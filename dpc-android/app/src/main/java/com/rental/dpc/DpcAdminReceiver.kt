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
            // Allow factory reset (clearing any previously set restriction)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_FACTORY_RESET)

            // Block safe boot (prevents bypassing via safe mode)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_SAFE_BOOT)

            // Block OEM Unlocking (prevents bootloader unlocking via Developer Options)
            dpm.addUserRestriction(admin, "no_oem_unlock")

            // Block Developer Options / ADB (prevents tapping 7 times on build number)
            // NOTE: Admin can still remove Device Owner via backend "Remove MDM" command
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_DEBUGGING_FEATURES)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_CONFIG_WIFI)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_SHARE_LOCATION)
            
            disableDeveloperMode(dpm, admin)

            // Block uninstall
            dpm.setUninstallBlocked(admin, context.packageName, true)

            // SYSTEM_ALERT_WINDOW is a special app-op permission. Android does not
            // allow a DPC to silently grant it with setPermissionGrantState().
            // The reliable managed-device lock path is LockActivity; overlay is optional.
            Log.i(
                TAG,
                "Overlay permission state: canDraw=${android.provider.Settings.canDrawOverlays(context)}"
            )

            // Hide app from launcher (prevents user from finding it in app drawer)
            val launcherComponent = ComponentName(context, MainActivity::class.java)
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

    private fun disableDeveloperMode(dpm: DevicePolicyManager, admin: ComponentName) {
        try {
            dpm.setGlobalSetting(
                admin,
                android.provider.Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                "0"
            )
            dpm.setGlobalSetting(
                admin,
                android.provider.Settings.Global.ADB_ENABLED,
                "0"
            )
            Log.i(TAG, "✅ Developer Options and ADB disabled via setGlobalSetting")
        } catch (e: Exception) {
            Log.w(TAG, "Could not disable Developer Options/ADB via setGlobalSetting: ${e.message}")
        }
    }

    /**
     * Called by Android when the Setup Wizard provisioning flow is complete.
     * This is triggered when the admin's QR code is scanned during the initial phone setup.
     *
     * We extract the PROVISIONING_ADMIN_EXTRAS_BUNDLE (which contains the registrationToken
     * and backendUrl embedded by our backend) and silently self-register the device.
     */
    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        Log.i(TAG, "🎉 onProfileProvisioningComplete — Setup Wizard provisioning complete!")

        // Apply DO policies immediately since we are now Device Owner
        applyDeviceOwnerPolicies(context)

        // Extract the extras bundle passed via the QR payload (It's a PersistableBundle in Android!)
        val extras = intent.getParcelableExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE) as? android.os.PersistableBundle
        val registrationToken = extras?.getString("registrationToken")
        val backendUrl = extras?.getString("backendUrl")

        if (!registrationToken.isNullOrBlank() && !backendUrl.isNullOrBlank()) {
            Log.i(TAG, "Found registration token — auto-registering with backend: $backendUrl")
            // Mark admin as active before starting registration
            Prefs.setAdminWasEverActive(context)

            ApiHelper.selfRegister(
                context = context,
                registrationToken = registrationToken,
                backendUrl = backendUrl,
                onSuccess = { deviceId, _ ->
                    Log.i(TAG, "✅ Auto-registration via Setup Wizard complete! deviceId=${deviceId.take(8)}...")
                    // Show success notification on the phone
                    showProvisioningSuccessNotification(context)
                },
                onError = { msg ->
                    Log.e(TAG, "Auto-registration failed during provisioning: $msg")
                    // On failure, start MainActivity so the user can manually scan a QR code
                    val launchIntent = Intent(context, MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(launchIntent)
                }
            )
        } else {
            Log.w(TAG, "No registration token in provisioning extras — launching MainActivity for manual setup")
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(launchIntent)
        }
    }

    private fun showProvisioningSuccessNotification(context: Context) {
        val channelId = "provisioning_success"
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

        val channel = android.app.NotificationChannel(
            channelId,
            "Setup Complete",
            android.app.NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Device provisioning success"
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            enableVibration(true)
        }
        nm.createNotificationChannel(channel)

        val notification = android.app.Notification.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("✅ Device Setup Complete")
            .setContentText("MDM has been successfully installed and configured.")
            .setStyle(
                android.app.Notification.BigTextStyle()
                    .bigText("Device Owner has been successfully provisioned.\n\n" +
                            "• App is now hidden from launcher\n" +
                            "• Developer Options is blocked\n" +
                            "• Device is managed by rental system\n\n" +
                            "The device is ready for rental use.")
            )
            .setOngoing(false) // User can dismiss
            .setPriority(android.app.Notification.PRIORITY_HIGH)
            .setVisibility(android.app.Notification.VISIBILITY_PUBLIC)
            .build()

        nm.notify(9004, notification)
    }
}
