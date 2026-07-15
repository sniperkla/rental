import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DpcApiKeyGuard, DPC_DEVICE_KEY } from './dpc-api-key.guard';
import {
  StandaloneMdmService,
  EnrollStandaloneDto,
  QueueCommandDto,
  DpcPollDto,
  DpcCallbackDto,
  SelfRegisterDto,
} from './standalone-mdm.service';
import { streamApk, getApkStorageDir } from './apk-stream.util';
import type { DeviceDocument } from '../schemas/device.schema';

// ── Admin Endpoints (JWT Required) ─────────────────────────────────────────

@Controller()
export class StandaloneMdmController {
  private readonly logger = new Logger(StandaloneMdmController.name);
  constructor(private readonly service: StandaloneMdmService) {}

  /**
   * GET /api/dpc/download
   * PUBLIC endpoint — no auth required.
   * Serves the DPC APK file so technicians can install it via Chrome browser.
   *
   * Setup: Place the built APK at:  uploads/dpc/rental-dpc.apk
   *
   * On device: open Chrome → visit https://rental-backend.eaqdragon.com/api/dpc/download
   *            Chrome will download and prompt to install the APK.
   *
   * NOTE: The device must have "Install unknown apps" enabled for Chrome.
   *       Settings → Apps → Special app access → Install unknown apps → Chrome → Allow
   */
  @Get('dpc/download')
  downloadDpcApk(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    const dpcApkPath = path.join(getApkStorageDir().replace('/apks', '/dpc'), 'rental-dpc.apk');

    if (!fs.existsSync(dpcApkPath)) {
      res.status(404).send(`
        <html>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#121212;color:#fff">
          <h2>⚠️ DPC APK not uploaded yet</h2>
          <p>Build the APK from Android Studio and upload it to the server:</p>
          <pre style="background:#1e1e1e;padding:16px;text-align:left;display:inline-block;border:1px solid #333;color:#2196F3">
scp rental-dpc.apk user@server:/home/ec2-user/rental/backend/uploads/dpc/rental-dpc.apk
          </pre>
        </body>
        </html>
      `);
      return;
    }

    const userAgent = req.headers['user-agent'] || '';
    const isAndroid = userAgent.toLowerCase().includes('android');
    const forceDownload = req.query.download === 'true';

    if (isAndroid || forceDownload) {
      const stat = fs.statSync(dpcApkPath);
      res.set({
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="rental-dpc.apk"',
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(dpcApkPath).pipe(res);
    } else {
      const host = req.headers.host || 'localhost:3001';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const downloadUrl = `${protocol}://${host}/api/dpc/download?download=true`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(downloadUrl)}`;

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Rental DPC APK Download</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background-color: #121212;
              color: #ffffff;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
            }
            .container {
              background: #1e1e1e;
              border: 1px solid #333;
              padding: 30px;
              border-radius: 16px;
              text-align: center;
              max-width: 400px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            }
            h2 { margin-top: 0; color: #2196F3; }
            p { color: #aaa; font-size: 14px; line-height: 1.5; }
            .qr-box {
              background: white;
              padding: 16px;
              border-radius: 12px;
              display: inline-block;
              margin: 20px 0;
            }
            .btn {
              display: block;
              background: #2196F3;
              color: white;
              text-decoration: none;
              padding: 12px;
              border-radius: 8px;
              font-weight: bold;
              margin-top: 15px;
              transition: background 0.2s;
            }
            .btn:hover { background: #1976D2; }
            .footer { font-size: 11px; color: #555; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>📲 ติดตั้งแอป Rental DPC</h2>
            <p>สแกน QR Code ด้านล่างด้วยโทรศัพท์มือถือระบบ Android เพื่อดาวน์โหลดและติดตั้งแอปพลิเคชัน</p>
            <div class="qr-box">
              <img src="${qrCodeUrl}" alt="Scan to Download" width="220" height="220" />
            </div>
            <p style="font-size: 12px; color: #ff9800;">
              ⚠️ อย่าลืมเปิดการอนุญาตให้ติดตั้งแอปจากแหล่งที่ไม่รู้จัก (Unknown sources) สำหรับเบราว์เซอร์
            </p>
            <a href="${downloadUrl}" class="btn">📥 ดาวน์โหลดตรงไฟล์ APK</a>
            <div class="footer">Rental MDM System v1.0</div>
          </div>
        </body>
        </html>
      `);
    }
  }

