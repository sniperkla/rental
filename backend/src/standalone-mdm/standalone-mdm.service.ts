import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DeviceDocument, DeviceStatus, DevicePlatform } from '../schemas/device.schema';
import { MdmCommand, MdmCommandDocument, MdmCommandStatus, MdmCommandType } from '../schemas/mdm-command.schema';
import { StandaloneConfig, StandaloneConfigDocument } from '../schemas/standalone-config.schema';
import { AndroidMdmService } from '../android-mdm/android-mdm.service';
import { AppleMdmService } from '../apple-mdm/apple-mdm.service';
import { DevicesService } from '../devices/devices.service';
import { AdminWebSocketGateway } from '../admin-websocket.gateway';

import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsEnum, IsObject } from 'class-validator';

// ─── DTOs ──────────────────────────────────────────────────────────────────

export class EnrollStandaloneDto {
  @IsString()
  deviceId: string;        // MongoDB ObjectId of existing device record

  @IsOptional()
  @IsNumber()
  pollingIntervalSeconds?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedApps?: string[];

  @IsOptional()
  @IsString()
  securityMode?: 'device-admin' | 'device-owner';
}

export class QueueCommandDto {
  @IsString()
  deviceId: string;

  @IsEnum(MdmCommandType)
  commandType: MdmCommandType;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @IsOptional()
  @IsString()
  apkFileName?: string;
}

export class DpcPollDto {
  /** Telemetry snapshot from the device. */
  @IsOptional()
  @IsObject()
  telemetry?: {
    battery_pct?: number;
    storage_free_mb?: number;
    installed_apps?: string[];
    wifi_ssid?: string;
    signal_strength?: number;
    [key: string]: any;
  };
}

export class DpcCallbackDto {
  @IsString()
  commandId: string;

  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}

export class SelfRegisterDto {
  @IsString()
  registrationToken: string;

  @IsString()
  androidId: string;

  @IsString()
  model: string;

  @IsString()
  brand: string;

  @IsString()
  manufacturer: string;

  @IsString()
  androidVersion: string;

  @IsOptional()
  @IsString()
  imei?: string;

