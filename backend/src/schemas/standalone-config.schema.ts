import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StandaloneConfigDocument = StandaloneConfig & Document;

/** Per-device DPC configuration stored and served to Standalone Android devices. */
@Schema({ timestamps: true })
export class StandaloneConfig {
  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, unique: true })
  device: Types.ObjectId;

  /** Seconds between DPC poll cycles. Overrides device-level default. */
  @Prop({ default: 30 })
  pollingIntervalSeconds: number;

  /**
   * Allowlist of Android package names the DPC should permit.
   * Empty array = no restriction (permissive mode).
   */
  @Prop({ type: [String], default: [] })
  allowedApps: string[];

  /**
   * Network policy enforced by the DPC. JSONB-style blob.
   * Example: { blockMobileData: true, blockWifi: false, vpnRequired: false }
   */
  @Prop({ type: Object, default: {} })
  networkPolicy: Record<string, any>;

  /** Timestamp of last successful poll (heartbeat). Updated on every /api/dpc/poll call. */
  @Prop({ default: null })
  lastHeartbeat: Date;

  /**
   * Latest telemetry snapshot sent by the DPC on poll.
   * Schema-less to support diverse hardware — stored as raw JSON.
   * Expected keys: battery_pct, storage_free_mb, installed_apps[], wifi_ssid, signal_strength
   */
  @Prop({ type: Object, default: {} })
  telemetry: Record<string, any>;

  /** Whether device is currently in kiosk (single-app) lockdown mode. */
  @Prop({ default: false })
  kioskModeEnabled: boolean;

  /** Package name of the single app shown in kiosk mode. */
  @Prop({ default: null })
  kioskApp: string;
}

export const StandaloneConfigSchema = SchemaFactory.createForClass(StandaloneConfig);
