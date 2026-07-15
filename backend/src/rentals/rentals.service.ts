import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rental, RentalDocument, RentalStatus } from '../schemas/rental.schema';
import { Device, DeviceDocument, DeviceStatus } from '../schemas/device.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../schemas/payment.schema';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateRentalDto {
  @IsString() customerId: string;
  @IsString() deviceId: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsString() billingCycle: string;
  @IsNumber() rateAmount: number;
  @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class RentalsService {
  constructor(
    @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  async create(dto: CreateRentalDto) {
    const device = await this.deviceModel.findById(dto.deviceId);
    if (!device) throw new NotFoundException('Device not found');
    if (device.status !== DeviceStatus.AVAILABLE)
      throw new BadRequestException('Device is not available');

    const rental = await this.rentalModel.create({
      customer: new Types.ObjectId(dto.customerId),
      device: new Types.ObjectId(dto.deviceId),
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      billingCycle: dto.billingCycle,
      rateAmount: dto.rateAmount,
      notes: dto.notes,
    });

    // Mark device as rented
    await this.deviceModel.findByIdAndUpdate(dto.deviceId, { status: DeviceStatus.RENTED });

    // Create first payment record
    const dueDate = new Date(dto.startDate);
    if (dto.billingCycle === 'monthly') dueDate.setMonth(dueDate.getMonth() + 1);
    else dueDate.setDate(dueDate.getDate() + 1);

    await this.paymentModel.create({
      rental: rental._id,
      customer: new Types.ObjectId(dto.customerId),
      device: new Types.ObjectId(dto.deviceId),
      amount: dto.rateAmount,
      dueDate,
      status: PaymentStatus.PENDING,
      periodStart: new Date(dto.startDate),
      periodEnd: dueDate,
    });

    return rental.populate(['customer', 'device']);
  }

  findAll(status?: string) {
    const filter: any = {};
    if (status) filter.status = status;
    return this.rentalModel
      .find(filter)
      .populate('customer', 'name phone')
      .populate('device', 'name model platform serialNumber status')
      .sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    const doc = await this.rentalModel
      .findById(id)
      .populate('customer')
      .populate('device');
    if (!doc) throw new NotFoundException('Rental not found');
    return doc;
  }

  async complete(id: string) {
    const rental = await this.rentalModel.findByIdAndUpdate(
      id,
      { status: RentalStatus.COMPLETED },
      { new: true },
    );
    if (!rental) throw new NotFoundException('Rental not found');
    await this.deviceModel.findByIdAndUpdate(rental.device, { status: DeviceStatus.AVAILABLE });
    return rental;
  }
}