  /**
   * GET /api/dpc/provisioning-qr
   * PUBLIC endpoint — returns the Android Device Owner provisioning JSON payload.
   *
   * This JSON is encoded as a QR code and scanned during the Android Setup Wizard
   * (tap the "Welcome" screen 6 times to trigger the provisioning flow).
   *
   * Android will:
   *   1. Connect to Wi-Fi (if SSID/password provided)
   *   2. Download the APK from PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION
   *   3. Verify the APK checksum
   *   4. Install the app silently
   *   5. Set it as Device Owner automatically
   *
   * The PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM is the SHA-256 of the APK
   * file encoded as base64url without padding — Android verifies this before installing.
   */
  @Get('dpc/provisioning-qr')
  getProvisioningQr(@Req() req: Request) {
    const dpcApkPath = path.join(getApkStorageDir().replace('/apks', '/dpc'), 'rental-dpc.apk');
    const host = req.headers.host || 'localhost:3001';
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const downloadUrl = `${protocol}://${host}/api/dpc/download?download=true`;

    // IMPORTANT: PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM must be the SHA-256 of the
    // signing CERTIFICATE (DER-encoded), NOT the APK file. Android verifies the signing cert hash
    // before installing the app during provisioning.
    let checksum = '';
    if (fs.existsSync(dpcApkPath)) {
      try {
        // 1. Try to read a pre-computed checksum file (useful for Docker deployments)
        const checksumFilePath = `${dpcApkPath}.sha256`;
        if (fs.existsSync(checksumFilePath)) {
          checksum = fs.readFileSync(checksumFilePath, 'utf8').trim();
          Logger.log(`Certificate checksum (from file): ${checksum}`, 'StandaloneMdmController');
        }

        // 2. Try apksigner if available (local development)
        if (!checksum) {
          const apksignerPaths = [
            'apksigner', // if in PATH
            '/Users/katanyoo/Library/Android/sdk/build-tools/36.0.0/apksigner',
            '/Users/katanyoo/Library/Android/sdk/build-tools/35.0.0/apksigner',
            '/Users/katanyoo/Library/Android/sdk/build-tools/34.0.0/apksigner',
          ];
          for (const p of apksignerPaths) {
            try {
              const { execSync } = require('child_process');
              const output = execSync(`"${p}" verify --print-certs "${dpcApkPath}" 2>/dev/null`).toString();
              const match = output.match(/certificate SHA-256 digest:\s+([0-9a-f]{64})/i);
              if (match) {
                const hexBytes = Buffer.from(match[1], 'hex');
                checksum = hexBytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                Logger.log(`Certificate checksum (apksigner): ${checksum}`, 'StandaloneMdmController');
                break;
              }
            } catch (e) {
              // Ignore and try next path
            }
          }
        }

        // 3. Hardcoded fallback for the known debug keystore (temporary fix for server deployments)
        if (!checksum) {
          checksum = 'MG2n1dcSj_tjXLajb94DzPSccFoKtHGkTvEMGFbsPUk';
          Logger.warn('apksigner not found — using hardcoded debug keystore checksum', 'StandaloneMdmController');
        }
      } catch (e) {
        Logger.error(`Failed to compute checksum: ${e}`, 'StandaloneMdmController');
      }
    }

    const payload = {
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME':
        'com.rental.dpc/.DpcAdminReceiver',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': downloadUrl,
      ...(checksum
        ? { 'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': checksum }
        : {}),
      'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': false,
      'android.app.extra.PROVISIONING_LOCALE': 'th_TH',
      'android.app.extra.PROVISIONING_TIME_ZONE': 'Asia/Bangkok',
    };

    if (req.query.registrationToken) {
      (payload as any)['android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE'] = {
        registrationToken: req.query.registrationToken,
        backendUrl: `${protocol}://${host}`,
      };
    }

    return {
      payload,
      payloadJson: JSON.stringify(payload),
      downloadUrl,
      checksumSha256: checksum || '(APK not found — upload APK first)',
      instructions: [
        'Factory reset the phone first',
        'On the Welcome screen, tap 6 times rapidly',
        'The phone will open a QR scanner',
        'Scan this QR — Android will download & install the app as Device Owner automatically',
      ],
    };
  }

  /**
   * POST /api/mdm/standalone/enroll
   * Admin generates a QR-code payload to enroll a GMS-free Android device.
   * The raw API key is returned exactly once here — the DPC must persist it on-device.
   */
  @Post('mdm/standalone/enroll')
  @UseGuards(JwtAuthGuard)
  async enrollDevice(@Body(new ValidationPipe({ whitelist: true })) dto: EnrollStandaloneDto) {
    return this.service.enrollStandaloneDevice(dto);
  }

