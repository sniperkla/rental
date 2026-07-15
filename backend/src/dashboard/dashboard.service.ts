import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { Rental, RentalDocument, RentalStatus } from '../schemas/rental.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../schemas/payment.schema';
import { ReminderLog, ReminderLogDocument } from '../schemas/reminder-log.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(ReminderLog.name) private reminderLogModel: Model<ReminderLogDocument>,
  ) {}

  async getStats() {
    const [
      totalCustomers,
      totalDevices,
      devicesByStatus,
      devicesByPlatform,
      activeRentals,
      paymentStats,
      recentPayments,
      recentReminders,
      monthlyRevenue,
    ] = await Promise.all([
      this.customerModel.countDocuments(),
      this.deviceModel.countDocuments(),
      this.deviceModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.deviceModel.aggregate([{ $group: { _id: '$platform', count: { $sum: 1 } } }]),
      this.rentalModel.countDocuments({ status: RentalStatus.ACTIVE }),
      this.paymentModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }]),
      this.paymentModel
        .find()
        .populate('customer', 'name')
        .populate('device', 'name platform')
        .sort({ createdAt: -1 })
        .limit(10),
      this.reminderLogModel
        .find()
        .populate('customer', 'name')
        .populate('device', 'name')
        .sort({ createdAt: -1 })
        .limit(5),
      this.paymentModel.aggregate([
        { $match: { status: PaymentStatus.PAID } },
        {
          $group: {
            _id: { year: { $year: '$paidDate' }, month: { $month: '$paidDate' } },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 },
      ]),
    ]);

    const paymentMap: Record<string, { count: number; total: number }> = {};
    for (const p of paymentStats) paymentMap[p._id] = { count: p.count, total: p.total };

    return {
      summary: {
        totalCustomers,
        totalDevices,
        activeRentals,
        pendingPayments: paymentMap['pending']?.count || 0,
        overduePayments: paymentMap['overdue']?.count || 0,
        paidThisMonth: paymentMap['paid']?.total || 0,
      },
      devicesByStatus,
      devicesByPlatform,
      paymentStats,
      recentPayments,
      recentReminders,
      monthlyRevenue,
    };
  }
}
