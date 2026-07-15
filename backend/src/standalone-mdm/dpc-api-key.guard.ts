import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StandaloneMdmService } from './standalone-mdm.service';

export const DPC_DEVICE_KEY = 'dpcDevice';

/**
 * Guard for all DPC-facing endpoints (/api/dpc/*).
 * Validates X-DPC-Device-Id and X-DPC-Api-Key headers against the hashed key stored in MongoDB.
 * No JWT required — this is intentionally separate from the admin JWT auth chain.
 * On success, attaches the authenticated DeviceDocument to request[DPC_DEVICE_KEY].
 */
@Injectable()
export class DpcApiKeyGuard implements CanActivate {
  constructor(private standaloneMdmService: StandaloneMdmService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const deviceId = request.headers['x-dpc-device-id'] as string;
    const apiKey = request.headers['x-dpc-api-key'] as string;

    if (!deviceId || !apiKey) {
      throw new UnauthorizedException('Missing required headers: X-DPC-Device-Id, X-DPC-Api-Key');
    }

    // Will throw UnauthorizedException internally if invalid
    const device = await this.standaloneMdmService.authenticateDpc(deviceId, apiKey);

    // Attach device to request for use in controllers
    (request as any)[DPC_DEVICE_KEY] = device;
    return true;
  }
}
