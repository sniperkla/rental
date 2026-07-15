import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type MdmCommandDocument = MdmCommand & Document;

export enum MdmCommandType {
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
  INSTALL_APK = 'INSTALL_APK',
  UNINSTALL_APK = 'UNINSTALL_APK',
  WIPE = 'WIPE',
  REBOOT = 'REBOOT',
  UPDATE_CONFIG = 'UPDATE_CONFIG',
  PUSH_MESSAGE = 'PUSH_MESSAGE',
  UNENROLL = 'UNENROLL',   // Deactivates Device Admin so DPC can be uninstalled
}

export enum MdmCommandStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class MdmCommand {
  /** UUID string for stable cross-system reference (also used as APK download path key). */
  @Prop({ required: true, unique: true, default: () => uuidv4() })
  commandId: string;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  device: Types.ObjectId;

  @Prop({ required: true, enum: MdmCommandType })
  commandType: MdmCommandType;

  @Prop({ default: MdmCommandStatus.PENDING, enum: MdmCommandStatus, index: true })
  status: MdmCommandStatus;

  /**
   * Arbitrary JSON payload. Content depends on commandType:
   *   INSTALL_APK → { apkFileName: 'app.apk', packageName: 'com.example.app', silent: true }
   *   LOCK/UNLOCK → {}
   *   PUSH_MESSAGE → { title: '...', body: '...' }
   *   UPDATE_CONFIG → { pollingIntervalSeconds: 15 }
   */
  @Prop({ type: Object, default: {} })
  payload: Record<string, any>;

  /** Set when commandType === INSTALL_APK. Relative path under uploads/apks/. */
  @Prop()
  apkFileName: string;

  /** Human-readable result message reported back by DPC on callback. */
  @Prop()
  resultMessage: string;

  /** Commands auto-expire after this date (used to clean up stale PENDING commands). */
  @Prop({ default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) })
  expiresAt: Date;
}

export const MdmCommandSchema = SchemaFactory.createForClass(MdmCommand);
MdmCommandSchema.index({ device: 1, status: 1 });
MdmCommandSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup
