import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceDocument = Device & Document;

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

export enum DeviceStatus {
  PENDING = 'pending',
  AVAILABLE = 'available',
  RENTED = 'rented',
  LOCKED = 'locked',
  MAINTENANCE = 'maintenance',
  RETURNED = 'returned',
}

@Schema({ timestamps: true })
export class Device {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  brand: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true, unique: true })
  serialNumber: string;

  @Prop()
  imei: string;

  @Prop({ required: true, enum: DevicePlatform })
  platform: DevicePlatform;

  @Prop({ default: DeviceStatus.AVAILABLE, enum: DeviceStatus })
  status: DeviceStatus;

  @Prop()
  color: string;

  @Prop()
  storageGB: number;

  @Prop()
  dailyRate: number;

  @Prop()
  monthlyRate: number;

  // MDM enrollment identifiers
  @Prop()
  androidEnterpriseDeviceId: string;

  @Prop()
  androidEnterpriseName: string;

  @Prop()
  appleMdmUdid: string;

  @Prop()
  applePushToken: string;

  @Prop()
  notes: string;

  @Prop({
    type: {
      cameraDisabled: { type: Boolean, default: false },
      usbFileTransferDisabled: { type: Boolean, default: false },
      installAppsDisabled: { type: Boolean, default: false },
      outgoingCallsDisabled: { type: Boolean, default: false },
    },
    default: {
      cameraDisabled: false,
      usbFileTransferDisabled: false,
      installAppsDisabled: false,
      outgoingCallsDisabled: false,
    }
  })
  restrictions: {
    cameraDisabled: boolean;
    usbFileTransferDisabled: boolean;
    installAppsDisabled: boolean;
    outgoingCallsDisabled: boolean;
  };

  @Prop({ default: () => new Date() })
  lastSeen: Date;

  @Prop({ type: Boolean, default: false })
  screenTimeLocked: boolean;

  // ── Hybrid MDM: Management Track ─────────────────────────────────
  /** 'cloud' = iOS APNs / Android AMAPI. 'standalone' = Custom DPC polling (GMS-free). */
  @Prop({ default: 'cloud', enum: ['cloud', 'standalone'] })
  managementTrack: 'cloud' | 'standalone';

  /** Unique device identifier issued at standalone enrollment (UUID v4). */
  @Prop({ index: true, sparse: true })
  standaloneDeviceId: string;

  /** bcrypt-hashed API key for standalone DPC authentication. Never returned to client. */
  @Prop()
  standaloneApiKeyHash: string;

  /** How often (seconds) the DPC should call /api/dpc/poll. Default: 30s. */
  @Prop({ default: 30 })
  standalonePollingInterval: number;

  /** Active restriction keys for standalone devices (e.g. ['no_factory_reset', 'no_usb_file_transfer']). */
  @Prop({ type: [String], default: [] })
  standaloneRestrictions: string[];

  // ── Post-Scan Configuration ────────────────────────────────────
  /** Tags for categorization (e.g. 'VIP', 'High-value'). */
  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Security mode selected during configuration: 'device-admin' or 'device-owner'. */
  @Prop({ enum: ['device-admin', 'device-owner'] })
  securityMode: string;

  /** When the admin completed post-scan configuration. */
  @Prop()
  configuredAt: Date;

  /** SHA-256 hash of the offline recovery code (Device Owner only). */
  @Prop()
  recoveryCodeHash: string;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
