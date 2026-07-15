import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  idNumber: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  email: string;

  @Prop()
  address: string;

  @Prop({ default: 'active', enum: ['active', 'suspended', 'blacklisted'] })
  status: string;

  @Prop()
  notes: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
