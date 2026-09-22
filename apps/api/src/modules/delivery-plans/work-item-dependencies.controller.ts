import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DeliveryPlansService } from './delivery-plans.service.js';
import { CreateWorkItemLinkDto } from './dto/delivery-plans.dto.js';
import { AuthGuard } from '../../common/auth/auth.guard.js';

/**
 * Work-item dependency endpoints (Phase 17).
 *
 * Dependencies are project-scoped relationships between work items and feed
 * the Delivery Plan timeline. They live in the delivery-plans module because
 * the timeline is their primary consumer.
 *
 *   GET  /projects/:projectId/work-items/:workItemId/dependencies
 *   POST /projects/:projectId/work-items/:workItemId/dependencies
 *         { targetWorkItemId, linkType: 'DEPENDS_ON' | 'RELATED' }
 *   DELETE /projects/:projectId/work-items/:workItemId/dependencies/:targetWorkItemId
 */
@Controller('projects/:projectId/work-items')
@UseGuards(AuthGuard)
export class WorkItemDependenciesController {
  constructor(private readonly deliveryPlansService: DeliveryPlansService) {}

  private uid(req: any): string {
    return req.user.id;
  }

  @Get(':workItemId/dependencies')
  getDependencies(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.deliveryPlansService.getItemLinks(this.uid(req), projectId, workItemId);
  }

  @Post(':workItemId/dependencies')
  createDependency(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Body() dto: CreateWorkItemLinkDto,
  ) {
    return this.deliveryPlansService.createLink(
      this.uid(req),
      projectId,
      workItemId,
      dto,
    );
  }

  @Delete(':workItemId/dependencies/:targetWorkItemId')
  removeDependency(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Param('targetWorkItemId') targetWorkItemId: string,
  ) {
    return this.deliveryPlansService.removeLink(
      this.uid(req),
      projectId,
      workItemId,
      targetWorkItemId,
    );
  }
}