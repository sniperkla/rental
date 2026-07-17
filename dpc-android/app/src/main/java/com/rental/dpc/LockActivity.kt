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
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import java.security.MessageDigest

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
        const val UNLOCK_PERMISSION = "com.rental.dpc.permission.UNLOCK"

        fun start(context: Context) {
            val intent = Intent(context, LockActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
            }
            context.startActivity(intent)
        }
    }

    private val handler = Handler(Looper.getMainLooper())

    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == ACTION_UNLOCK) {
                LockTaskHelper.stopLockTask(this@LockActivity)
                finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyWindowFlags()
        buildUI()
        LockTaskHelper.startLockTask(this)
        BroadcastCompat.registerInternalReceiver(this, unlockReceiver, IntentFilter(ACTION_UNLOCK))
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        buildUI()
    }

    private fun applyWindowFlags() {
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

        // ── Dismiss button for dev_options / usb_debug ─────────────────────
        if (reason == "dev_options" || reason == "usb_debug") {
            root.addView(android.widget.Button(this).apply {
                text = "ไปปิด Developer Options"
                textSize = 14f
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.parseColor("#2196F3"))
                setPadding(32, 16, 32, 16)

                setOnClickListener {
                    // Reset warning so polling shows warning again before re-locking
                    Prefs.setDevOptionsWarningShown(this@LockActivity, false)
                    Prefs.setDeviceLocked(this@LockActivity, false)
                    Prefs.setLockReason(this@LockActivity, "")
                    Prefs.setAdbBlocked(this@LockActivity, false)

                    // Dismiss lock screen
                    sendBroadcast(Intent(ACTION_UNLOCK), UNLOCK_PERMISSION)

                    // Open Developer Options settings
                    try {
                        startActivity(Intent(android.provider.Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        })
                    } catch (_: Exception) {
                        // Fallback: open general settings
                        startActivity(Intent(android.provider.Settings.ACTION_SETTINGS).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        })
                    }
                    finish()
                }
            })
        }

        // ── Recovery Code Input (only visible after 2+ hours offline) ──────
        if (shouldShowRecoveryCode()) {
            root.addView(TextView(this).apply {
                text = "──────────────────────"
                textSize = 14f
                setTextColor(Color.parseColor("#334460"))
                gravity = Gravity.CENTER
                setPadding(0, 32, 0, 24)
            })

            root.addView(TextView(this).apply {
                text = "ปลดล็อคด้วยรหัสกู้คืน"
                textSize = 14f
                setTextColor(Color.parseColor("#F59E0B"))
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 12)
            })

            val recoveryInput = EditText(this@LockActivity).apply {
                hint = "กรอกรหัสกู้คืน 8 หลัก"
                setTextColor(Color.WHITE)
                setHintTextColor(Color.parseColor("#6B7280"))
                setBackgroundColor(Color.parseColor("#1E293B"))
                textSize = 18f
                gravity = Gravity.CENTER
                setPadding(24, 16, 24, 16)
                maxLines = 1
                inputType = android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS or
                        android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            }
            root.addView(recoveryInput)

            val statusText = TextView(this).apply {
                text = ""
                textSize = 12f
                setTextColor(Color.parseColor("#EF4444"))
                gravity = Gravity.CENTER
                setPadding(0, 8, 0, 0)
            }
            root.addView(statusText)

            root.addView(android.widget.Button(this).apply {
                text = "ปลดล็อค"
                textSize = 14f
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.parseColor("#F59E0B"))
                setPadding(32, 12, 32, 12)

                setOnClickListener {
                    val code = recoveryInput.text.toString().trim().uppercase()

                    // Rate limiting: 3 failed attempts → 30s cooldown
                    val attempts = Prefs.getRecoveryAttempts(this@LockActivity)
                    val cooldownUntil = Prefs.getRecoveryCooldownUntil(this@LockActivity)
                    val now = System.currentTimeMillis()

                    if (now < cooldownUntil) {
                        val remaining = ((cooldownUntil - now) / 1000).toInt()
                        statusText.text = "ลองใหม่ใน ${remaining} วินาที"
                        return@setOnClickListener
                    }

                    if (code.length != 8) {
                        statusText.text = "รหัสต้องมี 8 ตัวอักษร"
                        return@setOnClickListener
                    }

                    if (validateRecoveryCode(code)) {
                        // Success — unlock device
                        Prefs.setRecoveryAttempts(this@LockActivity, 0)
                        Prefs.setDeviceLocked(this@LockActivity, false)
                        Prefs.setLockReason(this@LockActivity, "")
                        Prefs.setRecoveryUnlocked(this@LockActivity) // 24h cooldown
                        sendBroadcast(Intent(ACTION_UNLOCK), UNLOCK_PERMISSION)
                        finish()
                    } else {
                        // Failed — increment attempts
                        val newAttempts = attempts + 1
                        Prefs.setRecoveryAttempts(this@LockActivity, newAttempts)

                        if (newAttempts >= 3) {
                            Prefs.setRecoveryCooldownUntil(this@LockActivity, now + 30_000)
                            Prefs.setRecoveryAttempts(this@LockActivity, 0)
                            statusText.text = "ลองผิด 3 ครั้ง — รอ 30 วินาที"
                        } else {
                            statusText.text = "รหัสไม่ถูกต้อง (${newAttempts}/3)"
                        }
                    }
                }
            })
        }

        setContentView(root)
    }

    /** Show recovery code input only when device has been offline for 2+ hours. */
    private fun shouldShowRecoveryCode(): Boolean {
        if (!Prefs.hasRecoveryCode(this)) return false
        val offlineMs = Prefs.msSinceLastPoll(this)
        return offlineMs >= 2 * 60 * 60 * 1000L // 2 hours
    }

    /** Validate recovery code against stored SHA-256 hash. */
    private fun validateRecoveryCode(code: String): Boolean {
        val storedHash = Prefs.getRecoveryCodeHash(this)
        if (storedHash.isBlank()) return false
        val inputHash = sha256(code)
        return inputHash == storedHash
    }

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
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
        // Without overlay permission, re-launch lock screen when user presses Home.
        if (!LockOverlayService.canDrawOverlays(this)) {
            handler.postDelayed({ start(this) }, 200)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applyWindowFlags()
        }
    }

    override fun onResume() {
        super.onResume()
        applyWindowFlags()
    }

    override fun onPause() {
        super.onPause()
    }
}
