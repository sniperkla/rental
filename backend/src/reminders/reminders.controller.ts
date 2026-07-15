import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private svc: RemindersService) {}

  @Get()
  findAll(@Query('limit') limit?: number) {
    const logLimit = limit ? Number(limit) : 50;
    return this.svc.findLogs(logLimit);
  }
}
