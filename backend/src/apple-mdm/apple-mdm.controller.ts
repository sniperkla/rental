import { Controller, Post, Get, Param, Body, UseGuards, Req, Res } from '@nestjs/common';
import { AppleMdmService } from './apple-mdm.service';
import { DevicesService } from '../devices/devices.service';
import { DeviceStatus } from '../schemas/device.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class MdmActionDto {
  udid: string;
  pushToken: string;
}

@Controller('mdm/apple')
export class AppleMdmController {
  constructor(
    private mdmService: AppleMdmService,
    private devicesService: DevicesService
  ) {}

  // Serves the OTA Mobileconfig Profile dynamically (no JWT needed since it's downloaded on the phone Safari)
  @Get('enroll-profile')
  getEnrollProfile(@Req() req: any, @Res() res: any) {
    const host = req.headers.host;
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const serverUrl = `${protocol}://${host}`;
    const topic = this.mdmService['mdmTopic'] || 'com.rentcontrol.mdm.fake';

    const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadDisplayName</key>
    <string>RentControl MDM Enrollment</string>
    <key>PayloadIdentifier</key>
    <string>com.rentcontrol.mdm.enrollment</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>3C9666E3-8E5A-4364-839A-7EDAD07A48E4</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.mdm</string>
            <key>PayloadIdentifier</key>
            <string>com.rentcontrol.mdm.service</string>
            <key>PayloadUUID</key>
            <string>8E8F5C9C-4B9F-4912-9F1F-C78C9EFE8F2A</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>ServerURL</key>
            <string>${serverUrl}/mdm/apple/commands/%UDID%</string>
            <key>CheckInURL</key>
            <string>${serverUrl}/mdm/apple/checkin</string>
            <key>Topic</key>
            <string>${topic}</string>
            <key>AccessRights</key>
            <integer>8191</integer>
            <key>SignMessage</key>
            <true/>
            <key>CheckOutWhenRemoved</key>
            <true/>
        </dict>
    </array>
</dict>
</plist>`;

    res.setHeader('Content-Type', 'application/x-apple-aspen-config');
    res.setHeader('Content-Disposition', 'attachment; filename="rentcontrol.mobileconfig"');
    return res.send(plistXml);
  }

  // MDM checkin endpoint (called by Apple devices, no JWT)
  @Post('checkin')
  async checkin(@Body() body: { udid: string; pushToken: string; topic?: string; deviceName?: string }) {
    const { udid, pushToken, deviceName } = body;
    
    this.mdmService.handleCheckin(udid, pushToken);

    // Auto-register: check if device already exists in DB
    try {
      const existing = await this.devicesService.model.findOne({ appleMdmUdid: udid });

      if (!existing) {
        // New device — auto-create with available status
        await new this.devicesService.model({
          name: deviceName || `iPhone (${udid.slice(-6)})`,
          brand: 'Apple',
          model: deviceName || 'iPhone/iPad',
          serialNumber: udid,
          platform: 'ios',
          status: 'available',
          appleMdmUdid: udid,
          applePushToken: pushToken,
          notes: 'Auto-registered via iOS MDM CheckIn',
          lastSeen: new Date(),
        }).save();
      } else {
        // Existing device — just update push token and lastSeen
        await this.devicesService.model.findByIdAndUpdate(existing._id, {
          applePushToken: pushToken,
          lastSeen: new Date(),
        });
      }
    } catch (err: any) {
      // Non-fatal — device registration failed but checkin acknowledged
      console.error('[iOS MDM] Auto-register failed:', err.message);
    }

    return { status: 'acknowledged' };
  }

  // MDM command queue endpoint (called by Apple devices, no JWT)
  @Get('commands/:udid')
  async getCommands(@Param('udid') udid: string) {
    // Update lastSeen timestamp on command pull
    try {
      await this.devicesService.updateLastSeenByAppleUdid(udid);
    } catch (err: any) {
      console.error('[iOS MDM] Failed to update lastSeen on command pull:', err.message);
    }

    const cmd = this.mdmService.getPendingCommand(udid);
    return cmd || { RequestType: 'Idle' };
  }

  // Admin-triggered manual lock (activates Screen Time Lockdown)
  @UseGuards(JwtAuthGuard)
  @Post('lock')
  async lock(@Body() dto: MdmActionDto) {
    const success = await this.mdmService.lockDevice(dto.udid, dto.pushToken);
    const device = await this.devicesService.findOneByAppleUdid(dto.udid);
    if (device) {
      await this.devicesService.update(device._id.toString(), {
        status: DeviceStatus.LOCKED,
        screenTimeLocked: true,
      } as any);
    }
    return { success };
  }

  // Admin-triggered manual unlock (deactivates Screen Time Lockdown)
  @UseGuards(JwtAuthGuard)
  @Post('unlock')
  async unlock(@Body() dto: MdmActionDto) {
    const success = await this.mdmService.unlockDevice(dto.udid, dto.pushToken);
    const device = await this.devicesService.findOneByAppleUdid(dto.udid);
    if (device) {
      await this.devicesService.update(device._id.toString(), {
        status: DeviceStatus.RENTED,
        screenTimeLocked: false,
      } as any);
    }
    return { success };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus() {
    return this.mdmService.getStatus();
  }

  @UseGuards(JwtAuthGuard)
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
    const updatedDevice = await this.devicesService.update(id, { restrictions: body } as any);

    if (device.appleMdmUdid && device.applePushToken) {
      await this.mdmService.applyDeviceRestrictions(device.appleMdmUdid, device.applePushToken, body);
    }
    return updatedDevice;
  }

  /**
   * Enable Screen Time Lockdown on an iOS device.
   * Pushes a maximum-restriction profile that blocks Settings access, Safari,
   * app installation, and camera — preventing the customer from removing the MDM profile.
   * Works even on non-supervised (OTA-enrolled) devices.
   */
  @UseGuards(JwtAuthGuard)
  @Post('device/:id/screen-time-lockdown')
  async enableScreenTimeLockdown(@Param('id') id: string) {
    const device = await this.devicesService.findOne(id);
    if (!device.appleMdmUdid || !device.applePushToken) {
      return { success: false, message: 'Device has no Apple MDM UDID or Push Token' };
    }
    const success = await this.mdmService.enableScreenTimeLockdown(
      device.appleMdmUdid,
      device.applePushToken,
    );
    // Mark in DB
    await this.devicesService.update(id, { screenTimeLocked: true } as any);
    return { success };
  }

  /**
   * Disable Screen Time Lockdown — remove the lockdown profile.
   * Call this after customer pays or when releasing the device.
   */
  @UseGuards(JwtAuthGuard)
  @Post('device/:id/screen-time-unlock')
  async disableScreenTimeLockdown(@Param('id') id: string) {
    const device = await this.devicesService.findOne(id);
    if (!device.appleMdmUdid || !device.applePushToken) {
      return { success: false, message: 'Device has no Apple MDM UDID or Push Token' };
    }
    const success = await this.mdmService.disableScreenTimeLockdown(
      device.appleMdmUdid,
      device.applePushToken,
    );
    await this.devicesService.update(id, { screenTimeLocked: false } as any);
    return { success };
  }
}
