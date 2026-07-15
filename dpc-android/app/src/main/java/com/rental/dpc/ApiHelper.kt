package com.rental.dpc

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * ApiHelper — reusable self-registration logic.
 * Can be called from both MainActivity (UI) and DpcAdminReceiver (background provisioning).
 */
object ApiHelper {

    private const val TAG = "ApiHelper"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /**
     * Registers this device with the backend using [registrationToken] and [backendUrl].
     * On success, saves credentials via [Prefs] and starts [DpcPollingService].
     * [onSuccess] and [onError] are called on the IO thread — dispatch to Main if needed.
     */
    fun selfRegister(
        context: Context,
        registrationToken: String,
        backendUrl: String,
        onSuccess: ((deviceId: String, apiKey: String) -> Unit)? = null,
        onError: ((message: String) -> Unit)? = null,
    ) {
        val androidId     = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
        val model         = Build.MODEL        ?: "Unknown"
        val brand         = Build.BRAND        ?: "Unknown"
        val manufacturer  = Build.MANUFACTURER ?: "Unknown"
        val androidVersion = Build.VERSION.RELEASE ?: "0"

        Log.i(TAG, "selfRegister → $backendUrl | device=$brand $model androidId=$androidId")

        // Detect if we're Device Owner
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
        val isDeviceOwner = dpm.isDeviceOwnerApp(context.packageName)

        val payload = JSONObject().apply {
            put("registrationToken", registrationToken)
            put("androidId", androidId)
            put("model", model)
            put("brand", brand)
            put("manufacturer", manufacturer)
            put("androidVersion", androidVersion)
            put("securityMode", if (isDeviceOwner) "device-owner" else "device-admin")
        }

        val endpoint = "$backendUrl/api/dpc/self-register"
        val requestBody = payload.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(endpoint)
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

                if (response.isSuccessful) {
                    val json    = JSONObject(body)
                    val qr      = json.getJSONObject("enrollmentQr")
                    val deviceId = qr.getString("standaloneDeviceId")
                    val apiKey   = qr.getString("rawApiKey")
                    val interval = qr.optInt("pollingIntervalSeconds", 30)

                    Log.i(TAG, "Self-registered! deviceId=${deviceId.take(8)}...")

                    // Persist credentials and start polling
                    Prefs.save(context, deviceId, apiKey, backendUrl, interval)
                    Prefs.setSecurityMode(context, if (isDeviceOwner) "device-owner" else "device-admin")
                    DpcPollingService.start(context)
                    Log.i(TAG, "✅ Started polling service (isDeviceOwner=$isDeviceOwner)")

                    onSuccess?.invoke(deviceId, apiKey)
                } else {
                    val msg = "Server HTTP $code"
                    Log.e(TAG, "Server error: $code — $body")
                    onError?.invoke(msg)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Network error during self-register", e)
                onError?.invoke("Network error: ${e.message}")
            }
        }
    }
}
