import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { NotificationType, NotificationSeverity } from '@prisma/client';

@Controller('v1/workspaces/:wsId/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Param('wsId') workspaceId: string,
    @Query('isRead') isRead?: string,
    @Query('type') type?: NotificationType,
    @Query('severity') severity?: NotificationSeverity,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isReadBool =
      isRead === 'true' ? true : isRead === 'false' ? false : undefined;

    return this.notificationService.findAll(workspaceId, {
      isRead: isReadBool,
      type,
      severity,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('wsId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.notificationService.markAsRead(workspaceId, id);
  }

  @Post('read-all')
  async markAllAsRead(@Param('wsId') workspaceId: string) {
    return this.notificationService.markAllAsRead(workspaceId);
  }

  @Delete(':id')
  async deleteNotification(
    @Param('wsId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.notificationService.delete(workspaceId, id);
  }
}
