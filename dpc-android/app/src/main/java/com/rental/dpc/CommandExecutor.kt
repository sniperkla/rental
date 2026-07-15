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
                "LOCK"        -> lock(context)
                "UNLOCK"      -> unlock(context)
                "INSTALL_APK" -> installApk(context, command)
                "REBOOT"      -> reboot(context)
                "UNENROLL"    -> unenroll(context)
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
    private fun lock(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        return if (dpm.isAdminActive(admin)) {
            // 1. Persist lock state (survives reboot)
            Prefs.setDeviceLocked(context, true)
            Prefs.setLockReason(context, "server")
            // 2. Apply extra restrictions if Device Owner
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                applyLockdownRestrictions(dpm, admin)
            }
            // 3. Show persistent notification (visible on keyguard)
            showLockScreenNotification(context)
            // 4. Launch fullscreen kiosk LockActivity + persistent overlay service
            LockActivity.start(context)
            LockOverlayService.start(context)
            // 5. Lock the keyguard as well for extra security
            dpm.lockNow()
            Log.i(TAG, "🔒 Device locked via LockActivity (owner=${dpm.isDeviceOwnerApp(context.packageName)})")
            true
        } else {
            Log.e(TAG, "Device Admin not active — cannot lock!")
            false
        }
    }

    /** Device Owner only: disable camera, USB, and other features during lock. */
    private fun applyLockdownRestrictions(dpm: DevicePolicyManager, admin: ComponentName) {
        try {
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_INSTALL_APPS)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_UNINSTALL_APPS)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_CONFIG_WIFI)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_SHARE_LOCATION)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_USB_FILE_TRANSFER)
            dpm.addUserRestriction(admin, android.os.UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            dpm.setCameraDisabled(admin, true)
            Log.i(TAG, "🛡️ Device Owner lockdown restrictions applied")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply lockdown restrictions: ${e.message}")
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
            clearLockdownRestrictions(dpm, admin)
        }
        // 3. Dismiss lock screen notification
        dismissLockNotification(context)
        // 4. Dismiss LockActivity via broadcast + stop overlay service
        context.sendBroadcast(Intent(LockActivity.ACTION_UNLOCK))
        LockOverlayService.stop(context)
        Log.i(TAG, "🔓 Unlock command received — LockActivity + overlay dismissed")
        return true
    }

    /** Device Owner only: remove lockdown restrictions. */
    private fun clearLockdownRestrictions(dpm: DevicePolicyManager, admin: ComponentName) {
        try {
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_INSTALL_APPS)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_UNINSTALL_APPS)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_CONFIG_WIFI)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_SHARE_LOCATION)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_USB_FILE_TRANSFER)
            dpm.clearUserRestriction(admin, android.os.UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            dpm.setCameraDisabled(admin, false)
            Log.i(TAG, "🛡️ Device Owner lockdown restrictions cleared")
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
            if (dpm.isAdminActive(admin)) {
                dpm.removeActiveAdmin(admin)
                Log.i(TAG, "🔓 Device Admin deactivated — app can now be uninstalled")
            }
            // Clear stored credentials and stop the polling service
            Prefs.clear(context)
            DpcPollingService.stop(context)
            Log.i(TAG, "✅ Unenroll complete — app is now removable via Settings > Apps")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Unenroll failed: ${e.message}")
            false
        }
    }
}
