import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentDocument, PaymentStatus } from '../schemas/payment.schema';
import { Device, DeviceDocument, DeviceStatus, DevicePlatform } from '../schemas/device.schema';
import { RemindersService } from '../reminders/reminders.service';
import { AndroidMdmService } from '../android-mdm/android-mdm.service';
import { AppleMdmService } from '../apple-mdm/apple-mdm.service';
import { StandaloneMdmService } from '../standalone-mdm/standalone-mdm.service';
import { MdmCommandType } from '../schemas/mdm-command.schema';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    private remindersService: RemindersService,
    private androidMdm: AndroidMdmService,
    private appleMdm: AppleMdmService,
    private standaloneMdm: StandaloneMdmService,
    private config: ConfigService,
  ) {}

  /**
   * Daily payment check — runs every day at 08:00
   *
   * Logic:
   * - For each pending payment past due date:
   *   1. < grace period → send reminder email
   *   2. >= grace period → lock device via MDM
   * - For each paid payment with locked device → unlock device
   */
  @Cron('0 8 * * *') // Every day at 08:00
  async runDailyPaymentCheck() {
    this.logger.log('⏰ Running daily payment check...');
    const gracePeriodDays = this.config.get<number>('PAYMENT_GRACE_PERIOD_DAYS', 3);
    const now = new Date();

    // ── 1. Find all pending/overdue payments ──────────────────────────────
    const pendingPayments = await this.paymentModel
      .find({ status: { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] }, dueDate: { $lt: now } })
      .populate('customer', 'name email phone')
      .populate('device');

    this.logger.log(`Found ${pendingPayments.length} overdue payment(s)`);

    for (const payment of pendingPayments) {
      const customer = payment.customer as any;
      const device = payment.device as any;
      const daysOverdue = Math.floor((now.getTime() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24));

      // Mark as overdue in DB
      if (payment.status !== PaymentStatus.OVERDUE) {
        await this.paymentModel.findByIdAndUpdate(payment._id, { status: PaymentStatus.OVERDUE });
      }

      if (daysOverdue >= gracePeriodDays) {
        // ── Lock device ──────────────────────────────────────────────────
        this.logger.log(`🔒 Locking device ${device.name} (${daysOverdue} days overdue)`);

        if (device.platform === 'android' && device.androidEnterpriseName) {
          const locked = await this.androidMdm.lockDevice(device.androidEnterpriseName);
          if (locked) await this.deviceModel.findByIdAndUpdate(device._id, { status: DeviceStatus.LOCKED });
        } else if (
          device.platform === 'android' &&
          device.managementTrack === 'standalone' &&
          device.standaloneDeviceId
        ) {
          await this.standaloneMdm.queueCommand({
            deviceId: device._id.toString(),
            commandType: MdmCommandType.LOCK,
          });
          await this.deviceModel.findByIdAndUpdate(device._id, { status: DeviceStatus.LOCKED });
        } else if (device.platform === 'ios' && device.appleMdmUdid) {
          const locked = await this.appleMdm.lockDevice(device.appleMdmUdid, device.applePushToken);
          if (locked) await this.deviceModel.findByIdAndUpdate(device._id, { status: DeviceStatus.LOCKED });
        }

        // Still send a "device locked" warning notification
        await this.remindersService.sendPaymentReminder({
          customerId: customer._id.toString(),
          deviceId: device._id.toString(),
          paymentId: payment._id.toString(),
          customerName: customer.name,
          customerEmail: customer.email,
          deviceName: device.name,
          amount: payment.amount,
          dueDate: payment.dueDate,
          daysOverdue,
        });
      } else {
        // ── Send reminder only ────────────────────────────────────────────
        this.logger.log(`📧 Sending reminder for ${device.name} (${daysOverdue} days overdue)`);
        await this.remindersService.sendPaymentReminder({
          customerId: customer._id.toString(),
          deviceId: device._id.toString(),
          paymentId: payment._id.toString(),
          customerName: customer.name,
          customerEmail: customer.email,
          deviceName: device.name,
          amount: payment.amount,
          dueDate: payment.dueDate,
          daysOverdue,
        });
      }
    }

    // ── 2. Find paid payments where device is still locked → unlock ────────
    const paidWithLockedDevice = await this.paymentModel
      .find({ status: PaymentStatus.PAID })
      .populate({ path: 'device', match: { status: DeviceStatus.LOCKED } });

    for (const payment of paidWithLockedDevice) {
      const device = payment.device as any;
      if (!device) continue;

      this.logger.log(`🔓 Unlocking device ${device.name} (payment received)`);

      if (device.platform === 'android' && device.androidEnterpriseName) {
        const unlocked = await this.androidMdm.unlockDevice(device.androidEnterpriseName);
        if (unlocked) await this.deviceModel.findByIdAndUpdate(device._id, { status: DeviceStatus.RENTED });
      } else if (
        device.platform === 'android' &&
        device.managementTrack === 'standalone' &&
        device.standaloneDeviceId
      ) {
        await this.standaloneMdm.queueCommand({
          deviceId: device._id.toString(),
          commandType: MdmCommandType.UNLOCK,
        });
        await this.deviceModel.findByIdAndUpdate(device._id, { status: DeviceStatus.RENTED });
      } else if (device.platform === 'ios' && device.appleMdmUdid) {
        const unlocked = await this.appleMdm.unlockDevice(device.appleMdmUdid, device.applePushToken);
        if (unlocked) await this.deviceModel.findByIdAndUpdate(device._id, { status: DeviceStatus.RENTED });
      }
    }

    this.logger.log('✅ Daily payment check complete');
  }

  /** Manual trigger for testing */
  async runNow() {
    return this.runDailyPaymentCheck();
  }

  /**
   * Automatic background sync — runs every 10 minutes
   * Fetches newly enrolled Android devices from Google and registers them
   */
  @Cron('*/10 * * * *')
  async runAutoSyncDevices() {
    this.logger.log('⏰ Running background Android EMM device sync...');
    try {
      const mockDevicesService = { model: this.deviceModel };
      const res = await this.androidMdm.syncAndImportDevices(mockDevicesService);
      if (res.importedCount > 0) {
        this.logger.log(`📥 Auto-sync: Imported ${res.importedCount} new device(s)`);
      }
    } catch (err: any) {
      this.logger.error('Failed to auto-sync devices from Google:', err.message);
    }
  }

  /**
   * Daily MDM Offline Check — runs every day at 09:00
   * Scans for rented/locked iOS and Android devices that haven't checked in for > 24 hours
   * and emails an alert to the administrator.
   */
  @Cron('0 9 * * *')
  async runDailyMdmOfflineCheck() {
    this.logger.log('⏰ Running daily MDM offline check...');
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    try {
      const offlineDevices = await this.deviceModel.find({
        status: { $in: [DeviceStatus.RENTED, DeviceStatus.LOCKED] },
        lastSeen: { $lt: cutoff }
      });

      this.logger.log(`Found ${offlineDevices.length} offline device(s)`);

      for (const dev of offlineDevices) {
        await this.remindersService.sendMdmOfflineAlert({
          deviceName: dev.name,
          serialNumber: dev.platform === DevicePlatform.IOS 
            ? (dev.appleMdmUdid || dev.serialNumber) 
            : (dev.androidEnterpriseName || dev.serialNumber),
          lastSeen: dev.lastSeen,
          platform: dev.platform,
        });
      }
    } catch (err: any) {
      this.logger.error('Failed to run daily MDM offline check:', err.message);
    }
  }
}
