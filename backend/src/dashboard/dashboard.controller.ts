import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private schedulerService: SchedulerService,
  ) {}

  @Get('stats')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Post('run-check')
  runCheck() {
    return this.schedulerService.runNow();
  }
}
