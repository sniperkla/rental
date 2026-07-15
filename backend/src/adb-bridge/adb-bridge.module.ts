import { Module } from '@nestjs/common';
import { AdbBridgeGateway } from './adb-bridge.gateway';
import { AdbBridgeService } from './adb-bridge.service';
import { AdbBridgeController } from './adb-bridge.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  controllers: [AdbBridgeController],
  providers: [AdbBridgeGateway, AdbBridgeService],
  exports: [AdbBridgeService],
})
export class AdbBridgeModule {}
