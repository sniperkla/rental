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
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i("BootReceiver", "Boot completed — starting DPC services")

            if (!Prefs.isEnrolled(context)) return

            // 1. Start polling service (WebSocket + HTTP fallback)
            DpcPollingService.start(context)

            // 2. Apply Device Owner policies if set
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(context, DpcAdminReceiver::class.java)
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                DpcAdminReceiver().applyDeviceOwnerPolicies(context)
                Log.i("BootReceiver", "🛡️ Device Owner policies re-applied on boot")
            }

            // 3. If device was locked before shutdown, restore lock state
            if (Prefs.isDeviceLocked(context)) {
                Log.w("BootReceiver", "🔒 Device was locked — restoring LockActivity + overlay on boot")

                // Re-lock the keyguard FIRST so LockActivity can show over it
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
    }
}
