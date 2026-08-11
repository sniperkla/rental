'use client';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plug, Wifi, Battery, Ban, Lightbulb, Search, Phone, MessageSquare, Globe, Camera, Settings, Map, Music, Gamepad2, Unlock } from 'lucide-react';

const appIcons: Record<string, any> = {
  '📞': Phone, '💬': MessageSquare, '🌐': Globe, '📸': Camera,
  '⚙️': Settings, '🗺️': Map, '🎵': Music, '🎮': Gamepad2
};

interface Device {
  _id: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  platform: string;
}

export default function SimulatorPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedSerial, setSelectedSerial] = useState<string>('');
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [polling, setPolling] = useState(false);
  const [manualSerial, setManualSerial] = useState('');

  // Fetch devices list for selection (if logged in, using token from localStorage)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rental_token') : null;
    if (token) {
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setDevices(res.data);
        if (res.data.length > 0) {
          setSelectedSerial(res.data[0].serialNumber);
        }
      })
      .catch(err => {
        console.warn('Could not fetch devices list without active admin login token.', err);
      });
    }
  }, []);

  // Poll device status
  useEffect(() => {
    if (!selectedSerial) {
      setCurrentDevice(null);
      return;
    }

    setPolling(true);
    const fetchStatus = () => {
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/devices/status/serial/${selectedSerial}`)
        .then(res => {
          setCurrentDevice(res.data);
        })
        .catch(err => {
          console.error('Failed to poll device status', err);
        });
    };

    fetchStatus(); // immediate call
    const interval = setInterval(fetchStatus, 2000);

    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, [selectedSerial]);

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualSerial.trim()) {
      setSelectedSerial(manualSerial.trim());
    }
  };

  const isLocked = currentDevice?.status === 'locked';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090f',
      color: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Decorative Background Orbs */}
      <div style={{
        position: 'fixed', top: '-10%', left: '30%', width: '400px', height: '400px',
        background: 'rgba(139,92,246,0.08)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none'
      }} />

      <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px', background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Android Kiosk & Lock Simulator
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px', textAlign: 'center', maxWidth: '500px' }}>
        Simulates how RentControl locks/unlocks Android endpoints automatically based on payment statuses.
      </p>

      {/* Controller Area */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '20px',
        width: '100%',
        maxWidth: '380px',
        marginBottom: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Plug size={16} /> Connect Simulated Device
        </div>

        {devices.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>SELECT DEVICE FROM DATABASE</label>
            <select
              id="sim-device-select"
              value={selectedSerial}
              onChange={e => setSelectedSerial(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                padding: '8px 10px', borderRadius: '8px', outline: 'none', cursor: 'pointer'
              }}
            >
              {devices.map(d => (
                <option key={d._id} value={d.serialNumber}>
                  {d.name} ({d.serialNumber})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <form onSubmit={handleManualConnect} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>ENTER SERIAL NUMBER MANUALLY</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="sim-manual-serial"
                className="form-input"
                placeholder="e.g. SN12345"
                value={manualSerial}
                onChange={e => setManualSerial(e.target.value)}
                style={{ flex: 1, padding: '8px', fontSize: '13px' }}
              />
              <button id="sim-manual-connect" type="submit" className="btn btn-primary btn-sm">Connect</button>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              Tip: Log in to the Admin Dashboard first to load registered devices list automatically.
            </span>
          </form>
        )}

        {currentDevice && (
          <div style={{ fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div><strong>Device Model:</strong> {currentDevice.brand} {currentDevice.model}</div>
            <div><strong>Serial Number:</strong> {currentDevice.serialNumber}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <strong>MDM Status:</strong>
              <span style={{
                color: isLocked ? '#ef4444' : '#22c55e',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                ● {currentDevice.status}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Simulated Mobile Handset */}
      <div style={{
        width: '300px',
        height: '600px',
        background: '#000',
        borderRadius: '40px',
        border: '10px solid #1e293b',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 30px rgba(139,92,246,0.1)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Notch / Speaker */}
        <div style={{
          position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
          width: '110px', height: '22px', background: '#1e293b',
          borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px',
          zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ width: '40px', height: '4px', background: '#0f172a', borderRadius: '2px' }} />
        </div>

        {/* Status Bar */}
        <div style={{
          height: '34px', background: 'transparent', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', fontSize: '11px', fontWeight: 600,
          color: '#fff', zIndex: 5, marginTop: '2px'
        }}>
          <span>09:41</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span>5G</span>
            <span><Wifi size={14} /></span>
            <span><Battery size={14} /> 98%</span>
          </div>
        </div>

        {/* Mobile Screen Area */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {isLocked ? (
            /* ─── Lock Mode (Kiosk Mode Lock screen) ─── */
            <div style={{
              position: 'absolute', inset: 0,
              background: '#0a0505',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '24px', textAlign: 'center',
              zIndex: 8,
              animation: 'fadeIn 0.3s ease-in'
            }}>
              {/* Giant warning lock icon */}
              <div style={{
                fontSize: '52px', color: '#ef4444',
                animation: 'pulse 2s infinite', marginBottom: '16px'
              }}>
                <Ban size={48} />
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444', letterSpacing: '-0.3px', marginBottom: '8px' }}>
                DEVICE LOCKED
              </h2>

              <div style={{
                width: '40px', height: '2px', background: '#ef4444', opacity: 0.5, marginBottom: '16px'
              }} />

              <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '20px' }}>
                This corporate-owned device is managed by <strong>RentControl</strong>. Access has been restricted due to an overdue payment status.
              </p>

              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                padding: '12px',
                width: '100%',
                fontSize: '11px',
                color: '#f87171',
                lineHeight: 1.4,
                marginBottom: '24px'
              }}>
                <Lightbulb size={14} /> To unlock, please make a payment in the Admin Dashboard.
              </div>

              <div style={{ fontSize: '10px', color: '#475569' }}>
                Serial: {currentDevice?.serialNumber || 'UNKNOWN'}
              </div>
            </div>
          ) : (
            /* ─── Unlocked Mode (Android Desktop) ─── */
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, #1e1b4b, #0f172a)',
              display: 'flex', flexDirection: 'column',
              padding: '20px',
              animation: 'fadeIn 0.3s ease-in'
            }}>
              {/* Android Search Widget Mockup */}
              <div style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '8px 14px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '32px',
                marginTop: '12px'
              }}>
                <span><Search size={14} /></span> Search apps or web...
              </div>

              {/* Grid of Mock Android App Icons */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                flex: 1
              }}>
                {[
                  { icon: '📞', label: 'Phone' },
                  { icon: '💬', label: 'Chat' },
                  { icon: '🌐', label: 'Chrome' },
                  { icon: '📸', label: 'Camera' },
                  { icon: '⚙️', label: 'Settings' },
                  { icon: '🗺️', label: 'Maps' },
                  { icon: '🎵', label: 'Music' },
                  { icon: '🎮', label: 'Games' }
                ].map((app, index) => (
                  <div key={index} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '4px', cursor: 'pointer'
                  }}>
                    <div style={{
                      width: '42px', height: '42px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      display: 'flex', alignItems: 'center',
                      fontSize: '20px', justifyContent: 'center'
                    }}>
                      {appIcons[app.icon] ? React.createElement(appIcons[app.icon], { size: 20 }) : app.icon}
                    </div>
                    <span style={{ fontSize: '9px', color: '#cbd5e1' }}>{app.label}</span>
                  </div>
                ))}
              </div>

              {/* Status Ribbon bottom */}
              <div style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '12px',
                padding: '8px',
                textAlign: 'center',
                fontSize: '11px',
                color: '#4ade80',
                fontWeight: 600,
                marginBottom: '20px'
              }}>
                <Unlock size={16} /> Device Fully Functional
              </div>
            </div>
          )}
        </div>

        {/* Android Navigation Bar */}
        <div style={{
          height: '32px', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          padding: '0 60px', zIndex: 10
        }}>
          {/* Back button */}
          <span style={{ fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}>◀</span>
          {/* Home button */}
          <span style={{ fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}>●</span>
          {/* Recents button */}
          <span style={{ fontSize: '10px', cursor: 'pointer', opacity: 0.6 }}>■</span>
        </div>
      </div>
    </div>
  );
}
