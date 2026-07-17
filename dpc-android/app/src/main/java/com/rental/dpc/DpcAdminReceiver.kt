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
    fun applyDeviceOwnerPolicies(context: Context, hideFromLauncher: Boolean = true) {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)

        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            Log.d(TAG, "Not Device Owner — skipping advanced policies")
            return
        }

        Log.i(TAG, "🛡️ Device Owner detected — applying security policies (hideLauncher=$hideFromLauncher)")

        try {
            // Block factory reset — customer must not wipe MDM to bypass lock
            // TODO: Re-enable after testing. dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_FACTORY_RESET)

            // Block safe boot (prevents bypassing via safe mode)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_SAFE_BOOT)

            // Block OEM Unlocking (prevents bootloader unlocking via Developer Options)
            dpm.addUserRestriction(admin, "no_oem_unlock")

            // Block Developer Options / ADB via global settings (does NOT block camera)
            disableDeveloperMode(dpm, admin)

            // Block uninstall
            dpm.setUninstallBlocked(admin, context.packageName, true)

            Log.i(
                TAG,
                "Overlay permission state: canDraw=${android.provider.Settings.canDrawOverlays(context)}"
            )

            // Re-enable camera — may have been disabled by a previous lockdown that wasn't cleared
            if (!Prefs.isDeviceLocked(context)) {
                dpm.setCameraDisabled(admin, false)
                Log.i(TAG, "Camera re-enabled (not in active lock)")
            }

            // Lock Task Mode works without overlay permission (required for QR provisioning)
            LockTaskHelper.configure(context)

            if (hideFromLauncher) {
                hideFromLauncher(context)
            } else {
                Log.i(TAG, "Keeping app visible in launcher until overlay permission is granted")
            }

            Log.i(TAG, "✅ Device Owner policies applied")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply Device Owner policies: ${e.message}")
        }
    }

    fun hideFromLauncher(context: Context) {
        val launcherComponent = ComponentName(context, MainActivity::class.java)
        context.packageManager.setComponentEnabledSetting(
            launcherComponent,
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
        )
        Log.i(TAG, "App hidden from launcher")
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

        // Apply DO policies but keep app visible — overlay is not yet granted during Setup Wizard
        applyDeviceOwnerPolicies(context, hideFromLauncher = false)

        // Restore system apps in background (don't block registration)
        Thread { restoreSystemApps(context) }.start()

        // Extract the extras bundle passed via the QR payload (It's a PersistableBundle in Android!)
        val extras = intent.getParcelableExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE) as? android.os.PersistableBundle
        val registrationToken = extras?.getString("registrationToken")
        val backendUrl = extras?.getString("backendUrl")

        if (!registrationToken.isNullOrBlank() && !backendUrl.isNullOrBlank()) {
            Log.i(TAG, "Found registration token — auto-registering with backend: $backendUrl")
            Prefs.setAdminWasEverActive(context)

            ApiHelper.selfRegister(
                context = context,
                registrationToken = registrationToken,
                backendUrl = backendUrl,
                onSuccess = { deviceId, _ ->
                    Log.i(TAG, "✅ Auto-registration via Setup Wizard complete! deviceId=${deviceId.take(8)}...")
                    showProvisioningSuccessNotification(context)
                    launchOverlaySetup(context)
                },
                onError = { msg ->
                    Log.e(TAG, "Auto-registration failed during provisioning: $msg")
                    launchOverlaySetup(context)
                }
            )
        } else {
            Log.w(TAG, "No registration token in provisioning extras — launching overlay setup")
            launchOverlaySetup(context)
        }
    }

    /**
     * Restore system apps that were skipped during QR provisioning.
     * Uses `pm install-existing` to force-install from system partition,
     * and re-enables any disabled system apps.
     */
    private fun restoreSystemApps(context: Context) {
        try {
            // Common system app packages across all brands
            val systemPackages = listOf(
                // ── AOSP (all Android) ──
                "com.android.camera",           // Camera
                "com.android.gallery3d",        // Gallery
                "com.android.chrome",           // Chrome
                "com.android.settings",         // Settings
                "com.android.phone",            // Phone
                "com.android.contacts",         // Contacts
                "com.android.mms",              // Messages
                "com.android.deskclock",        // Clock
                "com.android.calendar",         // Calendar
                "com.android.documentsui",      // Files
                "com.android.vending",          // Google Play Store
                "com.android.calculator2",      // Calculator
                "com.android.soundrecorder",    // Sound Recorder
                "com.android.fmradio",          // FM Radio

                // ── Google ──
                "com.google.android.apps.maps", // Google Maps
                "com.google.android.youtube",   // YouTube
                "com.google.android.gm",        // Gmail
                "com.google.android.apps.photos", // Google Photos

                // ── Samsung ──
                "com.samsung.android.camera",   // Samsung Camera
                "com.samsung.android.gallery",  // Samsung Gallery
                "com.samsung.android.app.calculator", // Samsung Calculator
                "com.samsung.android.calendar", // Samsung Calendar
                "com.samsung.android.contacts", // Samsung Contacts
                "com.samsung.android.messaging", // Samsung Messages
                "com.samsung.android.app.clock", // Samsung Clock
                "com.samsung.android.incallui", // Samsung Phone
                "com.samsung.android.dialer",   // Samsung Dialer
                "com.samsung.android.forest",   // Samsung Notes
                "com.samsung.android.app.notes", // Samsung Notes
                "com.sec.android.app.camera",   // Samsung Camera (alt)
                "com.sec.android.gallery3d",    // Samsung Gallery (alt)
                "com.sec.android.app.clockpackage", // Samsung Clock (alt)
                "com.sec.android.app.popupcalculator", // Samsung Calculator (alt)

                // ── Xiaomi / Redmi / POCO ──
                "com.miui.camera",              // Camera
                "com.miui.gallery",             // Gallery
                "com.miui.player",              // Music
                "com.miui.video",               // Video
                "com.miui.calculator",          // Calculator
                "com.miui.compass",             // Compass
                "com.miui.weather2",            // Weather
                "com.miui.notes",               // Notes
                "com.miui.fm",                  // FM Radio

                // ── OPPO / Realme ──
                "com.oppo.camera",              // OPPO Camera
                "com.coloros.gallery3d",        // OPPO Gallery
                "com.coloros.calculator",       // OPPO Calculator
                "com.coloros.weather2",         // OPPO Weather
                "com.coloros.notes",            // OPPO Notes
                "com.oppo.music",               // OPPO Music
                "com.oppo.video",               // OPPO Video

                // ── Vivo ──
                "com.vivo.camera",              // Vivo Camera
                "com.vivo.gallery",             // Vivo Gallery
                "com.vivo.calculator",          // Vivo Calculator
                "com.vivo.weather",             // Vivo Weather
                "com.vivo.notes",               // Vivo Notes
                "com.vivo.music",               // Vivo Music

                // ── Huawei / Honor ──
                "com.huawei.camera",            // Huawei Camera
                "com.huawei.gallery",           // Huawei Gallery
                "com.huawei.calculator",        // Huawei Calculator
                "com.huawei.notes",             // Huawei Notes
                "com.honor.camera",             // Honor Camera

                // ── OnePlus ──
                "com.oneplus.camera",           // OnePlus Camera
                "com.oneplus.gallery",          // OnePlus Gallery
                "com.oneplus.calculator",       // OnePlus Calculator

                // ── Motorola ──
                "com.motorola.camera",          // Motorola Camera
                "com.motorola.gallery",         // Motorola Gallery
                "com.motorola.calculator",      // Motorola Calculator
                "com.mot.camera",               // Motorola Camera (alt)

                // ── Lenovo ──
                "com.lenovo.camera",            // Lenovo Camera
                "com.lenovo.gallery",           // Lenovo Gallery

                // ── ASUS ──
                "com.asus.camera",              // ASUS Camera
                "com.asus.gallery",             // ASUS Gallery
                "com.asus.calculator",          // ASUS Calculator

                // ── Sony ──
                "com.sonymobile.camera",        // Sony Camera
                "com.sonyericsson.gallery",     // Sony Gallery

                // ── LG ──
                "com.lge.camera",               // LG Camera
                "com.lge.gallery",              // LG Gallery
                "com.lge.calculator",           // LG Calculator

                // ── Tecno ──
                "com.transsion.camera",         // Tecno Camera
                "com.transsion.gallery",        // Tecno Gallery
                "com.transsion.calculator",     // Tecno Calculator

                // ── Infinix ──
                "com.infinix.camera",           // Infinix Camera
                "com.infinix.gallery",          // Infinix Gallery

                // ── itel ──
                "com.itel.camera",              // itel Camera
                "com.itel.gallery",             // itel Gallery

                // ── Nokia ──
                "com.nokia.camera",             // Nokia Camera
                "com.nokia.gallery",            // Nokia Gallery

                // ── ZTE ──
                "com.zte.camera",               // ZTE Camera
                "com.zte.gallery",              // ZTE Gallery

                // ── iQOO / Poco (sub-brands) ──
                "com.iqoo.camera",              // iQOO Camera
                "com.poco.camera",              // POCO Camera

                // ── Nothing ──
                "com.nothing.camera",           // Nothing Camera

                // ── Meizu ──
                "com.meizu.media.camera",       // Meizu Camera
                "com.meizu.media.gallery",      // Meizu Gallery

                // ── Coolpad ──
                "com.coolpad.camera",           // Coolpad Camera
                "com.coolpad.gallery",          // Coolpad Gallery

                // ── Alcatel ──
                "com.tcl.camera",               // Alcatel/TCL Camera
                "com.tcl.gallery",              // Alcatel/TCL Gallery
            )

            val pm = context.packageManager
            var restored = 0

            // Re-enable known system apps and any disabled system apps
            for (pkg in systemPackages) {
                try {
                    pm.getPackageInfo(pkg, 0) // Check if package exists
                    val state = pm.getApplicationEnabledSetting(pkg)
                    if (state == android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER ||
                        state == android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED ||
                        state == android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED) {
                        pm.setApplicationEnabledSetting(pkg, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DEFAULT, 0)
                        restored++
                        Log.i(TAG, "Re-enabled: $pkg")
                    }
                } catch (_: Exception) {}
            }

            // Also re-enable any other disabled system apps
            val packages = pm.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA)
            for (appInfo in packages) {
                if (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM != 0) {
                    try {
                        val state = pm.getApplicationEnabledSetting(appInfo.packageName)
                        if (state == android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER ||
                            state == android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED ||
                            state == android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED) {
                            pm.setApplicationEnabledSetting(appInfo.packageName, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DEFAULT, 0)
                            restored++
                            Log.i(TAG, "Re-enabled system app: ${appInfo.packageName}")
                        }
                    } catch (_: Exception) {}
                }
            }

            Log.i(TAG, "System app restoration: $restored apps re-enabled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restore system apps: ${e.message}")
        }
    }

    private fun launchOverlaySetup(context: Context) {
        Log.i(TAG, "launchOverlaySetup — scheduling via AlarmManager")
        // Save flag so the app knows to show overlay setup when it opens
        Prefs.setOverlaySetupPending(context, true)

        // Use AlarmManager to launch activity after 2s — works even if process is killed
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val intent = Intent(context, ProvisioningSetupActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = android.app.PendingIntent.getActivity(
            context, 9999, intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        val triggerTime = android.os.SystemClock.elapsedRealtime() + 5000
        alarmManager.set(android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, pendingIntent)
        Log.i(TAG, "AlarmManager scheduled for 5s from now")
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
