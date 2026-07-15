package com.rental.dpc

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Foreground service that runs an HTTP Long Polling loop for instant
 * command delivery with sub-second latency, and automatically handles re-connections.
 *
 * Authentication headers:
 *   X-DPC-Device-Id: <standaloneDeviceId>
 *   X-DPC-Api-Key:   <rawApiKey>
 */
class DpcPollingService : Service() {

    companion object {
        private const val TAG = "DpcPolling"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "dpc_polling"

        fun start(context: Context) {
            val intent = Intent(context, DpcPollingService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, DpcPollingService::class.java))
        }
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(35, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pollingJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("MDM Agent running..."))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startPolling()
        return START_STICKY  // Restart automatically if killed
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    /**
     * Called when device is removed from the backend (401/404).
     * Clears all credentials, stops services, and brings user back to scan screen.
     */
    private fun handleDeviceRemoved() {
        Log.w(TAG, "Device removed — clearing all state")

        // Stop overlay service if running
        try { LockOverlayService.stop(this) } catch (_: Exception) {}

        // Dismiss lock activity if showing
        sendBroadcast(android.content.Intent(LockActivity.ACTION_UNLOCK))

        // Clear all stored credentials
        Prefs.clear(this)

        // Stop this polling service
        DpcPollingService.stop(this)

        // Launch MainActivity to show scan screen
        val intent = android.content.Intent(this, MainActivity::class.java).apply {
            addFlags(
                android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK or
                android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }
        startActivity(intent)
    }

    // ─── Polling Loop ──────────────────────────────────────────────────────────

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = serviceScope.launch {
            while (isActive) {
                // Security check: Lock if user deactivated Device Admin
                checkDeviceAdminStatus()

                var success = false
                try {
                    poll()
                    success = true
                } catch (e: Exception) {
                    Log.e(TAG, "Poll error: ${e.message}")
                    checkOfflineGracePeriod()
                }

                if (!success) {
                    val intervalSeconds = Prefs.getPollInterval(this@DpcPollingService).toLong()
                    delay(intervalSeconds * 1000)
                } else {
                    delay(200)
                }
            }
        }
    }

    private fun checkDeviceAdminStatus() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
        val admin = android.content.ComponentName(this, DpcAdminReceiver::class.java)
        
        if (!Prefs.isEnrolled(this)) return

        // 1. Device Admin removed check
        //    Guard with wasAdminEverActive so we don't lock during the first enrollment
        //    window before the user taps "Activate" on the system dialog.
        if (Prefs.wasAdminEverActive(this) && !dpm.isAdminActive(admin)) {
            Log.w(TAG, "⚠️ Device Admin removed! Locking device.")
            Prefs.setDeviceLocked(this, true)
            Prefs.setLockReason(this, "admin_removed")
            LockActivity.start(this)
            if (LockOverlayService.canDrawOverlays(this)) {
                LockOverlayService.start(this)
            }
            return
        }

        // 2. Developer Options / ADB check (for both Device Admin and Device Owner)
        //    Even with DISALLOW_DEBUGGING_FEATURES, some devices still allow enabling Developer Options UI
        val isDevOptionsOn = android.provider.Settings.Global.getInt(
            contentResolver,
            android.provider.Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
            0
        ) != 0

        val isAdbOn = android.provider.Settings.Global.getInt(
            contentResolver,
            android.provider.Settings.Global.ADB_ENABLED,
            0
        ) != 0

        val isViolation = isDevOptionsOn || isAdbOn
        val isAlreadyBlocked = Prefs.isAdbBlocked(this)
        
        Log.d(TAG, "🔍 Dev options check: devOptions=$isDevOptionsOn adb=$isAdbOn isViolation=$isViolation isAlreadyBlocked=$isAlreadyBlocked")

