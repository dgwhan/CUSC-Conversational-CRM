import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/domain/types/auth-user.js';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard.js';
import { ReportsService, OverviewFilterDto } from './reports.service.js';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  async getOverview(
    @Req() request: { user: AuthUser },
    @Query('workspaceId') queryWsId?: string,
    @Query('timeRange') timeRange?: OverviewFilterDto['timeRange'],
    @Query('channel') channel?: string,
    @Query('staffId') staffId?: string,
    @Query('courseId') courseId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.reportsService.getOverview({
      workspaceId: queryWsId,
      currentStaffId: request.user.id,
      timeRange,
      channel,
      staffId,
      courseId: courseId || productId,
    });
  }
}
