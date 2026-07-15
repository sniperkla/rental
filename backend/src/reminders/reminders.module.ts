import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { ReminderLog, ReminderLogSchema } from '../schemas/reminder-log.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: ReminderLog.name, schema: ReminderLogSchema }])],
  controllers: [RemindersController],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
