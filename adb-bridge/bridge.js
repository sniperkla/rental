#!/usr/bin/env node

/**
 * Rental ADB Bridge
 * 
 * Runs on admin's computer. Connects to the backend via WebSocket
 * and listens for ADB commands to execute locally.
 * 
 * Usage:
 *   1. Install: npm install
 *   2. Run: BACKEND_URL=http://your-server:3001 BRIDGE_TOKEN=your-secret node bridge.js
 *   3. Connect phone via USB
 *   4. Click "Activate Device Owner" in web dashboard
 *   5. Bridge runs ADB command automatically
 */

const { exec } = require('child_process');
const WebSocket = require('ws');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || 'bridge_secret_token';
const WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/adb-bridge';

console.log('🔌 Rental ADB Bridge');
console.log(`   Backend: ${BACKEND_URL}`);
console.log(`   Token: ${BRIDGE_TOKEN.slice(0, 8)}...`);
console.log('');

let ws;
let reconnectTimer;

function connect() {
  console.log('📡 Connecting to backend...');
  
  ws = new WebSocket(WS_URL, {
    headers: {
      'x-bridge-token': BRIDGE_TOKEN,
    },
  });

  ws.on('open', () => {
    console.log('✅ Connected to backend — waiting for ADB commands...');
    console.log('   (Keep this running. Connect phone via USB when ready.)');
    console.log('');
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'adb_command') {
        console.log(`📱 Received command for device: ${msg.deviceId}`);
        console.log(`   Command: ${msg.command}`);
        console.log('   Running...');
        
        runAdb(msg.command, msg.requestId);
      }
    } catch (e) {
      console.error('❌ Invalid message:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('⚠️  Disconnected. Reconnecting in 5s...');
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    console.error('❌ Connection error:', err.message);
  });
}

function runAdb(command, requestId) {
  exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
    const result = {
      type: 'adb_result',
      requestId,
      success: !error,
      output: stdout || '',
      error: error ? error.message : (stderr || ''),
    };

    if (error) {
      console.log(`❌ ADB failed: ${error.message}`);
      if (stderr) console.log(`   stderr: ${stderr}`);
    } else {
      console.log(`✅ ADB success: ${stdout.trim() || '(no output)'}`);
    }

    // Send result back to backend
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(result));
      console.log('📤 Result sent to backend');
    }
    console.log('');
  });
}

// Check ADB is available
exec('adb version', (error) => {
  if (error) {
    console.error('❌ ADB not found in PATH.');
    console.error('   Install Android SDK Platform Tools:');
    console.error('   https://developer.android.com/tools/releases/platform-tools');
    console.error('');
    console.error('   Then add to PATH:');
    console.error('   export PATH=$PATH:/path/to/platform-tools');
    process.exit(1);
  }
  
  console.log('🔧 ADB found — starting bridge...');
  connect();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down bridge...');
  if (ws) ws.close();
  process.exit(0);
});
