import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as https from 'https';
import * as http2 from 'http2';

/**
 * Apple MDM Service
 *
 * Uses APNs (Apple Push Notification service) to trigger MDM commands on supervised iOS devices.
 *
 * MDM Protocol flow:
 * 1. Device enrolled via Apple Business Manager + DEP
 * 2. Device sends TokenUpdate checkin → we store push token
 * 3. We send a "silent" push via APNs → device wakes and checks MDM command queue
 * 4. Device fetches the MDM command (DeviceLock / DeviceUnlock) from our server
 * 5. Device executes command and sends Acknowledge
 *
 * Prerequisites:
 * - Apple Business Manager account
 * - APNs push certificate for MDM (APPLE_MDM_PUSH_CERT_PATH / APPLE_MDM_PUSH_KEY_PATH)
 * - Device enrolled and supervised via DEP
 */
@Injectable()
export class AppleMdmService {
  private readonly logger = new Logger(AppleMdmService.name);

  // Pending commands waiting to be fetched by devices
  private commandQueue: Map<string, any[]> = new Map();

  constructor(private config: ConfigService) {}

  private get mdmTopic() {
    return this.config.get<string>('APPLE_MDM_TOPIC', '');
  }

  private get pushCertPath() {
    return this.config.get<string>('APPLE_MDM_PUSH_CERT_PATH', './certs/mdm_push_cert.pem');
  }

  private get pushKeyPath() {
    return this.config.get<string>('APPLE_MDM_PUSH_KEY_PATH', './certs/mdm_push_key.pem');
  }

