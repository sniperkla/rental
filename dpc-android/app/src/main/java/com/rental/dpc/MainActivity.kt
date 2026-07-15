package com.rental.dpc

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
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
            // Check if device is actually configured by admin before showing enrolled state
            checkBackendConfigAndShowState()
        } else {
            showScanState()
        }
    }

    /**
     * On startup, check backend config status before deciding which UI to show.
     * If not configured yet → show waiting state.
     * If configured → show enrolled state.
     */
    private fun checkBackendConfigAndShowState() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val deviceId = Prefs.getDeviceId(this@MainActivity)
                val apiKey = Prefs.getApiKey(this@MainActivity)
                val backendUrl = Prefs.getBackendUrl(this@MainActivity)

                if (deviceId.isBlank() || apiKey.isBlank() || backendUrl.isBlank()) {
                    withContext(Dispatchers.Main) { showEnrolledState() }
                    return@launch
                }

                val request = Request.Builder()
                    .url("$backendUrl/api/dpc/status")
                    .addHeader("X-DPC-Device-Id", deviceId)
                    .addHeader("X-DPC-Api-Key", apiKey)
                    .get()
                    .build()

                val response = httpClient.newCall(request).execute()
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: ""
                    val json = JSONObject(body)
                    val configuredAt = json.optString("configuredAt", "")
                    val securityMode = json.optString("securityMode", "")

                    val isConfigured = configuredAt.isNotBlank() && configuredAt != "null" &&
                            securityMode.isNotBlank() && securityMode != "null"

                    withContext(Dispatchers.Main) {
                        if (isConfigured) {
                            Prefs.setSecurityMode(this@MainActivity, securityMode)
                            showEnrolledState()
                        } else {
                            showWaitingForConfig()
                        }
                    }
                } else {
                    // Can't reach backend — show enrolled state (cached)
                    withContext(Dispatchers.Main) { showEnrolledState() }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Config check failed: ${e.message}")
                withContext(Dispatchers.Main) { showEnrolledState() }
            }
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
        Log.i(TAG, "selfRegisterAndEnroll → $backendUrl")
        setStatus("กำลังลงทะเบียนกับระบบ...")
        Toast.makeText(this, "กำลังลงทะเบียน...", Toast.LENGTH_SHORT).show()

        ApiHelper.selfRegister(
            context = this,
            registrationToken = registrationToken,
            backendUrl = backendUrl,
            onSuccess = { deviceId, _ ->
                runOnUiThread {
                    Log.i(TAG, "✅ Self-registered! deviceId=${deviceId.take(8)}…")
                    showWaitingForConfig()
                }
            },
            onError = { msg ->
                runOnUiThread {
                    setStatus(msg, isError = true)
                    Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                }
            }
        )
    }

    // ── Waiting for Configuration ─────────────────────────────────────────────

    private var configPolling = false

    private fun showWaitingForConfig() {
        btnScan.visibility = View.GONE
        layoutEnrolled.visibility = View.GONE
        layoutModeSelect.visibility = View.VISIBLE

        // Build waiting UI
        layoutModeSelect.removeAllViews()

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
        }

        container.addView(TextView(this).apply {
            text = "✓"
            textSize = 48f
            gravity = Gravity.CENTER
            setTextColor(0xFF00E676.toInt())
            setPadding(0, 0, 0, 16)
        })

        container.addView(TextView(this).apply {
            text = "เชื่อมต่อสำเร็จ"
            textSize = 20f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(0xFF00E676.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 8)
        })

        container.addView(TextView(this).apply {
            text = "กำลังรอแอดมินตั้งค่าจาก Web Dashboard\nกรุณามอบเครื่องให้แอดมินเพื่อเลือกโหมดความปลอดภัย"
            textSize = 14f
            setTextColor(0xFF9EAFCD.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 24)
            setLineSpacing(6f, 1f)
        })

        container.addView(TextView(this).apply {
            text = "กำลังตรวจสอบอัตโนมัติ..."
            textSize = 12f
            setTextColor(0xFF6B7280.toInt())
            gravity = Gravity.CENTER
        })

        layoutModeSelect.addView(container)
        setStatus("รอแอดมินตั้งค่าจาก Web Dashboard...")

        // Start polling backend for configuration changes
        startConfigPolling()
    }

    private fun startConfigPolling() {
        if (configPolling) return
        configPolling = true

        val handler = Handler(Looper.getMainLooper())
        val checkRunnable = object : Runnable {
            override fun run() {
                if (!configPolling) return

                // Poll backend to check if admin has configured the device
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val deviceId = Prefs.getDeviceId(this@MainActivity)
                        val apiKey = Prefs.getApiKey(this@MainActivity)
                        val backendUrl = Prefs.getBackendUrl(this@MainActivity)

                        if (deviceId.isBlank() || apiKey.isBlank() || backendUrl.isBlank()) return@launch

                        val request = Request.Builder()
                            .url("$backendUrl/api/dpc/status")
                            .addHeader("X-DPC-Device-Id", deviceId)
                            .addHeader("X-DPC-Api-Key", apiKey)
                            .get()
                            .build()

                        val response = httpClient.newCall(request).execute()
                        if (response.isSuccessful) {
                            val body = response.body?.string() ?: return@launch
                            val json = JSONObject(body)
                            val configuredAt = json.optString("configuredAt", "")
                            val securityMode = json.optString("securityMode", "")

                            withContext(Dispatchers.Main) {
                                // Handle both null JSON values and "null" strings
                                val isConfigured = configuredAt.isNotBlank() && configuredAt != "null" &&
                                        securityMode.isNotBlank() && securityMode != "null"

                                if (isConfigured) {
                                    // Admin has configured the device from dashboard
                                    Prefs.setSecurityMode(this@MainActivity, securityMode)
                                    Log.i(TAG, "✅ Backend configured: mode=$securityMode")

                                    if (securityMode == "device-owner") {
                                        // Check if Device Owner is actually set via ADB
                                        if (dpm.isDeviceOwnerApp(packageName)) {
                                            DpcAdminReceiver().applyDeviceOwnerPolicies(this@MainActivity)
                                            configPolling = false
                                            setStatus("Device Owner พร้อมใช้งาน!")
                                            showEnrolledState()
                                            Toast.makeText(this@MainActivity, "Device Owner พร้อมใช้งาน!", Toast.LENGTH_SHORT).show()
                                        } else {
                                            setStatus("Device Owner — กำลังรอ ADB activation...")
                                        }
                                    } else {
                                        // Device Admin — request activation
                                        configPolling = false
                                        requestDeviceAdmin()
                                        showEnrolledState()
                                    }
                                } else {
                                    Log.d(TAG, "Device not yet configured by admin")
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Config poll error: ${e.message}")
                    }
                }

                // Check again in 5 seconds
                handler.postDelayed(this, 5000)
            }
        }
        handler.post(checkRunnable)
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
