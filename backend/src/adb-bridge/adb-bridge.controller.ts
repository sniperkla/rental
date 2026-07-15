import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { AdbBridgeService } from './adb-bridge.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('adb-bridge')
@UseGuards(JwtAuthGuard)
export class AdbBridgeController {
  constructor(private readonly service: AdbBridgeService) {}

  @Get('status')
  getStatus() {
    return {
      connected: this.service.isBridgeConnected(),
    };
  }

  @Post('activate-device-owner/:deviceId')
  activateDeviceOwner(@Param('deviceId') deviceId: string) {
    return this.service.activateDeviceOwner(deviceId);
  }

  @Post('deactivate-device-owner/:deviceId')
  deactivateDeviceOwner(@Param('deviceId') deviceId: string) {
    return this.service.deactivateDeviceOwner(deviceId);
  }
}
