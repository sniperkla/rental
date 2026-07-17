package com.rental.dpc

import android.content.Context
import android.content.SharedPreferences

/**
 * Persistent storage for enrollment credentials.
 * Data is set once during QR scan enrollment and never changes.
 */
object Prefs {
    const val PROD_OFFLINE_GRACE_PERIOD_MS = 2 * 60 * 60 * 1000L  // 2 hours
    const val TEST_OFFLINE_GRACE_PERIOD_MS = 1 * 60 * 1000L       // 1 minute

    private const val PREF_NAME = "dpc_prefs"
    private const val KEY_DEVICE_ID = "standalone_device_id"
    private const val KEY_API_KEY = "api_key"
    private const val KEY_BACKEND_URL = "backend_url"
    private const val KEY_POLL_INTERVAL = "poll_interval_seconds"
    private const val KEY_LAST_POLL_SUCCESS = "last_poll_success_ms"
    private const val KEY_OFFLINE_LOCK_ENABLED = "offline_lock_enabled"
    private const val KEY_TEST_MODE_ENABLED = "test_mode_enabled"
    private const val KEY_ENROLLED_AT = "enrolled_at_ms"
    private const val KEY_DEVICE_LOCKED = "device_locked"
    private const val KEY_SECURITY_MODE = "security_mode"
    private const val KEY_ADMIN_WAS_ACTIVE = "admin_was_ever_active"

    private fun get(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    fun isEnrolled(ctx: Context): Boolean =
        get(ctx).contains(KEY_DEVICE_ID)

    fun save(ctx: Context, deviceId: String, apiKey: String, backendUrl: String, pollInterval: Int) {
        val editor = get(ctx).edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_API_KEY, apiKey)
            .putString(KEY_BACKEND_URL, backendUrl)
            .putInt(KEY_POLL_INTERVAL, pollInterval)
        if (!get(ctx).contains(KEY_ENROLLED_AT)) {
            editor.putLong(KEY_ENROLLED_AT, System.currentTimeMillis())
        }
        editor.apply()
    }

    fun getDeviceId(ctx: Context): String = get(ctx).getString(KEY_DEVICE_ID, "") ?: ""
    fun getApiKey(ctx: Context): String   = get(ctx).getString(KEY_API_KEY, "") ?: ""
    fun getBackendUrl(ctx: Context): String = get(ctx).getString(KEY_BACKEND_URL, "") ?: ""
    fun getPollInterval(ctx: Context): Int = get(ctx).getInt(KEY_POLL_INTERVAL, 30)

    fun isOfflineLockEnabled(ctx: Context): Boolean = get(ctx).getBoolean(KEY_OFFLINE_LOCK_ENABLED, true)
    fun setOfflineLockEnabled(ctx: Context, enabled: Boolean) {
        get(ctx).edit().putBoolean(KEY_OFFLINE_LOCK_ENABLED, enabled).apply()
    }

    fun isTestModeEnabled(ctx: Context): Boolean = get(ctx).getBoolean(KEY_TEST_MODE_ENABLED, false)
    fun setTestModeEnabled(ctx: Context, enabled: Boolean) {
        get(ctx).edit().putBoolean(KEY_TEST_MODE_ENABLED, enabled).apply()
    }

    fun getOfflineGracePeriod(ctx: Context): Long {
        return if (isTestModeEnabled(ctx)) TEST_OFFLINE_GRACE_PERIOD_MS else PROD_OFFLINE_GRACE_PERIOD_MS
    }

    /** Called every time a poll succeeds. */
    fun recordPollSuccess(ctx: Context) {
        get(ctx).edit().putLong(KEY_LAST_POLL_SUCCESS, System.currentTimeMillis()).apply()
    }

    // ── Recovery Cooldown (prevent re-lock after recovery unlock) ────────
    private const val KEY_RECOVERY_UNLOCKED_AT = "recovery_unlocked_at"
    private const val RECOVERY_COOLDOWN_MS = 24 * 60 * 60 * 1000L // 24 hours

    /** Called when device is unlocked via recovery code. */
    fun setRecoveryUnlocked(ctx: Context) {
        get(ctx).edit().putLong(KEY_RECOVERY_UNLOCKED_AT, System.currentTimeMillis()).apply()
    }

    /** Check if device is within recovery cooldown (skip auto-lock). */
    fun isWithinRecoveryCooldown(ctx: Context): Boolean {
        val unlockedAt = get(ctx).getLong(KEY_RECOVERY_UNLOCKED_AT, 0)
        return (System.currentTimeMillis() - unlockedAt) < RECOVERY_COOLDOWN_MS
    }

    /** Returns how many milliseconds since the last successful poll. */
    fun msSinceLastPoll(ctx: Context): Long {
        val prefs = get(ctx)
        val last = if (prefs.contains(KEY_LAST_POLL_SUCCESS)) {
            prefs.getLong(KEY_LAST_POLL_SUCCESS, 0)
        } else {
            prefs.getLong(KEY_ENROLLED_AT, System.currentTimeMillis())
        }
        return System.currentTimeMillis() - last
    }

