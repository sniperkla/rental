import { Module } from '@nestjs/common';
import { AndroidMdmService } from './android-mdm.service';
import { AndroidMdmController } from './android-mdm.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  providers: [AndroidMdmService],
  controllers: [AndroidMdmController],
  exports: [AndroidMdmService],
})
export class AndroidMdmModule {}
