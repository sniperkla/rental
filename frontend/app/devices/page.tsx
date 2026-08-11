'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  Smartphone,
  Cloud,
  Apple,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  ShieldOff,
  Zap,
  QrCode,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  Settings,
  ChevronDown,
  Edit3,
  Trash2,
  RefreshCw,
  Plus,
  Download,
  Terminal,
  Key,
  ExternalLink,
  X,
  Pencil,
  Save,
  ListChecks,
  Wrench,
  Loader2,
  User,
  Check,
  Cpu,
  Rocket,
  Copy,
  Search,
  Grid,
  List,
  Info,
  CheckSquare,
} from 'lucide-react';

interface Device {
  _id: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  imei: string;
  platform: 'android' | 'ios';
  status: 'available' | 'rented' | 'locked' | 'maintenance' | 'pending' | 'returned';
  color: string;
  storageGB: number;
  dailyRate: number;
  monthlyRate: number;
  androidEnterpriseDeviceId?: string;
  androidEnterpriseName?: string;
  appleMdmUdid?: string;
  applePushToken?: string;
  managementTrack?: 'cloud' | 'standalone';
  standaloneDeviceId?: string;
  notes: string;
  screenTimeLocked?: boolean;
  tags?: string[];
  securityMode?: 'device-admin' | 'device-owner';
  configuredAt?: string;
  restrictions?: {
    cameraDisabled: boolean;
    usbFileTransferDisabled: boolean;
    installAppsDisabled: boolean;
    outgoingCallsDisabled: boolean;
  };
  standaloneRestrictions?: string[];
  lastSeen?: string;
}

/* ── ADB Command Block with Copy ────────────────────────────────── */
function AdbCommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = command;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div style={{ background: '#0d1117', borderRadius: '10px', border: '1px solid #30363d', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <span style={{ fontSize: '11px', color: '#8b949e', fontFamily: 'monospace', fontWeight: 600 }}>Terminal</span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
            color: copied ? '#4ade80' : '#8b949e', fontSize: '11px', fontWeight: 600
          }}
        >
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <div style={{ padding: '14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#e6edf3', wordBreak: 'break-all', lineHeight: '1.6' }}>
        <span style={{ color: '#7ee787' }}>$</span> {command}
      </div>
    </div>
  );
}

