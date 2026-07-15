package com.rental.dpc

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log

/**
 * Device Admin / Device Owner Receiver.
 *
 * Security hardening:
 * - Device Admin mode: lock on deactivation attempt
 * - Device Owner mode: block factory reset, bootloader unlock, hide app
 */
class DpcAdminReceiver : DeviceAdminReceiver() {

    companion object {
        private const val TAG = "DpcAdmin"
    }

    override fun onEnabled(context: Context, intent: Intent) {
        Log.i(TAG, "Device Admin activated ✅")
        // Mark that admin has been confirmed active at least once.
        // This flag prevents the polling service from auto-locking before
        // the user taps "Activate" on first enrollment.
        Prefs.setAdminWasEverActive(context)
        applyDeviceOwnerPolicies(context)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        Log.w(TAG, "⚠️ Device Admin deactivated — locking device as security measure")
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        try {
            dpm.lockNow()
        } catch (e: Exception) {
            Log.e(TAG, "Lock failed after admin removal: ${e.message}")
        }
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "⚠️ การลบแอปนี้จะล็อคเครื่องทันที\nกรุณาติดต่อร้านเช่าเพื่อปลดล็อค"
    }

    override fun onPasswordFailed(context: Context, intent: Intent, user: android.os.UserHandle) {
        Log.w(TAG, "Failed password attempt detected")
    }

    /**
     * Apply Device Owner policies if app is set as Device Owner.
     * Called on activation and on boot.
     */
    fun applyDeviceOwnerPolicies(context: Context) {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)

        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            Log.d(TAG, "Not Device Owner — skipping advanced policies")
            return
        }

        Log.i(TAG, "🛡️ Device Owner detected — applying security policies")

        try {
            // Block factory reset
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_FACTORY_RESET)

            // Block safe boot (prevents bypassing via safe mode)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_SAFE_BOOT)

            // Block OEM Unlocking (prevents bootloader unlocking via Developer Options)
            dpm.addUserRestriction(admin, "no_oem_unlock")

            // Block Developer Options / USB Debugging completely
            dpm.addUserRestriction(admin, "no_debugging_features")

            // Block uninstall
            dpm.setUninstallBlocked(admin, context.packageName, true)

            // Hide app from launcher (prevents user from finding it in app drawer)
            val launcherComponent = ComponentName(context, "com.rental.dpc.MainActivity")
            context.packageManager.setComponentEnabledSetting(
                launcherComponent,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            )

            Log.i(TAG, "✅ Device Owner policies applied: factory reset blocked, app hidden")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply Device Owner policies: ${e.message}")
        }
    }
}
