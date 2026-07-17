package com.rental.dpc

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.IBinder
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Foreground service that shows a full-screen system overlay when the device is locked.
 * Uses TYPE_APPLICATION_OVERLAY when the special overlay permission is already allowed.
 */
class LockOverlayService : Service() {

    companion object {
        private const val TAG = "LockOverlay"
        private const val NOTIFICATION_ID = 9002
        private const val CHANNEL_ID = "mdm_lock_overlay"

        fun start(context: Context) {
            val intent = Intent(context, LockOverlayService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, LockOverlayService::class.java))
        }

        fun canDrawOverlays(context: Context): Boolean {
            return Settings.canDrawOverlays(context)
        }
    }

    private var overlayView: View? = null
    private val windowManager by lazy { getSystemService(WINDOW_SERVICE) as WindowManager }

    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == LockActivity.ACTION_UNLOCK) {
                stopSelf()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        BroadcastCompat.registerInternalReceiver(this, unlockReceiver, IntentFilter(LockActivity.ACTION_UNLOCK))
        overlayView = null
        showOverlay()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        removeOverlay()
        try { unregisterReceiver(unlockReceiver) } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun showOverlay() {
        removeOverlay()

        // Turn screen on
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "rental:lock_screen"
            )
            wl.acquire(10 * 1000L)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to acquire wake lock: ${e.message}")
        }

        // Check if we have overlay permission
        if (!canDrawOverlays(this)) {
            Log.w(TAG, "Overlay permission not granted — LockActivity + Lock Task Mode handle lock")
            return
        }

        // Use TYPE_APPLICATION_OVERLAY (works on Android 8+ for Device Owner)
        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_FULLSCREEN or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
        }

        overlayView = buildOverlayView()
        try {
            windowManager.addView(overlayView, layoutParams)
            Log.i(TAG, "✅ Full-screen lock overlay displayed")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to add overlay view: ${e.message}")
            // Try alternative type
            try {
                layoutParams.type = WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
                windowManager.addView(overlayView, layoutParams)
                Log.i(TAG, "✅ Full-screen lock overlay displayed (TYPE_SYSTEM_ALERT fallback)")
            } catch (e2: Exception) {
                Log.e(TAG, "❌ Failed to add overlay with fallback: ${e2.message}")
            }
        }
    }

    private fun removeOverlay() {
        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to remove overlay: ${e.message}")
            }
        }
        overlayView = null
    }

    private fun buildOverlayView(): View {
        val reason = Prefs.getLockReason(this)

        val (icon, titleTh, bodyTh, titleEn, bodyEn) = when (reason) {
            "dev_options" -> LockOverlayContent(
                icon = "🔒",
                titleTh = "ตรวจพบการเปิดโหมดนักพัฒนา",
                bodyTh = "📵 กรุณาปิด Developer Options เพื่อใช้งานต่อ\n(Settings → Developer Options → Off)",
                titleEn = "Developer Options Detected",
                bodyEn = "Developer Options is enabled on this device.\n\nPlease turn it OFF to resume using the device."
            )
            "usb_debug" -> LockOverlayContent(
                icon = "🔒",
                titleTh = "ตรวจพบการเปิด USB Debugging",
                bodyTh = "📵 กรุณาปิด USB Debugging เพื่อใช้งานต่อ\n(Settings → Developer Options → USB Debugging → Off)",
                titleEn = "USB Debugging Detected",
                bodyEn = "USB Debugging is enabled on this device.\n\nPlease disable it to resume using the device."
            )
            "admin_removed" -> LockOverlayContent(
                icon = "⛔",
                titleTh = "ถูกตรวจจับการถอดถอนสิทธิ์",
                bodyTh = "📞 กรุณาติดต่อร้านเช่าเพื่อดำเนินการต่อ",
                titleEn = "Device Admin Removed",
                bodyEn = "Device Admin permission was removed.\n\nPlease contact the shop to restore your device."
            )
            else -> LockOverlayContent(
                icon = "🔒",
                titleTh = "เครื่องถูกล็อคโดยระบบบริหารจัดการ",
                bodyTh = "📞 กรุณาติดต่อร้านเช่าเพื่อปลดล็อคและใช้งานต่อ",
                titleEn = "Device Locked",
                bodyEn = "This device has been remotely locked by the rental management system.\n\nPlease contact the shop to unlock your device."
            )
        }

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0A0E1A"))
            setPadding(72, 72, 72, 72)
            setOnTouchListener { _, _ -> true }

            addView(TextView(this@LockOverlayService).apply {
                text = icon
                textSize = 80f
                gravity = Gravity.CENTER
            })

            addView(TextView(this@LockOverlayService).apply {
                text = titleTh
                textSize = 22f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(Color.parseColor("#FF5252"))
                gravity = Gravity.CENTER
                setPadding(0, 32, 0, 0)
            })

            addView(TextView(this@LockOverlayService).apply {
                text = bodyTh
                textSize = 17f
                setTextColor(Color.parseColor("#E0E0E0"))
                gravity = Gravity.CENTER
                setPadding(0, 20, 0, 0)
            })

            addView(TextView(this@LockOverlayService).apply {
                text = "──────────────────────"
                textSize = 14f
                setTextColor(Color.parseColor("#334460"))
                gravity = Gravity.CENTER
                setPadding(0, 24, 0, 24)
            })

            addView(TextView(this@LockOverlayService).apply {
                text = titleEn
                textSize = 18f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(Color.parseColor("#FF8A80"))
                gravity = Gravity.CENTER
            })

            addView(TextView(this@LockOverlayService).apply {
                text = bodyEn
                textSize = 15f
                setTextColor(Color.parseColor("#9EAFCD"))
                gravity = Gravity.CENTER
                setPadding(0, 12, 0, 0)
            })
        }
    }

    private data class LockOverlayContent(
        val icon: String,
        val titleTh: String,
        val bodyTh: String,
        val titleEn: String,
        val bodyEn: String
    )

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

    private fun buildNotification(): Notification =
        Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("")
            .setContentText("")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_MIN)
            .setVisibility(Notification.VISIBILITY_SECRET)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
}