/* ── Device Registration / Edit Modal ────────────────────────────── */
function DeviceModal({ device, onClose, onSave }: { device?: Device | null; onClose: () => void; onSave: () => void }) {
  const isEdit = !!device;
  const [form, setForm] = useState({
    name: device?.name || '',
    brand: device?.brand || '',
    deviceModel: device?.model || '',
    serialNumber: device?.serialNumber || '',
    imei: device?.imei || '',
    platform: device?.platform || 'android',
    color: device?.color || '',
    storageGB: device?.storageGB || 64,
    dailyRate: device?.dailyRate || 100,
    monthlyRate: device?.monthlyRate || 2500,
    androidEnterpriseName: device?.androidEnterpriseName || '',
    appleMdmUdid: device?.appleMdmUdid || '',
    applePushToken: device?.applePushToken || '',
    status: device?.status || 'available',
    notes: device?.notes || '',
    managementTrack: device?.managementTrack || 'cloud',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/devices/${device._id}`, form);
      } else {
        await api.post('/devices', form);
      }
      toast(isEdit ? 'Device updated!' : 'Device registered!');
      onSave();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Error saving device', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? <><Pencil size={16} style={{marginRight: 6}} /> Edit Device</> : <><Plus size={16} style={{marginRight: 6}} /> Register New Device</>}</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group"><label className="form-label">Display Name *</label><input id="dev-name" className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Brand *</label><input id="dev-brand" className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Model *</label><input id="dev-model" className="form-input" value={form.deviceModel} onChange={e => set('deviceModel', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Serial Number *</label><input id="dev-serial" className="form-input" value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">IMEI</label><input id="dev-imei" className="form-input" value={form.imei} onChange={e => set('imei', e.target.value)} /></div>
            <div className="form-group">
              <label className="form-label">Platform *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { set('platform', 'android'); set('managementTrack', 'standalone'); }}
                  style={{
                    padding: '12px', borderRadius: '8px',
                    border: `2px solid ${form.platform === 'android' ? '#3b82f6' : 'var(--border)'}`,
                    background: form.platform === 'android' ? 'rgba(59,130,246,0.1)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                >
                  <Smartphone size={24} style={{ color: form.platform === 'android' ? '#3b82f6' : 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Android</div>
                    <div style={{ fontSize: '11px', color: 'var(--green-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> พร้อมใช้งาน — รองรับ Standalone DPC
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Color</label><input id="dev-color" className="form-input" value={form.color} onChange={e => set('color', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Storage (GB)</label><input id="dev-storage" className="form-input" type="number" value={form.storageGB} onChange={e => set('storageGB', parseInt(e.target.value))} /></div>
            <div className="form-group"><label className="form-label">Daily Rate (฿)</label><input id="dev-daily" className="form-input" type="number" value={form.dailyRate} onChange={e => set('dailyRate', parseInt(e.target.value))} /></div>
            <div className="form-group"><label className="form-label">Monthly Rate (฿)</label><input id="dev-monthly" className="form-input" type="number" value={form.monthlyRate} onChange={e => set('monthlyRate', parseInt(e.target.value))} /></div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="dev-save" type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Device'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Redesigned Global Self-Registration Modal (QR ลงทะเบียนด่วน) ──── */
function GlobalRegisterModal({ onClose, initialDeviceCount, onDeviceRegistered }: { onClose: () => void; initialDeviceCount: number; onDeviceRegistered?: (device: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [provisioningData, setProvisioningData] = useState<any>(null);
  const [setupMethod, setSetupMethod] = useState<'wizard' | 'scanner'>('wizard');
  const [loading, setLoading] = useState(true);
  const [registeredDevice, setRegisteredDevice] = useState<any>(null);
  const enrolledIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const fetchToken = async () => {
      try {
        const devRes = await api.get('/devices');
        const ids = new Set<string>(
          (devRes.data as any[])
            .filter((d: any) => d.managementTrack === 'standalone' && d.standaloneDeviceId)
            .map((d: any) => d.standaloneDeviceId)
        );
        enrolledIdsRef.current = ids;

        const res = await api.get('/mdm/standalone/registration-qr');
        if (active) {
          setData(res.data);
          try {
            const provRes = await api.get(`/dpc/provisioning-qr?registrationToken=${res.data.registrationToken}`);
            if (active) setProvisioningData(provRes.data);
          } catch (e) { /* silently ignore */ }
        }
      } catch (err) {
        toast('ไม่สามารถดึงข้อมูลรหัสลงทะเบียนได้', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchToken();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!data || registeredDevice) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/devices');
        const devices: any[] = res.data;
        const hasNewDevice = devices.length > initialDeviceCount;
        const hasNewlyEnrolled = devices.some((d: any) =>
          d.managementTrack === 'standalone' &&
          d.standaloneDeviceId &&
          !enrolledIdsRef.current.has(d.standaloneDeviceId)
        );
        if (hasNewDevice || hasNewlyEnrolled) {
          const newest = devices.reduce((a: any, b: any) =>
            new Date(a.createdAt) > new Date(b.createdAt) ? a : b
          );
          setRegisteredDevice(newest);
          clearInterval(interval);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [data, initialDeviceCount, registeredDevice]);

  useEffect(() => {
    if (registeredDevice && onDeviceRegistered) {
      if (registeredDevice.securityMode && registeredDevice.configuredAt) {
        onClose();
      } else {
        onDeviceRegistered(registeredDevice);
        onClose();
      }
    }
  }, [registeredDevice]);

  const qrUrl = data
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(JSON.stringify(data))}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '640px', width: '100%', borderRadius: '24px', background: '#0d0d1a',
          border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden', padding: 0
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '24px 28px',
          background: 'linear-gradient(180deg, rgba(139,92,246,0.18) 0%, transparent 100%)',
          borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '14px',
              background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <QrCode size={24} color="var(--purple-400)" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                QR ลงทะเบียนด่วน (Self-Register)
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                สแกนจากโทรศัพท์มือถือเพื่อเพิ่มอุปกรณ์เข้าระบบอัตโนมัติ
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              กำลังสร้างรหัสลงทะเบียน QR Code...
            </div>
          ) : (
            <>
              {/* Method Switcher Tabs */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border)'
              }}>
                <button
                  type="button"
                  onClick={() => setSetupMethod('wizard')}
                  style={{
                    padding: '12px', borderRadius: '10px', border: setupMethod === 'wizard' ? '1px solid var(--purple-500)' : '1px solid transparent',
                    background: setupMethod === 'wizard' ? 'rgba(139,92,246,0.2)' : 'transparent',
                    color: setupMethod === 'wizard' ? 'var(--purple-300)' : 'var(--text-muted)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="var(--purple-400)" /> 1. Setup Wizard 6-Tap
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>โหมด Device Owner (แนะนำ — ป้องกันลบแอป 100%)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSetupMethod('scanner')}
                  style={{
                    padding: '12px', borderRadius: '10px', border: setupMethod === 'scanner' ? '1px solid var(--blue-500)' : '1px solid transparent',
                    background: setupMethod === 'scanner' ? 'rgba(59,130,246,0.2)' : 'transparent',
                    color: setupMethod === 'scanner' ? '#60a5fa' : 'var(--text-muted)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <QrCode size={16} color="#60a5fa" /> 2. In-App Scanner
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>โหมด Device Admin (สแกนผ่านแอป Rental DPC)</div>
                </button>
              </div>

              {/* Main Content Box */}
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'center' }}>
                {/* QR Code Container */}
                <div style={{
                  background: '#ffffff', padding: '16px', borderRadius: '16px',
                  border: '2px solid rgba(139,92,246,0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                  {setupMethod === 'wizard' ? (
                    provisioningData ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(provisioningData.payloadJson)}&margin=2`}
                        alt="Setup Wizard QR"
                        style={{ width: '180px', height: '180px' }}
                      />
                    ) : (
                      <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={24} className="animate-spin" color="#6366f1" />
                      </div>
                    )
                  ) : (
                    <img src={qrUrl || ''} alt="Registration QR Code" style={{ width: '180px', height: '180px' }} />
                  )}
                </div>

                {/* Instructions Right Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {setupMethod === 'wizard' ? (
                    <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '14px', fontSize: '12.5px', lineHeight: '1.6' }}>
                      <div style={{ fontWeight: 700, color: 'var(--purple-300)', marginBottom: '6px' }}>
                        📲 ขั้นตอนสำหรับเครื่องใหม่ / หลัง Factory Reset:
                      </div>
                      <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                        <li>เปิดเครื่องใหม่ ในหน้าแรก <strong>"Welcome" / "ยินดีต้อนรับ"</strong></li>
                        <li>กดรัวๆ ตรงพื้นที่ว่างบนหน้าจอ <strong>6 ครั้งติดกัน</strong></li>
                        <li>กล้องสแกน QR Code จะเปิดขึ้น → ให้สแกน QR Code นี้</li>
                        <li>เครื่องจะติดตั้งแอปและเปิดโหมด <strong>Device Owner (ห้ามลบแอปถาวร)</strong></li>
                      </ol>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px', padding: '14px', fontSize: '12.5px', lineHeight: '1.6' }}>
                      <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '6px' }}>
                        📲 ขั้นตอนสำหรับเครื่องที่มีแอป Rental DPC แล้ว:
                      </div>
                      <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                        <li>เปิดแอป <strong>Rental DPC</strong> บนโทรศัพท์มือถือ</li>
                        <li>กดปุ่ม <strong>Scan QR Code</strong></li>
                        <li>สแกน QR Code รูปด้านซ้ายมือเพื่อลงทะเบียน</li>
                        <li>เครื่องจะส่งสเปกฮาร์ดแวร์มาลงทะเบียนในฟลีททันที</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>

              {/* Waiting Live Pulse Indicator */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)',
                borderRadius: '12px', padding: '12px 16px', fontSize: '12.5px', color: 'var(--yellow-400)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Loader2 size={18} className="animate-spin" />
                  <span>กำลังรออุปกรณ์สแกน QR Code... ระบบจะรับเข้าฟลีทและอัปเดตอัตโนมัติ</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Configure Device Modal (Post-Scan) ───────────────────────────── */