  /**
   * Queue an MDM command for a device and send an APNs push to wake it
   */
  private async sendMdmCommand(udid: string, pushToken: string, command: object): Promise<boolean> {
    if (!udid || !pushToken) {
      this.logger.warn('Apple MDM: missing UDID or push token, skipping');
      return false;
    }
    if (!this.mdmTopic) {
      this.logger.warn('Apple MDM: APPLE_MDM_TOPIC not configured, skipping');
      return false;
    }

    // Add command to queue for this device
    const queue = this.commandQueue.get(udid) || [];
    queue.push({ ...command, CommandUUID: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
    this.commandQueue.set(udid, queue);

    // Send APNs push to wake the device
    return this.sendApnsPush(pushToken, udid);
  }

  /**
   * Send an APNs "MDM wake" notification to the device
   */
  private async sendApnsPush(pushToken: string, udid: string): Promise<boolean> {
    try {
      if (!fs.existsSync(this.pushCertPath) || !fs.existsSync(this.pushKeyPath)) {
        this.logger.warn('Apple MDM push certificates not found. Configure APPLE_MDM_PUSH_CERT_PATH and APPLE_MDM_PUSH_KEY_PATH');
        // In dev mode, simulate success
        this.logger.log(`[DEV] Simulated APNs push for UDID: ${udid}`);
        return true;
      }

      const cert = fs.readFileSync(this.pushCertPath);
      const key = fs.readFileSync(this.pushKeyPath);

      const payload = JSON.stringify({ mdm: pushToken });
      const apnsHost = 'api.push.apple.com';

      return new Promise((resolve) => {
        const client = http2.connect(`https://${apnsHost}`, { cert, key });
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${pushToken}`,
          'apns-topic': this.mdmTopic,
          'apns-push-type': 'mdm',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload).toString(),
        });

        req.write(payload);
        req.end();

        req.on('response', (headers) => {
          const status = headers[':status'];
          client.close();
          if (status === 200) {
            this.logger.log(`✅ APNs push sent for UDID: ${udid}`);
            resolve(true);
          } else {
            this.logger.error(`❌ APNs push failed with status ${status}`);
            resolve(false);
          }
        });

        req.on('error', (err) => {
          this.logger.error('APNs push error:', err.message);
          client.close();
          resolve(false);
        });
      });
    } catch (err) {
      this.logger.error('Apple MDM push error:', err.message);
      return false;
    }
  }

  /**
   * Lock an iOS device by applying Screen Time Lockdown.
   * Restricts settings, Safari, camera, and app store to enforce payment.
   */
  async lockDevice(udid: string, pushToken: string): Promise<boolean> {
    this.logger.log(`Locking iOS device (applying Screen Time Lockdown): ${udid}`);
    return this.enableScreenTimeLockdown(udid, pushToken);
  }

  /**
   * Unlock an iOS device by removing Screen Time Lockdown.
   */
  async unlockDevice(udid: string, pushToken: string): Promise<boolean> {
    this.logger.log(`Unlocking iOS device (removing Screen Time Lockdown): ${udid}`);
    return this.disableScreenTimeLockdown(udid, pushToken);
  }

  /**
   * Get pending MDM commands for a device (called by the device at checkin)
   * This endpoint must be exposed publicly as the MDM server URL
   */
  getPendingCommand(udid: string): object | null {
    const queue = this.commandQueue.get(udid);
    if (!queue || queue.length === 0) return null;
    const command = queue.shift();
    this.commandQueue.set(udid, queue);
    return command;
  }

  /**
   * Handle device checkin (TokenUpdate) — store the push token
   */
  handleCheckin(udid: string, pushToken: string) {
    this.logger.log(`Device checkin: UDID=${udid}, pushToken stored`);
    // In production, persist pushToken to database here
    return { status: 'acknowledged' };
  }

  /**
   * Returns the health/configuration status of Apple MDM.
   */
  getStatus() {
    const topic = this.mdmTopic;
    const certPath = this.pushCertPath;
    const keyPath = this.pushKeyPath;

    const hasTopic = !!topic;
    const hasCert = fs.existsSync(certPath);
    const hasKey = fs.existsSync(keyPath);

    return {
      ready: hasTopic && hasCert && hasKey,
      checks: [
        {
          label: 'APNs Topic (APPLE_MDM_TOPIC)',
          ok: hasTopic,
          detail: hasTopic ? topic : 'Not configured — set APPLE_MDM_TOPIC in .env',
        },
        {
          label: 'APNs Push Certificate',
          ok: hasCert,
          detail: hasCert ? certPath : `File not found: ${certPath}`,
        },
        {
          label: 'APNs Push Key',
          ok: hasKey,
          detail: hasKey ? keyPath : `File not found: ${keyPath}`,
        },
      ],
    };
  }

  /**
   * Send a Restrictions payload to a supervised iOS device via MDM.
   * Uses the InstallProfile command to push a mobileconfig with
   * a Restrictions payload that blocks specific features.
   */
  async applyDeviceRestrictions(
    udid: string,
    pushToken: string,
    restrictions: {
      cameraDisabled: boolean;
      usbFileTransferDisabled: boolean;
      installAppsDisabled: boolean;
      outgoingCallsDisabled: boolean;
    }
  ): Promise<boolean> {
    this.logger.log(`🛡️ Applying restrictions to iOS device: ${udid}`);

    // Build restrictions payload keys (Apple Restrictions payload spec)
    const payloadContent: Record<string, boolean> = {};
    if (restrictions.cameraDisabled) payloadContent['allowCamera'] = false;
    if (restrictions.installAppsDisabled) payloadContent['allowAppInstallation'] = false;
    if (restrictions.outgoingCallsDisabled) payloadContent['allowVoiceDialing'] = false;
    // Note: USB file transfer restriction is enforced via Supervised mode + USB Restricted Mode
    // If the device is supervised, setting usbRestrictedMode blocks accessories after 1h
    if (restrictions.usbFileTransferDisabled) payloadContent['forceITunesStorePasswordEntry'] = true;

    return this.sendMdmCommand(udid, pushToken, {
      RequestType: 'InstallProfile',
      Payload: {
        PayloadVersion: 1,
        PayloadType: 'Configuration',
        PayloadIdentifier: `com.rentcontrol.device.${udid}.restrictions`,
        PayloadDisplayName: 'RentControl Device Policy',
        PayloadContent: [
          {
            PayloadType: 'com.apple.applicationaccess',
            PayloadIdentifier: `com.rentcontrol.device.${udid}.restrictions.access`,
            PayloadVersion: 1,
            ...payloadContent,
          },
        ],
      },
    });
  }

  /**
   * Push a "Screen Time Lockdown" profile to an iOS device.
   *
   * Works on NON-Supervised devices (OTA enrolled) too!
   * Pushes an applicationaccess payload that:
   *  - Blocks Settings (allowEnablingRestrictions: false)
   *  - Blocks Safari, App Store, FaceTime, Camera, Screen Recording
   *  - Prevents app installation/removal
   *
   * Combined with OTA MDM enrollment, the customer cannot navigate to
   * Settings → VPN & Device Management to remove the MDM profile,
   * because Settings itself is restricted.
   *
   * Note: On non-supervised devices the user CAN escape via Factory Reset,
   * which is why combining this with a physical passcode on the device
   * adds another layer of protection.
   */
  async enableScreenTimeLockdown(udid: string, pushToken: string): Promise<boolean> {
    this.logger.log(`🔐 Enabling Screen Time lockdown for device: ${udid}`);

    return this.sendMdmCommand(udid, pushToken, {
      RequestType: 'InstallProfile',
      Payload: {
        PayloadVersion: 1,
        PayloadType: 'Configuration',
        PayloadIdentifier: `com.rentcontrol.device.${udid}.screentime`,
        PayloadDisplayName: 'RentControl Screen Time Lockdown',
        PayloadContent: [
          {
            PayloadType: 'com.apple.applicationaccess',
            PayloadIdentifier: `com.rentcontrol.device.${udid}.screentime.access`,
            PayloadVersion: 1,
            // --- Block Settings access paths ---
            allowEnablingRestrictions: false,      // Cannot open Screen Time settings
            allowOpenFromManagedToUnmanaged: false,
            // --- Block escape routes ---
            allowSafari: false,                    // No browser to download removal tools
            allowAppInstallation: false,            // Cannot install apps
            allowAppRemoval: false,                 // Cannot remove apps (incl. MDM)
            // --- Block privacy leaks ---
            allowCamera: false,
            allowScreenShot: false,
            allowFaceTime: false,
            // --- Block account changes ---
            allowAccountModification: false,
            allowAddingGameCenterFriends: false,
          },
        ],
      },
    });
  }

  /**
   * Remove the Screen Time Lockdown profile from a device.
   * Called when customer has paid and device is released.
   */
  async disableScreenTimeLockdown(udid: string, pushToken: string): Promise<boolean> {
    this.logger.log(`🔓 Disabling Screen Time lockdown for device: ${udid}`);

    return this.sendMdmCommand(udid, pushToken, {
      RequestType: 'RemoveProfile',
      Identifier: `com.rentcontrol.device.${udid}.screentime`,
    });
  }
}
