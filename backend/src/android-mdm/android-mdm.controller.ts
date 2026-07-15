import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AndroidMdmService } from './android-mdm.service';
import { DevicesService } from '../devices/devices.service';
import { DeviceStatus } from '../schemas/device.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('mdm/android')
export class AndroidMdmController {
  constructor(
    private mdmService: AndroidMdmService,
    private devicesService: DevicesService
  ) {}

  @Post('lock/:deviceName')
  async lock(@Param('deviceName') deviceName: string) {
    const decodedName = decodeURIComponent(deviceName);
    const success = await this.mdmService.lockDevice(decodedName);
    // Even if credentials aren't set up, we still update status for sandbox simulator testing
    await this.devicesService.setStatusByAndroidEnterpriseName(decodedName, DeviceStatus.LOCKED);
    return { success };
  }

  @Post('unlock/:deviceName')
  async unlock(@Param('deviceName') deviceName: string) {
    const decodedName = decodeURIComponent(deviceName);
    const success = await this.mdmService.unlockDevice(decodedName);
    // Update status to rented (under contract)
    await this.devicesService.setStatusByAndroidEnterpriseName(decodedName, DeviceStatus.RENTED);
    return { success };
  }

  @Get('devices')
  getDevices() {
    return this.mdmService.listDevices();
  }

  @Get('status')
  getStatus() {
    return this.mdmService.getStatus();
  }

  @Post('signup-url')
  createSignupUrl() {
    return this.mdmService.createSignupUrl();
  }

  @Post('register-enterprise')
  registerEnterprise(@Body() body: { enterpriseToken: string; signupUrlName: string }) {
    return this.mdmService.registerEnterprise(body.enterpriseToken, body.signupUrlName);
  }

  @Post('enrollment-token')
  createEnrollmentToken(@Body() body: { displayName?: string }) {
    return this.mdmService.createEnrollmentToken(body?.displayName);
  }

  @Post('apply-policy')
  applyRentalPolicy() {
    return this.mdmService.ensureRentalPolicy();
  }

  @Post('device/:id/restrictions')
  async updateRestrictions(
    @Param('id') id: string,
    @Body() body: {
      cameraDisabled: boolean;
      usbFileTransferDisabled: boolean;
      installAppsDisabled: boolean;
      outgoingCallsDisabled: boolean;
    }
  ) {
    const device = await this.devicesService.findOne(id);
    
    // Save to database
    const updatedDevice = await this.devicesService.update(id, {
      restrictions: body
    } as any);

    // Sync to Google Android Management API if registered
    if (device.androidEnterpriseName) {
      await this.mdmService.applyCustomDevicePolicy(device.androidEnterpriseName, body);
    }
    return updatedDevice;
  }

  @Post('sync-import')
  syncAndImport() {
    return this.mdmService.syncAndImportDevices(this.devicesService);
  }
}