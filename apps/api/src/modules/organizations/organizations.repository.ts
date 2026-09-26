import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { db } from '../../db/kysely.js';
import type { OrganizationRole } from './dto/organizations.dto.js';

@Injectable()
export class OrganizationsRepository {
  async getOrganizationsForUser(userId: string) {
    const rows = await db
      .selectFrom('organizations as o')
      .leftJoin('organization_members as om', (join) =>
        join.onRef('om.organization_id', '=', 'o.id').on('om.user_id', '=', userId),
      )
      .where((eb) =>
        eb.or([
          eb('om.user_id', '=', userId),
          eb('o.created_by', '=', userId),
        ]),
      )
      .select([
        'o.id',
        'o.name',
        'o.description',
        'o.created_by',
        'o.created_at',
        'o.updated_at',
        'om.role as member_role',
        sql<number>`(
          SELECT COUNT(*)::int
          FROM organization_members
          WHERE organization_id = o.id
        )`.as('member_count'),
        sql<number>`(
          SELECT COUNT(*)::int
          FROM projects
          WHERE organization_id = o.id AND archived = false
        )`.as('project_count'),
      ])
      .orderBy('o.name', 'asc')
      .execute();

    if (rows.length === 0) {
      const user = await db
        .selectFrom('users')
        .where('id', '=', userId)
        .select(['name'])
        .executeTakeFirst();

      if (user) {
        const orgName = user.name?.trim() ? `${user.name}'s Organization` : 'Default Organization';
        const createdOrg = await this.createOrganization({
          name: orgName,
          created_by: userId,
        });

        return [
          {
            id: createdOrg.id,
            name: createdOrg.name,
            description: createdOrg.description,
            role: 'OWNER' as OrganizationRole,
            memberCount: 1,
            projectCount: 0,
            createdAt: createdOrg.created_at ? new Date(createdOrg.created_at).toISOString() : new Date().toISOString(),
            updatedAt: createdOrg.updated_at ? new Date(createdOrg.updated_at).toISOString() : undefined,
          },
        ];
      }
    }

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      role: (r.member_role ?? (r.created_by === userId ? 'OWNER' : 'MEMBER')) as OrganizationRole,
      memberCount: Number(r.member_count ?? 1),
      projectCount: Number(r.project_count ?? 0),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    }));
  }

  async getOrganizationById(id: string) {
    const row = await db
      .selectFrom('organizations as o')
      .where('o.id', '=', id)
      .select([
        'o.id',
        'o.name',
        'o.description',
        'o.created_by',
        'o.created_at',
        'o.updated_at',
        sql<number>`(
          SELECT COUNT(*)::int
          FROM organization_members
          WHERE organization_id = o.id
        )`.as('member_count'),
        sql<number>`(
          SELECT COUNT(*)::int
          FROM projects
          WHERE organization_id = o.id AND archived = false
        )`.as('project_count'),
      ])
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      memberCount: Number(row.member_count ?? 1),
      projectCount: Number(row.project_count ?? 0),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  async createOrganization(data: { name: string; description?: string; created_by: string }) {
    return await db.transaction().execute(async (trx) => {
      const org = await trx
        .insertInto('organizations')
        .values({
          name: data.name,
          description: data.description || null,
          created_by: data.created_by,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('organization_members')
        .values({
          organization_id: org.id,
          user_id: data.created_by,
          role: 'OWNER',
        })
        .onConflict((oc) =>
          oc.columns(['organization_id', 'user_id']).doUpdateSet({ role: 'OWNER' }),
        )
        .execute();

      return org;
    });
  }

  async updateOrganization(id: string, data: { name?: string; description?: string }) {
    const updateValues: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description || null;

    return await db
      .updateTable('organizations')
      .set(updateValues)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  }

  async getMembers(organizationId: string) {
    const rows = await db
      .selectFrom('organization_members as om')
      .innerJoin('users as u', 'u.id', 'om.user_id')
      .where('om.organization_id', '=', organizationId)
      .select([
        'om.id',
        'om.organization_id',
        'om.user_id',
        'om.role',
        'om.created_at',
        'u.name',
        'u.email',
        'u.avatar_url',
      ])
      .orderBy('om.created_at', 'asc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      userId: r.user_id,
      role: r.role as OrganizationRole,
      name: r.name,
      email: r.email,
      avatarUrl: r.avatar_url,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  async getMember(organizationId: string, userId: string) {
    const row = await db
      .selectFrom('organization_members as om')
      .innerJoin('users as u', 'u.id', 'om.user_id')
      .where('om.organization_id', '=', organizationId)
      .where('om.user_id', '=', userId)
      .select([
        'om.id',
        'om.organization_id',
        'om.user_id',
        'om.role',
        'om.created_at',
        'u.name',
        'u.email',
        'u.avatar_url',
      ])
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role as OrganizationRole,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  async addMember(organizationId: string, userId: string, role: OrganizationRole) {
    const inserted = await db
      .insertInto('organization_members')
      .values({
        organization_id: organizationId,
        user_id: userId,
        role: role,
      })
      .onConflict((oc) =>
        oc.columns(['organization_id', 'user_id']).doUpdateSet({ role }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return inserted;
  }

  async updateMemberRole(organizationId: string, userId: string, role: OrganizationRole) {
    return await db
      .updateTable('organization_members')
      .set({ role })
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
  }

  async removeMember(organizationId: string, userId: string) {
    return await db
      .deleteFrom('organization_members')
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', userId)
      .execute();
  }

  async countOwners(organizationId: string): Promise<number> {
    const result = await db
      .selectFrom('organization_members')
      .where('organization_id', '=', organizationId)
      .where('role', '=', 'OWNER')
      .select(sql<number>`COUNT(*)::int`.as('count'))
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  async getProjectsForOrganization(organizationId: string, userId: string) {
    return await db
      .selectFrom('projects as p')
      .leftJoin('project_members as pm', 'pm.project_id', 'p.id')
      .where('p.organization_id', '=', organizationId)
      .where((eb) =>
        eb.or([
          eb('p.created_by', '=', userId),
          eb('pm.user_id', '=', userId),
        ]),
      )
      .selectAll('p')
      .distinct()
      .orderBy('p.name', 'asc')
      .execute();
  }

  async findUserByEmailOrId(query: string) {
    return await db
      .selectFrom('users')
      .where((eb) =>
        eb.or([
          eb('id', '=', query),
          eb('email', '=', query.toLowerCase().trim()),
        ]),
      )
      .select(['id', 'email', 'name', 'avatar_url'])
      .executeTakeFirst();
  }
}
