package com.rental.dpc

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log

/**
 * SYSTEM_ALERT_WINDOW ("Display over other apps") cannot be silently granted by Device Owner.
 * Android treats it as a special AppOp — only shell/ADB can auto-grant it.
 *
 * During enrollment we open the system settings screen once so the admin can enable it
 * before the app is hidden from the launcher.
 */
object OverlayPermissionHelper {

    private const val TAG = "OverlayPerm"

    fun canDrawOverlays(context: Context): Boolean =
        Settings.canDrawOverlays(context)

    /** Opens the per-app "Display over other apps" settings screen. */
    fun openOverlaySettings(context: Context) {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open overlay settings: ${e.message}")
            try {
                context.startActivity(
                    Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            } catch (e2: Exception) {
                Log.e(TAG, "Fallback overlay settings also failed: ${e2.message}")
            }
        }
    }
}
