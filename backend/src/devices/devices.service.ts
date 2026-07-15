import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument, DeviceStatus } from '../schemas/device.schema';
import { IsString, IsOptional, IsNumber, IsEnum, IsArray } from 'class-validator';
import { DevicePlatform } from '../schemas/device.schema';
import * as crypto from 'crypto';

export class CreateDeviceDto {
  @IsString() name: string;
  @IsString() brand: string;
  @IsString() deviceModel: string;
  @IsString() serialNumber: string;
  @IsOptional() @IsString() imei?: string;
  @IsEnum(DevicePlatform) platform: DevicePlatform;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsNumber() storageGB?: number;
  @IsOptional() @IsNumber() dailyRate?: number;
  @IsOptional() @IsNumber() monthlyRate?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() managementTrack?: 'cloud' | 'standalone';
}

export class UpdateDeviceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() imei?: string;
  @IsOptional() @IsEnum(DeviceStatus) status?: DeviceStatus;
  @IsOptional() @IsNumber() dailyRate?: number;
  @IsOptional() @IsNumber() monthlyRate?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() androidEnterpriseDeviceId?: string;
  @IsOptional() @IsString() androidEnterpriseName?: string;
  @IsOptional() @IsString() appleMdmUdid?: string;
  @IsOptional() @IsString() applePushToken?: string;
  @IsOptional() @IsString() managementTrack?: 'cloud' | 'standalone';
}

export class ConfigureDeviceDto {
  @IsEnum(['device-admin', 'device-owner'])
  securityMode: 'device-admin' | 'device-owner';

  @IsOptional() @IsArray()
  tags?: string[];

  @IsOptional() @IsNumber()
  dailyRate?: number;

  @IsOptional() @IsNumber()
  monthlyRate?: number;

  @IsOptional() @IsString()
  notes?: string;
}

@Injectable()
export class DevicesService {
  constructor(@InjectModel(Device.name) public model: Model<DeviceDocument>) {}

  async create(dto: CreateDeviceDto) {
    const { deviceModel, ...rest } = dto;
    const doc = new this.model({ ...rest, model: deviceModel });
    return doc.save();
  }

  findAll(platform?: string, status?: string) {
    const filter: any = {};
    if (platform) filter.platform = platform;
    if (status) filter.status = status;
    return this.model.find(filter).sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Device not found');
    return doc;
  }

  async update(id: string, dto: UpdateDeviceDto) {
    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true });
    if (!doc) throw new NotFoundException('Device not found');
    return doc;
  }

  async setStatus(id: string, status: DeviceStatus) {
    return this.model.findByIdAndUpdate(id, { status }, { new: true });
  }

  async setStatusByAndroidEnterpriseName(androidEnterpriseName: string, status: DeviceStatus) {
    return this.model.findOneAndUpdate({ androidEnterpriseName }, { status }, { new: true });
  }

  async setStatusByAppleUdid(appleMdmUdid: string, status: DeviceStatus) {
    return this.model.findOneAndUpdate({ appleMdmUdid }, { status }, { new: true });
  }

  async findOneByAppleUdid(appleMdmUdid: string) {
    return this.model.findOne({ appleMdmUdid });
  }

  async updateLastSeenByAppleUdid(appleMdmUdid: string) {
    return this.model.findOneAndUpdate({ appleMdmUdid }, { lastSeen: new Date() }, { new: true });
  }

  async updateLastSeenByAndroidEnterpriseName(androidEnterpriseName: string) {
    return this.model.findOneAndUpdate({ androidEnterpriseName }, { lastSeen: new Date() }, { new: true });
  }

  async findBySerialNumber(serialNumber: string) {
    const doc = await this.model.findOne({ serialNumber });
    if (!doc) throw new NotFoundException('Device not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Device not found');
    return { deleted: true };
  }

  async configure(id: string, dto: ConfigureDeviceDto) {
    const device = await this.model.findById(id);
    if (!device) throw new NotFoundException('Device not found');
    if (device.status !== DeviceStatus.PENDING) {
      throw new BadRequestException('Device is not in pending configuration state');
    }

    const update: any = {
      securityMode: dto.securityMode,
      status: dto.securityMode === 'device-owner' ? DeviceStatus.PENDING : DeviceStatus.AVAILABLE,
      configuredAt: new Date(),
    };
    if (dto.tags !== undefined) update.tags = dto.tags;
    if (dto.dailyRate !== undefined) update.dailyRate = dto.dailyRate;
    if (dto.monthlyRate !== undefined) update.monthlyRate = dto.monthlyRate;
    if (dto.notes !== undefined) update.notes = dto.notes;

    // Generate recovery code for Device Owner mode
    let recoveryCode: string | null = null;
    if (dto.securityMode === 'device-owner') {
      recoveryCode = this.generateRecoveryCode();
      update.recoveryCodeHash = crypto
        .createHash('sha256')
        .update(recoveryCode)
        .digest('hex');
    }

    const doc = await this.model.findByIdAndUpdate(id, update, { new: true });

    return {
      device: doc,
      securityMode: dto.securityMode,
      requiresAdb: dto.securityMode === 'device-owner',
      adbCommand: dto.securityMode === 'device-owner'
        ? 'adb shell dpm set-device-owner com.rental.dpc/.DpcAdminReceiver'
        : null,
      recoveryCode, // shown once to admin, never stored in plain text
    };
  }

  async resetStatus(id: string) {
    const device = await this.model.findById(id);
    if (!device) throw new NotFoundException('Device not found');

    // Clear standalone enrollment data and reset status
    const update: any = {
      status: DeviceStatus.AVAILABLE,
      $unset: {
        standaloneDeviceId: 1,
        standaloneApiKeyHash: 1,
        standalonePollingInterval: 1,
        securityMode: 1,
        configuredAt: 1,
        recoveryCodeHash: 1,
      }
    };

    const doc = await this.model.findByIdAndUpdate(id, update, { new: true });
    return { message: 'Device status reset to available', device: doc };
  }

  private generateRecoveryCode(): string {
    // 8-char alphanumeric (uppercase), ~47 bits of entropy
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    const bytes = crypto.randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }
}
