package com.rental.dpc

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * Shown once after Setup Wizard QR provisioning when overlay permission is not yet granted.
 * Auto-opens the system "Display over other apps" settings screen.
 */
class ProvisioningSetupActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())
    private var openedSettings = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.clearOverlaySetupPending(this)
        buildUI()

        if (OverlayPermissionHelper.canDrawOverlays(this)) {
            finishSetup()
            return
        }

        // Auto-open Settings after 1.5s so user can see the instructions first
        handler.postDelayed({
            openedSettings = true
            OverlayPermissionHelper.openOverlaySettings(this)
        }, 1500)
    }

    override fun onResume() {
        super.onResume()
        if (OverlayPermissionHelper.canDrawOverlays(this)) {
            finishSetup()
        } else if (openedSettings) {
            Toast.makeText(
                this,
                "กรุณาเปิด \"Allow display over other apps\" แล้วกลับมาที่แอปนี้",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun buildUI() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0A0E1A"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setPadding(48, 48, 48, 48)
        }

        root.addView(TextView(this).apply {
            text = "ขั้นตอนสุดท้าย"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(Color.parseColor("#00E676"))
            gravity = Gravity.CENTER
        })

        root.addView(TextView(this).apply {
            text = "ติดตั้ง Device Owner สำเร็จแล้ว\n\n" +
                    "กรุณาเปิดสิทธิ์ \"แสดงทับแอปอื่น\" (Display over other apps)\n" +
                    "เพื่อให้หน้าจอล็อคทำงานได้เต็มที่\n\n" +
                    "หน้าจอการตั้งค่าจะเปิดให้อัตโนมัติ..."
            textSize = 16f
            setTextColor(Color.parseColor("#E0E0E0"))
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 32)
            setLineSpacing(8f, 1f)
        })

        root.addView(Button(this).apply {
            text = "เปิดการตั้งค่าอีกครั้ง"
            setOnClickListener {
                openedSettings = true
                OverlayPermissionHelper.openOverlaySettings(this@ProvisioningSetupActivity)
            }
        })

        root.addView(TextView(this).apply {
            text = "\nหมายเหตุ: หากไม่เปิดสิทธิ์นี้ ระบบยังล็อคได้ด้วย Lock Task Mode\n" +
                    "แต่ overlay จะช่วยบล็อคการสัมผัสหน้าจอได้ดีกว่า"
            textSize = 12f
            setTextColor(Color.parseColor("#6B7280"))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 0)
        })

        setContentView(root)
    }

    private fun finishSetup() {
        DpcAdminReceiver().hideFromLauncher(this)
        Toast.makeText(this, "ตั้งค่าเสร็จสมบูรณ์ — พร้อมใช้งาน", Toast.LENGTH_SHORT).show()
        finish()
    }
}
