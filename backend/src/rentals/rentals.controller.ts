import { Controller, Get, Post, Param, Body, Query, Put, UseGuards } from '@nestjs/common';
import { RentalsService, CreateRentalDto } from './rentals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('rentals')
export class RentalsController {
  constructor(private svc: RentalsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.svc.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRentalDto) {
    return this.svc.create(dto);
  }

  @Put(':id/complete')
  complete(@Param('id') id: string) {
    return this.svc.complete(id);
  }
}
