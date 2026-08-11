package com.rental.dpc

import android.app.DownloadManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.util.Log
import org.json.JSONObject
import java.io.File

/**
 * Handles execution of commands received from the backend during DPC poll.
 * Each command has a commandType and optional payload.
 */
object CommandExecutor {

    private const val TAG = "CommandExecutor"
    private const val LOCK_NOTIFICATION_ID = 9001

    fun execute(context: Context, command: JSONObject): Boolean {
        val type = command.optString("commandType", "")
        val payload = command.optJSONObject("payload")

        return try {
            when (type) {
                "LOCK"        -> lock(context, payload)
                "UNLOCK"      -> unlock(context)
                "INSTALL_APK" -> installApk(context, command)
                "REBOOT"      -> reboot(context)
                "UNENROLL"    -> unenroll(context)
                "WIPE"        -> wipeData(context)
                "RESTRICT"    -> applyRestrictions(context, payload)
                "UNRESTRICT"  -> removeRestrictions(context, payload)
                "RESTORE_SYSTEM_APPS" -> restoreSystemApps(context)
                else -> {
                    Log.w(TAG, "Unknown command type: $type")
                    false
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error executing command $type: ${e.message}")
            false
        }
    }

    // ── LOCK ─────────────────────────────────────────────────────────────────
    private fun lock(context: Context, payload: org.json.JSONObject? = null): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        return if (dpm.isAdminActive(admin)) {
            // 1. Persist lock state (survives reboot)
            Prefs.setDeviceLocked(context, true)
            Prefs.setLockReason(context, "server")
            // 1b. Persist optional custom message / emergency phone from dashboard
            val customMsg = payload?.optString("message", "") ?: ""
            val customPhone = payload?.optString("phone", "") ?: ""
            if (customMsg.isNotBlank()) Prefs.setCustomLockMessage(context, customMsg)
            if (customPhone.isNotBlank()) Prefs.setCustomLockPhone(context, customPhone)
            // 2. Apply extra restrictions if Device Owner
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                applyLockdownRestrictions(dpm, admin, context)
            }
            // 3. Show persistent notification
            showLockScreenNotification(context)
            // 4. Launch lock screen. Overlay is optional; Lock Task Mode blocks Home/Recents.
            LockTaskHelper.configure(context)
            val canDrawOverlays = android.provider.Settings.canDrawOverlays(context)
            Log.i(TAG, "🔒 Lock requested - canDrawOverlays=$canDrawOverlays, isDeviceOwner=${dpm.isDeviceOwnerApp(context.packageName)}")

            LockActivity.start(context)
            if (canDrawOverlays) {
                LockOverlayService.start(context)
            } else {
                Log.w(TAG, "⚠️ Overlay not granted — using LockActivity + Lock Task Mode")
                dpm.lockNow()
            }
            Log.i(TAG, "🔒 Device locked (owner=${dpm.isDeviceOwnerApp(context.packageName)})")
            true
        } else {
            Log.e(TAG, "Device Admin not active — cannot lock!")
            false
        }
    }

