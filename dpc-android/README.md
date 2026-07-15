# Rental DPC — Android Device Policy Controller

## Overview
This is the Android DPC (Device Policy Controller) app for the Rental MDM system.
It runs as a background service on GMS-free (standalone) Android devices,
polling the backend for MDM commands.

## Project Structure
```
app/src/main/java/com/rental/dpc/
├── MainActivity.kt         # Enrollment screen + QR scanner
├── DpcPollingService.kt    # Foreground service — polls backend every 30s
├── DpcAdminReceiver.kt     # Device Admin receiver (needed for lock)
├── CommandExecutor.kt      # Executes LOCK, UNLOCK, INSTALL_APK, REBOOT
├── BootReceiver.kt         # Restarts polling service after device reboot
└── Prefs.kt                # Stores enrollment credentials in SharedPreferences
```

## How to Build (Android Studio)

1. Open Android Studio
2. File → Open → select the `dpc-android/` folder
3. Wait for Gradle sync to complete
4. Build → Generate Signed Bundle / APK → APK
5. Select `release` or `debug` build
6. Install APK on device via ADB: `adb install app-release.apk`

## Enrollment Flow

1. Admin opens the Rental MDM web dashboard
2. Admin selects a device and clicks **Enroll Standalone**
3. Dashboard calls `POST /api/mdm/standalone/enroll` → gets a QR code
4. Technician opens DPC app on Android device → taps **Scan QR**
5. Device scans QR → saves credentials → starts background polling
6. Device prompts to activate Device Admin → tap **Activate**

## QR Code Payload Format (JSON)
```json
{
  "standaloneDeviceId": "abc-123-...",
  "rawApiKey": "sk_...",
  "backendUrl": "https://rental-backend.eaqdragon.com",
  "pollingIntervalSeconds": 30
}
```

## Supported Commands
| Command       | Description                           |
|---------------|---------------------------------------|
| LOCK          | Immediately lock the device screen    |
| UNLOCK        | Unlock hint (requires Device Owner)   |
| INSTALL_APK   | Download + install APK from backend   |
| REBOOT        | Reboot the device                     |

## Permissions Required
- `INTERNET` — for backend polling
- `RECEIVE_BOOT_COMPLETED` — restart polling after reboot
- `WAKE_LOCK` — keep polling service alive
- `CAMERA` — for QR code scanning on enrollment
- `BIND_DEVICE_ADMIN` — for lock/unlock commands

## Notes
- Full `lockNow()` works once Device Admin is activated.
- Full programmatic unlock (without user interaction) requires the app to be
  provisioned as **Device Owner** via ADB:
  `adb shell dpm set-device-owner com.rental.dpc/.DpcAdminReceiver`
- The app uses a foreground service (visible notification) so Android does
  not kill the polling loop in the background.
