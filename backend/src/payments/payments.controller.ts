import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { PaymentsService, RecordPaymentDto } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('customerId') customerId?: string) {
    return this.svc.findAll(status, customerId);
  }

  @Get('overdue')
  findOverdue() {
    return this.svc.findOverdue();
  }

  @Get('stats')
  getStats() {
    return this.svc.getStats();
  }

  @Post('record')
  record(@Body() dto: RecordPaymentDto) {
    return this.svc.recordPayment(dto);
  }
}
