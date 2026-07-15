package com.rental.dpc

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen kiosk lock activity.
 *
 * Launched by CommandExecutor when LOCK command is received.
 * Dismissed by CommandExecutor (via broadcast) when UNLOCK command is received.
 *
 * Security:
 *  - Shows over the lock screen (FLAG_SHOW_WHEN_LOCKED)
 *  - Blocks Back button
 *  - Re-launches itself when Home is pressed (onUserLeaveHint)
 *  - Re-focuses itself on window focus loss
 *  - Excluded from Recent Apps
 */
class LockActivity : Activity() {

    companion object {
        const val ACTION_UNLOCK = "com.rental.dpc.ACTION_UNLOCK"

        fun start(context: Context) {
            val intent = Intent(context, LockActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_NO_HISTORY or
                    Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TASK
                )
            }
            context.startActivity(intent)
        }
    }

    private val handler = Handler(Looper.getMainLooper())

    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == ACTION_UNLOCK) {
                finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over the keyguard/lock screen
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        // API 27+ deprecation-safe equivalents
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        // Hide all system UI bars for a true full-screen look
        window.decorView.systemUiVisibility = (
            android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
            android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
        )

        buildUI()

        registerReceiver(unlockReceiver, IntentFilter(ACTION_UNLOCK))
    }

    private fun buildUI() {
        val reason = Prefs.getLockReason(this)

        val (icon, titleTh, bodyTh, titleEn, bodyEn) = when (reason) {
            "dev_options" -> LockContent(
                icon    = "🔒",
                titleTh = "ตรวจพบการเปิดโหมดนักพัฒนา",
                bodyTh  = "📵 กรุณาปิด Developer Options เพื่อใช้งานต่อ\n(Settings → Developer Options → Off)",
                titleEn = "Developer Options Detected",
                bodyEn  = "Developer Options is enabled on this device.\n\nPlease turn it OFF to resume using the device."
            )
            "usb_debug" -> LockContent(
                icon    = "🔒",
                titleTh = "ตรวจพบการเปิด USB Debugging",
                bodyTh  = "📵 กรุณาปิด USB Debugging เพื่อใช้งานต่อ\n(Settings → Developer Options → USB Debugging → Off)",
                titleEn = "USB Debugging Detected",
                bodyEn  = "USB Debugging is enabled on this device.\n\nPlease disable it to resume using the device."
            )
            "admin_removed" -> LockContent(
                icon    = "⛔",
                titleTh = "ถูกตรวจจับการถอดถอนสิทธิ์",
                bodyTh  = "📞 กรุณาติดต่อร้านเช่าเพื่อดำเนินการต่อ",
                titleEn = "Device Admin Removed",
                bodyEn  = "Device Admin permission was removed.\n\nPlease contact the shop to restore your device."
            )
            else -> LockContent(
                icon    = "🔒",
                titleTh = "เครื่องถูกล็อคโดยระบบบริหารจัดการ",
                bodyTh  = "📞 กรุณาติดต่อร้านเช่าเพื่อปลดล็อคและใช้งานต่อ",
                titleEn = "Device Locked",
                bodyEn  = "This device has been remotely locked by the rental management system.\n\nPlease contact the shop to unlock your device."
            )
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0A0E1A"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setPadding(72, 72, 72, 72)
        }

        root.addView(TextView(this).apply {
            text = icon
            textSize = 80f
            gravity = Gravity.CENTER
        })

        root.addView(TextView(this).apply {
            text = titleTh
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(Color.parseColor("#FF5252"))
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 0)
        })

        root.addView(TextView(this).apply {
            text = bodyTh
            textSize = 17f
            setTextColor(Color.parseColor("#E0E0E0"))
            gravity = Gravity.CENTER
            setPadding(0, 20, 0, 0)
        })

        root.addView(TextView(this).apply {
            text = "──────────────────────"
            textSize = 14f
            setTextColor(Color.parseColor("#334460"))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 24)
        })

        root.addView(TextView(this).apply {
            text = titleEn
            textSize = 18f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(Color.parseColor("#FF8A80"))
            gravity = Gravity.CENTER
        })

        root.addView(TextView(this).apply {
            text = bodyEn
            textSize = 15f
            setTextColor(Color.parseColor("#9EAFCD"))
            gravity = Gravity.CENTER
            setPadding(0, 12, 0, 0)
        })

        setContentView(root)
    }

    private data class LockContent(
        val icon: String,
        val titleTh: String,
        val bodyTh: String,
        val titleEn: String,
        val bodyEn: String
    )

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        try { unregisterReceiver(unlockReceiver) } catch (_: Exception) {}
    }

    // ── Prevent user from leaving ──────────────────────────────────────────────

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        // Block back button entirely
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_BACK,
            KeyEvent.KEYCODE_MENU,
            KeyEvent.KEYCODE_SEARCH -> true   // consumed / blocked
            else -> super.onKeyDown(keyCode, event)
        }
    }

    override fun onUserLeaveHint() {
        // Home button pressed — relaunch ourselves after a short delay
        handler.postDelayed({ start(this) }, 300)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // Re-apply immersive mode any time focus returns
        if (hasFocus) {
            window.decorView.systemUiVisibility = (
                android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        } else {
            // Lost focus — bring ourselves back to front
            handler.postDelayed({ start(this) }, 500)
        }
    }

    override fun onPause() {
        super.onPause()
        // Re-launch after short delay in case something pushed us to the background
        handler.postDelayed({ start(this) }, 400)
    }
}
