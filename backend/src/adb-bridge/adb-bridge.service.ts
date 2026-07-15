import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AdbBridgeGateway } from './adb-bridge.gateway';
import { DevicesService } from '../devices/devices.service';

@Injectable()
export class AdbBridgeService {
  private readonly logger = new Logger(AdbBridgeService.name);

  constructor(
    private readonly gateway: AdbBridgeGateway,
    private readonly devicesService: DevicesService,
  ) {}

  isBridgeConnected(): boolean {
    return this.gateway.isBridgeConnected();
  }

  /**
   * Activate Device Owner on a specific device via the ADB bridge.
   */
  async activateDeviceOwner(deviceId: string) {
    const device = await this.devicesService.findOne(deviceId);
    if (!device) throw new BadRequestException('Device not found');

    if (!this.gateway.isBridgeConnected()) {
      throw new BadRequestException(
        'ADB Bridge not connected. Please start the bridge on your admin computer:\n' +
        'cd adb-bridge && npm start'
      );
    }

    const command = `adb shell dpm set-device-owner com.rental.dpc/.DpcAdminReceiver`;
    this.logger.log(`Activating Device Owner for device: ${device.name} (${deviceId})`);

    try {
      const result = await this.gateway.executeAdbCommand(deviceId, command);

      if (result.success) {
        await this.devicesService.model.findByIdAndUpdate(deviceId, { status: 'available' });
        this.logger.log(`✅ Device Owner activated for ${device.name}`);
        return {
          success: true,
          message: 'Device Owner activated successfully',
          output: result.output,
        };
      } else {
        this.logger.warn(`❌ Device Owner activation failed: ${result.error}`);
        return {
          success: false,
          message: 'Device Owner activation failed',
          error: result.error,
          hints: this.getErrorHints(result.error),
        };
      }
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Remove Device Owner from a device via the ADB bridge.
   */
  async deactivateDeviceOwner(deviceId: string) {
    const device = await this.devicesService.findOne(deviceId);
    if (!device) throw new BadRequestException('Device not found');

    if (!this.gateway.isBridgeConnected()) {
      throw new BadRequestException(
        'ADB Bridge not connected. Start the bridge on your admin computer.'
      );
    }

    const command = `adb shell dpm remove-active-admin com.rental.dpc/.DpcAdminReceiver`;
    this.logger.log(`Deactivating Device Owner for device: ${device.name} (${deviceId})`);

    try {
      const result = await this.gateway.executeAdbCommand(deviceId, command);

      if (result.success) {
        // Update device to Device Admin mode
        await this.devicesService.update(deviceId, { securityMode: 'device-admin' } as any);
        this.logger.log(`✅ Device Owner removed for ${device.name}`);
        return {
          success: true,
          message: 'Device Owner removed. Device is now Device Admin mode.',
          output: result.output,
        };
      } else {
        return {
          success: false,
          message: 'Failed to remove Device Owner',
          error: result.error,
        };
      }
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  private getErrorHints(error: string): string[] {
    const hints: string[] = [];
    if (error.includes('not allowed') || error.includes('Not allowed')) {
      hints.push('Device has a Google account signed in — factory reset required');
      hints.push('Go to Settings → System → Reset → Erase all data');
    }
    if (error.includes('accounts') || error.includes('has accounts')) {
      hints.push('Remove Google account first: Settings → Accounts → Remove');
    }
    if (error.includes('no devices') || error.includes('device not found')) {
      hints.push('Check USB connection and USB Debugging is enabled');
      hints.push('Run "adb devices" to verify device is connected');
    }
    if (error.includes('already set') || error.includes('already a device owner')) {
      hints.push('Device Owner is already set for another app');
      hints.push('Factory reset required to change device owner');
    }
    return hints;
  }
}