  /**
   * GET /api/mdm/standalone/registration-qr
   * Returns reusable token and endpoint configuration for initial self-registration.
   */
  @Get('mdm/standalone/registration-qr')
  @UseGuards(JwtAuthGuard)
  async getRegistrationQr() {
    const token = process.env.DPC_REGISTRATION_TOKEN || 'default_secret_token_123';
    const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${process.env.BACKEND_PORT ?? 3001}`;
    return {
      backendUrl,
      registrationToken: token,
      type: 'registration',
    };
  }

  /**
   * POST /api/dpc/self-register
   * PUBLIC endpoint — allows DPC app on the device to register itself with a registration token.
   */
  @Post('dpc/self-register')
  async selfRegister(@Body(new ValidationPipe({ whitelist: true })) dto: SelfRegisterDto) {
    return this.service.selfRegisterDevice(dto);
  }

  /**
   * POST /api/admin/commands/queue
   * Unified command entry point for both cloud and standalone devices.
   * Routes internally based on device.managementTrack.
   */
  @Post('admin/commands/queue')
  @UseGuards(JwtAuthGuard)
  async queueCommand(@Body(new ValidationPipe({ whitelist: true })) dto: QueueCommandDto) {
    return this.service.queueCommand(dto);
  }

  /**
   * GET /api/admin/devices
   * Returns all devices (cloud + standalone) in a unified format.
   * The standaloneApiKeyHash field is always stripped from the response.
   */
  @Get('admin/devices')
  @UseGuards(JwtAuthGuard)
  async getAllDevices() {
    return this.service.getAllDevices();
  }
}

// ── DPC Endpoints (API Key Auth, no JWT, GMS-free) ─────────────────────────

@Controller('dpc')
export class DpcController {
  constructor(private readonly service: StandaloneMdmService) {}

  /**
   * POST /api/dpc/poll
   * Primary heartbeat + command-dispatch endpoint for Standalone DPC apps.
   * The DPC sends this request on every polling cycle (default every 30 seconds).
   *
   * Headers required:
   *   X-DPC-Device-Id: <standaloneDeviceId>
   *   X-DPC-Api-Key:   <rawApiKey>
   *
   * Response includes:
   *   - pollingIntervalSeconds: next recommended poll interval
   *   - commands[]: array of PENDING commands the DPC must execute
   */
  @Post('poll')
  @UseGuards(DpcApiKeyGuard)
  async poll(@Req() req: Request, @Body() dto: DpcPollDto) {
    const device = (req as any)[DPC_DEVICE_KEY] as DeviceDocument;
    return this.service.processPoll(device, dto);
  }

  /**
   * POST /api/dpc/command-callback
   * Called by the DPC after executing a command (success or failure).
   * Updates the command status in MongoDB and syncs device lock state.
   *
   * Headers required:
   *   X-DPC-Device-Id: <standaloneDeviceId>
   *   X-DPC-Api-Key:   <rawApiKey>
   *
   * Body:
   *   { commandId: string, success: boolean, message?: string }
   */
  @Post('command-callback')
  @UseGuards(DpcApiKeyGuard)
  async commandCallback(@Req() req: Request, @Body() dto: DpcCallbackDto) {
    const device = (req as any)[DPC_DEVICE_KEY] as DeviceDocument;
    return this.service.processCallback(device, dto);
  }

  /**
   * GET /api/dpc/apk/:commandId
   * Streams an APK binary file to the authenticated DPC for silent install.
   *
   * The APK file must be present in the backend's uploads/apks/ directory.
   * File name is resolved from the command record, preventing arbitrary path access.
   *
   * Headers required:
   *   X-DPC-Device-Id: <standaloneDeviceId>
   *   X-DPC-Api-Key:   <rawApiKey>
   */
  @Get('apk/:commandId')
  @UseGuards(DpcApiKeyGuard)
  async downloadApk(
    @Param('commandId') commandId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const device = (req as any)[DPC_DEVICE_KEY] as DeviceDocument;
    const { apkFileName } = await this.service.resolveApkCommand(commandId, device);
    return streamApk(apkFileName, res);
  }

  /**
   * GET /api/dpc/status
   * Returns the device's current configuration status.
   * Used by the DPC app to check if admin has configured the device.
   *
   * Headers required:
   *   X-DPC-Device-Id: <standaloneDeviceId>
   *   X-DPC-Api-Key:   <rawApiKey>
   */
  @Get('status')
  @UseGuards(DpcApiKeyGuard)
  async getStatus(@Req() req: Request) {
    const device = (req as any)[DPC_DEVICE_KEY] as DeviceDocument;
    return {
      configuredAt: (device as any).configuredAt ? (device as any).configuredAt.toISOString() : '',
      securityMode: (device as any).securityMode || '',
      status: device.status,
    };
  }
}
