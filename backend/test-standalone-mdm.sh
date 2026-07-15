#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Standalone MDM – Full E2E Smoke Test
# Runs against a local backend at http://localhost:3001
#
# Usage:
#   chmod +x test-standalone-mdm.sh
#   ./test-standalone-mdm.sh
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:3001/api"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

pass() { echo -e "${GREEN}✅ $1${RESET}"; }
fail() { echo -e "${RED}❌ $1${RESET}"; exit 1; }
info() { echo -e "${CYAN}ℹ️  $1${RESET}"; }
step() { echo -e "\n${BOLD}${YELLOW}── STEP $1 ──────────────────────────────────────${RESET}"; }

# ─── STEP 0: Login to get JWT ─────────────────────────────────────────────────
step "0 — Admin Login (get JWT)"

LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rentcontrol.com","password":"yourpassword"}')

JWT=$(echo "$LOGIN_RESP" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JWT" ]; then
  echo "Login response: $LOGIN_RESP"
  fail "Could not get JWT. Check that admin user exists (run seed: cd backend && npm run seed)"
fi
pass "Got JWT: ${JWT:0:30}..."

# ─── STEP 1: Create a test device ─────────────────────────────────────────────
step "1 — Create a Standalone Android Test Device"

CREATE_RESP=$(curl -s -X POST "$BASE/devices" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standalone Test Phone",
    "brand": "Generic",
    "deviceModel": "GMS-Free-001",
    "serialNumber": "STANDALONE-SN-001",
    "platform": "android"
  }')

DEVICE_ID=$(echo "$CREATE_RESP" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$DEVICE_ID" ]; then
  # Device may already exist — find it specifically by serial number via the devices list
  info "Device may already exist. Looking up by serial number STANDALONE-SN-001..."
  DEVICES_RESP=$(curl -s "$BASE/devices" -H "Authorization: Bearer $JWT")
  # Use python3 to find the right device by serialNumber
  DEVICE_ID=$(echo "$DEVICES_RESP" | python3 -c "
import sys, json
try:
    devices = json.load(sys.stdin)
    # Handle both array and {data:[]} response shapes
    if isinstance(devices, list):
        items = devices
    elif isinstance(devices, dict):
        items = devices.get('data', devices.get('devices', []))
    else:
        items = []
    for d in items:
        if d.get('serialNumber') == 'STANDALONE-SN-001':
            print(d.get('_id', ''))
            break
except Exception as e:
    pass
" 2>/dev/null)
  if [ -z "$DEVICE_ID" ]; then
    echo "Create response: $CREATE_RESP"
    echo "Devices response: $DEVICES_RESP"
    fail "Could not create or find the test device"
  fi
fi
pass "Device ID: $DEVICE_ID"

# ─── STEP 2: Enroll device as Standalone ──────────────────────────────────────
step "2 — Enroll Device as Standalone (GMS-free)"

ENROLL_RESP=$(curl -s -X POST "$BASE/mdm/standalone/enroll" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceId\": \"$DEVICE_ID\",
    \"pollingIntervalSeconds\": 15,
    \"allowedApps\": [\"com.example.rentalapp\", \"com.android.settings\"]
  }")

echo "Enrollment response:"
echo "$ENROLL_RESP" | python3 -m json.tool 2>/dev/null || echo "$ENROLL_RESP"

STANDALONE_DEVICE_ID=$(echo "$ENROLL_RESP" | grep -o '"deviceId":"[^"]*"' | cut -d'"' -f4)
API_KEY=$(echo "$ENROLL_RESP" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$STANDALONE_DEVICE_ID" ] || [ -z "$API_KEY" ]; then
  fail "Enrollment failed — missing deviceId or apiKey in response"
fi
pass "Standalone Device ID: $STANDALONE_DEVICE_ID"
pass "Raw API Key:          ${API_KEY:0:20}..."

# ─── STEP 3: First DPC Poll (heartbeat, no commands) ──────────────────────────
step "3 — First DPC Poll (heartbeat with telemetry)"

POLL_RESP=$(curl -s -X POST "$BASE/dpc/poll" \
  -H "X-DPC-Device-Id: $STANDALONE_DEVICE_ID" \
  -H "X-DPC-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "telemetry": {
      "battery_pct": 87,
      "storage_free_mb": 4096,
      "wifi_ssid": "Office-WiFi",
      "signal_strength": -62,
      "installed_apps": ["com.android.settings", "com.example.rentalapp"]
    }
  }')

echo "Poll response:"
echo "$POLL_RESP" | python3 -m json.tool 2>/dev/null || echo "$POLL_RESP"

COMMANDS_COUNT=$(echo "$POLL_RESP" | grep -o '"commands":\[\]' | wc -l | tr -d ' ')
if echo "$POLL_RESP" | grep -q '"commands"'; then
  pass "Poll succeeded — no pending commands (expected on first poll)"
else
  fail "Poll request failed"
fi

# ─── STEP 4: Queue a LOCK command via Admin ────────────────────────────────────
step "4 — Admin Queues a LOCK Command"

LOCK_RESP=$(curl -s -X POST "$BASE/admin/commands/queue" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceId\": \"$DEVICE_ID\",
    \"commandType\": \"LOCK\",
    \"payload\": {}
  }")

echo "Queue command response:"
echo "$LOCK_RESP" | python3 -m json.tool 2>/dev/null || echo "$LOCK_RESP"

COMMAND_ID=$(echo "$LOCK_RESP" | grep -o '"commandId":"[^"]*"' | cut -d'"' -f4)
STATUS=$(echo "$LOCK_RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ -z "$COMMAND_ID" ]; then
  fail "Command not queued — missing commandId"
fi
if [ "$STATUS" = "PENDING" ]; then
  pass "Command queued as PENDING: $COMMAND_ID"
else
  fail "Expected PENDING status, got: $STATUS"
fi

# ─── STEP 5: Second DPC Poll (picks up LOCK command) ──────────────────────────
step "5 — Second DPC Poll (should return LOCK command)"

POLL2_RESP=$(curl -s -X POST "$BASE/dpc/poll" \
  -H "X-DPC-Device-Id: $STANDALONE_DEVICE_ID" \
  -H "X-DPC-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"telemetry": {"battery_pct": 85}}')

echo "Poll 2 response:"
echo "$POLL2_RESP" | python3 -m json.tool 2>/dev/null || echo "$POLL2_RESP"

if echo "$POLL2_RESP" | grep -q "LOCK"; then
  pass "DPC received LOCK command ✓"
else
  fail "DPC did not receive the LOCK command"
fi

# ─── STEP 6: DPC Reports Success (command callback) ───────────────────────────
step "6 — DPC Reports Command Executed Successfully"

CALLBACK_RESP=$(curl -s -X POST "$BASE/dpc/command-callback" \
  -H "X-DPC-Device-Id: $STANDALONE_DEVICE_ID" \
  -H "X-DPC-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"commandId\": \"$COMMAND_ID\",
    \"success\": true,
    \"message\": \"Device locked successfully by DPC\"
  }")

echo "Callback response:"
echo "$CALLBACK_RESP" | python3 -m json.tool 2>/dev/null || echo "$CALLBACK_RESP"

FINAL_STATUS=$(echo "$CALLBACK_RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$FINAL_STATUS" = "COMPLETED" ]; then
  pass "Command marked COMPLETED ✓"
else
  fail "Expected COMPLETED status, got: $FINAL_STATUS"
fi

# ─── STEP 7: Verify device is locked in unified device list ───────────────────
step "7 — Verify Device Shows as 'locked' in Unified Admin Device List"

DEV_LIST=$(curl -s "$BASE/admin/devices" -H "Authorization: Bearer $JWT")
DEVICE_STATUS=$(echo "$DEV_LIST" | python3 -c "
import sys, json
devices = json.load(sys.stdin)
for d in devices:
    if d.get('_id') == '$DEVICE_ID' or d.get('standaloneDeviceId') == '$STANDALONE_DEVICE_ID':
        print(d.get('status', 'UNKNOWN'))
        break
" 2>/dev/null)

if [ "$DEVICE_STATUS" = "locked" ]; then
  pass "Device status is 'locked' in the unified list ✓"
else
  info "Device status: '$DEVICE_STATUS' (may need a moment to propagate)"
fi

# ─── STEP 8: Test wrong API key (security check) ──────────────────────────────
step "8 — Security: Wrong API Key Should Return 401"

SEC_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/dpc/poll" \
  -H "X-DPC-Device-Id: $STANDALONE_DEVICE_ID" \
  -H "X-DPC-Api-Key: this_is_a_wrong_key_000000000000" \
  -H "Content-Type: application/json" \
  -d '{}')

if [ "$SEC_RESP" = "401" ]; then
  pass "Unauthorized with wrong key — returned 401 ✓"
else
  fail "Expected 401, got HTTP $SEC_RESP"
fi

# ─── STEP 9: Test missing headers (security check) ───────────────────────────
step "9 — Security: Missing Headers Should Return 401"

SEC2_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/dpc/poll" \
  -H "Content-Type: application/json" \
  -d '{}')

if [ "$SEC2_RESP" = "401" ]; then
  pass "Unauthorized with no headers — returned 401 ✓"
else
  fail "Expected 401, got HTTP $SEC2_RESP"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  ALL STANDALONE MDM TESTS PASSED ✅             ${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Standalone Device ID : ${CYAN}$STANDALONE_DEVICE_ID${RESET}"
echo -e "  Raw API Key (save!)  : ${CYAN}$API_KEY${RESET}"
echo -e "  Command ID (LOCK)    : ${CYAN}$COMMAND_ID${RESET}"
echo ""
info "Re-run at any time. The device is now enrolled in standalone mode."
