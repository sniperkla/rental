import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StandaloneMdmController, DpcController } from './standalone-mdm.controller';
import { StandaloneMdmService } from './standalone-mdm.service';
import { DpcApiKeyGuard } from './dpc-api-key.guard';
import { DpcWebSocketGateway } from './dpc-websocket.gateway';
import { MdmCommand, MdmCommandSchema } from '../schemas/mdm-command.schema';
import { StandaloneConfig, StandaloneConfigSchema } from '../schemas/standalone-config.schema';
import { AndroidMdmModule } from '../android-mdm/android-mdm.module';
import { AppleMdmModule } from '../apple-mdm/apple-mdm.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MdmCommand.name, schema: MdmCommandSchema },
      { name: StandaloneConfig.name, schema: StandaloneConfigSchema },
    ]),
    DevicesModule,   // Shares the same Mongoose Device model — avoids double-registration
    AndroidMdmModule,
    AppleMdmModule,
  ],
  controllers: [StandaloneMdmController, DpcController],
  providers: [StandaloneMdmService, DpcApiKeyGuard, DpcWebSocketGateway],
  exports: [StandaloneMdmService, DpcWebSocketGateway],
})
export class StandaloneMdmModule {}
