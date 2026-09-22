import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DeliveryPlansRepository, DeliveryPlanRow, PlanTeamRow } from './delivery-plans.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import {
  CreateDeliveryPlanSchema,
  UpdateDeliveryPlanSchema,
  SetPlanTeamsSchema,
  CreateWorkItemLinkSchema,
  TimelineQuerySchema,
} from './dto/delivery-plans.dto.js';

export interface PlanTeamView extends PlanTeamRow {
  isMember: boolean;
}

@Injectable()
export class DeliveryPlansService {
  constructor(
    private readonly repo: DeliveryPlansRepository,
    private readonly authz: AuthorizationService,
  ) {}

  // ─── Plans ─────────────────────────────────────────────────────────────────

  async findAll(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.DELIVERY_PLAN_VIEW);
    return this.repo.listByProject(projectId, userId);
  }

  async findOne(userId: string, projectId: string, planId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.DELIVERY_PLAN_VIEW);
    const plan = await this.repo.getById(projectId, planId);
    if (!plan) throw new NotFoundException('Delivery plan not found');
    return plan;
  }

  async create(userId: string, projectId: string, dto: unknown) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.DELIVERY_PLAN_CREATE);
    const parsed = CreateDeliveryPlanSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid plan payload');
    }
    const { name, description, teamIds } = parsed.data;

    const validTeamIds = await this.assertTeamsInProject(projectId, teamIds);

    await this.repo.create(projectId, userId, {
      name,
      description: description ?? null,
      teamIds: validTeamIds,
    });

    const created = await this.repo.listByProject(projectId, userId);
    return created[created.length - 1];
  }

  async update(userId: string, projectId: string, planId: string, dto: unknown) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.DELIVERY_PLAN_EDIT);
    const parsed = UpdateDeliveryPlanSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid plan payload');
    }
    await this.assertPlanInProject(projectId, planId);

    const { name, description, teamIds } = parsed.data;

    if (name !== undefined || description !== undefined) {
      const updated = await this.repo.update(planId, userId, {
        name,
        description,
      });
      if (!updated) throw new NotFoundException('Delivery plan not found');
    }

    if (teamIds !== undefined) {
      const validTeamIds = await this.assertTeamsInProject(projectId, teamIds);
      await this.repo.replaceTeams(planId, validTeamIds);
    }

    return this.repo.getById(projectId, planId);
  }

  async remove(userId: string, projectId: string, planId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.DELIVERY_PLAN_DELETE);
    await this.assertPlanInProject(projectId, planId);
    await this.repo.remove(planId);
    return { success: true };
  }

  // ─── Plan teams ─────────────────────────────────────────────────────────────

  async getPlanTeams(userId: string, projectId: string, planId: string): Promise<PlanTeamView[]> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.DELIVERY_PLAN_VIEW);
    await this.assertPlanInProject(projectId, planId);

    const [teams, userTeamIds] = await Promise.all([
      this.repo.getPlanTeams(planId),
      this.repo.getUserTeamIds(projectId, userId),
    ]);
    const memberSet = new Set(userTeamIds);
    return teams.map((t) => ({ ...t, isMember: memberSet.has(t.id) }));
  }

  async setPlanTeams(userId: string, projectId: string, planId: string, dto: unknown) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.DELIVERY_PLAN_EDIT);
    const parsed = SetPlanTeamsSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid team selection');
    }
    await this.assertPlanInProject(projectId, planId);
    const validTeamIds = await this.assertTeamsInProject(projectId, parsed.data.teamIds);
    const count = await this.repo.replaceTeams(planId, validTeamIds);
    return { planId, teamCount: count };
  }

  // ─── Timeline ───────────────────────────────────────────────────────────────

  async getTimeline(
    userId: string,
    projectId: string,
    planId: string,
    query: unknown,
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.DELIVERY_PLAN_VIEW);
    const plan = await this.assertPlanInProject(projectId, planId);

    const parsed = TimelineQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid timeline query');
    }

    const timeline = await this.repo.getTimeline({
      projectId,
      planId,
      userId,
      teamId: parsed.data.teamId,
      iterationId: parsed.data.iterationId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    return { plan, ...timeline };
  }

  // ─── Work item links (dependencies) ─────────────────────────────────────────

  async getItemLinks(userId: string, projectId: string, workItemId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_LINK_VIEW);
    await this.assertItemInProject(projectId, workItemId);
    const links = await this.repo.getItemLinks(projectId, workItemId);
    return {
      outgoing: links.filter((l) => l.sourceWorkItemId === workItemId),
      incoming: links.filter((l) => l.targetWorkItemId === workItemId),
    };
  }

  /**
   * Creates a dependency: `workItemId` depends on `targetWorkItemId`.
   * Guards: both items in the project, no self-dependency, no duplicates
   * (unique constraint), and no cycles in the DEPENDS_ON graph.
   */
  async createLink(userId: string, projectId: string, workItemId: string, dto: unknown) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_LINK_CREATE);
    const parsed = CreateWorkItemLinkSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid dependency payload');
    }
    const { targetWorkItemId, linkType } = parsed.data;

    if (workItemId === targetWorkItemId) {
      throw new BadRequestException('A work item cannot depend on itself');
    }

    await this.authz.requireWorkItemInProject(workItemId, projectId);
    await this.authz.requireWorkItemInProject(targetWorkItemId, projectId);

    if (linkType === 'DEPENDS_ON') {
      await this.assertNoCycle(projectId, workItemId, targetWorkItemId);
    }

    const link = await this.repo.createLink(
      projectId,
      workItemId,
      targetWorkItemId,
      linkType,
      userId,
    );
    return link;
  }

  async removeLink(userId: string, projectId: string, workItemId: string, targetWorkItemId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_LINK_DELETE);
    await this.authz.requireWorkItemInProject(workItemId, projectId);
    await this.authz.requireWorkItemInProject(targetWorkItemId, projectId);
    const removed = await this.repo.removeLink(projectId, workItemId, targetWorkItemId);
    if (!removed) throw new NotFoundException('Dependency not found');
    return { success: true };
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Cycle detection: we are about to add `source → target` ("source depends on
   * target"). A cycle is formed if `target` can already reach `source` by
   * following DEPENDS_ON edges. Traversal is bounded so a corrupt/huge graph
   * cannot hang the request.
   */
  private async assertNoCycle(projectId: string, source: string, target: string) {
    const edges = await this.repo.getDependencyEdges(projectId);
    const adjacency = new Map<string, string[]>();
    for (const e of edges) {
      const list = adjacency.get(e.sourceWorkItemId) ?? [];
      list.push(e.targetWorkItemId);
      adjacency.set(e.sourceWorkItemId, list);
    }

    // BFS from `target` following "depends on" outgoing edges.
    const queue = [target];
    const visited = new Set<string>([target]);
    let guard = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === source) {
        throw new BadRequestException(
          'This dependency would create a cycle in the delivery plan',
        );
      }
      if (++guard > 5000) break;
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }

  private async assertPlanInProject(projectId: string, planId: string): Promise<DeliveryPlanRow> {
    const plan = await this.repo.getById(projectId, planId);
    if (!plan) throw new NotFoundException('Delivery plan not found');
    return plan;
  }

  private async assertTeamsInProject(projectId: string, teamIds: string[]): Promise<string[]> {
    const valid = await this.repo.validateTeamsInProject(projectId, teamIds);
    if (valid.length !== new Set(teamIds).size) {
      throw new BadRequestException(
        'One or more teams do not belong to this project',
      );
    }
    return valid;
  }

  private async assertItemInProject(projectId: string, workItemId: string) {
    return this.authz.requireWorkItemInProject(workItemId, projectId);
  }
}