        if (isViolation) {
            if (!isAlreadyBlocked) {
                val reason = when {
                    isAdbOn       -> "usb_debug"
                    isDevOptionsOn -> "dev_options"
                    else           -> "dev_options"
                }
                
                // Check if warning has already been shown
                val warningShown = Prefs.isDevOptionsWarningShown(this)
                
                if (!warningShown) {
                    // Stage 1: Show warning notification (not full lock yet)
                    Log.w(TAG, "⚠️ Developer Options detected — showing warning")
                    Prefs.setDevOptionsWarningShown(this, true)
                    showDevOptionsWarning(this@DpcPollingService)
                } else {
                    // Stage 2: Warning ignored — apply full lock
                    Log.w(TAG, "⚠️ Developer Options still enabled after warning! Locking device.")
                    Prefs.setAdbBlocked(this, true)
                    Prefs.setDeviceLocked(this, true)
                    Prefs.setLockReason(this, reason)
                    
                    // For Device Owner: actively disable Developer Options
                    if (dpm.isDeviceOwnerApp(packageName)) {
                        try {
                            dpm.setGlobalSetting(admin, android.provider.Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, "0")
                            dpm.setGlobalSetting(admin, android.provider.Settings.Global.ADB_ENABLED, "0")
                            Log.i(TAG, "✅ Developer Options and ADB disabled via setGlobalSetting (Device Owner)")
                        } catch (e: Exception) {
                            Log.w(TAG, "Could not disable Developer Options/ADB: ${e.message}")
                        }
                    }
                    
                    LockActivity.start(this)
                    if (LockOverlayService.canDrawOverlays(this)) {
                        LockOverlayService.start(this)
                    }
                }
            } else {
                Log.d(TAG, "Device already blocked for dev options, skipping")
            }
        } else {
            if (isAlreadyBlocked) {
                Log.i(TAG, "✅ Developer Options disabled. Releasing dev-mode lock.")
                Prefs.setAdbBlocked(this, false)
                Prefs.setDeviceLocked(this, false)
                Prefs.setLockReason(this, "")
                Prefs.setDevOptionsWarningShown(this, false) // Reset warning flag
                dismissDevOptionsWarning(this@DpcPollingService) // Dismiss warning notification
                sendBroadcast(android.content.Intent(LockActivity.ACTION_UNLOCK))
            }
        }
    }

    private fun checkOfflineGracePeriod() {
        if (!Prefs.isOfflineLockEnabled(this)) {
            Log.d(TAG, "Offline lock is disabled in settings")
            return
        }

        // Skip auto-lock during recovery cooldown (24h after recovery unlock)
        if (Prefs.isWithinRecoveryCooldown(this)) {
            Log.d(TAG, "Within recovery cooldown — skipping auto-lock")
            return
        }

        val offlineMs = Prefs.msSinceLastPoll(this)
        val graceMs = Prefs.getOfflineGracePeriod(this)
        if (offlineMs >= graceMs) {
            val offlineSecs = offlineMs / 1000
            Log.w(TAG, "🔒 Device offline for ${offlineSecs}s — auto-locking (grace period exceeded)")
            CommandExecutor.execute(this, org.json.JSONObject().apply {
                put("commandType", "LOCK")
            })
        } else {
            val remainingSecs = (graceMs - offlineMs) / 1000
            Log.d(TAG, "📵 Offline — ${remainingSecs}s until auto-lock")
        }
    }

    private fun poll() {
        val ctx = this
        val deviceId   = Prefs.getDeviceId(ctx)
        val apiKey     = Prefs.getApiKey(ctx)
        val backendUrl = Prefs.getBackendUrl(ctx)

        if (deviceId.isBlank() || apiKey.isBlank() || backendUrl.isBlank()) {
            Log.w(TAG, "Not enrolled — skipping poll")
            return
        }

        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)

        // Build telemetry payload
        val telemetry = JSONObject().apply {
            put("battery_pct", getBatteryLevel())
            put("wifi_ssid", "unknown")
            put("is_device_owner", isDeviceOwner)
        }
        val body = JSONObject().apply {
            put("telemetry", telemetry)
        }

        val request = Request.Builder()
            .url("$backendUrl/api/dpc/poll")
            .addHeader("X-DPC-Device-Id", deviceId)
            .addHeader("X-DPC-Api-Key", apiKey)
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()

        Log.d(TAG, "⏱ Polling $backendUrl...")
        val response = client.newCall(request).execute()
        if (!response.isSuccessful) {
            Log.e(TAG, "Poll failed: HTTP ${response.code}")

            // Device deleted or unauthorized — clear credentials, go back to scan
            if (response.code == 401 || response.code == 404) {
                Log.w(TAG, "⚠️ Device removed or unauthorized — clearing enrollment")
                handleDeviceRemoved()
            }
            return
        }

        // ✅ Record successful poll timestamp (resets offline grace period)
        Prefs.recordPollSuccess(this)

        val responseBody = response.body?.string() ?: return
        val json = JSONObject(responseBody)

        // Update poll interval if server suggests a new one
        val newInterval = json.optInt("pollingIntervalSeconds", 30)
        Prefs.save(ctx, deviceId, apiKey, backendUrl, newInterval)

        // Execute each pending command
        val commands = json.optJSONArray("commands") ?: return
        Log.i(TAG, "📡 Received ${commands.length()} command(s)")

        for (i in 0 until commands.length()) {
            val cmd = commands.getJSONObject(i)
            val commandId = cmd.optString("commandId", "")
            val success = CommandExecutor.execute(ctx, cmd)
            sendCallback(deviceId, apiKey, backendUrl, commandId, success)
        }
    }

    // ─── Command Callback ──────────────────────────────────────────────────────

    private fun sendCallback(
        deviceId: String,
        apiKey: String,
        backendUrl: String,
        commandId: String,
        success: Boolean,
        message: String = ""
    ) {
        try {
            val body = JSONObject().apply {
                put("commandId", commandId)
                put("success", success)
                if (message.isNotBlank()) put("message", message)
            }

            val request = Request.Builder()
                .url("$backendUrl/api/dpc/command-callback")
                .addHeader("X-DPC-Device-Id", deviceId)
                .addHeader("X-DPC-Api-Key", apiKey)
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()
            Log.i(TAG, "📬 Callback sent for $commandId → HTTP ${response.code}")
        } catch (e: Exception) {
            Log.e(TAG, "Callback failed for $commandId: ${e.message}")
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private fun showDevOptionsWarning(context: Context) {
        val channelId = "dev_options_warning"
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

        val channel = android.app.NotificationChannel(
            channelId,
            "Security Warning",
            android.app.NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Developer Options warning"
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            enableVibration(true)
        }
        nm.createNotificationChannel(channel)

        val notification = android.app.Notification.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("⚠️ Developer Options Detected")
            .setContentText("Please disable Developer Options immediately or the device will be locked!")
            .setStyle(
                android.app.Notification.BigTextStyle()
                    .bigText("Developer Options or USB Debugging has been detected on this device.\n\n" +
                            "Please go to Settings → Developer Options → Turn it OFF immediately.\n\n" +
                            "If not disabled, the device will be LOCKED on the next check (within 30 seconds).")
            )
            .setOngoing(true)
            .setPriority(android.app.Notification.PRIORITY_HIGH)
            .setVisibility(android.app.Notification.VISIBILITY_PUBLIC)
            .build()

        nm.notify(9003, notification)
    }

    private fun dismissDevOptionsWarning(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        nm.cancel(9003)
    }

    private fun getBatteryLevel(): Int {
        val bm = getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager
        return bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "System",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "System maintenance"
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_SECRET
            setSound(null, null)
            enableVibration(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification =
        Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("")
            .setContentText("")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_MIN)
            .setVisibility(Notification.VISIBILITY_SECRET)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()

    private fun updateNotification(text: String) {
        // Don't update — keep it minimal and generic
        val notification = buildNotification(text)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }
}