    /** Device Owner only: disable camera, USB, and other features during lock. */
    private fun applyLockdownRestrictions(dpm: DevicePolicyManager, admin: ComponentName, context: Context) {
        try {
            // App restrictions
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_INSTALL_APPS)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_UNINSTALL_APPS)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_SHARE_LOCATION)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_USB_FILE_TRANSFER)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            dpm.setCameraDisabled(admin, true)
            
            // Disable status bar expansion (pull-down notifications)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_CONFIG_MOBILE_NETWORKS)
            
            // Mute all volumes (prevents volume button feedback)
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, 0, 0)
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_RING, 0, 0)
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION, 0, 0)
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_SYSTEM, 0, 0)
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_ALARM, 0, 0)
            
            Log.i(TAG, "🛡️ Device Owner lockdown restrictions applied (volume muted)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply lockdown restrictions: ${e.message}")
        }
    }

    // ── RESTRICT / UNRESTRICT ─────────────────────────────────────────────────

    /**
     * Maps restriction keys from backend to Android UserManager constants.
     * Backend sends human-readable keys like "no_factory_reset", "no_safe_boot", etc.
     */
    private fun resolveRestriction(key: String): String? {
        return when (key) {
            "no_factory_reset"        -> android.os.UserManager.DISALLOW_FACTORY_RESET
            "no_safe_boot"            -> android.os.UserManager.DISALLOW_SAFE_BOOT
            "no_install_apps"         -> android.os.UserManager.DISALLOW_INSTALL_APPS
            "no_uninstall_apps"       -> android.os.UserManager.DISALLOW_UNINSTALL_APPS
            "no_config_wifi"          -> android.os.UserManager.DISALLOW_CONFIG_WIFI
            "no_share_location"       -> android.os.UserManager.DISALLOW_SHARE_LOCATION
            "no_usb_file_transfer"    -> android.os.UserManager.DISALLOW_USB_FILE_TRANSFER
            "no_mount_physical_media" -> android.os.UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA
            "no_config_mobile"        -> android.os.UserManager.DISALLOW_CONFIG_MOBILE_NETWORKS
            "no_debugging_features"   -> android.os.UserManager.DISALLOW_DEBUGGING_FEATURES
            "no_oem_unlock"           -> "no_oem_unlock" // custom key, not in UserManager
            "no_camera"               -> "no_camera" // custom key, handled via setCameraDisabled
            else -> {
                Log.w(TAG, "Unknown restriction key: $key")
                null
            }
        }
    }

    private fun applyRestrictions(context: Context, payload: JSONObject?): Boolean {
        if (payload == null) return false
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            Log.w(TAG, "Not Device Owner — cannot apply restrictions")
            return false
        }

        val restrictions = payload.optJSONArray("restrictions") ?: return false
        var success = true
        for (i in 0 until restrictions.length()) {
            val key = restrictions.optString(i)
            val constant = resolveRestriction(key) ?: continue
            try {
                when (constant) {
                    "no_oem_unlock" -> dpm.addUserRestriction(admin, "no_oem_unlock")
                    "no_camera" -> dpm.setCameraDisabled(admin, true)
                    else -> dpm.addUserRestriction(admin, constant)
                }
                Log.i(TAG, "✅ Restriction applied: $key")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to apply restriction $key: ${e.message}")
                success = false
            }
        }
        return success
    }

    private fun removeRestrictions(context: Context, payload: JSONObject?): Boolean {
        if (payload == null) return false
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            Log.w(TAG, "Not Device Owner — cannot remove restrictions")
            return false
        }

        val restrictions = payload.optJSONArray("restrictions") ?: return false
        var success = true
        for (i in 0 until restrictions.length()) {
            val key = restrictions.optString(i)
            val constant = resolveRestriction(key) ?: continue
            try {
                when (constant) {
                    "no_oem_unlock" -> dpm.clearUserRestriction(admin, "no_oem_unlock")
                    "no_camera" -> dpm.setCameraDisabled(admin, false)
                    else -> dpm.clearUserRestriction(admin, constant)
                }
                Log.i(TAG, "✅ Restriction removed: $key")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to remove restriction $key: ${e.message}")
                success = false
            }
        }
        return success
    }

    // ── RESTORE SYSTEM APPS ───────────────────────────────────────────────────

    fun restoreSystemApps(context: Context): Boolean {
        return try {
            Log.i(TAG, "🔄 Starting system app restoration...")

            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(context, DpcAdminReceiver::class.java)

            if (!dpm.isDeviceOwnerApp(context.packageName)) {
                Log.w(TAG, "Not Device Owner — cannot restore system apps")
                return false
            }

            val systemPackages = listOf(
                "com.android.camera", "com.android.gallery3d", "com.android.chrome",
                "com.android.vending", "com.android.calculator2",
                "com.google.android.apps.maps", "com.google.android.youtube",
                "com.miui.camera", "com.miui.gallery", "com.miui.player", "com.miui.video",
                "com.miui.calculator", "com.miui.notes", "com.miui.fm",
                "com.miui.weather2", "com.miui.compass",
                "com.samsung.android.camera", "com.samsung.android.gallery",
                "com.sec.android.app.camera", "com.sec.android.gallery3d",
                "com.oppo.camera", "com.coloros.gallery3d",
                "com.vivo.camera", "com.vivo.gallery",
                "com.huawei.camera", "com.huawei.gallery",
                "com.oneplus.camera", "com.oneplus.gallery",
                "com.motorola.camera", "com.motorola.gallery",
                "com.transsion.camera", "com.transsion.gallery",
                "com.infinix.camera", "com.infinix.gallery",
                "com.itel.camera", "com.itel.gallery",
            )

            var restored = 0
            for (pkg in systemPackages) {
                try {
                    dpm.enableSystemApp(admin, pkg)
                    restored++
                    Log.i(TAG, "Enabled: $pkg")
                } catch (_: Exception) {
                    // Package doesn't exist or already enabled
                }
            }

            // Also re-enable camera if it was disabled
            try {
                dpm.setCameraDisabled(admin, false)
                Log.i(TAG, "📷 Camera re-enabled")
            } catch (e: Exception) {
                Log.w(TAG, "Could not re-enable camera: ${e.message}")
            }

            Log.i(TAG, "✅ System apps restored: $restored apps enabled")
            true
        } catch (e: Exception) {
            Log.e(TAG, "❌ restoreSystemApps failed: ${e.message}")
            false
        }
    }

    /** Posts a persistent, high-visibility notification that shows on the lock screen. */
    private fun showLockScreenNotification(context: Context) {
        val channelId = "mdm_lock_alert"
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

        val channel = android.app.NotificationChannel(
            channelId,
            "MDM Lock Alert",
            android.app.NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Shown when the device is remotely locked by the rental system"
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            enableLights(true)
        }
        nm.createNotificationChannel(channel)

        val notification = android.app.Notification.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentTitle("⛔ เครื่องถูกล็อคโดยระบบ")
            .setContentText("กรุณาติดต่อร้านเช่าเพื่อปลดล็อค")
            .setStyle(
                android.app.Notification.BigTextStyle()
                    .bigText(
                        "เครื่องนี้ถูกล็อคชั่วคราวโดยระบบบริหารจัดการของร้านเช่า\n\n" +
                        "📞 กรุณาติดต่อร้านเพื่อปลดล็อคและใช้งานต่อ\n\n" +
                        "Device is locked by the rental management system.\n" +
                        "Please contact the shop to unlock."
                    )
            )
            .setOngoing(true)            // user cannot swipe away
            .setPriority(android.app.Notification.PRIORITY_MAX)
            .setVisibility(android.app.Notification.VISIBILITY_PUBLIC)  // shows ON lock screen
            .build()

        nm.notify(LOCK_NOTIFICATION_ID, notification)
    }

    /** Removes the lock-screen notification (called by unlock). */
    private fun dismissLockNotification(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        nm.cancel(LOCK_NOTIFICATION_ID)
    }

    // ── UNLOCK ───────────────────────────────────────────────────────────────
    private fun unlock(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)

        // 1. Clear persisted lock state
        Prefs.setDeviceLocked(context, false)
        // 2. Remove Device Owner restrictions if applicable
        if (dpm.isDeviceOwnerApp(context.packageName)) {
            clearLockdownRestrictions(dpm, admin, context)
        }
        // 3. Dismiss lock screen notification
        dismissLockNotification(context)
        // 4. Dismiss LockActivity via broadcast + stop overlay service
        context.sendBroadcast(Intent(LockActivity.ACTION_UNLOCK), LockActivity.UNLOCK_PERMISSION)
        LockOverlayService.stop(context)
        Log.i(TAG, "🔓 Unlock command received — LockActivity + overlay dismissed")
        return true
    }

    /** Clear baseline Device Owner restrictions (set at enrollment). */
    private fun clearBaselineRestrictions(dpm: DevicePolicyManager, admin: ComponentName, packageName: String) {
        try {
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_SAFE_BOOT)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_DEBUGGING_FEATURES)
            // OEM unlock restriction key
            try { dpm.clearUserRestriction(admin, "no_oem_unlock") } catch (_: Exception) {}
            // Re-enable uninstall block removal
            dpm.setUninstallBlocked(admin, packageName, false)
            // Re-enable Developer Options (was disabled via Device Owner policy)
            try {
                dpm.setGlobalSetting(admin, android.provider.Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, "1")
                Log.i(TAG, "🔓 Developer Options re-enabled via setGlobalSetting")
            } catch (e: Exception) {
                Log.w(TAG, "Could not re-enable Developer Options: ${e.message}")
            }
            Log.i(TAG, "🔓 Baseline restrictions cleared (safe boot, debugging, OEM unlock, dev options restored)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear baseline restrictions: ${e.message}")
        }
    }

    /** Device Owner only: remove lockdown restrictions. */
    private fun clearLockdownRestrictions(dpm: DevicePolicyManager, admin: ComponentName, context: Context) {
        try {
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_INSTALL_APPS)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_UNINSTALL_APPS)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_SHARE_LOCATION)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_USB_FILE_TRANSFER)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_CONFIG_MOBILE_NETWORKS)
            dpm.setCameraDisabled(admin, false)
            
            // Restore volume to default levels
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, 7, 0)
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_RING, 5, 0)
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION, 5, 0)
            audioManager.setStreamVolume(android.media.AudioManager.STREAM_SYSTEM, 5, 0)
            
            Log.i(TAG, "🛡️ Device Owner lockdown restrictions cleared (volume restored)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear lockdown restrictions: ${e.message}")
        }
    }

    // ── INSTALL APK ──────────────────────────────────────────────────────────
    private fun installApk(context: Context, command: JSONObject): Boolean {
        val commandId = command.optString("commandId", "")
        val backendUrl = Prefs.getBackendUrl(context)
        val deviceId   = Prefs.getDeviceId(context)
        val apiKey     = Prefs.getApiKey(context)

        if (commandId.isBlank() || backendUrl.isBlank()) {
            Log.e(TAG, "Missing commandId or backendUrl for APK install")
            return false
        }

        val apkUrl = "$backendUrl/api/dpc/apk/$commandId"
        val fileName = "rental_apk_$commandId.apk"

        Log.i(TAG, "📦 Downloading APK from $apkUrl")

        // Use DownloadManager to handle the download with auth headers
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .addRequestHeader("X-DPC-Device-Id", deviceId)
            .addRequestHeader("X-DPC-Api-Key", apiKey)
            .setTitle("Rental DPC - Downloading update")
            .setDescription("Downloading app from MDM server")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            .setMimeType("application/vnd.android.package-archive")
        dm.enqueue(request)

        Log.i(TAG, "📦 APK download enqueued: $fileName")
        return true
    }

    // ── REBOOT ───────────────────────────────────────────────────────────────
    private fun reboot(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        return if (dpm.isAdminActive(admin)) {
            dpm.reboot(admin)
            Log.i(TAG, "🔄 Device reboot initiated")
            true
        } else {
            Log.e(TAG, "Device Admin not active — cannot reboot")
            false
        }
    }

    // ── UNENROLL ─────────────────────────────────────────────────────────────
    private fun unenroll(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        return try {
            // 1. Clear all restrictions (baseline + lock)
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                clearBaselineRestrictions(dpm, admin, context.packageName)
                clearLockdownRestrictions(dpm, admin, context)
            }
            // 2. Restore system apps (Camera, Gallery, etc.)
            restoreSystemApps(context)
            // 3. Clear Device Owner (must be before removeActiveAdmin)
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                dpm.clearDeviceOwnerApp(context.packageName)
                Log.i(TAG, "🔓 Device Owner cleared")
            }
            // 4. Remove Device Admin
            if (dpm.isAdminActive(admin)) {
                dpm.removeActiveAdmin(admin)
                Log.i(TAG, "🔓 Device Admin deactivated")
            }
            // 4. Stop overlay service and dismiss lock
            LockOverlayService.stop(context)
            context.sendBroadcast(android.content.Intent(LockActivity.ACTION_UNLOCK), LockActivity.UNLOCK_PERMISSION)
            // 5. Clear stored credentials LAST (after everything else is done)
            Prefs.clear(context)
            DpcPollingService.stop(context)
            Log.i(TAG, "✅ Unenroll complete — all restrictions removed, app is now removable")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Unenroll failed: ${e.message}")
            false
        }
    }

    // ── WIPE ─────────────────────────────────────────────────────────────────
    private fun wipeData(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        return try {
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                Log.i(TAG, "🚨 WIPE command received — factory resetting device!")
                dpm.wipeData(0)
                true
            } else {
                Log.e(TAG, "Cannot wipe data: App is not Device Owner")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Wipe data failed: ${e.message}")
            false
        }
    }
}
