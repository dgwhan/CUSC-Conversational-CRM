import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  async getOverview(
    @Headers('x-workspace-id') headerWsId?: string,
    @Query('workspaceId') queryWsId?: string,
    @Query('timeRange') timeRange?: any,
    @Query('channel') channel?: string,
    @Query('staffId') staffId?: string,
    @Query('courseId') courseId?: string,
  ) {
    const workspaceId = queryWsId || headerWsId;
    return this.reportsService.getOverview({
      workspaceId,
      timeRange,
      channel,
      staffId,
      courseId,
    });
  }
}
