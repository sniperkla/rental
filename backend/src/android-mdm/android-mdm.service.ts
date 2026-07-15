import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Android Enterprise MDM Service
 *
 * Uses the Google Android Management API v1:
 * https://developers.google.com/android/management/reference/rest
 *
 * Prerequisites:
 * 1. Create a Google Cloud project
 * 2. Enable Android Management API
 * 3. Create a service account with Android Management API access
 * 4. Set ANDROID_ENTERPRISE_ID and ANDROID_SERVICE_ACCOUNT_KEY_JSON in .env
 */
@Injectable()
export class AndroidMdmService {
  private readonly logger = new Logger(AndroidMdmService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private overriddenEnterpriseId: string | null = null;

  constructor(private config: ConfigService) {}

  private get enterpriseId() {
    return this.overriddenEnterpriseId || this.config.get<string>('ANDROID_ENTERPRISE_ID', '');
  }

  async getStatus() {
    const keyJson = this.config.get<string>('ANDROID_SERVICE_ACCOUNT_KEY_JSON', '{}');
    const hasKey = keyJson !== '{}' && keyJson.length > 10;

    let keyValid = false;
    let projectId = '';
    if (hasKey) {
      try {
        const parsed = JSON.parse(keyJson);
        projectId = parsed.project_id || '';
        keyValid = !!(parsed.type === 'service_account' && parsed.client_email && parsed.private_key);
      } catch {
        keyValid = false;
      }
    }

    const enterpriseId = this.enterpriseId;
    const hasEnterprise = !!(enterpriseId && enterpriseId !== 'LC04xxxxxx' && enterpriseId.length > 3);

    let canConnect = false;
    if (keyValid) {
      try {
        const token = await this.getAccessToken();
        canConnect = !!token;
      } catch {
        canConnect = false;
      }
    }

    return {
      steps: [
        {
          key: 'service_account',
          label: 'Google Service Account JSON Key',
          description: 'ต้องมีไฟล์คีย์จาก Google Cloud Console > IAM > Service Accounts',
          done: keyValid,
          detail: keyValid ? `Project: ${projectId}` : 'ยังไม่ได้ตั้งค่า ANDROID_SERVICE_ACCOUNT_KEY_JSON ใน .env',
        },
        {
          key: 'google_auth',
          label: 'ทดสอบการเชื่อมต่อ Google API',
          description: 'ตรวจสอบว่า Service Account มีสิทธิ์เรียกใช้ Android Management API',
          done: canConnect,
          detail: canConnect ? 'ได้รับ Access Token สำเร็จ' : 'ไม่สามารถเชื่อมต่อได้ — ตรวจสอบสิทธิ์ API หรือ Key',
        },
        {
          key: 'enterprise_id',
          label: 'Android Enterprise ID',
          description: 'รหัสองค์กรจาก Google (ขึ้นต้นด้วย LC0...) ได้จาก Android EMM Setup Wizard',
          done: hasEnterprise,
          detail: hasEnterprise ? `Enterprise: ${enterpriseId}` : 'ยังไม่ได้ตั้งค่า ANDROID_ENTERPRISE_ID ใน .env',
        },
      ],
      ready: keyValid && canConnect && hasEnterprise,
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const keyJson = this.config.get<string>('ANDROID_SERVICE_ACCOUNT_KEY_JSON', '{}');
    if (keyJson === '{}') {
      this.logger.warn('Android Enterprise credentials not configured. Skipping.');
      return '';
    }

    try {
      // In production, use google-auth-library for proper OAuth2
      // This is a simplified version — swap with GoogleAuth for production
      const key = JSON.parse(keyJson);
      const { GoogleAuth } = await import('google-auth-library').catch(() => {
        throw new Error('google-auth-library not installed. Run: npm install google-auth-library');
      });
      const auth = new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/androidmanagement'] });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      this.accessToken = (tokenResponse.token as string) || '';
      this.tokenExpiry = new Date(Date.now() + 3500 * 1000);
      return this.accessToken;
    } catch (err) {
      this.logger.error('Failed to get Android access token', err.message);
      return '';
    }
  }

  /**
   * Lock an Android device using the Android Management API IssueCommand endpoint
   */
  async lockDevice(enterpriseDeviceName: string): Promise<boolean> {
    if (!enterpriseDeviceName) {
      this.logger.warn('No Android device name provided, skipping lock');
      return false;
    }

    const token = await this.getAccessToken();
    if (!token) return false;

    try {
      const url = `https://androidmanagement.googleapis.com/v1/${enterpriseDeviceName}:issueCommand`;
      await axios.post(url, { type: 'LOCK' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.logger.log(`✅ Locked Android device: ${enterpriseDeviceName}`);
      return true;
    } catch (err) {
      this.logger.error(`❌ Failed to lock Android device ${enterpriseDeviceName}:`, err.message);
      return false;
    }
  }

  /**
   * Unlock an Android device by pushing a permissive policy
   * (removes lock task mode and keyguard restrictions)
   */
  async unlockDevice(enterpriseDeviceName: string): Promise<boolean> {
    if (!enterpriseDeviceName) return false;
    const token = await this.getAccessToken();
    if (!token) return false;

    try {
      const parts = enterpriseDeviceName.split('/');
      const devId = parts[parts.length - 1];
      const entId = this.enterpriseId;
      const policyName = `enterprises/${entId}/policies/device-${devId}`;

      // Set the policy back to the device's custom restrictions policy
      const deviceUrl = `https://androidmanagement.googleapis.com/v1/${enterpriseDeviceName}`;
      await axios.patch(
        deviceUrl,
        { policyName },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      this.logger.log(`✅ Unlocked Android device (restoring custom policy): ${enterpriseDeviceName}`);
      return true;
    } catch (err: any) {
      this.logger.error(`❌ Failed to unlock Android device ${enterpriseDeviceName}:`, err.message);
      return false;
    }
  }

  /**
   * Apply the locked policy to restrict device to a single "Payment Required" kiosk app
   */
  async applyLockedPolicy(enterpriseDeviceName: string): Promise<boolean> {
    if (!enterpriseDeviceName) return false;
    const token = await this.getAccessToken();
    if (!token) return false;

    try {
      const deviceUrl = `https://androidmanagement.googleapis.com/v1/${enterpriseDeviceName}`;
      await axios.patch(
        deviceUrl,
        { policyName: `enterprises/${this.enterpriseId}/policies/rental_locked` },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      this.logger.log(`✅ Applied locked policy to: ${enterpriseDeviceName}`);
      return true;
    } catch (err) {
      this.logger.error(`❌ Failed to apply locked policy:`, err.message);
      return false;
    }
  }

  async getDeviceInfo(enterpriseDeviceName: string) {
    const token = await this.getAccessToken();
    if (!token) return null;
    try {
      const res = await axios.get(
        `https://androidmanagement.googleapis.com/v1/${enterpriseDeviceName}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    } catch (err) {
      this.logger.error('Failed to get device info:', err.message);
      return null;
    }
  }

  async listDevices() {
    const token = await this.getAccessToken();
    if (!token) {
      return {
        devices: [
          {
            name: 'enterprises/MOCK_ENT/devices/MOCK_DEV_123',
            state: 'ACTIVE',
            lastStatusReportTime: new Date().toISOString(),
            hardwareInfo: {
              brand: 'Google',
              model: 'Pixel 8 (Simulator Mock)',
              serialNumber: 'SIM-AND-123',
            },
          },
          {
            name: 'enterprises/MOCK_ENT/devices/MOCK_DEV_999',
            state: 'ACTIVE',
            lastStatusReportTime: new Date().toISOString(),
            hardwareInfo: {
              brand: 'Samsung',
              model: 'Galaxy S24 (Simulator Mock)',
              serialNumber: 'SIM-AND-999',
            },
          },
        ],
      };
    }

    try {
      const res = await axios.get(
        `https://androidmanagement.googleapis.com/v1/enterprises/${this.enterpriseId}/devices`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    } catch (err) {
      this.logger.error('Failed to list Android Enterprise devices:', err.message);
      throw new Error(`Failed to list devices: ${err.message}`);
    }
  }

  async createSignupUrl() {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Google Service Account key is missing or invalid.');

    const key = JSON.parse(process.env.ANDROID_SERVICE_ACCOUNT_KEY_JSON as string);
    const projectId = key.project_id;
    if (!projectId) throw new Error('Missing project_id in Service Account JSON key.');

    try {
      const res = await axios.post(
        `https://androidmanagement.googleapis.com/v1/signupUrls?projectId=${projectId}&callbackUrl=https://google.com`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return res.data; // Returns { url, name }
    } catch (err: any) {
      this.logger.error('Failed to create signup URL:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error?.message || 'Failed to create signup URL.');
    }
  }

  async createEnrollmentToken(displayName?: string) {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Google Service Account credentials are not configured.');
    if (!this.enterpriseId) throw new Error('Enterprise ID is not configured. Please complete Android EMM Setup first.');

    try {
      const body: any = {
        duration: '86400s', // 24 hours validity
        allowPersonalUsage: 'PERSONAL_USAGE_DISALLOWED',
        policyName: `enterprises/${this.enterpriseId}/policies/rental-base`,
      };
      if (displayName) body.additionalData = displayName;

      const res = await axios.post(
        `https://androidmanagement.googleapis.com/v1/enterprises/${this.enterpriseId}/enrollmentTokens`,
        body,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );

      // Google returns { value, qrCode, expirationTimestamp, name }
      // qrCode is already the JSON string to be encoded into a QR image
      return {
        token: res.data.value,
        qrCode: res.data.qrCode,
        expiresAt: res.data.expirationTimestamp,
        name: res.data.name,
      };
    } catch (err: any) {
      this.logger.error('Failed to create enrollment token:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error?.message || 'Failed to create enrollment token.');
    }
  }

  async registerEnterprise(enterpriseToken: string, signupUrlName: string) {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Google Service Account key is missing or invalid.');

    const key = JSON.parse(process.env.ANDROID_SERVICE_ACCOUNT_KEY_JSON as string);
    const projectId = key.project_id;

    try {
      const res = await axios.post(
        `https://androidmanagement.googleapis.com/v1/enterprises?enterpriseToken=${enterpriseToken}&projectId=${projectId}&signupUrlName=${encodeURIComponent(signupUrlName)}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const name = res.data.name; // Format: enterprises/LC04xxxxxxxx
      const enterpriseId = name.split('/')[1];

      // Dynamically write to .env file
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(
          /ANDROID_ENTERPRISE_ID=LC04xxxxxx|ANDROID_ENTERPRISE_ID=\w*/,
          `ANDROID_ENTERPRISE_ID=${enterpriseId}`
        );
        fs.writeFileSync(envPath, envContent, 'utf8');
      }

      // Update internal memory reference so immediately active without server restart
      this.overriddenEnterpriseId = enterpriseId;

      // Auto-create the rental-base policy immediately after binding
      try {
        await this.ensureRentalPolicy(token, enterpriseId);
        this.logger.log('rental-base policy created successfully');
      } catch (policyErr: any) {
        this.logger.warn('Could not create rental-base policy (will retry on next enrollment):', policyErr.message);
      }

      return { success: true, enterpriseId };
    } catch (err: any) {
      this.logger.error('Failed to register enterprise:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error?.message || 'Failed to complete enterprise registration.');
    }
  }

  /**
   * Creates (or patches) the 'rental-base' policy on Google that:
   *  - Prevents Factory Reset (most important for device rental)
   *  - Prevents Safe Boot / Recovery Mode access
   *  - Allows everything else normally (calls, apps, camera, etc.)
   */
  async ensureRentalPolicy(accessToken?: string, enterpriseId?: string) {
    const token = accessToken || await this.getAccessToken();
    const entId = enterpriseId || this.enterpriseId;
    if (!token || !entId) throw new Error('Not configured');

    const policy = {
      // ── Core anti-reset protections ──────────────────────────────
      factoryResetDisabled: true,       // Disable Settings → Factory Reset
      safeBootDisabled: true,           // Disable booting into Recovery Mode

      // ── Keep everything else normal ───────────────────────────────
      cameraDisabled: false,
      screenCaptureDisabled: false,
      adjustVolumeDisabled: false,
      outgoingCallsDisabled: false,
      smsDisabled: false,
      installAppsDisabled: false,
      uninstallAppsDisabled: false,
      bluetoothDisabled: false,
      wifiConfigDisabled: false,
      locationMode: 'LOCATION_USER_CHOICE',

      // ── Block developer bypass routes ─────────────────────────────
      developerSettingsDisabled: true,   // Hide Developer Options menu
      usbFileTransferDisabled: false,    // Allow USB charging/transfer (optional)

      // ── Policy display metadata ───────────────────────────────────
      name: `enterprises/${entId}/policies/rental-base`,
    };

    try {
      // PATCH creates or updates the policy
      const res = await axios.patch(
        `https://androidmanagement.googleapis.com/v1/enterprises/${entId}/policies/rental-base`,
        policy,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      return res.data;
    } catch (err: any) {
      this.logger.error('Failed to create rental-base policy:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error?.message || 'Failed to create rental-base policy');
    }
  }

  /**
   * Generates a device-specific custom policy and applies it to the device on Google
   */
  async applyCustomDevicePolicy(
    enterpriseDeviceName: string,
    restrictions: {
      cameraDisabled: boolean;
      usbFileTransferDisabled: boolean;
      installAppsDisabled: boolean;
      outgoingCallsDisabled: boolean;
    }
  ): Promise<boolean> {
    if (!enterpriseDeviceName) return false;
    const token = await this.getAccessToken();
    if (!token) return false;

    const parts = enterpriseDeviceName.split('/');
    const devId = parts[parts.length - 1];
    const entId = this.enterpriseId;
    const policyName = `enterprises/${entId}/policies/device-${devId}`;

    const policy = {
      // Core anti-reset protections (worst case protection)
      factoryResetDisabled: true,
      safeBootDisabled: true,
      developerSettingsDisabled: true,

      // Custom toggles
      cameraDisabled: !!restrictions.cameraDisabled,
      usbFileTransferDisabled: !!restrictions.usbFileTransferDisabled,
      installAppsDisabled: !!restrictions.installAppsDisabled,
      outgoingCallsDisabled: !!restrictions.outgoingCallsDisabled,

      // Default permissive rules for other settings
      screenCaptureDisabled: false,
      adjustVolumeDisabled: false,
      smsDisabled: false,
      uninstallAppsDisabled: false,
      bluetoothDisabled: false,
      wifiConfigDisabled: false,
      locationMode: 'LOCATION_USER_CHOICE',

      name: policyName,
    };

    try {
      // 1. Create or update this device's custom policy on Google
      await axios.patch(
        `https://androidmanagement.googleapis.com/v1/${policyName}`,
        policy,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );

      // 2. Assign the policy to this device
      await axios.patch(
        `https://androidmanagement.googleapis.com/v1/${enterpriseDeviceName}?updateMask=policyName`,
        { policyName },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );

      this.logger.log(`✅ Synced custom policy to Google for device: ${enterpriseDeviceName}`);
      return true;
    } catch (err: any) {
      this.logger.error(`❌ Failed to sync custom policy for device ${enterpriseDeviceName}:`, err.response?.data || err.message);
      return false;
    }
  }

  /**
   * Fetches enrolled devices from Google Enterprise, compares them with MongoDB,
   * and automatically registers any new devices.
   */
  async syncAndImportDevices(devicesService: any) {
    const listResult = await this.listDevices();
    const enrolledDevices = listResult.devices || [];

    if (enrolledDevices.length === 0) {
      return { importedCount: 0, imported: [] };
    }

    // Get all registered devices in MongoDB
    const registered = await devicesService.model.find({ platform: 'android' });
    const registeredNames = new Set(registered.map((d: any) => d.androidEnterpriseName).filter(Boolean));

    const imported: any[] = [];

    for (const rawDev of enrolledDevices) {
      const lastSeenDate = rawDev.lastStatusReportTime ? new Date(rawDev.lastStatusReportTime) : new Date();

      // If already registered in MongoDB, update lastSeen and skip creation
      if (registeredNames.has(rawDev.name)) {
        await devicesService.model.findOneAndUpdate(
          { androidEnterpriseName: rawDev.name },
          { lastSeen: lastSeenDate }
        );
        continue;
      }

      const parts = rawDev.name.split('/');
      const devId = parts[parts.length - 1];

      // Extract device hardware properties
      const brand = rawDev.hardwareInfo?.brand || 'Android';
      const model = rawDev.hardwareInfo?.model || 'Device';
      const serialNumber = rawDev.hardwareInfo?.serialNumber || `SN-${devId}`;

      // Create new Device document
      const newDevice = new devicesService.model({
        name: `${brand} ${model}`,
        brand: brand,
        model: model,
        serialNumber: serialNumber,
        platform: 'android',
        status: 'available',
        androidEnterpriseName: rawDev.name,
        androidEnterpriseDeviceId: devId,
        notes: 'Imported automatically via Google Enterprise Sync',
        lastSeen: lastSeenDate,
      });

      const saved = await newDevice.save();
      imported.push(saved);
      this.logger.log(`📥 Automatically imported device: ${saved.brand} ${saved.model} (S/N: ${saved.serialNumber})`);
    }

    return {
      importedCount: imported.length,
      imported,
    };
  }
}