  @IsOptional()
  @IsString()
  securityMode?: 'device-admin' | 'device-owner';
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class StandaloneMdmService {
  private readonly logger = new Logger(StandaloneMdmService.name);
  
  // Track active long-poll request resolvers by device ID (string)
  private activePolls = new Map<string, (commands: any[]) => void>();

  constructor(
    private devicesService: DevicesService,
    @InjectModel(MdmCommand.name) private commandModel: Model<MdmCommandDocument>,
    @InjectModel(StandaloneConfig.name) private configModel: Model<StandaloneConfigDocument>,
    private androidMdmService: AndroidMdmService,
    private appleMdmService: AppleMdmService,
    private adminGateway: AdminWebSocketGateway,
  ) {}

  // ── Admin: Enrollment ───────────────────────────────────────────────────

  /**
   * Generate a secure enrollment payload for a GMS-free Standalone Android device.
   * Returns a JSON object suitable for encoding into a QR code by the admin dashboard.
   * The raw API key is returned ONCE here — subsequent requests require the hashed version.
   */
  async enrollStandaloneDevice(dto: EnrollStandaloneDto) {
    const device = await this.devicesService.model.findById(dto.deviceId);
    if (!device) throw new NotFoundException('Device not found');

    // Generate a stable UUID device ID and a single-use 32-byte raw API key
    const standaloneDeviceId = uuidv4();
    const rawApiKey = crypto.randomBytes(32).toString('hex');
    const hashedApiKey = await bcrypt.hash(rawApiKey, 12);

    const pollingInterval = dto.pollingIntervalSeconds ?? 30;

    // Persist enrollment credentials on the device record
    await this.devicesService.model.findByIdAndUpdate(dto.deviceId, {
      managementTrack: 'standalone',
      standaloneDeviceId,
      standaloneApiKeyHash: hashedApiKey,
      standalonePollingInterval: pollingInterval,
    });

    // Create or update DPC config record
    await this.configModel.findOneAndUpdate(
      { device: new Types.ObjectId(dto.deviceId) },
      {
        device: new Types.ObjectId(dto.deviceId),
        pollingIntervalSeconds: pollingInterval,
        allowedApps: dto.allowedApps ?? [],
        telemetry: {},
        lastHeartbeat: null,
      },
      { upsert: true, new: true },
    );

    this.logger.log(`✅ Enrolled standalone device: ${device.name} (${standaloneDeviceId}) mode=${dto.securityMode ?? 'device-admin'}`);

    return {
      message: 'Standalone enrollment successful. Save the API key — it will not be shown again.',
      enrollmentQr: {
        // DPC App expects these:
        backendUrl: process.env.BACKEND_URL ?? `http://localhost:${process.env.BACKEND_PORT ?? 3001}`,
        standaloneDeviceId: standaloneDeviceId,
        rawApiKey: rawApiKey,
        pollingIntervalSeconds: pollingInterval,
        securityMode: dto.securityMode ?? 'device-admin',
        // Backend legacy keys:
        serverUrl: process.env.BACKEND_URL ?? `http://localhost:${process.env.BACKEND_PORT ?? 3001}`,
        deviceId: standaloneDeviceId,
        apiKey: rawApiKey,
        apiPollPath: '/api/dpc/poll',
        apiCallbackPath: '/api/dpc/command-callback',
      },
    };
  }

  /**
   * Self-register a device that scanned the generic registration QR token.
   * - Validates the shared registration token.
   * - Creates a new device record if none exists for this androidId.
   * - If the device already exists, refreshes the API key but KEEPS the same standaloneDeviceId
   *   so any existing dashboard sessions don't need to be updated.
   * - Returns DPC credentials (deviceId + rawApiKey) for the app to store.
   */
  async selfRegisterDevice(dto: SelfRegisterDto) {
    // 1. Validate registration token
    const serverToken = process.env.DPC_REGISTRATION_TOKEN || 'default_secret_token_123';
    if (dto.registrationToken !== serverToken) {
      this.logger.warn(`❌ Invalid registration token attempt from androidId=${dto.androidId}`);
      throw new UnauthorizedException('Invalid registration token');
    }

    const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${process.env.BACKEND_PORT ?? 3001}`;
    const pollingInterval = 30;

    // 2. Generate fresh credentials
    const rawApiKey    = crypto.randomBytes(32).toString('hex');
    const hashedApiKey = await bcrypt.hash(rawApiKey, 12);

    // 3. Find existing device by androidId (stored as serialNumber)
    let device = await this.devicesService.model.findOne({ serialNumber: dto.androidId });

    if (!device) {
      // --- New device: create a fresh record ---
      const standaloneDeviceId = uuidv4();
      this.logger.log(`📲 New self-registration: ${dto.brand} ${dto.model} (androidId=${dto.androidId})`);

      device = await this.devicesService.model.create({
        name:                     `${dto.brand} ${dto.model}`.trim(),
        brand:                    dto.brand,
        model:                    dto.model,
        serialNumber:             dto.androidId,
        imei:                     dto.imei || '',
        platform:                 DevicePlatform.ANDROID,
        status:                   DeviceStatus.PENDING,
        managementTrack:          'standalone',
        standaloneDeviceId,
        standaloneApiKeyHash:     hashedApiKey,
        standalonePollingInterval: pollingInterval,
        dailyRate:                0,
        monthlyRate:              0,
      } as any);

      if (!device) throw new NotFoundException('Failed to create device record');

    } else {
      // --- Existing device: generate NEW standaloneDeviceId (fresh start after factory reset) ---
      const newStandaloneDeviceId = uuidv4();
      this.logger.log(`🔄 Re-registration: ${device.name} (androidId=${dto.androidId}) — new deviceId=${newStandaloneDeviceId}`);

      device = await this.devicesService.model.findByIdAndUpdate(
        device._id,
        {
          managementTrack:      'standalone',
          standaloneDeviceId:   newStandaloneDeviceId,
          standaloneApiKeyHash: hashedApiKey,
          standalonePollingInterval: pollingInterval,
          brand:  dto.brand,
          model:  dto.model,
          imei:   dto.imei || (device as any).imei || '',
          status: DeviceStatus.PENDING,
          $unset: { configuredAt: 1, securityMode: 1 },
        } as any,
        { new: true },
      );
    }

    if (!device) throw new NotFoundException('Device record missing after upsert');

    const standaloneDeviceId = (device as any).standaloneDeviceId;

    // 4. Upsert DPC config
    await this.configModel.findOneAndUpdate(
      { device: device._id },
      {
        device:                 device._id,
        pollingIntervalSeconds: pollingInterval,
        allowedApps:            [],
        telemetry:              {},
        lastHeartbeat:          null,
      },
      { upsert: true, new: true },
    );

    this.logger.log(`✅ Self-register complete: ${device.name} standaloneDeviceId=${standaloneDeviceId}`);

    // 5. Return credentials for the DPC app to store
    return {
      message: 'Self-registration successful.',
      enrollmentQr: {
        backendUrl,
        standaloneDeviceId,
        rawApiKey,
        pollingIntervalSeconds: pollingInterval,
      },
    };
  }


  // ── Admin: Unified Command Queue ─────────────────────────────────────────

  /**
   * Queue or immediately dispatch a management command.
   * Routes based on managementTrack:
   *   cloud      → dispatches immediately via AMAPI / APNs
   *   standalone → saves as PENDING; DPC picks up on next poll
   */
  async queueCommand(dto: QueueCommandDto) {
    const device = await this.devicesService.model.findById(dto.deviceId);
    if (!device) throw new NotFoundException('Device not found');

    // Save command record regardless of track
    const command = await this.commandModel.create({
      commandId: uuidv4(),
      device: new Types.ObjectId(dto.deviceId),
      commandType: dto.commandType,
      payload: dto.payload ?? {},
      apkFileName: dto.apkFileName,
      status: MdmCommandStatus.PENDING,
      // Always set explicitly so the $gt filter in processPoll never misses it
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

     // Persist restriction state for standalone devices
     if (device.managementTrack === 'standalone' && (dto.commandType === MdmCommandType.RESTRICT || dto.commandType === MdmCommandType.UNRESTRICT)) {
       const keys: string[] = dto.payload?.restrictions ?? [];
       if (dto.commandType === MdmCommandType.RESTRICT) {
         const merged = [...new Set([...(device.standaloneRestrictions ?? []), ...keys])];
         await this.devicesService.model.findByIdAndUpdate(dto.deviceId, { standaloneRestrictions: merged });
       } else {
         const remaining = (device.standaloneRestrictions ?? []).filter(k => !keys.includes(k));
         await this.devicesService.model.findByIdAndUpdate(dto.deviceId, { standaloneRestrictions: remaining });
       }
     }

     if (device.managementTrack === 'standalone') {
       this.logger.log(`⏳ Command ${dto.commandType} queued (PENDING) for standalone device: ${device.name}`);
       
       // Trigger long-poll resolver instantly if the device has a request open
       const resolver = this.activePolls.get(device._id.toString());
       if (resolver) {
         this.activePolls.delete(device._id.toString());
         this.getPendingCommands(device._id).then(cmds => resolver(cmds));
         this.logger.log(`⚡ Command pushed instantly via long-poll to ${device.name}`);
       }

       return {
         commandId: command.commandId,
         status: MdmCommandStatus.PENDING,
         track: 'standalone',
         message: 'Command queued. Standalone DPC will pick it up on next poll.',
       };
     }

    // Cloud track: dispatch immediately
    let cloudSuccess = false;
    try {
      if (device.platform === 'android' && device.androidEnterpriseName) {
        if (dto.commandType === MdmCommandType.LOCK) {
          cloudSuccess = await this.androidMdmService.lockDevice(device.androidEnterpriseName);
        } else if (dto.commandType === MdmCommandType.UNLOCK) {
          cloudSuccess = await this.androidMdmService.unlockDevice(device.androidEnterpriseName);
        }
      } else if (device.platform === 'ios' && device.appleMdmUdid && device.applePushToken) {
        if (dto.commandType === MdmCommandType.LOCK) {
          cloudSuccess = await this.appleMdmService.lockDevice(device.appleMdmUdid, device.applePushToken);
        } else if (dto.commandType === MdmCommandType.UNLOCK) {
          cloudSuccess = await this.appleMdmService.unlockDevice(device.appleMdmUdid, device.applePushToken);
        }
      }

      const newStatus = cloudSuccess ? MdmCommandStatus.SENT : MdmCommandStatus.FAILED;
      await this.commandModel.findByIdAndUpdate(command._id, { status: newStatus });

      return {
        commandId: command.commandId,
        status: newStatus,
        track: 'cloud',
        message: cloudSuccess ? 'Command dispatched via cloud MDM.' : 'Cloud dispatch failed — check MDM credentials.',
      };
    } catch (err) {
      await this.commandModel.findByIdAndUpdate(command._id, {
        status: MdmCommandStatus.FAILED,
        resultMessage: err.message,
      });
      throw err;
    }
  }

  // ── Admin: Unified Device List ──────────────────────────────────────────

  async getAllDevices() {
    const devices = await this.devicesService.model
      .find({})
      .select('-standaloneApiKeyHash') // Never expose hashed key
      .sort({ createdAt: -1 })
      .lean();

    return devices.map(d => ({
      ...d,
      managementTrack: d.managementTrack ?? 'cloud',
      enrolled: d.managementTrack === 'standalone'
        ? !!d.standaloneDeviceId
        : !!(d.androidEnterpriseName || d.appleMdmUdid),
    }));
  }

  // ── DPC: API Key Authentication ─────────────────────────────────────────

  /**
   * Validates the X-DPC-Device-Id + X-DPC-Api-Key headers.
   * Returns the device document if valid, throws UnauthorizedException otherwise.
   */
  async authenticateDpc(standaloneDeviceId: string, rawApiKey: string): Promise<DeviceDocument> {
    if (!standaloneDeviceId || !rawApiKey) {
      throw new UnauthorizedException('Missing DPC authentication headers');
    }

    const device = await this.devicesService.model.findOne({ standaloneDeviceId, managementTrack: 'standalone' });
    if (!device || !device.standaloneApiKeyHash) {
      throw new UnauthorizedException('Invalid DPC device ID');
    }

    const valid = await bcrypt.compare(rawApiKey, device.standaloneApiKeyHash);
    if (!valid) throw new UnauthorizedException('Invalid DPC API key');

    return device;
  }

  /**
   * Validates device credentials for WebSocket connection.
   * Returns the device document if valid, null otherwise.
   * Used by DpcWebSocketGateway — does not throw on failure.
   */
  async validateDevice(standaloneDeviceId: string, rawApiKey: string): Promise<DeviceDocument | null> {
    if (!standaloneDeviceId || !rawApiKey) return null;

    const device = await this.devicesService.model.findOne({ standaloneDeviceId, managementTrack: 'standalone' });
    if (!device || !device.standaloneApiKeyHash) return null;

    const valid = await bcrypt.compare(rawApiKey, device.standaloneApiKeyHash);
    return valid ? device : null;
  }

  // ── DPC: Poll (Heartbeat + Command Fetch) ──────────────────────────────

  private async getPendingCommands(deviceId: Types.ObjectId) {
    const now = new Date();
    return this.commandModel
      .find({
        device: deviceId,
        status: MdmCommandStatus.PENDING,
        $or: [
          { expiresAt: null },
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: now } },
        ],
      })
      .sort({ createdAt: 1 })
      .lean();
  }

  /**
   * Called by the Standalone DPC app on each poll cycle.
   * 1. Updates lastHeartbeat and stores telemetry snapshot.
   * 2. Returns all PENDING commands for the device.
   * 3. Marks returned commands as SENT to prevent double-dispatch.
   */
  async processPoll(device: DeviceDocument, dto: DpcPollDto) {
    const now = new Date();

    // Update device lastSeen
    await this.devicesService.model.findByIdAndUpdate(device._id, { lastSeen: now });

    // Update config: heartbeat + telemetry
    await this.configModel.findOneAndUpdate(
      { device: device._id },
      {
        lastHeartbeat: now,
        ...(dto.telemetry ? { telemetry: dto.telemetry } : {}),
      },
    );

    // If telemetry confirms Device Owner is active, promote status to AVAILABLE
    if (
      dto.telemetry &&
      (dto.telemetry as any).is_device_owner === true &&
      device.securityMode === 'device-owner' &&
      device.status === DeviceStatus.PENDING
    ) {
      this.logger.log(`🛡️ Device Owner verified via telemetry for device: ${device.name}. Promoting status to AVAILABLE.`);
      const updated = await this.devicesService.model.findByIdAndUpdate(
        device._id,
        { status: DeviceStatus.AVAILABLE },
        { new: true },
      );
      this.adminGateway.broadcastDeviceUpdate(updated);
    }

    // Fetch pending commands (skip if device is not yet configured)
    let pendingCommands: any[] = [];
    if ((device as any).configuredAt) {
      pendingCommands = await this.getPendingCommands(device._id);
    }

    // Long-polling: if no commands are currently pending, hold the request open for up to 20s
    if (pendingCommands.length === 0) {
      pendingCommands = await new Promise<any[]>((resolve) => {
        const timeout = setTimeout(() => {
          this.activePolls.delete(device._id.toString());
          resolve([]);
        }, 20000); // Wait up to 20 seconds

        this.activePolls.set(device._id.toString(), (cmds) => {
          clearTimeout(timeout);
          resolve(cmds);
        });
      });
    }

    if (pendingCommands.length > 0) {
      // Mark them SENT atomically
      const ids = pendingCommands.map(c => c._id);
      await this.commandModel.updateMany({ _id: { $in: ids } }, { status: MdmCommandStatus.SENT });
      this.logger.log(`📡 DPC poll: dispatching ${pendingCommands.length} command(s) to ${device.name}`);
    }

    const config = await this.configModel.findOne({ device: device._id }).lean();
    const recoveryCodeHash = (device as any).recoveryCodeHash as string | undefined;

    return {
      deviceName: device.name,
      serverTime: now.toISOString(),
      pollingIntervalSeconds: config?.pollingIntervalSeconds ?? device.standalonePollingInterval ?? 30,
      recoveryCodeHash: recoveryCodeHash || null,
      commands: pendingCommands.map(c => ({
        commandId: c.commandId,
        commandType: c.commandType,
        payload: c.payload,
        apkDownloadUrl: c.commandType === MdmCommandType.INSTALL_APK && c.apkFileName
          ? `/api/dpc/apk/${c.commandId}`
          : null,
      })),
    };
  }

  // ── DPC: Command Result Callback ────────────────────────────────────────

  /**
   * Called by the DPC after it has executed a command.
   * Updates the command status to COMPLETED or FAILED.
   */
  async processCallback(device: DeviceDocument, dto: DpcCallbackDto) {
    const command = await this.commandModel.findOne({
      commandId: dto.commandId,
      device: device._id,
    });

    if (!command) throw new NotFoundException(`Command ${dto.commandId} not found for this device`);

    const newStatus = dto.success ? MdmCommandStatus.COMPLETED : MdmCommandStatus.FAILED;
    await this.commandModel.findByIdAndUpdate(command._id, {
      status: newStatus,
      resultMessage: dto.message ?? (dto.success ? 'Success' : 'Failed'),
    });

    // Reflect lock/unlock/unenroll status on the device record
    if (command.commandType === MdmCommandType.LOCK && dto.success) {
      const updated = await this.devicesService.model.findByIdAndUpdate(device._id, { status: DeviceStatus.LOCKED }, { new: true });
      this.adminGateway.broadcastDeviceUpdate(updated);
    } else if (command.commandType === MdmCommandType.UNLOCK && dto.success) {
      const updated = await this.devicesService.model.findByIdAndUpdate(device._id, { status: DeviceStatus.RENTED }, { new: true });
      this.adminGateway.broadcastDeviceUpdate(updated);
    } else if (command.commandType === MdmCommandType.UNENROLL && dto.success) {
      // Device has been unenrolled — clear standalone enrollment data
      const updated = await this.devicesService.model.findByIdAndUpdate(device._id, {
        $unset: { standaloneDeviceId: 1, standaloneApiKeyHash: 1, standalonePollingInterval: 1 },
        standaloneRestrictions: [],
        status: DeviceStatus.AVAILABLE,
        managementTrack: 'cloud',
      }, { new: true });
      this.adminGateway.broadcastDeviceUpdate(updated);
      this.logger.log(`🔓 Device ${device.name} unenrolled — standalone data cleared`);
    }

    this.logger.log(`📬 DPC callback: ${dto.commandId} → ${newStatus} (device: ${device.name})`);
    return { commandId: dto.commandId, status: newStatus };
  }

  // ── DPC: APK File Streaming ─────────────────────────────────────────────

  /**
   * Resolves the APK file path for a given command ID.
   * Used by the streaming endpoint to verify the file exists before streaming.
   */
  async resolveApkCommand(commandId: string, device: DeviceDocument) {
    const command = await this.commandModel.findOne({
      commandId,
      device: device._id,
      commandType: MdmCommandType.INSTALL_APK,
    });

    if (!command || !command.apkFileName) {
      throw new NotFoundException('APK command not found or has no associated file');
    }

    return { apkFileName: command.apkFileName };
  }
}
