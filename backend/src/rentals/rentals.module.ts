import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RentalsService } from './rentals.service';
import { RentalsController } from './rentals.controller';
import { Rental, RentalSchema } from '../schemas/rental.schema';
import { Device, DeviceSchema } from '../schemas/device.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rental.name, schema: RentalSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  providers: [RentalsService],
  controllers: [RentalsController],
  exports: [RentalsService],
})
export class RentalsModule {}
