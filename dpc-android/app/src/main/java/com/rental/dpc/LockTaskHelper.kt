package com.rental.dpc

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.util.Log

/**
 * Device Owner lock-task mode pins the user inside our lock screen.
 * Works without SYSTEM_ALERT_WINDOW — ideal for Setup Wizard / QR provisioning.
 */
object LockTaskHelper {

    private const val TAG = "LockTask"

    fun configure(context: Context) {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DpcAdminReceiver::class.java)
        if (!dpm.isDeviceOwnerApp(context.packageName)) return

        try {
            dpm.setLockTaskPackages(admin, arrayOf(context.packageName))
            Log.i(TAG, "Lock task packages configured for ${context.packageName}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set lock task packages: ${e.message}")
        }
    }

    fun startLockTask(activity: Activity) {
        val dpm = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isDeviceOwnerApp(activity.packageName)) return

        try {
            activity.startLockTask()
            Log.i(TAG, "Lock task started")
        } catch (e: Exception) {
            Log.e(TAG, "startLockTask failed: ${e.message}")
        }
    }

    fun stopLockTask(activity: Activity) {
        val dpm = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isDeviceOwnerApp(activity.packageName)) return

        try {
            activity.stopLockTask()
            Log.i(TAG, "Lock task stopped")
        } catch (e: Exception) {
            Log.e(TAG, "stopLockTask failed: ${e.message}")
        }
    }
}
