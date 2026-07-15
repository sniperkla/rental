import { Module } from '@nestjs/common';
import { AppleMdmService } from './apple-mdm.service';
import { AppleMdmController } from './apple-mdm.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  providers: [AppleMdmService],
  controllers: [AppleMdmController],
  exports: [AppleMdmService],
})
export class AppleMdmModule {}
