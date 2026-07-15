import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Device, DeviceSchema } from '../schemas/device.schema';
import { Rental, RentalSchema } from '../schemas/rental.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { ReminderLog, ReminderLogSchema } from '../schemas/reminder-log.schema';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: Rental.name, schema: RentalSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: ReminderLog.name, schema: ReminderLogSchema },
    ]),
    SchedulerModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
