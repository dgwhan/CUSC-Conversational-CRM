import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ReportsService, OverviewFilterDto } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  async getOverview(
    @Headers('x-workspace-id') headerWsId?: string,
    @Headers('x-owner-id') headerOwnerId?: string,
    @Headers('x-staff-id') headerStaffId?: string,
    @Query('workspaceId') queryWsId?: string,
    @Query('timeRange') timeRange?: OverviewFilterDto['timeRange'],
    @Query('channel') channel?: string,
    @Query('staffId') staffId?: string,
    @Query('courseId') courseId?: string,
    @Query('productId') productId?: string,
  ) {
    const workspaceId = queryWsId || headerWsId;
    return this.reportsService.getOverview({
      workspaceId,
      ownerId: headerOwnerId,
      currentStaffId: headerStaffId,
      timeRange,
      channel,
      staffId,
      courseId: courseId || productId,
    });
  }
}
