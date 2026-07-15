import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReminderLogDocument = ReminderLog & Document;

@Schema({ timestamps: true })
export class ReminderLog {
  @Prop({ type: Types.ObjectId, ref: 'Customer' })
  customer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device' })
  device: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  payment: Types.ObjectId;

  @Prop({ required: true, enum: ['email', 'sms', 'system'] })
  channel: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: 'sent', enum: ['sent', 'failed'] })
  status: string;

  @Prop()
  error: string;
}

export const ReminderLogSchema = SchemaFactory.createForClass(ReminderLog);
