import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchedulerService } from './scheduler.service';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Device, DeviceSchema } from '../schemas/device.schema';
import { RemindersModule } from '../reminders/reminders.module';
import { AndroidMdmModule } from '../android-mdm/android-mdm.module';
import { AppleMdmModule } from '../apple-mdm/apple-mdm.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
    RemindersModule,
    AndroidMdmModule,
    AppleMdmModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
