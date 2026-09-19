import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import { getNotificationsQuerySchema } from './dto/notifications.dto.js';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
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

  @Get('unread-count')
  async getUnreadCount(@Req() req: { user: { id: string } }) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Get('count')
  async getCountAlias(@Req() req: { user: { id: string } }) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
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

  @Post(':id/read')
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

  @Post('read-all')
  async markAllAsRead(@Req() req: { user: { id: string } }) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch('read-all')
  async markAllAsReadPatch(@Req() req: { user: { id: string } }) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
