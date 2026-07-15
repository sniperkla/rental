package com.rental.dpc

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanIntentResult
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONException
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Main screen of the Rental DPC app.
 *
 * States:
 *  - NOT ENROLLED → shows Scan QR button
 *  - ENROLLED     → shows enrolled info, hides all controls
 *
 * Self-Register flow (standalone QR):
 *   1. Customer scans "Self-Register QR" from admin dashboard
 *   2. App POSTs device info to /api/dpc/self-register with a pre-shared token
 *   3. Server creates/updates device record, returns deviceId + apiKey
 *   4. App saves credentials → starts DpcPollingService → requests Device Admin
 */
class MainActivity : AppCompatActivity() {

    private val TAG = "MainActivity"

    private val dpm by lazy { getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager }
    private val adminComponent by lazy { ComponentName(this, DpcAdminReceiver::class.java) }

    private lateinit var tvTitle: TextView
    private lateinit var tvStatus: TextView
    private lateinit var btnScan: Button
    private lateinit var layoutEnrolled: LinearLayout
    private lateinit var layoutModeSelect: LinearLayout

    // Shared HTTP client with timeouts
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    // ZXing QR scanner launcher
    private val qrLauncher = registerForActivityResult(ScanContract()) { result: ScanIntentResult ->
        Log.i(TAG, "QR scan result: contents=${result.contents?.take(100)}")
        val content = result.contents
        if (content != null) {
            handleQrResult(content)
        } else {
            Log.w(TAG, "QR scan cancelled or returned null")
        }
    }

