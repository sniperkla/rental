import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RentalDocument = Rental & Document;

export enum RentalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class Rental {
  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true })
  device: Types.ObjectId;

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop({ required: true, enum: ['daily', 'monthly'] })
  billingCycle: string;

  @Prop({ required: true })
  rateAmount: number;

  @Prop({ default: RentalStatus.ACTIVE, enum: RentalStatus })
  status: RentalStatus;

  @Prop()
  notes: string;
}

export const RentalSchema = SchemaFactory.createForClass(Rental);