function ConfigureModal({ device, onClose, onConfigured, isDeviceOwner = false }: { device: Device; onClose: () => void; onConfigured: () => void; isDeviceOwner?: boolean }) {
  const [securityMode, setSecurityMode] = useState<'device-admin' | 'device-owner' | ''>(isDeviceOwner ? 'device-owner' : '');
  const [dailyRate, setDailyRate] = useState(device.dailyRate || 100);
  const [monthlyRate, setMonthlyRate] = useState(device.monthlyRate || 2500);
  const [notes, setNotes] = useState(device.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!securityMode) {
      toast('กรุณาเลือกระดับความปลอดภัย', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/devices/${device._id}/configure`, {
        securityMode: securityMode as 'device-admin' | 'device-owner',
        dailyRate,
        monthlyRate,
        notes,
      });
      toast('ตั้งค่าอุปกรณ์สำเร็จ', 'success');
      onConfigured();
      onClose();
    } catch (err: any) {
      toast(err.response?.data?.message || 'ไม่สามารถตั้งค่าอุปกรณ์ได้', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><Settings size={18} style={{ marginRight: 6 }} /> ตั้งค่าอุปกรณ์ใหม่</div>
            <div className="modal-subtitle">{device.name} — {device.brand} {device.model}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">ระดับความปลอดภัย MDM *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <button type="button" onClick={() => setSecurityMode('device-admin')} style={{
                padding: '12px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                border: `2px solid ${securityMode === 'device-admin' ? '#3b82f6' : 'var(--border)'}`,
                background: securityMode === 'device-admin' ? 'rgba(59,130,246,0.08)' : 'transparent',
                color: 'var(--text-primary)',
              }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}><Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Device Admin</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>สแกน QR ผ่านแอปได้ทันที | ยกเลิกสิทธิ์แล้วเครื่องล็อค</div>
              </button>

              <button type="button" onClick={() => setSecurityMode('device-owner')} style={{
                padding: '12px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                border: `2px solid ${securityMode === 'device-owner' ? 'var(--purple-500)' : 'var(--border)'}`,
                background: securityMode === 'device-owner' ? 'rgba(139,92,246,0.08)' : 'transparent',
                color: 'var(--text-primary)',
              }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}><Shield size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Device Owner (ป้องกันลบแอป 100%)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>สแกน QR 6-tap จาก Setup Wizard หรือรัน ADB ครั้งแรก | ห้ามลบแอปถาวร</div>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">ค่าเช่าวันละ (฿)</label>
              <input type="number" className="form-input" value={dailyRate} onChange={e => setDailyRate(Number(e.target.value))} min={0} />
            </div>
            <div className="form-group">
              <label className="form-label">ค่าเช่ารายเดือน (฿)</label>
              <input type="number" className="form-input" value={monthlyRate} onChange={e => setMonthlyRate(Number(e.target.value))} min={0} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', height: '44px', fontWeight: 700 }}>
            {saving ? 'กำลังบันทึก...' : <><Check size={16} style={{ marginRight: 6 }} /> บันทึกและเริ่มใช้งาน</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Unified Device Command Center Modal ──────────────────────────── */
function CommandCenterModal({
  device,
  rentingCustomerName,
  onClose,
  onUpdate,
}: {
  device: Device;
  rentingCustomerName?: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'quick' | 'restrictions' | 'enrollment' | 'specs' | 'danger'>('quick');
  const [executing, setExecuting] = useState(false);
  const [lockMsg, setLockMsg] = useState('อุปกรณ์นี้ถูกล็อคตามสัญญาเช่า กรุณาติดต่อผู้ให้บริการ');
  const [lockPhone, setLockPhone] = useState('');
  
  // Restriction items state
  const restrictionItems = [
    { key: 'factoryReset',    icon: '🏭', label: 'Factory Reset',     color: '#F59E0B', backendKey: 'no_factory_reset',        alwaysOn: false },
    { key: 'safeBoot',        icon: '🛡️', label: 'Safe Boot',         color: '#EF4444', backendKey: 'no_safe_boot',            alwaysOn: true },
    { key: 'oemUnlock',       icon: '🔓', label: 'OEM Unlock',        color: '#EF4444', backendKey: 'no_oem_unlock',           alwaysOn: true },
    { key: 'camera',          icon: '📷', label: 'Camera',            color: '#EF4444', backendKey: 'no_camera',               alwaysOn: false },
    { key: 'wifi',            icon: '📶', label: 'Wi-Fi',             color: '#3B82F6', backendKey: 'no_config_wifi',           alwaysOn: false },
    { key: 'installApps',     icon: '📦', label: 'Install Apps',      color: '#F59E0B', backendKey: 'no_install_apps',          alwaysOn: false },
    { key: 'usbTransfer',     icon: '🔌', label: 'USB Transfer',      color: '#8B5CF6', backendKey: 'no_usb_file_transfer',     alwaysOn: false },
    { key: 'location',        icon: '📍', label: 'Location',          color: '#3B82F6', backendKey: 'no_share_location',        alwaysOn: false },
    { key: 'mobileNetwork',   icon: '📡', label: 'Mobile Network',    color: '#06B6D4', backendKey: 'no_config_mobile',         alwaysOn: false },
    { key: 'sdCard',          icon: '💾', label: 'SD Card',           color: '#8B5CF6', backendKey: 'no_mount_physical_media',  alwaysOn: false },
    { key: 'debugging',       icon: '🐛', label: 'Developer',         color: '#EF4444', backendKey: 'no_debugging_features',    alwaysOn: false },
  ];

  const [enabledRestrictions, setEnabledRestrictions] = useState<Record<string, boolean>>(() => {
    const saved: string[] = (device as any).standaloneRestrictions ?? [];
    const init: Record<string, boolean> = {};
    restrictionItems.forEach(item => {
      init[item.key] = item.alwaysOn || saved.includes(item.backendKey);
    });
    return init;
  });

  const toggleRestriction = (key: string) => {
    setEnabledRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApplyRestrictions = async () => {
    setExecuting(true);
    try {
      if (device.managementTrack === 'standalone') {
        const restrictKeys = restrictionItems.filter(item => enabledRestrictions[item.key]).map(item => item.backendKey);
        const allKeys = [...new Set(restrictionItems.map(item => item.backendKey))];
        await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'UNRESTRICT', payload: { restrictions: allKeys } });
        if (restrictKeys.length > 0) {
          await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'RESTRICT', payload: { restrictions: restrictKeys } });
        }
        toast('ส่งคำสั่งปรับเปลี่ยนนโยบายแล้ว — อุปกรณ์จะซิงค์เมื่อออนไลน์', 'success');
      } else {
        await api.post(`/mdm/android/device/${device._id}/restrictions`, {
          cameraDisabled: enabledRestrictions['camera'],
          usbFileTransferDisabled: enabledRestrictions['usbTransfer'],
          installAppsDisabled: enabledRestrictions['installApps'],
          outgoingCallsDisabled: enabledRestrictions['location'],
        });
        toast('อัปเดตนโยบายความปลอดภัยเรียบร้อย', 'success');
      }
      onUpdate();
    } catch (err: any) {
      toast(err.response?.data?.message || 'ไม่สามารถส่งคำสั่งได้', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const sendLockCommand = async () => {
    setExecuting(true);
    try {
      if (device.platform === 'android') {
        if (device.managementTrack === 'standalone') {
          await api.post('/admin/commands/queue', {
            deviceId: device._id,
            commandType: 'LOCK',
            payload: { message: lockMsg, phone: lockPhone }
          });
          toast(`ส่งคำสั่งล็อคเครื่อง ${device.name} พร้อมข้อความแจ้งเตือนแล้ว`, 'success');
        } else {
          if (!device.androidEnterpriseName) return toast('Android enterprise name not configured', 'error');
          await api.post(`/mdm/android/lock/${encodeURIComponent(device.androidEnterpriseName)}`);
          toast(`ส่งคำสั่งล็อคกูเกิ้ลสำหรับ ${device.name} แล้ว`, 'success');
        }
      } else {
        if (!device.appleMdmUdid || !device.applePushToken) return toast('Apple MDM not configured', 'error');
        await api.post('/mdm/apple/lock', { udid: device.appleMdmUdid, pushToken: device.applePushToken });
        toast(`Lock command issued to ${device.name}`, 'success');
      }
      onUpdate();
    } catch (err: any) {
      toast('Failed to lock device', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const sendUnlockCommand = async () => {
    setExecuting(true);
    try {
      if (device.platform === 'android') {
        if (device.managementTrack === 'standalone') {
          await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'UNLOCK' });
          toast(`ส่งคำสั่งปลดล็อคเครื่อง ${device.name} เรียบร้อย`, 'success');
        } else {
          if (!device.androidEnterpriseName) return toast('Android enterprise name not configured', 'error');
          await api.post(`/mdm/android/unlock/${encodeURIComponent(device.androidEnterpriseName)}`);
          toast(`ส่งคำสั่งปลดล็อคกูเกิ้ลสำหรับ ${device.name} แล้ว`, 'success');
        }
      } else {
        if (!device.appleMdmUdid || !device.applePushToken) return toast('Apple MDM not configured', 'error');
        await api.post('/mdm/apple/unlock', { udid: device.appleMdmUdid, pushToken: device.applePushToken });
        toast(`Unlock command issued to ${device.name}`, 'success');
      }
      onUpdate();
    } catch (err: any) {
      toast('Failed to unlock device', 'error');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
      <div className="cmd-center-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cmd-center-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: device.platform === 'android' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${device.platform === 'android' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {device.platform === 'android' ? <Smartphone size={22} color="#3b82f6" /> : <Apple size={22} color="#f0f4ff" />}
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {device.name}
                <span className={`badge badge-${device.status === 'available' ? 'green' : device.status === 'rented' ? 'blue' : device.status === 'locked' ? 'red' : 'yellow'}`}>
                  {device.status}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {device.brand} {device.model} • S/N: <span style={{ fontFamily: 'monospace' }}>{device.serialNumber}</span>
                {rentingCustomerName && <span style={{ color: '#60a5fa', marginLeft: 8 }}>👤 เช่าโดย: {rentingCustomerName}</span>}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Navigation Tabs */}
        <div className="cmd-center-nav">
          <button className={`cmd-nav-btn ${activeTab === 'quick' ? 'active' : ''}`} onClick={() => setActiveTab('quick')}>
            <Zap size={15} /> Quick Controls
          </button>
          <button className={`cmd-nav-btn ${activeTab === 'restrictions' ? 'active' : ''}`} onClick={() => setActiveTab('restrictions')}>
            <Shield size={15} /> Mission Control ({Object.values(enabledRestrictions).filter(Boolean).length})
          </button>
          <button className={`cmd-nav-btn ${activeTab === 'enrollment' ? 'active' : ''}`} onClick={() => setActiveTab('enrollment')}>
            <QrCode size={15} /> Provisioning & MDM
          </button>
          <button className={`cmd-nav-btn ${activeTab === 'specs' ? 'active' : ''}`} onClick={() => setActiveTab('specs')}>
            <Info size={15} /> Specs & Tenant
          </button>
          <button className={`cmd-nav-btn ${activeTab === 'danger' ? 'active' : ''}`} onClick={() => setActiveTab('danger')} style={{ color: activeTab === 'danger' ? '#f87171' : undefined }}>
            <AlertTriangle size={15} /> Danger Zone
          </button>
        </div>

        {/* Tab Content */}
        <div className="cmd-center-content">
          {/* TAB 1: Quick Controls */}
          {activeTab === 'quick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <button
                  onClick={sendLockCommand}
                  disabled={executing}
                  style={{
                    padding: '20px', borderRadius: '16px', border: '1px solid rgba(239,68,68,0.3)',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                    color: '#f87171', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                    cursor: executing ? 'default' : 'pointer', transition: 'all 0.2s ease'
                  }}
                >
                  <Lock size={32} />
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Lock Device</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>ล็อคหน้าจอและระงับการใช้งานทันที</div>
                </button>

                <button
                  onClick={sendUnlockCommand}
                  disabled={executing}
                  style={{
                    padding: '20px', borderRadius: '16px', border: '1px solid rgba(34,197,94,0.3)',
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
                    color: '#4ade80', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                    cursor: executing ? 'default' : 'pointer', transition: 'all 0.2s ease'
                  }}
                >
                  <Unlock size={32} />
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Unlock Device</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>ปลดล็อคอุปกรณ์ให้ลูกค้าใช้งานตามปกติ</div>
                </button>
              </div>

              {/* Lock Screen Custom Message Builder */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pencil size={15} color="var(--purple-400)" /> ข้อความแสดงหน้าจอล็อค (Custom Lock Screen Overlay)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text" className="form-input" value={lockMsg} onChange={e => setLockMsg(e.target.value)}
                    placeholder="ข้อความแจ้งเตือนเมื่อเครื่องถูกล็อค..."
                  />
                  <input
                    type="text" className="form-input" value={lockPhone} onChange={e => setLockPhone(e.target.value)}
                    placeholder="เบอร์โทรติดต่อกลับฉุกเฉิน..."
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  💡 ข้อความและเบอร์โทรนี้จะถูกส่งไปแสดงผลบนหน้าจอล็อคแบบ Fullscreen บนโทรศัพท์มือถือของลูกค้า
                </div>
              </div>

              {/* Auxiliary Quick Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    try {
                      await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'RESTORE_SYSTEM_APPS' });
                      toast('ส่งคำสั่ง คืนค่า System Apps แล้ว', 'success');
                    } catch { toast('Failed', 'error'); }
                  }}
                  className="btn btn-secondary" style={{ flex: 1, height: '42px', fontSize: '12.5px' }}
                >
                  📱 Restore System Apps
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'SYNC' });
                      toast('ส่งคำสั่ง Sync Telemetry แล้ว', 'success');
                    } catch { toast('Failed', 'error'); }
                  }}
                  className="btn btn-secondary" style={{ flex: 1, height: '42px', fontSize: '12.5px' }}
                >
                  <RefreshCw size={14} style={{ marginRight: 6 }} /> Sync Telemetry Now
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Mission Control Restrictions */}
          {activeTab === 'restrictions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>นโยบายควบคุมอุปกรณ์ (Device Restrictions)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>คลิกเพื่อเปิด/ปิดฟังก์ชั่นความปลอดภัยฮาร์ดแวร์</div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--purple-400)', background: 'rgba(139,92,246,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                  🔒 {Object.values(enabledRestrictions).filter(Boolean).length} Blocked
                </div>
              </div>

              <div className="control-grid">
                {restrictionItems.map(item => {
                  const isOn = enabledRestrictions[item.key];
                  const isLocked = item.alwaysOn;
                  const active = isOn || isLocked;
                  return (
                    <div
                      key={item.key}
                      className={`control-tile ${active ? 'active' : 'inactive'}`}
                      onClick={() => !isLocked && toggleRestriction(item.key)}
                    >
                      {isLocked && <div style={{ position: 'absolute', top: 6, right: 6, fontSize: '10px' }}>🔒</div>}
                      <div style={{ fontSize: '26px', lineHeight: 1, filter: active ? 'none' : 'grayscale(0.8) opacity(0.4)' }}>
                        {item.icon}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, textAlign: 'center', color: active ? '#F3F4F6' : '#6B7280' }}>
                        {item.label}
                      </div>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? item.color : 'rgba(255,255,255,0.15)' }} />
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleApplyRestrictions}
                disabled={executing}
                className="btn btn-primary"
                style={{ width: '100%', height: '44px', fontWeight: 700, marginTop: '8px' }}
              >
                {executing ? 'กำลังบันทึกนโยบาย...' : 'Apply Security Policy'}
              </button>
            </div>
          )}

          {/* TAB 3: Provisioning & MDM */}
          {activeTab === 'enrollment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#60a5fa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={16} /> ข้อมูลการลงทะเบียน MDM & สิทธิ์การลบแอป
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div><strong>Track:</strong> {device.managementTrack || 'standalone'}</div>
                  <div><strong>Security Mode:</strong> {device.securityMode || 'device-admin'}</div>
                  {device.standaloneDeviceId && <div><strong>Standalone Device ID:</strong> <span style={{ fontFamily: 'monospace' }}>{device.standaloneDeviceId}</span></div>}
                </div>

                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '11px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
                  💡 <strong style={{ color: '#fff' }}>ทำไมถึงลบแอปได้?</strong><br />
                  • <strong>Device Owner (รัน ADB หรือ 6-tap QR Setup Wizard):</strong> ระบบ Android จะ<strong>บล็อคการลบแอป 100%</strong> (`setUninstallBlocked`) ถอนไม่ได้ทุกกรณี<br />
                  • <strong>Device Admin (สแกน QR ผ่านแอป):</strong> สิทธิ์ Android ทั่วไป ระบบไม่ยอมให้บล็อคปุ่มถอนติดตั้ง แต่หากผู้ใช้พยายามยกเลิก Admin — <strong>เครื่องจะถูกสั่งล็อคทันที</strong>
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: '14px' }}>ADB Terminal Command (Setup Device Owner):</div>
              <AdbCommandBlock command={`adb shell dpm set-device-owner com.rental.dpc/.DpcAdminReceiver`} />

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                📌 คำสั่งนี้สำหรับเปิดโหมด <strong>Device Owner</strong> บน Android เพื่อป้องกันการ Factory Reset และการถอนติดตั้งแอปถาวร
              </div>
            </div>
          )}

          {/* TAB 4: Specs & Tenant */}
          {activeTab === 'specs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Brand / Model</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{device.brand} {device.model}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Storage & Color</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{device.storageGB} GB • {device.color || 'Standard'}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Daily Rental Rate</div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--green-400)' }}>฿{device.dailyRate} /วัน</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Monthly Rental Rate</div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--blue-400)' }}>฿{device.monthlyRate} /เดือน</div>
                </div>
              </div>

              {device.notes && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>หมายเหตุ (Notes)</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{device.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Danger Zone */}
          {activeTab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontWeight: 700, color: '#f87171', fontSize: '14px', marginBottom: '4px' }}>⚠️ Danger Zone Operations</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>การดำเนินการเหล่านี้ส่งผลกระทบอย่างถาวรต่อเครื่องและข้อมูล</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Remove MDM Control</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ถอนการควบคุม MDM และอนุญาตให้ลบแอป</div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`ถอนการควบคุม MDM ออกจาก "${device.name}"?`)) return;
                    try {
                      await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'UNENROLL' });
                      toast('ส่งคำสั่ง Unenroll แล้ว', 'success');
                      onUpdate();
                    } catch { toast('Failed', 'error'); }
                  }}
                  className="btn btn-secondary" style={{ color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  Remove MDM
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Reset Device Status</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>รีเซ็ตสถานะอุปกรณ์กลับเป็น Available</div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`รีเซ็ตสถานะ "${device.name}" เป็น Available?`)) return;
                    try {
                      await api.post(`/devices/${device._id}/reset-status`);
                      toast('สถานะถูกรีเซ็ตเรียบร้อย', 'success');
                      onUpdate();
                    } catch { toast('Failed', 'error'); }
                  }}
                  className="btn btn-secondary"
                >
                  Reset Status
                </button>
              </div>

              {device.securityMode === 'device-owner' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.05)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#f87171' }}>Remote Factory Reset (Wipe)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ล้างข้อมูลทั้งหมดในเครื่องเพื่อเริ่มต้นใหม่</div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`⚠️ ยืนยันลบข้อมูลทั้งหมด (Factory Reset) ในเครื่อง "${device.name}"?`)) return;
                      try {
                        await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'WIPE' });
                        toast('คำสั่ง WIPE ถูกส่งแล้ว', 'success');
                        onUpdate();
                      } catch { toast('Failed', 'error'); }
                    }}
                    className="btn btn-danger"
                  >
                    Factory Reset
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Modern Devices Page ─────────────────────────────────────── */
export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Selection state for Batch Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals state
  const [cmdCenterDevice, setCmdCenterDevice] = useState<Device | null>(null);
  const [globalRegisterModalOpen, setGlobalRegisterModalOpen] = useState(false);
  const [deviceModal, setDeviceModal] = useState<{ open: boolean; device?: Device | null }>({ open: false });
  const [configureDevice, setConfigureDevice] = useState<Device | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devRes, rentRes] = await Promise.all([
        api.get('/devices'),
        api.get('/rentals'),
      ]);
      setDevices(devRes.data);
      setRentals(rentRes.data);
    } catch (err) {
      toast('Failed to load device fleet', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncImport = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/mdm/android/sync-import');
      const count = res.data.importedCount;
      if (count > 0) {
        toast(`📥 ดึงข้อมูลสำเร็จ! นำเข้าอุปกรณ์ใหม่จำนวน ${count} เครื่องเรียบร้อย`, 'success');
      } else {
        toast('✨ ดึงข้อมูลสำเร็จ! ไม่มีอุปกรณ์ใหม่เพิ่มเติมในระบบ Google', 'success');
      }
      loadData();
    } catch (err: any) {
      toast(err.response?.data?.message || 'ไม่สามารถดึงข้อมูลอุปกรณ์ได้', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const deleteDevice = async (id: string, name: string) => {
    if (!confirm(`Delete device "${name}" from inventory?`)) return;
    try {
      await api.delete(`/devices/${id}`);
      toast('Device deleted');
      loadData();
    } catch {
      toast('Failed to delete device', 'error');
    }
  };

  // Filtered devices list based on search and filters
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const activeRental = rentals.find(r => r.device?._id === d._id && r.status === 'active');
      const customerName = activeRental?.customer?.name || '';
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        d.name.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        d.serialNumber.toLowerCase().includes(q) ||
        (d.imei && d.imei.toLowerCase().includes(q)) ||
        customerName.toLowerCase().includes(q)
      );

      const matchesPlatform = !platformFilter || d.platform === platformFilter;
      const matchesStatus = !statusFilter || d.status === statusFilter;

      return matchesSearch && matchesPlatform && matchesStatus;
    });
  }, [devices, rentals, searchQuery, platformFilter, statusFilter]);

  // KPI Metrics Calculation
  const stats = useMemo(() => {
    const total = devices.length;
    const available = devices.filter(d => d.status === 'available').length;
    const rented = devices.filter(d => d.status === 'rented').length;
    const locked = devices.filter(d => d.status === 'locked').length;
    const pending = devices.filter(d => d.status === 'pending').length;
    const maintenance = devices.filter(d => d.status === 'maintenance').length;
    return { total, available, rented, locked, pending, maintenance };
  }, [devices]);

  // Toggle selection for batch operations
  const toggleSelectDevice = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDevices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDevices.map(d => d._id));
    }
  };

  // Batch actions
  const handleBatchLock = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`ล็อคอุปกรณ์ที่เลือกจำนวน ${selectedIds.length} เครื่อง?`)) return;
    try {
      await Promise.all(
        selectedIds.map(id => api.post('/admin/commands/queue', { deviceId: id, commandType: 'LOCK' }))
      );
      toast(`ส่งคำสั่งล็อคอุปกรณ์ ${selectedIds.length} เครื่องเรียบร้อย`, 'success');
      setSelectedIds([]);
      loadData();
    } catch {
      toast('ส่งคำสั่งบางเครื่องไม่สำเร็จ', 'error');
    }
  };

  const handleBatchUnlock = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`ปลดล็อคอุปกรณ์ที่เลือกจำนวน ${selectedIds.length} เครื่อง?`)) return;
    try {
      await Promise.all(
        selectedIds.map(id => api.post('/admin/commands/queue', { deviceId: id, commandType: 'UNLOCK' }))
      );
      toast(`ส่งคำสั่งปลดล็อคอุปกรณ์ ${selectedIds.length} เครื่องเรียบร้อย`, 'success');
      setSelectedIds([]);
      loadData();
    } catch {
      toast('ส่งคำสั่งบางเครื่องไม่สำเร็จ', 'error');
    }
  };

  return (
    <AppLayout
      title="Device Fleet & Control"
      subtitle="ระบบบริหารจัดการฟลีทอุปกรณ์และนโยบายความปลอดภัย MDM"
      actions={
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* QR ลงทะเบียนด่วน */}
          <button
            onClick={() => setGlobalRegisterModalOpen(true)}
            className="topbar-btn"
            style={{
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: 'var(--blue-400)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <QrCode size={16} /> QR ลงทะเบียนด่วน
          </button>

          {/* ซิงค์นำเข้าจาก Google */}
          <button
            onClick={handleSyncImport}
            disabled={syncing || loading}
            className="topbar-btn"
            style={{
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: 'var(--purple-400)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {syncing ? (
              <><RefreshCw size={16} className="animate-spin" /> กำลังดึงข้อมูล...</>
            ) : (
              <><Download size={16} /> ซิงค์นำเข้าจาก Google</>
            )}
          </button>

          {/* Register Device */}
          <button
            className="topbar-btn primary"
            onClick={() => setDeviceModal({ open: true, device: null })}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Register Device
          </button>
        </div>
      }
    >
      {/* ── KPI Metrics Bar ────────────────────────────────────────── */}
      <div className="fleet-kpi-grid">
        <div
          className={`kpi-card ${statusFilter === '' ? 'active' : ''}`}
          onClick={() => setStatusFilter('')}
        >
          <div className="kpi-card-icon" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--purple-400)' }}>
            <Smartphone size={22} />
          </div>
          <div>
            <div className="kpi-card-val">{stats.total}</div>
            <div className="kpi-card-lbl">Total Fleet</div>
          </div>
        </div>

        <div
          className={`kpi-card ${statusFilter === 'available' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'available' ? '' : 'available')}
        >
          <div className="kpi-card-icon" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--green-400)' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="kpi-card-val" style={{ color: 'var(--green-400)' }}>{stats.available}</div>
            <div className="kpi-card-lbl">Available</div>
          </div>
        </div>

        <div
          className={`kpi-card ${statusFilter === 'rented' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'rented' ? '' : 'rented')}
        >
          <div className="kpi-card-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--blue-400)' }}>
            <User size={22} />
          </div>
          <div>
            <div className="kpi-card-val" style={{ color: 'var(--blue-400)' }}>{stats.rented}</div>
            <div className="kpi-card-lbl">Active Rented</div>
          </div>
        </div>

        <div
          className={`kpi-card ${statusFilter === 'locked' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'locked' ? '' : 'locked')}
        >
          <div className="kpi-card-icon" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red-400)' }}>
            <Lock size={22} />
          </div>
          <div>
            <div className="kpi-card-val" style={{ color: 'var(--red-400)' }}>{stats.locked}</div>
            <div className="kpi-card-lbl">Locked / Overdue</div>
          </div>
        </div>

        <div
          className={`kpi-card ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
        >
          <div className="kpi-card-icon" style={{ background: 'rgba(234,179,8,0.15)', color: 'var(--yellow-400)' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="kpi-card-val" style={{ color: 'var(--yellow-400)' }}>{stats.pending}</div>
            <div className="kpi-card-lbl">Pending Setup</div>
          </div>
        </div>
      </div>

      {/* ── Control Toolbar ────────────────────────────────────────── */}
      <div className="fleet-control-bar">
        {/* Universal Search */}
        <div className="fleet-search-box">
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="fleet-search-input"
            placeholder="ค้นหาชื่ออุปกรณ์, รุ่น, Brand, Serial Number, IMEI หรือชื่อผู้เช่า..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* View Mode Toggle & Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Platform Filters */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className={`filter-chip ${platformFilter === '' ? 'active' : ''}`} onClick={() => setPlatformFilter('')}>All</button>
            <button className={`filter-chip ${platformFilter === 'android' ? 'active' : ''}`} onClick={() => setPlatformFilter('android')}>Android</button>
            <button className={`filter-chip ${platformFilter === 'ios' ? 'active' : ''}`} onClick={() => setPlatformFilter('ios')}>iOS</button>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

          {/* View Mode */}
          <div className="view-mode-toggle">
            <button className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
              <Grid size={15} /> Card View
            </button>
            <button className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
              <List size={15} /> Table View
            </button>
          </div>
        </div>
      </div>

      {/* ── Main View Content ──────────────────────────────────────── */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : filteredDevices.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Smartphone size={48} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600 }}>ไม่พบอุปกรณ์ในรายการ</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองใหม่อีกครั้ง</div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID CARD VIEW ────────────────────────────────────────── */
        <div className="device-grid">
          {filteredDevices.map(d => {
            const activeRental = rentals.find(r => r.device?._id === d._id && r.status === 'active');
            const tenantName = activeRental?.customer?.name;
            const isSelected = selectedIds.includes(d._id);

            return (
              <div key={d._id} className={`device-card ${isSelected ? 'selected' : ''}`}>
                {/* Header */}
                <div className="device-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectDevice(d._id)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <div>
                      <div className="device-card-title">
                        <span className={`status-pulse-dot ${d.status}`} />
                        {d.name}
                      </div>
                      <div className="device-card-subtitle">{d.brand} {d.model} • {d.storageGB}GB</div>
                    </div>
                  </div>
                  <span className={`badge badge-${d.status === 'available' ? 'green' : d.status === 'rented' ? 'blue' : d.status === 'locked' ? 'red' : 'yellow'}`}>
                    {d.status}
                  </span>
                </div>

                {/* Body */}
                <div className="device-card-body">
                  {tenantName && (
                    <div className="tenant-badge-box">
                      <User size={15} />
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ปัจจุบันเช่าโดย:</div>
                        <div style={{ fontWeight: 600 }}>{tenantName}</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="device-spec-pill">S/N: {d.serialNumber}</span>
                    {d.securityMode && <span className="device-spec-pill" style={{ color: 'var(--purple-300)' }}>🛡️ {d.securityMode}</span>}
                    <span className="device-spec-pill">฿{d.dailyRate}/วัน</span>
                  </div>
                </div>

                {/* Footer Quick Action Bar */}
                <div className="device-card-footer">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCmdCenterDevice(d)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Zap size={14} color="var(--purple-400)" />
                    Control Center
                  </button>

                  {d.status === 'locked' ? (
                    <button
                      className="btn-unlock"
                      onClick={async () => {
                        try {
                          await api.post('/admin/commands/queue', { deviceId: d._id, commandType: 'UNLOCK' });
                          toast(`ส่งคำสั่งปลดล็อค ${d.name} แล้ว`, 'success');
                          loadData();
                        } catch { toast('Failed to unlock', 'error'); }
                      }}
                      style={{ padding: '6px 12px' }}
                    >
                      <Unlock size={14} /> Unlock
                    </button>
                  ) : (
                    <button
                      className="btn-lock"
                      onClick={async () => {
                        try {
                          await api.post('/admin/commands/queue', { deviceId: d._id, commandType: 'LOCK' });
                          toast(`ส่งคำสั่งล็อค ${d.name} แล้ว`, 'success');
                          loadData();
                        } catch { toast('Failed to lock', 'error'); }
                      }}
                      style={{ padding: '6px 12px' }}
                    >
                      <Lock size={14} /> Lock
                    </button>
                  )}

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDeviceModal({ open: true, device: d })}
                    style={{ padding: '6px' }}
                    title="Edit device details"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ────────────────────────────────────────────── */
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredDevices.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Device</th>
                  <th>Serial / IMEI</th>
                  <th>Platform</th>
                  <th>Rates</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map(d => {
                  const activeRental = rentals.find(r => r.device?._id === d._id && r.status === 'active');
                  const rentingCustomerName = activeRental?.customer?.name;
                  const isSelected = selectedIds.includes(d._id);

                  return (
                    <tr key={d._id} style={{ background: isSelected ? 'rgba(139,92,246,0.05)' : undefined }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectDevice(d._id)}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.brand} {d.model} • {d.storageGB}GB</div>
                        {rentingCustomerName && (
                          <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: 2 }}>👤 เช่าโดย: {rentingCustomerName}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>S/N: {d.serialNumber}</div>
                        {d.imei && <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-muted)' }}>IMEI: {d.imei}</div>}
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {d.platform === 'android' ? <Smartphone size={16} color="#3b82f6" /> : <Apple size={16} />}
                          {d.platform === 'android' ? 'Android' : 'iOS'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }}>Day: ฿{d.dailyRate}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Month: ฿{d.monthlyRate}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${d.status === 'available' ? 'green' : d.status === 'rented' ? 'blue' : d.status === 'locked' ? 'red' : 'yellow'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setCmdCenterDevice(d)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Zap size={14} color="var(--purple-400)" /> Control Center
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDeviceModal({ open: true, device: d })}
                            style={{ padding: '6px' }}
                            title="Edit device details"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => deleteDevice(d._id, d.name)}
                            style={{ padding: '6px', color: 'var(--red-400)' }}
                            title="Delete device"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Batch Floating Action Bar ───────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="batch-floating-bar">
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--purple-300)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={18} /> เลือกไว้ {selectedIds.length} เครื่อง
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-lock" onClick={handleBatchLock} style={{ padding: '6px 14px' }}>
              <Lock size={14} /> Batch Lock ({selectedIds.length})
            </button>
            <button className="btn-unlock" onClick={handleBatchUnlock} style={{ padding: '6px 14px' }}>
              <Unlock size={14} /> Batch Unlock ({selectedIds.length})
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>
              ยกเลิกการเลือก
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {globalRegisterModalOpen && (
        <GlobalRegisterModal
          initialDeviceCount={devices.length}
          onClose={() => { setGlobalRegisterModalOpen(false); loadData(); }}
          onDeviceRegistered={(dev) => { setConfigureDevice({ ...dev, _fromSetupWizard: true } as any); }}
        />
      )}

      {deviceModal.open && (
        <DeviceModal
          device={deviceModal.device}
          onClose={() => setDeviceModal({ open: false, device: null })}
          onSave={() => { setDeviceModal({ open: false, device: null }); loadData(); }}
        />
      )}

      {configureDevice && (
        <ConfigureModal
          device={configureDevice}
          isDeviceOwner={!!(configureDevice as any)._fromSetupWizard}
          onClose={() => setConfigureDevice(null)}
          onConfigured={() => { setConfigureDevice(null); loadData(); }}
        />
      )}

      {cmdCenterDevice && (
        <CommandCenterModal
          device={cmdCenterDevice}
          rentingCustomerName={rentals.find(r => r.device?._id === cmdCenterDevice._id && r.status === 'active')?.customer?.name}
          onClose={() => setCmdCenterDevice(null)}
          onUpdate={loadData}
        />
      )}
    </AppLayout>
  );
}