    // Device Admin activation result
    private val adminLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            Log.i(TAG, "Device Admin activated ✅")
        } else {
            Log.w(TAG, "Device Admin NOT activated by user")
        }
        // Always show enrolled state regardless — credentials already saved
        showEnrolledState()
    }

    // System overlay permission launcher — removed: LockActivity needs no overlay permission

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvTitle = findViewById(R.id.tvTitle) ?: TextView(this).also { it.id = View.generateViewId() }
        tvStatus = findViewById(R.id.tvStatus)
        btnScan = findViewById(R.id.btnScan)
        layoutEnrolled = findViewById(R.id.layoutEnrolled)
        layoutModeSelect = findViewById(R.id.layoutModeSelect)

        // Dynamically set version footer
        try {
            val pInfo = packageManager.getPackageInfo(packageName, 0)
            findViewById<TextView>(R.id.tvVersion)?.text = "v${pInfo.versionName}"
        } catch (_: Exception) {}

        btnScan.setOnClickListener { startQrScan() }

        // Restore correct UI state
        if (Prefs.isEnrolled(this)) {
            showEnrolledState()
        } else {
            showScanState()
        }
    }

    // ── QR Scanning ──────────────────────────────────────────────────────────

    private fun startQrScan() {
        val options = ScanOptions()
            .setPrompt("สแกน QR Code จากเครื่องคอมพิวเตอร์ของร้านเช่า")
            .setBeepEnabled(true)
            .setOrientationLocked(false)
        qrLauncher.launch(options)
    }

    /**
     * Called after the QR scanner finishes.
     * Supports two QR types:
     *   1. Self-Register QR  → {type:"registration", backendUrl, registrationToken}
     *   2. Enrollment QR     → {standaloneDeviceId, rawApiKey, backendUrl, ...}
     */
    private fun handleQrResult(rawText: String) {
        Log.i(TAG, "handleQrResult: $rawText")
        val json = try {
            JSONObject(rawText.trim())
        } catch (e: JSONException) {
            Log.e(TAG, "QR is not valid JSON: ${e.message}")
            setStatus("QR Code ไม่ถูกต้อง (ไม่ใช่ JSON)", isError = true)
            Toast.makeText(this, "QR Code ไม่ถูกต้อง", Toast.LENGTH_SHORT).show()
            return
        }

        when (json.optString("type")) {
            "registration" -> {
                // Self-Register flow: device registers itself with a shared token
                val token = json.optString("registrationToken").trim()
                val url   = json.optString("backendUrl").trim().trimEnd('/')
                if (token.isBlank() || url.isBlank()) {
                    setStatus("QR ขาดข้อมูล token หรือ URL", isError = true)
                    return
                }
                selfRegisterAndEnroll(token, url)
            }
            else -> {
                // Direct enrollment QR (pre-configured by admin)
                val deviceId     = json.optString("standaloneDeviceId").trim()
                val apiKey       = json.optString("rawApiKey").trim()
                val backendUrl   = json.optString("backendUrl").trim().trimEnd('/')
                val pollInterval = json.optInt("pollingIntervalSeconds", 30)
                val securityMode = json.optString("securityMode", "device-admin")

                if (deviceId.isBlank() || apiKey.isBlank() || backendUrl.isBlank()) {
                    setStatus("QR ขาดข้อมูลสำคัญ", isError = true)
                    Toast.makeText(this, "QR Code ไม่ครบถ้วน", Toast.LENGTH_SHORT).show()
                    return
                }

                Log.i(TAG, "Direct enrollment QR: deviceId=${deviceId.take(8)}…")
                Prefs.save(this, deviceId, apiKey, backendUrl, pollInterval)
                Prefs.setSecurityMode(this, securityMode)
                DpcPollingService.start(this)
                requestDeviceAdmin()
                showEnrolledState()
            }
        }
    }

    // ── Self-Register Flow ───────────────────────────────────────────────────

    /**
     * POSTs device info + registration token to the server.
     * On success → saves credentials, starts polling, requests Device Admin.
     */
    private fun selfRegisterAndEnroll(registrationToken: String, backendUrl: String) {
        val androidId     = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
        val model         = Build.MODEL       ?: "Unknown"
        val brand         = Build.BRAND       ?: "Unknown"
        val manufacturer  = Build.MANUFACTURER ?: "Unknown"
        val androidVersion = Build.VERSION.RELEASE ?: "0"

        Log.i(TAG, "selfRegisterAndEnroll → $backendUrl | device=$brand $model androidId=$androidId")

        // Show registration is in progress on the UI (Toasts can be blocked by permissions)
        setStatus("กำลังลงทะเบียนกับระบบ...")
        Toast.makeText(this, "กำลังลงทะเบียน...", Toast.LENGTH_SHORT).show()

        val payload = JSONObject().apply {
            put("registrationToken", registrationToken)
            put("androidId", androidId)
            put("model", model)
            put("brand", brand)
            put("manufacturer", manufacturer)
            put("androidVersion", androidVersion)
        }

        val endpoint = "$backendUrl/api/dpc/self-register"
        val requestBody = payload.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(endpoint)
            // Use a browser User-Agent to bypass Cloudflare Browser Integrity Check
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36")
            .header("Accept", "application/json")
            .post(requestBody)
            .build()

        Log.i(TAG, "POST $endpoint")

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = httpClient.newCall(request).execute()
                val code     = response.code
                val body     = response.body?.string() ?: ""
                Log.i(TAG, "Response HTTP $code: $body")

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        handleSelfRegisterSuccess(body, backendUrl)
                    } else {
                        val msg = "เซิร์ฟเวอร์ตอบ HTTP $code"
                        Log.e(TAG, "Server error: $code — $body")
                        setStatus(msg, isError = true)
                        Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Network error during self-register", e)
                withContext(Dispatchers.Main) {
                    val msg = "เชื่อมต่อไม่ได้: ${e.message}"
                    setStatus(msg, isError = true)
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    /** Parses a successful self-register response and shows mode selection. */
    private fun handleSelfRegisterSuccess(body: String, backendUrl: String) {
        try {
            val json       = JSONObject(body)
            val qr         = json.getJSONObject("enrollmentQr")
            val deviceId   = qr.getString("standaloneDeviceId")
            val apiKey     = qr.getString("rawApiKey")
            val interval   = qr.optInt("pollingIntervalSeconds", 30)

            Log.i(TAG, "✅ Self-registered! deviceId=${deviceId.take(8)}…")

            // Save credentials but don't set mode yet
            Prefs.save(this, deviceId, apiKey, backendUrl, interval)

            // Show mode selection screen
            showModeSelection()

        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse self-register response", e)
            setStatus("ข้อมูลตอบกลับไม่ถูกต้อง: ${e.message}", isError = true)
            Toast.makeText(this, "ลงทะเบียนไม่สำเร็จ: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    // ── Mode Selection ───────────────────────────────────────────────────────

    private fun showModeSelection() {
        btnScan.visibility = View.GONE
        layoutEnrolled.visibility = View.GONE
        layoutModeSelect.visibility = View.VISIBLE
        setStatus("ลงทะเบียนสำเร็จ! เลือกระดับความปลอดภัย")

        findViewById<LinearLayout>(R.id.btnModeAdmin).setOnClickListener {
            selectMode("device-admin")
        }

        findViewById<LinearLayout>(R.id.btnModeOwner).setOnClickListener {
            selectMode("device-owner")
        }
    }

    private fun selectMode(mode: String) {
        Prefs.setSecurityMode(this, mode)
        Log.i(TAG, "Security mode selected: $mode")

        DpcPollingService.start(this)

        if (mode == "device-owner") {
            // Device Owner: show enrolled state with ADB instructions
            setStatus("Device Owner — ต้องรัน ADB จากคอมพิวเตอร์")
            showEnrolledState()
            Toast.makeText(this, "ต้องรันคำสั่ง ADB จากคอมพิวเตอร์เพื่อเปิดใช้งาน Device Owner", Toast.LENGTH_LONG).show()
        } else {
            // Device Admin: request activation and show enrolled
            setStatus("กำลังเปิดใช้งาน Device Admin...")
            requestDeviceAdmin()
            showEnrolledState()
        }
    }

    // ── Device Admin ─────────────────────────────────────────────────────────

    private fun requestDeviceAdmin() {
        if (dpm.isAdminActive(adminComponent)) {
            Log.i(TAG, "Device Admin already active")
            return
        }
        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
            putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
            putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "จำเป็นสำหรับระบบจัดการอุปกรณ์จากร้านเช่า เพื่อรักษาความปลอดภัยของอุปกรณ์")
        }
        adminLauncher.launch(intent)
    }

    // ── UI State ─────────────────────────────────────────────────────────────

    private fun showScanState() {
        btnScan.visibility = View.VISIBLE
        layoutEnrolled.visibility = View.GONE
        setStatus("พร้อมใช้งาน — กดปุ่มเพื่อสแกน QR")
    }

    private fun showEnrolledState() {
        btnScan.visibility = View.GONE
        layoutEnrolled.visibility = View.VISIBLE
        tvStatus.text = ""

        val deviceId     = Prefs.getDeviceId(this)
        val backendUrl   = Prefs.getBackendUrl(this)
        val securityMode = Prefs.getSecurityMode(this)
        val interval     = Prefs.getPollInterval(this)

        val shortId = if (deviceId.length > 8) "${deviceId.take(8)}…" else deviceId
        val modeLabel = if (securityMode == "device-owner") "Device Owner (ADB)" else "Device Admin"
        findViewById<TextView>(R.id.tvDeviceId)?.text     = "Device ID: $shortId"
        findViewById<TextView>(R.id.tvBackendUrl)?.text   = "Server: $backendUrl"
        findViewById<TextView>(R.id.tvSecurityMode)?.text = "Mode: $modeLabel"
        findViewById<TextView>(R.id.tvPollInterval)?.text = "Polling: ${interval}s"
    }

    /** Updates tvStatus with optional error coloring. */
    private fun setStatus(msg: String, isError: Boolean = false) {
        tvStatus.text = msg
        tvStatus.setTextColor(
            if (isError) 0xFFFF5252.toInt()   // Red
            else         0xFF9EAFCD.toInt()    // Muted blue-grey
        )
    }
}
