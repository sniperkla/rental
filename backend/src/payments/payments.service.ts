import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from '../schemas/payment.schema';
import { Rental, RentalDocument } from '../schemas/rental.schema';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class RecordPaymentDto {
  @IsString() paymentId: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreatePaymentDto {
  @IsString() rentalId: string;
  @IsString() customerId: string;
  @IsString() deviceId: string;
  @IsNumber() amount: number;
  @IsString() dueDate: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
  ) {}

  findAll(status?: string, customerId?: string) {
    const filter: any = {};
    if (status) filter.status = status;
    if (customerId) filter.customer = new Types.ObjectId(customerId);
    return this.paymentModel
      .find(filter)
      .populate('customer', 'name phone')
      .populate('device', 'name model platform')
      .populate('rental')
      .sort({ dueDate: 1 });
  }

  async findOverdue() {
    return this.paymentModel
      .find({ status: PaymentStatus.PENDING, dueDate: { $lt: new Date() } })
      .populate('customer', 'name phone email')
      .populate('device', 'name model platform serialNumber androidEnterpriseName appleMdmUdid applePushToken')
      .populate('rental');
  }

  async recordPayment(dto: RecordPaymentDto) {
    const payment = await this.paymentModel.findById(dto.paymentId);
    if (!payment) throw new NotFoundException('Payment not found');

    payment.status = PaymentStatus.PAID;
    payment.paidDate = new Date();
    if (dto.amount) payment.amount = dto.amount;
    if (dto.notes) payment.notes = dto.notes;
    await payment.save();

    // Create next payment record
    const rental = await this.rentalModel.findById(payment.rental);
    if (rental && rental.status === 'active') {
      const nextDue = new Date(payment.dueDate);
      if (rental.billingCycle === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
      else nextDue.setDate(nextDue.getDate() + 1);

      await this.paymentModel.create({
        rental: rental._id,
        customer: payment.customer,
        device: payment.device,
        amount: rental.rateAmount,
        dueDate: nextDue,
        status: PaymentStatus.PENDING,
        periodStart: payment.dueDate,
        periodEnd: nextDue,
      });
    }

    return payment;
  }

  async markOverdue(paymentIds: string[]) {
    return this.paymentModel.updateMany(
      { _id: { $in: paymentIds.map(id => new Types.ObjectId(id)) } },
      { status: PaymentStatus.OVERDUE },
    );
  }

  getStats() {
    return this.paymentModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' },
        },
      },
    ]);
  }
}
