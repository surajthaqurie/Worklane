import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import {
  getNotificationsQuerySchema,
  updateNotificationPreferencesSchema,
  UpdateNotificationPreferencesDto,
} from './dto/notifications.dto.js';

@Controller()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  async getNotifications(
    @Req() req: { user: { id: string } },
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedQuery = getNotificationsQuerySchema.safeParse({
      unreadOnly,
      limit,
      cursor,
    });

    if (!parsedQuery.success) {
      throw new BadRequestException(
        parsedQuery.error.issues.map((i) => i.message).join('; '),
      );
    }

    return this.notificationsService.getNotifications(
      req.user.id,
      parsedQuery.data,
    );
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Req() req: { user: { id: string } }) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Get('notifications/count')
  async getCountAlias(@Req() req: { user: { id: string } }) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch('notifications/:id/read')
  async markAsRead(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    const updated = await this.notificationsService.markAsRead(id, req.user.id);
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
    return updated;
  }

  @Post('notifications/:id/read')
  async markAsReadPost(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    const updated = await this.notificationsService.markAsRead(id, req.user.id);
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
    return updated;
  }

  @Post('notifications/read-all')
  async markAllAsRead(@Req() req: { user: { id: string } }) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch('notifications/read-all')
  async markAllAsReadPatch(@Req() req: { user: { id: string } }) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  // ─── User Notification Preferences (Phase 14) ───────────────────────────

  @Get('users/me/notification-preferences')
  async getUserPreferences(@Req() req: { user: { id: string } }) {
    return this.notificationsService.getUserPreferences(req.user.id);
  }

  @Patch('users/me/notification-preferences')
  async updateUserPreferences(
    @Req() req: { user: { id: string } },
    @Body() body: unknown,
  ) {
    const parsed = updateNotificationPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    }
    return this.notificationsService.updateUserPreferences(req.user.id, parsed.data);
  }

  // ─── Followers Management Endpoints (Phase 14) ───────────────────────────

  @Post('projects/:projectId/work-items/:id/follow')
  async followWorkItem(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('id') workItemId: string,
  ) {
    return this.notificationsService.followWorkItem(req.user.id, projectId, workItemId);
  }

  @Delete('projects/:projectId/work-items/:id/follow')
  async unfollowWorkItem(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('id') workItemId: string,
  ) {
    return this.notificationsService.unfollowWorkItem(req.user.id, projectId, workItemId);
  }

  @Get('projects/:projectId/work-items/:id/followers')
  async getWorkItemFollowers(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('id') workItemId: string,
  ) {
    return this.notificationsService.getWorkItemFollowers(req.user.id, projectId, workItemId);
  }

  @Get('projects/:projectId/work-items/:id/follow-status')
  async getFollowStatus(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('id') workItemId: string,
  ) {
    return this.notificationsService.getFollowStatus(req.user.id, projectId, workItemId);
  }
}
