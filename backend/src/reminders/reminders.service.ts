import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ReminderLog, ReminderLogDocument } from '../schemas/reminder-log.schema';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(ReminderLog.name) private logModel: Model<ReminderLogDocument>,
    private config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  async sendPaymentReminder(params: {
    customerId: string;
    deviceId: string;
    paymentId: string;
    customerName: string;
    customerEmail: string;
    deviceName: string;
    amount: number;
    dueDate: Date;
    daysOverdue: number;
  }): Promise<void> {
    const subject = params.daysOverdue > 0
      ? `⚠️ Payment Overdue – ${params.deviceName}`
      : `💰 Payment Reminder – ${params.deviceName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${params.daysOverdue > 0 ? '#ef4444' : '#8b5cf6'};">
          ${params.daysOverdue > 0 ? '⚠️ Payment Overdue' : '💰 Payment Reminder'}
        </h2>
        <p>Dear <strong>${params.customerName}</strong>,</p>
        <p>This is a ${params.daysOverdue > 0 ? `<strong>reminder that your payment is ${params.daysOverdue} day(s) overdue</strong>` : 'friendly reminder about your upcoming payment'}.</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Device</strong></td><td style="padding: 8px;">${params.deviceName}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Amount Due</strong></td><td style="padding: 8px;">฿${params.amount.toLocaleString()}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6;"><strong>Due Date</strong></td><td style="padding: 8px;">${params.dueDate.toLocaleDateString()}</td></tr>
        </table>
        ${params.daysOverdue >= 3 ? `<p style="color: #ef4444;"><strong>⚠️ Your device may be locked until payment is received.</strong></p>` : ''}
        <p>Please contact us immediately to avoid service interruption.</p>
      </div>
    `;

    let status = 'sent';
    let error = '';

    try {
      if (params.customerEmail) {
        await this.transporter.sendMail({
          from: this.config.get('SMTP_FROM'),
          to: params.customerEmail,
          subject,
          html,
        });
        this.logger.log(`📧 Email reminder sent to ${params.customerEmail}`);
      }
    } catch (err) {
      status = 'failed';
      error = err.message;
      this.logger.error(`Failed to send email reminder: ${err.message}`);
    }

    await this.logModel.create({
      customer: new Types.ObjectId(params.customerId),
      device: new Types.ObjectId(params.deviceId),
      payment: new Types.ObjectId(params.paymentId),
      channel: 'email',
      message: subject,
      status,
      error,
    });
  }

  findLogs(limit = 50) {
    return this.logModel
      .find()
      .populate('customer', 'name')
      .populate('device', 'name model')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async sendMdmOfflineAlert(params: {
    deviceName: string;
    serialNumber: string;
    lastSeen: Date;
    platform: string;
  }): Promise<void> {
    const adminEmail = this.config.get('SMTP_USER');
    if (!adminEmail) {
      this.logger.warn('No SMTP_USER configured, skipping MDM offline alert email');
      return;
    }

    const subject = `🚨 [RentControl ALERT] Device Offline > 24 Hours: ${params.deviceName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fca5a5; padding: 20px; border-radius: 12px;">
        <h2 style="color: #ef4444; margin-top: 0;">🚨 คำเตือน: อุปกรณ์ขาดการเชื่อมต่อเกิน 24 ชั่วโมง</h2>
        <p>เรียนผู้ดูแลระบบ,</p>
        <p>อุปกรณ์เช่าตัวนี้ขาดการส่งสัญญาณเชื่อมต่อกลับมายังเซิร์ฟเวอร์เกิน 24 ชั่วโมงแล้ว ซึ่งมีความเสี่ยงที่ผู้เช่าอาจทำการปิดเน็ต ถอดซิม หรือลบโปรไฟล์ควบคุม:</p>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; background: #fee2e2; font-weight: bold; width: 150px;">ชื่ออุปกรณ์</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${params.deviceName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #fee2e2; font-weight: bold;">UDID / Serial</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-family: monospace;">${params.serialNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #fee2e2; font-weight: bold;">แพลตฟอร์ม</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${params.platform.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #fee2e2; font-weight: bold;">เชื่อมต่อล่าสุดเมื่อ</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: #ef4444; font-weight: bold;">
              ${new Date(params.lastSeen).toLocaleString('th-TH')}
            </td>
          </tr>
        </table>
        <p style="font-size: 12.5px; color: #6b7280; line-height: 1.5;">
          💡 <strong>แนะนำให้ดำเนินการ:</strong><br>
          1. ตรวจสอบสถานะการเช่าของลูกค้าคนนี้ในระบบ<br>
          2. โทรติดต่อผู้เช่าเพื่อแจ้งเรื่องระบบขัดข้องหรือตรวจสอบสถานะการชำระเงิน<br>
          3. หากมีข้อสงสัยเรื่องความปลอดภัย ให้ดำเนินการส่งคำสั่งล็อกหน้าจอเครื่องทันที
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.config.get('SMTP_FROM'),
        to: adminEmail,
        subject,
        html,
      });
      this.logger.log(`📧 MDM Offline Alert email sent to admin: ${adminEmail}`);
    } catch (err: any) {
      this.logger.error(`Failed to send MDM offline alert email: ${err.message}`);
    }
  }
}
