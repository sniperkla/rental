import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { DevicesModule } from './devices/devices.module';
import { RentalsModule } from './rentals/rentals.module';
import { PaymentsModule } from './payments/payments.module';
import { RemindersModule } from './reminders/reminders.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AndroidMdmModule } from './android-mdm/android-mdm.module';
import { AppleMdmModule } from './apple-mdm/apple-mdm.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StandaloneMdmModule } from './standalone-mdm/standalone-mdm.module';
import { AdbBridgeModule } from './adb-bridge/adb-bridge.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    CustomersModule,
    DevicesModule,
    RentalsModule,
    PaymentsModule,
    RemindersModule,
    SchedulerModule,
    AndroidMdmModule,
    AppleMdmModule,
    DashboardModule,
    StandaloneMdmModule, // Hybrid MDM: Standalone/Offline Android (GMS-free) + Unified Admin API
    AdbBridgeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
