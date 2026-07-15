import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { DevicesService, CreateDeviceDto, UpdateDeviceDto, ConfigureDeviceDto } from './devices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('devices')
export class DevicesController {
  constructor(private svc: DevicesService) {}

  // Public endpoint for Mock Simulator to check status
  @Get('status/serial/:serialNumber')
  findBySerial(@Param('serialNumber') serialNumber: string) {
    return this.svc.findBySerialNumber(serialNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('platform') platform?: string, @Query('status') status?: string) {
    return this.svc.findAll(platform, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.svc.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.svc.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/configure')
  configure(@Param('id') id: string, @Body() dto: ConfigureDeviceDto) {
    return this.svc.configure(id, dto);
  }
}
