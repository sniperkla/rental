package com.rental.dpc

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.IBinder
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Foreground service that shows a full-screen system overlay when the device is locked.
 *
 * Uses WindowManager with TYPE_APPLICATION_OVERLAY to display over ALL apps and the keyguard.
 * This is much more reliable than a regular Activity — users cannot navigate away from it.
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
    }

    private var overlayView: View? = null
    private val windowManager by lazy { getSystemService(WINDOW_SERVICE) as WindowManager }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        showOverlay()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        removeOverlay()
        super.onDestroy()
    }

    private fun showOverlay() {
        if (overlayView != null) return

        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // NOT_FOCUSABLE omitted intentionally — on Android 12+, adding it
            // causes the system to show a dim layer with swipe-to-dismiss.
            // We keep the overlay focusable and intercept all touches ourselves.
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_FULLSCREEN or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.OPAQUE
        ).apply {
            gravity = Gravity.CENTER
        }

        overlayView = buildOverlayView()
        windowManager.addView(overlayView, layoutParams)
        Log.i(TAG, "🔒 Touch-blocking Lock overlay displayed")
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
        val isAdb = Prefs.isAdbBlocked(this)

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0A0E1A")) // Pure midnight dark background
            setPadding(64, 64, 64, 64)

            // Intercept and swallow all touches so user can't tap buttons/settings behind
            setOnTouchListener { _, _ -> true }

            addView(TextView(this@LockOverlayService).apply {
                text = "🔒"
                textSize = 80f
                gravity = Gravity.CENTER
            })

            addView(TextView(this@LockOverlayService).apply {
                text = if (isAdb) "ตรวจพบการเปิดโหมดพัฒนาซอฟต์แวร์" else "เครื่องถูกล็อคโดยระบบบริหารจัดการ"
                textSize = 24f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(Color.parseColor("#FF5252")) // Neon red
                gravity = Gravity.CENTER
                setPadding(0, 32, 0, 0)
            })

            addView(TextView(this@LockOverlayService).apply {
                text = if (isAdb) "📞 กรุณาปิด USB Debugging เพื่อใช้งานต่อ" else "📞 กรุณาติดต่อร้านเช่าเพื่อปลดล็อคและใช้งานต่อ"
                textSize = 18f
                setTextColor(Color.parseColor("#E0E0E0"))
                gravity = Gravity.CENTER
                setPadding(0, 24, 0, 0)
            })

            addView(TextView(this@LockOverlayService).apply {
                text = "──────────────────────"
                textSize = 14f
                setTextColor(Color.parseColor("#334460"))
                gravity = Gravity.CENTER
                setPadding(0, 24, 0, 24)
            })

            addView(TextView(this@LockOverlayService).apply {
                text = if (isAdb) "USB Debugging Detected" else "Device Locked"
                textSize = 20f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(Color.parseColor("#FF8A80"))
                gravity = Gravity.CENTER
            })

            addView(TextView(this@LockOverlayService).apply {
                text = if (isAdb) 
                    "USB Debugging is enabled on this device. Please turn it off in Developer Options to resume using your device."
                else 
                    "This device has been remotely locked by the rental management system.\n\nPlease contact the shop to unlock your device."
                textSize = 15f
                setTextColor(Color.parseColor("#9EAFCD"))
                gravity = Gravity.CENTER
                setPadding(0, 12, 0, 0)
            })
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Display Services",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "Display maintenance"
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_SECRET
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification =
        Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Display Services")
            .setContentText("Running")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_MIN)
            .setVisibility(Notification.VISIBILITY_SECRET)
            .build()
}
