package com.rental.dpc

import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Restarts services automatically after device reboot.
 * Also restores lock overlay if device was locked before shutdown.
 * Applies Device Owner policies if applicable.
 *
 * Post-wipe re-enrollment:
 * If the device is Device Owner but Prefs show not enrolled (app data cleared / wipe),
 * we immediately lock the device and attempt self re-enrollment using the baked-in
 * enrollment config saved during the original QR provisioning.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        Log.i("BootReceiver", "Boot completed — starting DPC services")

        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        val isDeviceOwner = dpm.isDeviceOwnerApp(context.packageName)

        // ── Case 1: Device Owner but not enrolled (post-wipe / app data cleared) ──
        // The DPC APK survived as system app but SharedPreferences were wiped.
        // Lock immediately and attempt re-enrollment using baked-in config.
        if (isDeviceOwner && !Prefs.isEnrolled(context)) {
            Log.w("BootReceiver", "⚠️ Device Owner active but not enrolled — post-wipe detected")

            // Re-apply security policies first (they survived as Device Owner)
            DpcAdminReceiver().applyDeviceOwnerPolicies(context)

            // Lock device immediately — user cannot do anything until re-enrolled
            try {
                if (dpm.isAdminActive(admin)) {
                    dpm.lockNow()
                    Log.w("BootReceiver", "🔒 Device locked pending re-enrollment")
                }
            } catch (e: Exception) {
                Log.e("BootReceiver", "Lock failed: ${e.message}")
            }

            // Show lock screen overlay
            if (LockOverlayService.canDrawOverlays(context)) {
                LockOverlayService.start(context)
            }
            LockActivity.start(context)

            // Attempt auto re-enrollment if baked-in config exists
            attemptReEnrollment(context)
            return
        }

        // ── Case 2: Normal boot — already enrolled ──
        if (!Prefs.isEnrolled(context)) return

        // 1. Start polling service (WebSocket + HTTP fallback)
        DpcPollingService.start(context)

        // 2. Re-apply Device Owner policies
        if (isDeviceOwner) {
            DpcAdminReceiver().applyDeviceOwnerPolicies(context)
            Log.i("BootReceiver", "🛡️ Device Owner policies re-applied on boot")
        }

        // 3. If device was locked before shutdown, restore lock state
        if (Prefs.isDeviceLocked(context)) {
            Log.w("BootReceiver", "🔒 Device was locked — restoring LockActivity + overlay on boot")

            try {
                if (dpm.isAdminActive(admin)) {
                    dpm.lockNow()
                }
            } catch (e: Exception) {
                Log.e("BootReceiver", "Failed to re-lock keyguard: ${e.message}")
            }

            if (LockOverlayService.canDrawOverlays(context)) {
                LockOverlayService.start(context)
            }
            LockActivity.start(context)
        }
    }

    /**
     * Attempt re-enrollment using the token saved during original QR provisioning.
     *
     * This handles the case where:
     * - Device Owner app survived (pre-installed / system partition)
     * - But user data was wiped (SharedPreferences cleared)
     *
     * On success: polling service starts, device unlocks when server sends UNLOCK command.
     * On failure: device stays locked — user must contact the shop.
     */
    private fun attemptReEnrollment(context: Context) {
        val token = Prefs.getEnrollmentToken(context)
        val backendUrl = Prefs.getEnrollmentBackendUrl(context)

        if (token.isBlank() || backendUrl.isBlank()) {
            Log.w("BootReceiver", "No baked-in enrollment config found — device stays locked until manual re-provision")
            return
        }

        Log.i("BootReceiver", "🔄 Attempting auto re-enrollment to $backendUrl")

        // Mark as pending so polling service shows proper status
        Prefs.setAdminWasEverActive(context)

        ApiHelper.selfRegister(
            context = context,
            registrationToken = token,
            backendUrl = backendUrl,
            onSuccess = { deviceId, _ ->
                Log.i("BootReceiver", "✅ Re-enrollment successful! deviceId=${deviceId.take(8)}...")
                // Polling service is now started by ApiHelper.selfRegister on success.
                // Server will push the appropriate LOCK/UNLOCK command.
            },
            onError = { msg ->
                Log.e("BootReceiver", "Re-enrollment failed: $msg — device stays locked")
                // Device remains locked. User must contact shop.
            }
        )
    }
}