    /** Persist lock state so overlay can be restored after reboot. */
    fun setDeviceLocked(ctx: Context, locked: Boolean) {
        get(ctx).edit().putBoolean(KEY_DEVICE_LOCKED, locked).apply()
    }

    fun isDeviceLocked(ctx: Context): Boolean =
        get(ctx).getBoolean(KEY_DEVICE_LOCKED, false)

    /** Security mode: "device-admin" (default) or "device-owner". */
    fun setSecurityMode(ctx: Context, mode: String) {
        get(ctx).edit().putString(KEY_SECURITY_MODE, mode).apply()
    }

    fun getSecurityMode(ctx: Context): String =
        get(ctx).getString(KEY_SECURITY_MODE, "device-admin") ?: "device-admin"

    /** Set to true the first time Device Admin is confirmed active by the user. */
    fun setAdminWasEverActive(ctx: Context) {
        get(ctx).edit().putBoolean(KEY_ADMIN_WAS_ACTIVE, true).apply()
    }

    fun wasAdminEverActive(ctx: Context): Boolean =
        get(ctx).getBoolean(KEY_ADMIN_WAS_ACTIVE, false)

    private const val KEY_ADB_BLOCKED = "adb_blocked"

    fun setAdbBlocked(ctx: Context, blocked: Boolean) {
        get(ctx).edit().putBoolean(KEY_ADB_BLOCKED, blocked).apply()
    }

    fun isAdbBlocked(ctx: Context): Boolean =
        get(ctx).getBoolean(KEY_ADB_BLOCKED, false)

    private const val KEY_DEV_OPTIONS_WARNING_SHOWN = "dev_options_warning_shown"

    fun setDevOptionsWarningShown(ctx: Context, shown: Boolean) {
        get(ctx).edit().putBoolean(KEY_DEV_OPTIONS_WARNING_SHOWN, shown).apply()
    }

    fun isDevOptionsWarningShown(ctx: Context): Boolean =
        get(ctx).getBoolean(KEY_DEV_OPTIONS_WARNING_SHOWN, false)

    private const val KEY_LOCK_REASON = "lock_reason"

    /** Reason codes: "server", "admin_removed", "usb_debug", "dev_options", "" (unlocked) */
    fun setLockReason(ctx: Context, reason: String) {
        get(ctx).edit().putString(KEY_LOCK_REASON, reason).apply()
    }

    fun getLockReason(ctx: Context): String =
        get(ctx).getString(KEY_LOCK_REASON, "") ?: ""

    // ── Offline Recovery Code ──────────────────────────────────────────────
    private const val KEY_RECOVERY_CODE_HASH = "recovery_code_hash"

    /** Store SHA-256 hash of the recovery code. Called once during enrollment. */
    fun setRecoveryCodeHash(ctx: Context, hash: String) {
        get(ctx).edit().putString(KEY_RECOVERY_CODE_HASH, hash).apply()
    }

    /** Get the stored recovery code hash, or empty if not set. */
    fun getRecoveryCodeHash(ctx: Context): String =
        get(ctx).getString(KEY_RECOVERY_CODE_HASH, "") ?: ""

    /** Check if a recovery code hash has been set. */
    fun hasRecoveryCode(ctx: Context): Boolean =
        get(ctx).contains(KEY_RECOVERY_CODE_HASH)

    // ── Recovery Attempt Rate Limiting ─────────────────────────────────────
    private const val KEY_RECOVERY_ATTEMPTS = "recovery_attempts"
    private const val KEY_RECOVERY_COOLDOWN_UNTIL = "recovery_cooldown_until"

    fun setRecoveryAttempts(ctx: Context, attempts: Int) {
        get(ctx).edit().putInt(KEY_RECOVERY_ATTEMPTS, attempts).apply()
    }

    fun getRecoveryAttempts(ctx: Context): Int =
        get(ctx).getInt(KEY_RECOVERY_ATTEMPTS, 0)

    fun setRecoveryCooldownUntil(ctx: Context, timestampMs: Long) {
        get(ctx).edit().putLong(KEY_RECOVERY_COOLDOWN_UNTIL, timestampMs).apply()
    }

    fun getRecoveryCooldownUntil(ctx: Context): Long =
        get(ctx).getLong(KEY_RECOVERY_COOLDOWN_UNTIL, 0)

    // ── Overlay Setup Pending ───────────────────────────────────────────────
    private const val KEY_OVERLAY_SETUP_PENDING = "overlay_setup_pending"

    fun setOverlaySetupPending(ctx: Context, pending: Boolean) {
        get(ctx).edit().putBoolean(KEY_OVERLAY_SETUP_PENDING, pending).apply()
    }

    fun isOverlaySetupPending(ctx: Context): Boolean =
        get(ctx).getBoolean(KEY_OVERLAY_SETUP_PENDING, false)

    fun clearOverlaySetupPending(ctx: Context) {
        get(ctx).edit().remove(KEY_OVERLAY_SETUP_PENDING).apply()
    }

    fun clear(ctx: Context) = get(ctx).edit().clear().apply()
}
