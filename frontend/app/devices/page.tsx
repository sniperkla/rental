'use client';
import { useEffect, useState, useRef } from 'react';
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
  Globe,
  Key,
  FileJson,
  Server,
  ExternalLink,
  X,
  Pencil,
  CameraOff,
  PhoneOff,
  PackageMinus,
  Save,
  ListChecks,
  Wrench,
  Loader2,
  User,
  Check,
  Cpu,
  Rocket,
  Copy,
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
}

/* ── Restrictions Configuration Modal ──────────────────────────────── */
function RestrictionsModal({ device, onClose, onSave }: { device: Device; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false);
  const isStandalone = (device as any).managementTrack === 'standalone';

  // Restriction items — mission control style
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

  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const saved: string[] = (device as any).standaloneRestrictions ?? [];
    const init: Record<string, boolean> = {};
    restrictionItems.forEach(item => {
      init[item.key] = item.alwaysOn || saved.includes(item.backendKey);
    });
    return init;
  });

  const toggle = (key: string) => setEnabled(prev => ({ ...prev, [key]: !prev[key] }));

  const blockedCount = Object.values(enabled).filter(Boolean).length;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (isStandalone) {
        const restrictKeys = restrictionItems.filter(item => enabled[item.key]).map(item => item.backendKey);
        const allKeys = [...new Set(restrictionItems.map(item => item.backendKey))];
        await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'UNRESTRICT', payload: { restrictions: allKeys } });
        if (restrictKeys.length > 0) {
          await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'RESTRICT', payload: { restrictions: restrictKeys } });
        }
        toast('คำสั่งส่งแล้ว — จะทำงานเมื่อเครื่องออนไลน์', 'success');
      } else {
        await api.post(`/mdm/android/device/${device._id}/restrictions`, {
          cameraDisabled: enabled['camera'], usbFileTransferDisabled: enabled['usbTransfer'],
          installAppsDisabled: enabled['installApps'], outgoingCallsDisabled: enabled['location'],
        });
        toast('อัพเดทนโยบายสำเร็จ', 'success');
      }
      onSave();
    } catch (err: any) {
      toast(err.response?.data?.message || 'ไม่สามารถส่งคำสั่งได้', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '380px', maxHeight: '90vh', borderRadius: '24px',
        background: '#111827', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px', flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(99,102,241,0.15) 0%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px' }}>
              Mission Control
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#9CA3AF', fontSize: '14px'
            }}>✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <div style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
              background: blockedCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              color: blockedCount > 0 ? '#F87171' : '#34D399'
            }}>
              {blockedCount > 0 ? `🔒 ${blockedCount} blocked` : '✅ All clear'}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>{device.name}</div>
          </div>
          {isStandalone && (
            <div style={{ fontSize: '11px', color: '#FBBF24', marginTop: '6px' }}>
              ⚡ Commands sync when device is online
            </div>
          )}
        </div>

        {/* Grid — Control Center style */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 16px 16px',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
          alignContent: 'start'
        }}>
          {restrictionItems.map(item => {
            const isOn = enabled[item.key];
            const isLocked = item.alwaysOn;
            const active = isOn || isLocked;
            return (
              <div
                key={item.key}
                onClick={() => !isLocked && toggle(item.key)}
                style={{
                  aspectRatio: '1', borderRadius: '18px', cursor: isLocked ? 'default' : 'pointer',
                  background: active
                    ? `linear-gradient(135deg, ${item.color}33, ${item.color}15)`
                    : 'rgba(255,255,255,0.04)',
                  border: active
                    ? `1px solid ${item.color}40`
                    : '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '6px', transition: 'all 0.2s ease',
                  position: 'relative', overflow: 'hidden'
                }}
              >
                {/* Glow effect when active */}
                {active && (
                  <div style={{
                    position: 'absolute', top: '-20px', right: '-20px',
                    width: '60px', height: '60px', borderRadius: '50%',
                    background: `${item.color}20`, filter: 'blur(15px)'
                  }} />
                )}
                {/* Lock icon — small, same color */}
                {isLocked && (
                  <div style={{
                    position: 'absolute', top: '6px', right: '6px',
                    fontSize: '10px', background: `${item.color}30`,
                    borderRadius: '6px', padding: '1px 5px', color: item.color
                  }}>🔒</div>
                )}
                <div style={{ fontSize: '28px', lineHeight: 1, filter: active ? 'none' : 'grayscale(0.8) opacity(0.4)' }}>
                  {item.icon}
                </div>
                <div style={{
                  fontSize: '10px', fontWeight: 600, textAlign: 'center', lineHeight: 1.2,
                  color: active ? '#F3F4F6' : '#6B7280',
                  padding: '0 4px'
                }}>
                  {item.label}
                </div>
                {/* Status dot */}
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: active ? item.color : 'rgba(255,255,255,0.15)',
                  boxShadow: active ? `0 0 8px ${item.color}80` : 'none'
                }} />
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{
          padding: '8px 16px 0', flexShrink: 0,
          display: 'flex', gap: '8px'
        }}>
          <button onClick={async () => {
            if (!confirm('Restore system apps (Camera, Gallery, etc.)?')) return;
            try {
              await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'RESTORE_SYSTEM_APPS' });
              toast('คำสั่ง Restore Apps ถูกส่งแล้ว', 'success');
            } catch { toast('Failed', 'error'); }
          }} style={{
            flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)',
            background: 'rgba(16,185,129,0.08)', color: '#34D399', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer'
          }}>📱 Restore Apps</button>
          <button onClick={async () => {
            if (!confirm('Remove MDM from this device?\n\nAll restrictions will be cleared and app can be uninstalled.')) return;
            try {
              await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'UNENROLL' });
              toast('คำสั่ง Remove MDM ถูกส่งแล้ว', 'success');
              onSave();
            } catch { toast('Failed', 'error'); }
          }} style={{
            flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer'
          }}>🗑️ Remove MDM</button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px 16px', flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: '8px'
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer'
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: '12px', borderRadius: '14px', border: 'none',
            background: saving ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff', fontSize: '14px', fontWeight: 700, cursor: saving ? 'default' : 'pointer',
            boxShadow: saving ? 'none' : '0 4px 15px rgba(99,102,241,0.3)'
          }}>
            {saving ? '⏳ Sending...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Device Registration/Edit Modal ───────────────────────────────── */
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
                {/* Android Option — Always Ready */}
                <button
                  type="button"
                  onClick={() => { set('platform', 'android'); set('managementTrack', 'standalone'); }}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: `2px solid ${form.platform === 'android' ? '#3b82f6' : 'var(--border)'}`,
                    background: form.platform === 'android' ? 'rgba(59,130,246,0.1)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <Smartphone size={24} style={{ color: form.platform === 'android' ? '#3b82f6' : 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Android</div>
                    <div style={{ fontSize: '11px', color: 'var(--green-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} />
                      พร้อมใช้งาน — รองรับ Standalone DPC (ตั้งค่าง่าย)
                    </div>
                  </div>
                </button>

                {/* iOS Option — Disabled (needs Apple MDM setup) */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2px solid var(--border)',
                    background: 'rgba(128,128,128,0.05)',
                    cursor: 'not-allowed',
                    opacity: 0.5,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <Apple size={24} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-muted)' }}>iOS (iPhone/iPad)</div>
                    <div style={{ fontSize: '11px', color: 'var(--red-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <XCircle size={12} />
                      ยังไม่พร้อม — ต้องตั้งค่า Apple MDM (APNs) ก่อน
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>ไปที่ Settings → iOS MDM เพื่อตั้งค่า</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Color</label><input id="dev-color" className="form-input" value={form.color} onChange={e => set('color', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Storage (GB)</label><input id="dev-storage" className="form-input" type="number" value={form.storageGB} onChange={e => set('storageGB', parseInt(e.target.value))} /></div>
            <div className="form-group"><label className="form-label">Daily Rate (฿)</label><input id="dev-daily" className="form-input" type="number" value={form.dailyRate} onChange={e => set('dailyRate', parseInt(e.target.value))} /></div>
            <div className="form-group"><label className="form-label">Monthly Rate (฿)</label><input id="dev-monthly" className="form-input" type="number" value={form.monthlyRate} onChange={e => set('monthlyRate', parseInt(e.target.value))} /></div>
          </div>

          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--purple-400)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} />
              MDM Enrollment Config
            </div>
            
            {form.platform === 'android' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Android Track Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="form-label">Management Track *</label>
                  
                  {/* Standalone DPC Option — Always Ready */}
                  <button
                    type="button"
                    onClick={() => set('managementTrack', 'standalone')}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `2px solid ${form.managementTrack === 'standalone' ? 'var(--green-500)' : 'var(--border)'}`,
                      background: form.managementTrack === 'standalone' ? 'rgba(34,197,94,0.1)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Smartphone size={16} />
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Standalone DPC (แนะนำ)</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', padding: '2px 6px', background: 'rgba(34,197,94,0.2)', color: 'var(--green-400)', borderRadius: '4px' }}>
                        <CheckCircle2 size={10} />
                        พร้อมใช้
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ไม่ต้องตั้งค่า Google Enterprise แค่สแกน QR Code ก็ใช้ได้ เหมาะสำหรับเครื่องทุกรุ่น
                    </div>
                  </button>

                  {/* Cloud-managed Option — Disabled (needs Google Enterprise setup) */}
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: '2px solid var(--border)',
                      background: 'rgba(128,128,128,0.05)',
                      cursor: 'not-allowed',
                      opacity: 0.5,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Cloud size={16} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-muted)' }}>Cloud-managed (Google AMAPI)</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', padding: '2px 6px', background: 'rgba(239,68,68,0.2)', color: 'var(--red-400)', borderRadius: '4px' }}>
                        <XCircle size={10} />
                        ยังไม่พร้อม
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ต้องตั้งค่า Google Enterprise + Android Management API ก่อน
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      ไปที่ Settings → Android Cloud เพื่อตั้งค่า
                    </div>
                  </div>
                </div>

                {/* Cloud-managed specific fields — Disabled (not ready) */}
                {form.managementTrack === 'cloud' && (
                  <div style={{ padding: '12px', background: 'rgba(128,128,128,0.06)', border: '1px solid var(--border)', borderRadius: '8px', opacity: 0.5, pointerEvents: 'none' }}>
                    <div className="form-group">
                      <label className="form-label">Android Enterprise Device Resource Name *</label>
                      <input id="dev-ae-name" className="form-input" placeholder="enterprises/LC04xxxxxx/devices/dyxxxxxxxx" value={form.androidEnterpriseName} onChange={e => set('androidEnterpriseName', e.target.value)} disabled />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      ต้องตั้งค่า Google Enterprise ก่อนจึงจะใช้ Cloud-managed ได้
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* iOS Configuration — Disabled State */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.5, pointerEvents: 'none' }}>
                <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--red-400)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <XCircle size={14} />
                    iOS MDM ยังไม่ได้ตั้งค่า
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>ต้องตั้งค่า Apple MDM (APNs) ก่อนจึงจะเพิ่มอุปกรณ์ iOS ได้</div>
                    <div style={{ marginTop: '8px' }}>ขั้นตอน:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>1. <Key size={10} /> สร้าง APNs Certificate จาก Apple Developer Portal</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>2. <Settings size={10} /> ตั้งค่า MDM Server ใน Settings → iOS MDM</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>3. <Smartphone size={10} /> Enroll อุปกรณ์ iOS ผ่าน Apple Configurator หรือ DEP</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ExternalLink size={10} />
                    ไปที่หน้า Settings → iOS MDM เพื่อตั้งค่า
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Apple MDM UDID *</label>
                  <input id="dev-udid" className="form-input" placeholder="00008101-000E34D20xxxxxxxx" value={form.appleMdmUdid} onChange={e => set('appleMdmUdid', e.target.value)} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Apple Push Token *</label>
                  <input id="dev-token" className="form-input" placeholder="APNs push token hex string" value={form.applePushToken} onChange={e => set('applePushToken', e.target.value)} disabled />
                </div>
              </div>
            )}
          </div>

          {isEdit && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select id="dev-status" className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="available">Available</option>
                <option value="rented">Rented</option>
                <option value="locked">Locked (Overdue)</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          )}

          <div className="form-group"><label className="form-label">Notes</label><textarea id="dev-notes" className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="dev-save" type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Registering...' : 'Save Device'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Configure Device Modal (post-scan) ──────────────────────────── */
function ConfigureModal({ device, onClose, onConfigured, isDeviceOwner = false }: { device: Device; onClose: () => void; onConfigured: () => void; isDeviceOwner?: boolean }) {
  const [securityMode, setSecurityMode] = useState<'device-admin' | 'device-owner' | ''>(isDeviceOwner ? 'device-owner' : '');
  const [tags, setTags] = useState('');
  const [dailyRate, setDailyRate] = useState(device.dailyRate || 0);
  const [monthlyRate, setMonthlyRate] = useState(device.monthlyRate || 0);
  const [notes, setNotes] = useState(device.notes || '');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [adbVerified, setAdbVerified] = useState(false);

  // Auto-configure immediately when coming from Setup Wizard (device is already Device Owner)
  useEffect(() => {
    if (isDeviceOwner) {
      setSaving(true);
      api.patch(`/devices/${device._id}/configure`, {
        securityMode: 'device-owner',
        tags: [],
        dailyRate: device.dailyRate || 0,
        monthlyRate: device.monthlyRate || 0,
        notes: device.notes || '',
      }).then(res => {
        setResult(res.data);
        // Since phone is already DO via Setup Wizard, mark ADB as already verified
        setAdbVerified(true);
        setSaving(false);
      }).catch(err => {
        toast(err.response?.data?.message || 'ไม่สามารถตั้งค่าได้', 'error');
        setSaving(false);
      });
    }
  }, []);

  const handleSave = async () => {
    if (!securityMode) {
      toast('กรุณาเลือกระดับความปลอดภัย', 'error');
      return;
    }
    setSaving(true);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await api.patch(`/devices/${device._id}/configure`, {
        securityMode: securityMode as 'device-admin' | 'device-owner',
        tags: tagList,
        dailyRate,
        monthlyRate,
        notes,
      });
      setResult(res.data);
      if (res.data.requiresAdb) {
        toast('บันทึกสำเร็จ — ต้องเปิดใช้งาน Device Owner ผ่าน ADB', 'success');
      } else {
        toast('ตั้งค่าอุปกรณ์สำเร็จ', 'success');
      }
    } catch (err: any) {
      toast(err.response?.data?.message || 'ไม่สามารถตั้งค่าอุปกรณ์ได้', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Poll for ADB verification (device owner mode)
  useEffect(() => {
    if (!result || !result.requiresAdb || adbVerified) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/devices/${device._id}`);
        if (res.data.securityMode === 'device-owner' && res.data.status === 'available') {
          setAdbVerified(true);
          clearInterval(interval);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [result, adbVerified, device._id]);

  // ── Result: Device Owner → ADB instructions ──
  if (result?.requiresAdb && !adbVerified) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <div>
              <div className="modal-title"><Shield size={18} style={{ marginRight: 6 }} /> ตั้งค่า Device Owner</div>
              <div className="modal-subtitle">ต้องรันคำสั่ง ADB จากคอมพิวเตอร์ก่อนมอบเครื่อง</div>
            </div>
            <button className="modal-close" onClick={onClose}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px' }}>
              <AlertTriangle size={18} color="#eab308" />
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                เชื่อมต่อเครื่อง <strong>{device.name}</strong> กับคอมพิวเตอร์ผ่าน USB แล้วรันคำสั่งด้านล่าง
              </div>
            </div>

            <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ListChecks size={14} /> ขั้นตอน
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { n: '1', text: 'เปิด Developer Options → เปิด USB Debugging บนเครื่อง' },
                { n: '2', text: 'เสียบสาย USB เชื่อมต่อกับคอมพิวเตอร์ → กด Allow บนเครื่อง' },
                { n: '3', text: 'เปิด Terminal / Command Prompt แล้วรันคำสั่งด้านล่าง' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--purple-400)' }}>{s.n}.</span> {s.text}
                </div>
              ))}
            </div>

            {/* Auto-activate button (via ADB bridge) */}
            <button
              className="btn btn-primary"
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await api.post(`/adb-bridge/activate-device-owner/${device._id}`);
                  if (res.data.success) {
                    toast('Device Owner เปิดใช้งานสำเร็จ!', 'success');
                    setAdbVerified(true);
                  } else {
                    toast(`ไม่สำเร็จ: ${res.data.message}`, 'error');
                  }
                } catch (err: any) {
                  const msg = err.response?.data?.message || 'ADB Bridge ไม่เชื่อมต่อ';
                  toast(msg, 'error');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={{ width: '100%' }}
            >
              {saving ? <><Loader2 size={16} className="animate-spin" style={{ marginRight: 6 }} /> กำลังเปิดใช้งาน...</> : <><Zap size={16} style={{ marginRight: 6 }} /> Activate Device Owner (Auto)</>}
            </button>

            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>— หรือรันคำสั่ง ADB ด้วยตนเอง —</div>

            <AdbCommandBlock command={result.adbCommand} />

            {/* Recovery Code (shown once, admin must save) */}
            {result.recoveryCode && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '2px solid rgba(245,158,11,0.4)', borderRadius: '8px', padding: '16px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <AlertTriangle size={16} color="#f59e0b" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#f59e0b' }}>รหัสกู้คืนฉุกเฉิน (Emergency Recovery Code)</span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: 700, color: '#f59e0b', textAlign: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', letterSpacing: '4px', marginBottom: '8px' }}>
                  {result.recoveryCode}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  <strong>บันทึกรหัสนี้ไว้!</strong> จะแสดงแค่ครั้งเดียว<br />
                  ใช้ปลดล็อคเครื่องฉุกเฉินเมื่อเซิร์ฟเวอร์ไม่สามารถเข้าถึงได้<br />
                  ลูกค้าจะเห็นช่องกรอกรหัสบนหน้าจอล็อคเมื่อออฟไลน์เกิน 2 ชั่วโมง
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px' }}>
              <Loader2 size={16} className="animate-spin" color="#60a5fa" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>กำลังรอระบบยืนยัน ADB... หน้าต่างนี้จะอัปเดตอัตโนมัติ</span>
            </div>

            <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>
              ปิดหน้าต่าง (ระบบจะยืนยันอัตโนมัติ)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Result: Device Admin → Done ──
  if (result && !result.requiresAdb) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <div>
              <div className="modal-title"><CheckCircle2 size={20} style={{ marginRight: 6, color: '#22c55e' }} /> พร้อมใช้งาน!</div>
              <div className="modal-subtitle">อุปกรณ์พร้อมมอบให้ลูกค้า</div>
            </div>
            <button className="modal-close" onClick={onClose}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop 0.4s ease-out' }}>
              <CheckCircle2 size={36} color="#22c55e" />
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>
              <strong>{device.name}</strong> ตั้งค่าเป็น <strong>Device Admin</strong> เรียบร้อย<br />
              มอบเครื่องให้ลูกค้าได้เลย
            </div>
            <button className="btn btn-primary" onClick={() => { onConfigured(); onClose(); }} style={{ width: '100%' }}>
              เสร็จสิ้น
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ADB Verified ──
  if (adbVerified) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <div>
              <div className="modal-title"><CheckCircle2 size={20} style={{ marginRight: 6, color: '#22c55e' }} /> Device Owner ตั้งค่าสำเร็จ!</div>
              <div className="modal-subtitle">อุปกรณ์ป้องกัน factory reset ได้แล้ว</div>
            </div>
            <button className="modal-close" onClick={onClose}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop 0.4s ease-out' }}>
              <Shield size={36} color="var(--purple-400)" />
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>
              <strong>{device.name}</strong> ตั้งค่าเป็น <strong>Device Owner</strong> เรียบร้อย<br />
              ป้องกัน factory reset + bootloader ได้ถาวร
            </div>
            <button className="btn btn-primary" onClick={() => { onConfigured(); onClose(); }} style={{ width: '100%' }}>
              เสร็จสิ้น — มอบเครื่องให้ลูกค้า
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Configuration Form ──
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><Settings size={18} style={{ marginRight: 6 }} /> ตั้งค่าอุปกรณ์</div>
            <div className="modal-subtitle">{device.name} — {device.brand} {device.model}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
          {/* Device Info */}
          <div style={{ background: 'var(--surface-secondary, rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Platform</span><span style={{ fontWeight: 600 }}>{device.platform}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Serial</span><span style={{ fontFamily: 'monospace' }}>{device.serialNumber}</span></div>
            {device.imei && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>IMEI</span><span style={{ fontFamily: 'monospace' }}>{device.imei}</span></div>}
          </div>

          {/* Security Mode */}
          <div className="form-group">
            <label className="form-label"><Lock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> ระดับความปลอดภัย</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={() => setSecurityMode('device-admin')} style={{
                padding: '14px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                border: `2px solid ${securityMode === 'device-admin' ? '#3b82f6' : 'var(--border)'}`,
                background: securityMode === 'device-admin' ? 'rgba(59,130,246,0.08)' : 'transparent',
                color: 'var(--text-primary)',
              }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}><Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Device Admin — ตั้งค่าง่าย</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ล็อค/ปลดล็อค + แสดงข้อความหน้าจอ | ลูกค้า factory reset หลุดได้</div>
                {device.securityMode === 'device-owner' && (
                  <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={10} /> เครื่องนี้เป็น Device Owner อยู่แล้ว — การเลือก Device Admin จะไม่ลบ Device Owner ออก
                  </div>
                )}
              </button>
              <button type="button" onClick={() => setSecurityMode('device-owner')} style={{
                padding: '14px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                border: `2px solid ${securityMode === 'device-owner' ? 'var(--purple-500)' : 'var(--border)'}`,
                background: securityMode === 'device-owner' ? 'rgba(139,92,246,0.08)' : 'transparent',
                color: 'var(--text-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                  <Shield size={14} /> Device Owner
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advanced</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ป้องกัน factory reset + bootloader + ซ่อนแอป | ต้องรัน ADB ครั้งเดียว</div>
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label">Tags (คั่นด้วยจุลภาค)</label>
            <input type="text" className="form-input" value={tags} onChange={e => setTags(e.target.value)} placeholder="เช่น VIP, ราคาสูง, ลูกค้าดี" />
          </div>

          {/* Rates */}
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

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">หมายเหตุ</label>
            <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="บันทึกเพิ่มเติม..." />
          </div>

          {/* Submit */}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', height: '48px' }}>
            {saving ? 'กำลังบันทึก...' : <><Check size={16} style={{ marginRight: 6 }} /> บันทึกและเริ่มใช้งาน</>}
          </button>
        </div>
      </div>
    </div>
  );
}

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
        // Snapshot current standalone device IDs before showing QR
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
        toast('ไม่สามารถดึงข้อมูลรหัสลงทะเบียนรวมได้', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchToken();
    return () => {
      active = false;
    };
  }, []);

  // Poll for new device registration every 3 seconds
  useEffect(() => {
    if (!data || registeredDevice) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/devices');
        const devices: any[] = res.data;
        // Detect new device OR existing device newly enrolled (standaloneDeviceId changed)
        const hasNewDevice = devices.length > initialDeviceCount;
        const hasNewlyEnrolled = devices.some((d: any) =>
          d.managementTrack === 'standalone' &&
          d.standaloneDeviceId &&
          !enrolledIdsRef.current.has(d.standaloneDeviceId)
        );
        if (hasNewDevice || hasNewlyEnrolled) {
          // Find the device that was just enrolled
          const newest = devices.reduce((a: any, b: any) =>
            new Date(a.createdAt) > new Date(b.createdAt) ? a : b
          );
          setRegisteredDevice(newest);
          clearInterval(interval);
        }
      } catch {
        // silently ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [data, initialDeviceCount, registeredDevice]);

  // Auto-open ConfigureModal immediately when device detected (only if not already configured)
  useEffect(() => {
    if (registeredDevice && onDeviceRegistered) {
      // Check if device is already configured (has securityMode and configuredAt)
      if (registeredDevice.securityMode && registeredDevice.configuredAt) {
        // Device is already configured, just refresh and close
        onClose();
      } else {
        // Device needs configuration, open ConfigureModal
        onDeviceRegistered(registeredDevice);
        onClose();
      }
    }
  }, [registeredDevice]);

  const qrUrl = data
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        JSON.stringify(data)
      )}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {registeredDevice ? <><CheckCircle2 size={20} style={{marginRight: 6}} /> ลงทะเบียนสำเร็จ!</> : <><QrCode size={16} style={{marginRight: 6}} /> QR ลงทะเบียนอัตโนมัติ (Self-Register)</>}
            </div>
            <div className="modal-subtitle">
              {registeredDevice
                ? 'อุปกรณ์ใหม่ถูกลงทะเบียนเข้าระบบเรียบร้อยแล้ว'
                : 'ใช้แสกนบนเครื่องใดก็ได้เพื่อลงทะเบียนอัตโนมัติโดยไม่ต้องกดเพิ่มเครื่องล่วงหน้า'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px', alignItems: 'center' }}>
          {loading ? (
            <div style={{ padding: '40px', color: 'var(--text-muted)' }}>กำลังสร้างรหัสเชื่อมต่อ...</div>
          ) : registeredDevice ? (
            /* ── Success State ──────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', width: '100%' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pop 0.4s ease-out',
              }}>
                <CheckCircle2 size={48} color="#22c55e" />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#22c55e' }}>ลงทะเบียนสำเร็จ!</div>

              <div style={{
                background: 'var(--surface-secondary, rgba(255,255,255,0.04))',
                border: '1px solid var(--border)', borderRadius: '10px',
                padding: '14px 16px', width: '100%', textAlign: 'left',
                display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ชื่อเครื่อง</span>
                  <span style={{ fontWeight: 600 }}>{registeredDevice.name || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>แพลตฟอร์ม</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{registeredDevice.platform || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Model</span>
                  <span style={{ fontWeight: 600 }}>{registeredDevice.model || registeredDevice.deviceModel || '-'}</span>
                </div>
                {registeredDevice.serialNumber && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>S/N</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{registeredDevice.serialNumber}</span>
                  </div>
                )}
                {registeredDevice.imei && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>IMEI</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{registeredDevice.imei}</span>
                  </div>
                )}
              </div>

              <button className="btn btn-primary" onClick={() => {
                if (onDeviceRegistered) onDeviceRegistered(registeredDevice);
                onClose();
              }} style={{ width: '100%' }}>
                <Settings size={16} style={{ marginRight: 6 }} /> ตั้งค่าอุปกรณ์
              </button>
              <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>
                ตั้งค่าภายหลัง
              </button>
            </div>
          ) : qrUrl ? (
            /* ── QR Display + Waiting State ─────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', width: '100%' }}>
              
              <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-secondary, rgba(255,255,255,0.04))', padding: '4px', borderRadius: '10px', width: '100%' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSetupMethod('wizard')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${setupMethod === 'wizard' ? 'var(--purple-500)' : 'var(--border)'}`,
                    background: setupMethod === 'wizard' ? 'rgba(139,92,246,0.15)' : 'transparent',
                    color: setupMethod === 'wizard' ? 'var(--purple-300)' : 'var(--text-muted)',
                    fontSize: '12px', fontWeight: setupMethod === 'wizard' ? 600 : 400
                  }}
                >
                  <Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Setup Wizard (เครื่องใหม่)
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSetupMethod('scanner')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${setupMethod === 'scanner' ? 'var(--purple-500)' : 'var(--border)'}`,
                    background: setupMethod === 'scanner' ? 'rgba(139,92,246,0.15)' : 'transparent',
                    color: setupMethod === 'scanner' ? 'var(--purple-300)' : 'var(--text-muted)',
                    fontSize: '12px', fontWeight: setupMethod === 'scanner' ? 600 : 400
                  }}
                >
                  <QrCode size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> In-App Scanner (มีแอปแล้ว)
                </button>
              </div>

              {setupMethod === 'wizard' ? (
                <>
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    {provisioningData ? (
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(provisioningData.payloadJson)}&margin=2`} alt="Setup Wizard Auto-Register QR" style={{ width: '220px', height: '220px' }} />
                    ) : (
                      <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="animate-spin" /></div>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'left', width: '100%', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px' }}>
                    <strong>วิธีใช้งาน (เครื่องใหม่ / Factory Reset):</strong><br />
                    1. หน้าแรกสุด (Welcome) กดรัวๆ ที่หน้าจอ 6 ครั้ง<br />
                    2. กล้องจะเปิดขึ้น ให้สแกน QR นี้<br />
                    3. เครื่องจะติดตั้งแอป และลงทะเบียนเข้าระบบให้อัตโนมัติ<br />
                    4. เปิดสิทธิ์ &quot;แสดงทับแอปอื่น&quot; เมื่อแอปถาม (กดเปิด 1 ครั้ง)
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <img src={qrUrl} alt="Registration QR Code" style={{ width: '220px', height: '220px' }} />
                  </div>
                  
                  <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px', padding: '12px', textAlign: 'left', width: '100%' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#60a5fa', marginBottom: '6px' }}><Key size={14} style={{verticalAlign:'middle',marginRight:4}} /> รายละเอียด QR รวม:</div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>URL:</strong> {data.backendUrl}</div>
                      <div><strong>Token:</strong> {data.registrationToken}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'left', width: '100%' }}>
                    1. เปิดแอป <strong>Rental DPC</strong> บนอุปกรณ์มือถือลูกค้า<br />
                    2. กดปุ่ม <strong>Scan QR</strong> แล้วสแกนสัญลักษณ์ด้านบนนี้<br />
                    3. แอปจะส่งข้อมูลสเปกเครื่องเพื่อลงทะเบียนสร้างเครื่องใหม่ในฐานข้อมูลให้ทันที!
                  </div>
                </>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '12px', color: 'var(--text-muted)',
                background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)',
                borderRadius: '8px', padding: '10px 14px', width: '100%',
              }}>
                <Loader2 size={16} className="animate-spin" />
                <span>กำลังรอเครื่องสแกนลงทะเบียน... หน้าต่างนี้จะอัปเดตอัตโนมัติเมื่อสำเร็จ</span>
              </div>

              <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%', marginTop: '10px' }}>
                ปิดหน้าต่าง
              </button>
            </div>
          ) : (
            <div style={{ padding: '20px', color: 'var(--red-400)' }}>ดึงข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง</div>
          )}
        </div>
      </div>
    </div>
  );
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
      // fallback
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
    <div style={{ background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <span style={{ fontSize: '11px', color: '#8b949e', fontFamily: 'monospace' }}>Terminal</span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer',
            color: copied ? '#4ade80' : '#8b949e', fontSize: '11px',
          }}
        >
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <div style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', color: '#e6edf3', wordBreak: 'break-all', lineHeight: '1.6' }}>
        <span style={{ color: '#7ee787' }}>$</span> {command}
      </div>
    </div>
  );
}

/* ── Standalone DPC Enrollment Modal ─────────────────────────────── */
function StandaloneEnrollModal({ device, onClose, onSave }: { device: Device; onClose: () => void; onSave: () => void }) {
  const [pollingInterval, setPollingInterval] = useState(30);
  const [securityMode, setSecurityMode] = useState<'device-admin' | 'device-owner'>('device-admin');
  const [enrollData, setEnrollData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dpcConnected, setDpcConnected] = useState(false);
  // Device Owner method tabs: 'adb' | 'wizard'
  const [doMethodTab, setDoMethodTab] = useState<'adb' | 'wizard'>('wizard');
  const [provisioningQr, setProvisioningQr] = useState<{ payloadJson: string; checksumSha256: string; downloadUrl: string } | null>(null);
  const [provisioningLoading, setProvisioningLoading] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const res = await api.post('/mdm/standalone/enroll', {
        deviceId: device._id,
        pollingIntervalSeconds: pollingInterval,
        securityMode,
      });
      enrollTimeRef.current = Date.now();
      setEnrollData({ ...res.data.enrollmentQr, securityMode });
      toast('ลงทะเบียนอุปกรณ์สำเร็จ! สแกน QR Code เพื่อเริ่มซิงค์', 'success');
    } catch (err: any) {
      toast(err.response?.data?.message || 'ไม่สามารถลงทะเบียนอุปกรณ์ได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Poll for device DPC connection after QR is shown
  const enrollTimeRef = useRef(0);
  useEffect(() => {
    if (!enrollData || dpcConnected) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/devices');
        const devices: any[] = res.data;
        const updated = devices.find((d: any) => d._id === device._id);
        if (updated) {
          const lastSeen = updated.lastSeen ? new Date(updated.lastSeen).getTime() : 0;
          const updatedAt = updated.updatedAt ? new Date(updated.updatedAt).getTime() : 0;
          // device.lastSeen defaults to creation time. We must ensure it pinged AFTER we started enrolling.
          // Add 2000ms buffer to account for server/client clock drift since the enroll API updates the device.
          if (lastSeen > enrollTimeRef.current + 2000) {
            setDpcConnected(true);
            clearInterval(interval);
          }
        }
      } catch {
        // silently ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [enrollData, dpcConnected, device._id]);

  const qrDataUrl = enrollData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        JSON.stringify(enrollData)
      )}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {dpcConnected ? <><CheckCircle2 size={20} style={{marginRight: 6}} /> เชื่อมต่อสำเร็จ!</> : <><Cpu size={16} style={{marginRight: 6}} /> ลงทะเบียน Standalone DPC: {device.name}</>}
            </div>
            <div className="modal-subtitle">
              {dpcConnected
                ? 'อุปกรณ์ได้เชื่อมต่อกับเซิร์ฟเวอร์แล้ว พร้อมรับคำสั่ง'
                : 'ใช้ควบคุมเครื่อง Android แบบไร้กูเกิ้ล (GMS-free / Offline)'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px', alignItems: 'center' }}>
          {!enrollData ? (
            <div style={{ width: '100%' }}>
              {/* Security Mode Selector */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label"><Lock size={14} style={{verticalAlign:'middle',marginRight:4}} /> ระดับความปลอดภัย</label>
                
                {/* Comparison Table */}
                <div style={{ 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  marginTop: '8px',
                  marginBottom: '16px',
                  fontSize: '12px'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)' }}>ฟีเจอร์</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', color: '#3b82f6' }}><Smartphone size={14} style={{verticalAlign:'middle',marginRight:4}} /> Device Admin</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--purple-400)' }}><Shield size={14} style={{verticalAlign:'middle',marginRight:4}} /> Device Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { feature: 'ล็อค/ปลดล็อคเครื่อง', admin: true, owner: true },
                        { feature: 'แสดงข้อความหน้าจอ', admin: true, owner: true },
                        { feature: 'บล็อค Factory Reset', admin: false, owner: true },
                        { feature: 'บล็อค Bootloader', admin: false, owner: true },
                        { feature: 'ซ่อนแอปจากระบบ', admin: false, owner: true },
                        { feature: 'ป้องกันถอนติดตั้ง', admin: false, owner: true },
                        { feature: 'ความยากในการตั้งค่า', admin: 'ง่าย (สแกน QR)', owner: 'ยาก (ต้องใช้ ADB)' },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: i < 6 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{row.feature}</td>
                          <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                            {typeof row.admin === 'boolean' ? (
                              row.admin ? <span style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} /></span> : <span style={{ color: 'var(--red-400)' }}><XCircle size={14} /></span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{row.admin}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                            {typeof row.owner === 'boolean' ? (
                              row.owner ? <span style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} /></span> : <span style={{ color: 'var(--red-400)' }}><XCircle size={14} /></span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{row.owner}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSecurityMode('device-admin')}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: `2px solid ${securityMode === 'device-admin' ? 'var(--blue-500)' : 'var(--border)'}`,
                      background: securityMode === 'device-admin' ? 'rgba(59,130,246,0.1)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}><Smartphone size={16} style={{verticalAlign:'middle',marginRight:4}} /> Device Admin — ตั้งค่าง่าย</div>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> ล็อค/ปลดล็อคเครื่องระยะไกล</div>
                      <div style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> แสดงข้อความล็อคหน้าจอ</div>
                      <div style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> ตั้งค่าง่าย แค่สแกน QR</div>
                      <div style={{ color: 'var(--red-400)', marginTop: '4px' }}><XCircle size={14} style={{verticalAlign:'middle',marginRight:4}} /> ลูกค้าอาจ factory reset หลุดได้</div>
                      <div style={{ color: 'var(--red-400)' }}><XCircle size={14} style={{verticalAlign:'middle',marginRight:4}} /> ไม่สามารถบล็อค bootloader ได้</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>เหมาะสำหรับ: ลูกค้าทั่วไป, ความเสี่ยงต่ำ</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSecurityMode('device-owner')}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: `2px solid ${securityMode === 'device-owner' ? 'var(--purple-500)' : 'var(--border)'}`,
                      background: securityMode === 'device-owner' ? 'rgba(139,92,246,0.1)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}><Shield size={16} style={{verticalAlign:'middle',marginRight:4}} /> Device Owner — ปลอดภัยสูงสุด</div>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> ล็อค/ปลดล็อคเครื่องระยะไกล</div>
                      <div style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> บล็อค factory reset</div>
                      <div style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> บล็อค bootloader</div>
                      <div style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> ซ่อนแอปจากระบบ</div>
                      <div style={{ color: 'var(--green-400)' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> รอดจากการ factory reset</div>
                      <div style={{ color: 'var(--red-400)', marginTop: '4px' }}><XCircle size={14} style={{verticalAlign:'middle',marginRight:4}} /> ต้องตั้งค่าผ่าน ADB ครั้งแรก</div>
                      <div style={{ color: 'var(--red-400)' }}><XCircle size={14} style={{verticalAlign:'middle',marginRight:4}} /> ต้อง factory reset เครื่องก่อนถ้าเคย sign-in Google</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>เหมาะสำหรับ: เครื่องราคาสูง, ความเสี่ยงสูง</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">รอบความถี่ในการดึงคำสั่ง (วินาที) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={pollingInterval}
                  onChange={e => setPollingInterval(parseInt(e.target.value) || 30)}
                  min={5}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  กำหนดให้เครื่องติดต่อเซิร์ฟเวอร์ทุกๆ กี่วินาที (แนะนำ 30)
                </span>
              </div>
              <button className="btn btn-primary" onClick={handleEnroll} disabled={loading} style={{ width: '100%', height: '48px' }}>
                {loading ? 'กำลังสร้างรหัสการเชื่อมต่อ...' : <><Rocket size={16} style={{verticalAlign:'middle',marginRight:4}} /> สร้างรหัสลงทะเบียน QR Code</>}
              </button>
            </div>
          ) : dpcConnected ? (
            /* ── DPC Connected Success ─────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', width: '100%' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pop 0.4s ease-out',
              }}>
                <CheckCircle2 size={48} color="#22c55e" />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#22c55e' }}>DPC เชื่อมต่อสำเร็จ!</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                อุปกรณ์ <strong>{device.name}</strong> ได้เชื่อมต่อกับเซิร์ฟเวอร์แล้ว<br />
                พร้อมรับคำสั่งควบคุม
              </div>

              <div style={{
                background: 'var(--surface-secondary, rgba(255,255,255,0.04))',
                border: '1px solid var(--border)', borderRadius: '10px',
                padding: '14px 16px', width: '100%', textAlign: 'left',
                display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Device ID</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{enrollData.standaloneDeviceId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Security Mode</span>
                  <span style={{ fontWeight: 600 }}>{enrollData.securityMode === 'device-owner' ? <><Shield size={14} style={{verticalAlign:'middle',marginRight:4}} /> Device Owner</> : <><Smartphone size={14} style={{verticalAlign:'middle',marginRight:4}} /> Device Admin</>}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Polling</span>
                  <span style={{ fontWeight: 600 }}>{pollingInterval}s</span>
                </div>
              </div>

              <button className="btn btn-primary" onClick={onSave} style={{ width: '100%' }}>
                เสร็จสิ้น — ดูรายการเครื่อง
              </button>
            </div>
          ) : (
            /* ── QR Code Display + Waiting ─────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                {qrDataUrl && <img src={qrDataUrl} alt="Enrollment QR Code" style={{ width: '240px', height: '240px' }} />}
              </div>
              
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px', padding: '12px', textAlign: 'left', width: '100%' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#60a5fa', marginBottom: '6px' }}><Key size={14} style={{verticalAlign:'middle',marginRight:4}} /> ข้อมูลอุปกรณ์ลงทะเบียน:</div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>ID:</strong> {enrollData.standaloneDeviceId}</div>
                  <div><strong>URL:</strong> {enrollData.backendUrl}</div>
                  <div><strong>Key:</strong> {enrollData.rawApiKey.substring(0, 10)}...</div>
                  <div><strong>Mode:</strong> {enrollData.securityMode === 'device-owner' ? <><Shield size={14} style={{verticalAlign:'middle',marginRight:4}} /> Device Owner</> : <><Smartphone size={14} style={{verticalAlign:'middle',marginRight:4}} /> Device Admin</>}</div>
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '12px', color: 'var(--text-muted)',
                background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)',
                borderRadius: '8px', padding: '10px 14px', width: '100%',
              }}>
                <Loader2 size={16} className="animate-spin" />
                <span>กำลังรออุปกรณ์สแกน QR และเชื่อมต่อ... หน้าต่างนี้จะอัปเดตอัตโนมัติ</span>
              </div>

              {enrollData.securityMode === 'device-owner' ? (
                /* ── Device Owner Setup Guide (Advanced) ─────────────── */
                <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '8px', padding: '16px', textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Shield size={16} color="var(--purple-400)" />
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--purple-400)' }}>วิธีตั้งค่า Device Owner</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advanced</span>
                  </div>

                  {/* ── Method Tabs ── */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <button
                      type="button"
                      onClick={() => setDoMethodTab('wizard')}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${doMethodTab === 'wizard' ? 'var(--purple-500)' : 'var(--border)'}`,
                        background: doMethodTab === 'wizard' ? 'rgba(139,92,246,0.15)' : 'transparent',
                        color: doMethodTab === 'wizard' ? 'var(--purple-300)' : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      <QrCode size={14} /> Setup Wizard QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoMethodTab('adb')}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${doMethodTab === 'adb' ? 'var(--purple-500)' : 'var(--border)'}`,
                        background: doMethodTab === 'adb' ? 'rgba(139,92,246,0.15)' : 'transparent',
                        color: doMethodTab === 'adb' ? 'var(--purple-300)' : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      <Terminal size={14} /> ADB / USB
                    </button>
                  </div>

                  {doMethodTab === 'wizard' ? (
                    /* ── Setup Wizard QR Tab ── */
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.6' }}>
                        ✨ <strong style={{ color: 'var(--text-primary)' }}>ง่ายที่สุด — ไม่ต้องใช้ USB / ADB</strong><br />
                        สแกน QR นี้ตอน Setup Wizard หลัง Factory Reset แอนดรอยด์จะติดตั้งแอปและตั้งค่า Device Owner ให้อัตโนมัติ
                      </div>

                      {/* Steps */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                        {[
                          { step: '1', title: 'Factory Reset เครื่อง', desc: 'ไปที่ <strong>Settings → System → Reset → Factory Reset</strong> หรือจาก Recovery Mode', color: '#ef4444' },
                          { step: '2', title: 'กดหน้าจอ Welcome 6 ครั้ง', desc: 'บนหน้าจอ <strong>"Hi there" / "ยินดีต้อนรับ"</strong> ให้กดตรงกลางหน้าจอ <strong>6 ครั้งติดกัน</strong> → จะเปิด QR Scanner', color: '#a855f7' },
                          { step: '3', title: 'สแกน QR Code ด้านล่าง', desc: 'ระบบจะดาวน์โหลดและติดตั้งแอป <strong>System Service</strong> พร้อมตั้งค่า Device Owner ให้อัตโนมัติ', color: '#22c55e' },
                          { step: '4', title: 'เปิดสิทธิ์ "แสดงทับแอปอื่น"', desc: 'หลังติดตั้งเสร็จ แอปจะเปิดหน้าตั้งค่าให้อัตโนมัติ — กดเปิด <strong>Allow display over other apps</strong> (1 ครั้ง) แล้วกลับมาที่แอป', color: '#eab308' },
                        ].map(item => (
                          <div key={item.step} style={{ display: 'flex', gap: '10px', padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                            <div style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: item.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{item.step}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '2px' }}>{item.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: item.desc }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Provisioning QR */}
                      {!provisioningQr ? (
                        <button
                          type="button"
                          disabled={provisioningLoading}
                          onClick={async () => {
                            setProvisioningLoading(true);
                            try {
                              const res = await api.get('/dpc/provisioning-qr');
                              setProvisioningQr(res.data);
                            } catch { toast('ไม่สามารถโหลด QR ได้', 'error'); }
                            finally { setProvisioningLoading(false); }
                          }}
                          style={{
                            width: '100%', padding: '10px', borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--purple-600), var(--purple-500))',
                            color: '#fff', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          }}
                        >
                          {provisioningLoading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                          {provisioningLoading ? 'กำลังสร้าง QR...' : 'สร้าง Setup Wizard QR'}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: '2px solid rgba(139,92,246,0.4)' }}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(provisioningQr.payloadJson)}&margin=2`}
                              alt="Setup Wizard Provisioning QR"
                              style={{ width: '220px', height: '220px', display: 'block' }}
                            />
                          </div>
                          <div style={{ width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '10px', fontSize: '11px' }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>SHA-256 Checksum (ตรวจสอบ APK):</div>
                            <div style={{ fontFamily: 'monospace', fontSize: '10px', wordBreak: 'break-all', color: '#86efac' }}>{provisioningQr.checksumSha256}</div>
                          </div>
                          <div style={{ width: '100%', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', padding: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <strong style={{ color: '#eab308' }}>⚠️ หมายเหตุ:</strong> QR นี้จะหมดอายุถ้า APK ถูก rebuild — กด "สร้าง QR" ใหม่ทุกครั้งหลัง build APK ใหม่
                          </div>
                          <button
                            type="button"
                            onClick={() => setProvisioningQr(null)}
                            style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            สร้าง QR ใหม่
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── ADB / USB Tab ── */
                    <div>
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '12px', marginBottom: '14px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--red-400)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> สิ่งที่ต้องเตรียม</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ color: 'var(--red-400)', fontWeight: 700, minWidth: '14px' }}>1.</span>
                        <span>คอมพิวเตอร์ (Windows / Mac / Linux) ที่ติดตั้ง <strong>ADB</strong> แล้ว</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ color: 'var(--red-400)', fontWeight: 700, minWidth: '14px' }}>2.</span>
                        <span>สาย USB สำหรับเชื่อมต่อกับเครื่อง Android</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ color: 'var(--red-400)', fontWeight: 700, minWidth: '14px' }}>3.</span>
                        <span>เครื่อง Android <strong>ต้องยังไม่เคย sign-in Google Account</strong><br/><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ถ้าเคย sign-in แล้ว → ต้อง factory reset ก่อน (Settings → System → Reset)</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Step by step */}
                  <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><ListChecks size={14} /> ขั้นตอน</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { step: '1', title: 'สแกน QR Code', desc: 'เปิดแอป <strong>System Service</strong> บนเครื่อง Android → กด <strong>สแกน QR</strong> → สแกน QR Code ด้านบน', highlight: true },
                      { step: '2', title: 'เปิด Developer Options', desc: 'ไปที่ <strong>Settings → About Phone</strong> → กด <strong>Build Number</strong> 7 ครั้ง ติดกัน → จะมีเมนู Developer Options ปรากฏขึ้น' },
                      { step: '3', title: 'เปิด USB Debugging', desc: 'ไปที่ <strong>Settings → Developer Options</strong> → เปิด <strong>USB Debugging</strong> → กด <strong>OK</strong> ใน popup ที่ปรากฏ' },
                      { step: '4', title: 'เชื่อมต่อ USB', desc: 'เสียบสาย USB เชื่อมต่อเครื่อง Android กับคอมพิวเตอร์ → บนเครื่องจะถาม <strong>"Allow USB Debugging?"</strong> → กด <strong>Allow</strong> / <strong>อนุญาต</strong>' },
                      { step: '5', title: 'รันคำสั่ง ADB', desc: 'เปิด Terminal (Mac/Linux) หรือ Command Prompt (Windows) แล้วรันคำสั่งด้านล่าง ↓' },
                      { step: '6', title: 'สำเร็จ', desc: 'เครื่องจะตั้งค่า Device Owner เรียบร้อย → แอป <strong>System Service</strong> จะซ่อนตัวเองจากหน้าจอ → ป้องกัน factory reset + bootloader ได้ถาวร' },
                    ].map(item => (
                      <div key={item.step} style={{ display: 'flex', gap: '10px', padding: '10px', background: item.highlight ? 'rgba(139,92,246,0.1)' : 'rgba(0,0,0,0.15)', borderRadius: '6px', border: item.highlight ? '1px solid rgba(139,92,246,0.25)' : '1px solid transparent' }}>
                        <div style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: 'var(--purple-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{item.step}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '3px' }}>{item.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: item.desc }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ADB Command - Copyable */}
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>คำสั่ง ADB (สำหรับขั้นตอนที่ 5):</div>
                    <AdbCommandBlock command="adb shell dpm set-device-owner com.rental.dpc/.DpcAdminReceiver" />
                  </div>

                  {/* Common errors */}
                  <div style={{ marginTop: '14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#eab308', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Wrench size={14} /> แก้ปัญหาที่พบบ่อย</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                      {[
                        { error: 'java.lang.IllegalStateException: Not allowed to set device owner', fix: 'เครื่องเคย sign-in Google Account → ต้อง factory reset ก่อน (ตั้งค่าใหม่ทั้งเครื่อง)' },
                        { error: 'java.lang.IllegalStateException: User 0 has accounts', fix: 'ลบ Google Account ออกก่อน: Settings → Accounts → เลือก Account → Remove Account' },
                        { error: "'adb' is not recognized as an internal or external command", fix: 'ยังไม่ได้ติดตั้ง ADB → ดาวน์โหลด Android SDK Platform Tools จาก developer.android.com' },
                        { error: 'error: no devices/emulators found', fix: 'ตรวจสอบว่า: (1) เสียบ USB แล้ว (2) เปิด USB Debugging แล้ว (3) กด Allow บนเครื่องแล้ว' },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '4px', padding: '8px 10px' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#f87171', marginBottom: '4px', wordBreak: 'break-all' }}>{item.error}</div>
                          <div style={{ color: 'var(--text-muted)' }}><strong style={{ color: '#4ade80' }}>แก้ไข:</strong> {item.fix}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  </div>
                )}
                </div>
              ) : (
                /* ── Device Admin Setup Guide ─────────────────────────────── */
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px', padding: '16px', textAlign: 'left', width: '100%' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#60a5fa', marginBottom: '12px' }}><Smartphone size={14} style={{verticalAlign:'middle',marginRight:4}} /> วิธีตั้งค่า Device Admin (ตั้งค่าง่าย)</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { step: '1', title: 'เปิดแอป', desc: 'เปิดแอป <strong>System Service</strong> บนเครื่อง Android ที่ต้องการลงทะเบียน' },
                      { step: '2', title: 'สแกน QR Code', desc: 'กดปุ่ม <strong>สแกน QR</strong> → กล้องจะเปิดขึ้น → สแกน QR Code ด้านบน' },
                      { step: '3', title: 'อนุญาต Device Admin', desc: 'ระบบจะถามว่าต้องการให้แอปจัดการเครื่อง → กด <strong>Activate</strong> / <strong>เปิดใช้งาน</strong>' },
                      { step: '4', title: 'เสร็จสิ้น', desc: 'แอปจะเริ่มทำงานเบื้องหลัง → ปิดตัวเองอัตโนมัติ → พร้อมใช้งาน' },
                    ].map(item => (
                      <div key={item.step} style={{ display: 'flex', gap: '10px', padding: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                        <div style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{item.step}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '2px' }}>{item.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: item.desc }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', padding: '10px' }}>
                    <div style={{ fontWeight: 600, fontSize: '11px', color: '#eab308', marginBottom: '4px' }}><AlertTriangle size={14} style={{verticalAlign:'middle',marginRight:4}} /> ข้อจำกัด:</div>
                    <ul style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, paddingLeft: '16px' }}>
                      <li>ลูกค้าสามารถ <strong>factory reset</strong> เครื่องเพื่อลบแอปได้</li>
                      <li>ไม่สามารถป้องกัน <strong>bootloader unlock</strong> ได้</li>
                      <li>เหมาะสำหรับลูกค้าทั่วไปที่ความเสี่ยงต่ำ</li>
                    </ul>
                  </div>
                </div>
              )}

              <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>
                เสร็จสิ้น
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Danger Zone Modal ─────────────────────────────────────────────── */
function DangerZoneModal({ device, onClose, onAction }: { device: Device; onClose: () => void; onAction: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  const executeAction = async (action: string, commandType: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setLoading(action);
    try {
      await api.post('/admin/commands/queue', { deviceId: device._id, commandType });
      toast(`Command queued for ${device.name}. Will execute on next poll (≤30s).`, 'success');
      onAction();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Failed to send command', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--red-400)' }} />
            Danger Zone
          </h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            These actions are irreversible. Be careful!
          </p>

          {/* Remove MDM */}
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            padding: '14px',
            marginBottom: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldOff size={16} style={{ color: 'var(--yellow-400)' }} />
                  Remove MDM
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {device.securityMode === 'device-owner' 
                    ? 'Remove Device Owner status. App can be uninstalled.'
                    : 'Remove Device Admin. App can be uninstalled.'}
                </div>
              </div>
              <button 
                className="btn btn-sm" 
                style={{ background: 'var(--yellow-400)', color: '#000', fontWeight: 600 }}
                disabled={loading === 'unenroll'}
                onClick={() => executeAction('unenroll', 'UNENROLL', `Remove MDM from "${device.name}"?\n\n${device.securityMode === 'device-owner' ? 'Device will lose Device Owner status.' : 'Device Admin will be removed.'}`)}
              >
                {loading === 'unenroll' ? <Loader2 size={14} className="spin" /> : 'Remove'}
              </button>
            </div>
          </div>

          {/* Factory Reset - only for Device Owner */}
          {device.securityMode === 'device-owner' && (
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid rgba(239,68,68,0.3)', 
            borderRadius: '8px', 
            padding: '14px',
            marginBottom: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={16} style={{ color: 'var(--red-400)' }} />
                  Factory Reset
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Erase ALL data. Cannot be undone!
                </div>
              </div>
              <button 
                className="btn btn-sm btn-danger"
                disabled={loading === 'wipe'}
                onClick={() => executeAction('wipe', 'WIPE', `⚠️ FACTORY RESET "${device.name}"?\n\nThis will ERASE ALL DATA on the device.\nThis cannot be undone!`)}
              >
                {loading === 'wipe' ? <Loader2 size={14} className="spin" /> : 'Wipe'}
              </button>
            </div>
          </div>
          )}

          {/* Remove FRP - only for Device Owner */}
          {device.securityMode === 'device-owner' && (
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={16} style={{ color: 'var(--purple-400)' }} />
                    Remove FRP
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Remove Factory Reset Protection.
                  </div>
                </div>
                <button 
                  className="btn btn-sm btn-secondary"
                  disabled={loading === 'frp'}
                  onClick={async () => {
                    if (!confirm(`Remove FRP from "${device.name}"?`)) return;
                    setLoading('frp');
                    try {
                      const res = await api.post(`/adb-bridge/remove-factory-reset-protection/${device._id}`);
                      if (res.data.success) {
                        toast('FRP removed successfully', 'success');
                        onAction();
                      } else {
                        toast(`Failed: ${res.data.message}`, 'error');
                      }
                    } catch (err: any) {
                      toast(err.response?.data?.message || 'Failed', 'error');
                    } finally {
                      setLoading(null);
                    }
                  }}
                >
                  {loading === 'frp' ? <Loader2 size={14} className="spin" /> : 'Remove'}
                </button>
              </div>
            </div>
          )}

          {/* Reset Status - for devices that stopped polling (factory reset, etc.) */}
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            padding: '14px',
            marginTop: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={16} style={{ color: 'var(--blue-400)' }} />
                  Reset Status
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  For factory reset or lost devices. Sets status to available.
                </div>
              </div>
              <button 
                className="btn btn-sm btn-secondary"
                disabled={loading === 'reset'}
                onClick={async () => {
                  if (!confirm(`Reset status for "${device.name}"?\n\nThis will set the device to available and clear MDM enrollment.`)) return;
                  setLoading('reset');
                  try {
                    await api.post(`/devices/${device._id}/reset-status`);
                    toast('Device status reset to available', 'success');
                    onAction();
                  } catch (err: any) {
                    toast(err.response?.data?.message || 'Failed to reset status', 'error');
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                {loading === 'reset' ? <Loader2 size={14} className="spin" /> : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard Fleet View ─────────────────────────────────────── */
export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modal, setModal] = useState<{ open: boolean; device?: Device | null }>({ open: false });
  const [restrictionsModal, setRestrictionsModal] = useState<{ open: boolean; device: Device | null }>({ open: false, device: null });
  const [standaloneEnrollModal, setStandaloneEnrollModal] = useState<{ open: boolean; device: Device | null }>({ open: false, device: null });
  const [globalRegisterModalOpen, setGlobalRegisterModalOpen] = useState(false);
  const [dangerZoneModal, setDangerZoneModal] = useState<{ open: boolean; device: Device | null }>({ open: false, device: null });
  const [configureDevice, setConfigureDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [devicesRes, rentalsRes] = await Promise.all([
        api.get('/devices', {
          params: {
            ...(platformFilter && { platform: platformFilter }),
            ...(statusFilter && { status: statusFilter }),
          }
        }),
        api.get('/rentals')
      ]);
      setDevices(devicesRes.data);
      setRentals(rentalsRes.data);
    } catch (err) {
      console.error(err);
      toast('Failed to load devices', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [platformFilter, statusFilter]);

  // WebSocket connection for real-time device updates
  useEffect(() => {
    let socket: any = null;
    
    const connectWebSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || apiUrl.replace(/\/api\/?$/, '')).replace(/\/$/, '');
        
        socket = io(`${backendUrl}/admin`, {
          transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
          console.log('Connected to admin WebSocket');
        });

        socket.on('device:update', (updatedDevice: any) => {
          setDevices(prevDevices => {
            return prevDevices.map(d => {
              if (d._id === updatedDevice._id) {
                return { ...d, ...updatedDevice };
              }
              return d;
            });
          });
        });

        socket.on('devices:refresh', () => {
          load();
        });

        socket.on('disconnect', () => {
          console.log('Disconnected from admin WebSocket');
        });

        socket.on('connect_error', (err: Error) => {
          console.error('Admin WebSocket connection error:', err.message);
        });
      } catch (err) {
        console.error('WebSocket connection failed:', err);
      }
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach((menu) => {
          (menu as HTMLElement).style.display = 'none';
        });
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
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
      load();
    } catch (err: any) {
      toast(err.response?.data?.message || 'ไม่สามารถดึงข้อมูลอุปกรณ์ได้', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete device "${name}" from inventory?`)) return;
    try {
      await api.delete(`/devices/${id}`);
      toast('Device deleted');
      load();
    } catch {
      toast('Failed to delete device', 'error');
    }
  };

  const handleMdmLock = async (device: Device) => {
    try {
      if (device.platform === 'android') {
        if (device.managementTrack === 'standalone') {
          await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'LOCK' });
          toast(`คิวคำสั่งล็อคเครื่อง Standalone DPC ของ ${device.name} แล้ว (จะทำงานเมื่อเครื่องเชื่อมต่อเน็ต)`, 'success');
        } else {
          if (!device.androidEnterpriseName) return toast('Android enterprise name not configured for this device', 'error');
          await api.post(`/mdm/android/lock/${encodeURIComponent(device.androidEnterpriseName)}`);
          toast(`ส่งคำสั่งล็อคเครื่องไปที่กูเกิ้ลสำหรับ ${device.name} แล้ว`, 'success');
        }
      } else {
        if (!device.appleMdmUdid || !device.applePushToken) return toast('Apple MDM credentials not fully configured for this device', 'error');
        await api.post('/mdm/apple/lock', { udid: device.appleMdmUdid, pushToken: device.applePushToken });
        toast(`Lock command issued to ${device.name}`, 'success');
      }
      load();
    } catch (err) {
      toast('Failed to issue MDM lock', 'error');
    }
  };

  const handleMdmUnlock = async (device: Device) => {
    try {
      if (device.platform === 'android') {
        if (device.managementTrack === 'standalone') {
          await api.post('/admin/commands/queue', { deviceId: device._id, commandType: 'UNLOCK' });
          toast(`คิวคำสั่งปลดล็อกเครื่อง Standalone DPC ของ ${device.name} แล้ว (จะทำงานเมื่อเครื่องเชื่อมต่อเน็ต)`, 'success');
        } else {
          if (!device.androidEnterpriseName) return toast('Android enterprise name not configured for this device', 'error');
          await api.post(`/mdm/android/unlock/${encodeURIComponent(device.androidEnterpriseName)}`);
          toast(`ส่งคำสั่งปลดล็อกเครื่องไปที่กูเกิ้ลสำหรับ ${device.name} แล้ว`, 'success');
        }
      } else {
        if (!device.appleMdmUdid || !device.applePushToken) return toast('Apple MDM credentials not fully configured for this device', 'error');
        await api.post('/mdm/apple/unlock', { udid: device.appleMdmUdid, pushToken: device.applePushToken });
        toast(`Unlock command issued to ${device.name}`, 'success');
      }
      load();
    } catch (err) {
      toast('Failed to issue MDM unlock', 'error');
    }
  };

  const handleScreenTimeLock = async (device: Device) => {
    try {
      await api.post(`/mdm/apple/device/${device._id}/screen-time-lockdown`);
      toast(`Screen Time Lock command sent to ${device.name}`);
      load();
    } catch (err) {
      toast('Failed to apply Screen Time Lock', 'error');
    }
  };

  const handleScreenTimeUnlock = async (device: Device) => {
    try {
      await api.post(`/mdm/apple/device/${device._id}/screen-time-unlock`);
      toast(`Screen Time Unlock command sent to ${device.name}`);
      load();
    } catch (err) {
      toast('Failed to remove Screen Time Lock', 'error');
    }
  };

  const statusBadge: Record<string, string> = {
    pending: 'yellow',
    available: 'green',
    rented: 'blue',
    locked: 'red',
    maintenance: 'gray',
    returned: 'gray',
  };

  return (
    <AppLayout
      title="Devices"
      subtitle="Fleet & MDM inventory"
      actions={
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setGlobalRegisterModalOpen(true)}
            className="topbar-btn"
            style={{
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: 'var(--blue-400)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <QrCode size={16} />
            QR ลงทะเบียนด่วน
          </button>
          <button
            onClick={handleSyncImport}
            disabled={syncing || loading}
            className="topbar-btn"
            style={{
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: 'var(--purple-400)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {syncing ? (
              <>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                กำลังดึงข้อมูล...
              </>
            ) : (
              <>
                <Download size={16} />
                ซิงค์นำเข้าจาก Google
              </>
            )}
          </button>
          <button id="add-device" className="topbar-btn primary" onClick={() => setModal({ open: true, device: null })} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />
            Register Device
          </button>
        </div>
      }
    >
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Device Fleet</div>
            <div className="card-subtitle">{devices.length} device{devices.length !== 1 ? 's' : ''} registered</div>
          </div>
          <div className="filters-row" style={{ margin: 0 }}>
            <button className={`filter-chip ${platformFilter === '' ? 'active' : ''}`} onClick={() => setPlatformFilter('')}>All Platforms</button>
            <button className={`filter-chip ${platformFilter === 'android' ? 'active' : ''}`} onClick={() => setPlatformFilter('android')}>Android</button>
            <button className={`filter-chip ${platformFilter === 'ios' ? 'active' : ''}`} onClick={() => setPlatformFilter('ios')}>iOS</button>

            <span style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 4px' }}>|</span>

            <button className={`filter-chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All Statuses</button>
            <button className={`filter-chip ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>Pending</button>
            <button className={`filter-chip ${statusFilter === 'available' ? 'active' : ''}`} onClick={() => setStatusFilter('available')}>Available</button>
            <button className={`filter-chip ${statusFilter === 'rented' ? 'active' : ''}`} onClick={() => setStatusFilter('rented')}>Rented</button>
            <button className={`filter-chip ${statusFilter === 'locked' ? 'active' : ''}`} onClick={() => setStatusFilter('locked')}>Locked</button>
            <button className={`filter-chip ${statusFilter === 'returned' ? 'active' : ''}`} onClick={() => setStatusFilter('returned')}>Returned</button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Serial / IMEI</th>
                <th>Platform</th>
                <th>Rates</th>
                <th>Status</th>
                <th>MDM Enrollment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && devices.length === 0 ? (
                <tr><td colSpan={7}><div className="loading-spinner"><div className="spinner" /></div></td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon"><Smartphone size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} /></div><div className="empty-state-text">No devices registered yet</div></div></td></tr>
              ) : devices.map(d => {
                const activeRental = rentals.find(r => r.device?._id === d._id && r.status === 'active');
                const rentingCustomerName = activeRental?.customer?.name;

                const isReturned = d.status === 'returned';
                return (
                  <tr key={d._id} style={isReturned ? { opacity: 0.5 } : undefined}>
                    <td>
                      <div style={{ fontWeight: 600, textDecoration: isReturned ? 'line-through' : undefined }}>{d.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.brand} {d.model} • {d.storageGB}GB</div>
                      {rentingCustomerName && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '4px',
                          padding: '2px 8px',
                          background: 'rgba(59,130,246,0.1)',
                          border: '1px solid rgba(59,130,246,0.2)',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          color: '#60a5fa',
                          fontWeight: 600
                        }}>
                          <User size={14} style={{verticalAlign:'middle',marginRight:4}} /> เช่าโดย: {rentingCustomerName}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>S/N: {d.serialNumber}</div>
                      {d.imei && <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-muted)' }}>IMEI: {d.imei}</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {d.platform === 'android' ? (
                          <Smartphone size={16} style={{ color: '#3b82f6' }} />
                        ) : (
                          <Apple size={16} style={{ color: 'var(--text-primary)' }} />
                        )}
                        {d.platform === 'android' ? 'Android' : 'iOS'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>Day: ฿{d.dailyRate}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Month: ฿{d.monthlyRate}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${statusBadge[d.status] || 'gray'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>
                      {d.platform === 'android' ? (
                        d.managementTrack === 'standalone' ? (
                          d.standaloneDeviceId ? (
                            <span style={{ color: 'var(--green-400)', fontSize: '12px' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> Enrolled (Standalone DPC)</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}><AlertTriangle size={14} style={{verticalAlign:'middle',marginRight:4}} /> Not Enrolled (Standalone)</span>
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => setStandaloneEnrollModal({ open: true, device: d })}
                                style={{ padding: '4px 8px', fontSize: '10.5px', height: 'auto', alignSelf: 'start', borderRadius: '4px', background: 'var(--blue-600)', color: '#fff', border: 'none', cursor: 'pointer' }}
                              >
                                <QrCode size={14} style={{verticalAlign:'middle',marginRight:4}} /> Scan QR เพื่อเริ่ม
                              </button>
                            </div>
                          )
                        ) : (
                          d.androidEnterpriseName ? (
                            <span style={{ color: 'var(--green-400)', fontSize: '12px' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> Enrolled (Android Enterprise)</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}><AlertTriangle size={14} style={{verticalAlign:'middle',marginRight:4}} /> Not Enrolled</span>
                          )
                        )
                      ) : (
                        d.appleMdmUdid ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: 'var(--green-400)', fontSize: '12px' }}><CheckCircle2 size={14} style={{verticalAlign:'middle',marginRight:4}} /> Enrolled (iOS MDM)</span>
                            {d.screenTimeLocked && (
                              <span style={{ color: 'var(--red-400)', fontSize: '11px', fontWeight: 'bold' }}><Lock size={14} style={{verticalAlign:'middle',marginRight:4}} /> ST Locked</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}><AlertTriangle size={14} style={{verticalAlign:'middle',marginRight:4}} /> Not Enrolled</span>
                        )
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {/* Configure button for pending devices */}
                        {d.status === 'pending' && (
                          <button className="btn btn-primary btn-sm" onClick={() => setConfigureDevice(d)} title="Configure" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px' }}>
                            <Settings size={14} /> ตั้งค่า
                          </button>
                        )}
                        {/* Primary action buttons */}
                        {d.status !== 'pending' && (
                          <>
                            <button className="btn-lock" onClick={() => handleMdmLock(d)} title="Lock" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Lock size={14} />
                            </button>
                            <button className="btn-unlock" onClick={() => handleMdmUnlock(d)} title="Unlock" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Unlock size={14} />
                            </button>
                          </>
                        )}
                        
                        {/* More actions dropdown */}
                        <div className="dropdown">
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              // Close all other dropdowns first
                              document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none');
                              const btn = e.currentTarget;
                              const menu = btn.nextElementSibling as HTMLElement;
                              const rect = btn.getBoundingClientRect();
                              menu.style.display = 'block';
                              menu.style.position = 'fixed';
                              menu.style.top = `${rect.bottom + 4}px`;
                              menu.style.right = `${window.innerWidth - rect.right}px`;
                            }}
                            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <div className="dropdown-menu" style={{
                            display: 'none',
                            position: 'fixed',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '4px',
                            minWidth: '180px',
                            zIndex: 9999,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          }}>
                            {/* iOS Screen Time */}
                            {d.platform === 'ios' && d.appleMdmUdid && (
                              d.screenTimeLocked ? (
                                <button className="dropdown-item" onClick={() => { handleScreenTimeUnlock(d); document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none'); }}>
                                  <Unlock size={14} />
                                  Screen Time Unlock
                                </button>
                              ) : (
                                <button className="dropdown-item" onClick={() => { handleScreenTimeLock(d); document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none'); }}>
                                  <Lock size={14} />
                                  Screen Time Lock
                                </button>
                              )
                            )}

                            {/* Android Enterprise Restrictions */}
                            {d.platform === 'android' && d.androidEnterpriseName && (
                              <button className="dropdown-item" onClick={() => { setRestrictionsModal({ open: true, device: d }); document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none'); }}>
                                <Shield size={14} />
                                Block Features
                              </button>
                            )}

                            {/* ── Restrictions: Standalone devices ── */}
                            {d.platform === 'android' && d.managementTrack === 'standalone' && d.standaloneDeviceId && (
                              <button className="dropdown-item" onClick={() => {
                                document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none');
                                setRestrictionsModal({ open: true, device: { ...d, managementTrack: 'standalone' } });
                              }}>
                                <Shield size={14} />
                                Restrictions
                              </button>
                            )}

                            {/* ── Danger Zone: Standalone devices ── */}
                            {d.platform === 'android' && d.managementTrack === 'standalone' && d.standaloneDeviceId && (
                              <button className="dropdown-item" style={{ color: 'var(--red-400)' }} onClick={() => {
                                document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none');
                                setDangerZoneModal({ open: true, device: d });
                              }}>
                                <AlertTriangle size={14} />
                                Danger Zone...
                              </button>
                            )}


                            {/* Enroll/Re-enroll DPC */}
                            {d.platform === 'android' && (
                              <button className="dropdown-item" onClick={() => { setStandaloneEnrollModal({ open: true, device: { ...d, managementTrack: 'standalone' } }); document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none'); }}>
                                <RefreshCw size={14} />
                                {d.standaloneDeviceId ? 'Re-Enroll DPC' : 'Enroll DPC'}
                              </button>
                            )}

                            {/* Remove Factory Reset Protection (Device Owner only) */}
                            {d.securityMode === 'device-owner' && d.managementTrack === 'standalone' && (
                              <button className="dropdown-item" style={{ color: 'var(--red-400)' }} onClick={async () => {
                                document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none');
                                if (!confirm(`ลบ Factory Reset Protection จาก "${d.name}"?\n\nเครื่องจะไม่ป้องกัน Factory Reset อีกต่อไป แต่ยังอยู่ในโหมด Device Owner`)) return;
                                try {
                                  const res = await api.post(`/adb-bridge/remove-factory-reset-protection/${d._id}`);
                                  if (res.data.success) {
                                    toast('ลบ Factory Reset Protection สำเร็จ', 'success');
                                    load();
                                  } else {
                                    toast(`ไม่สำเร็จ: ${res.data.message}`, 'error');
                                  }
                                } catch (err: any) {
                                  toast(err.response?.data?.message || 'ADB Bridge ไม่เชื่อมต่อ', 'error');
                                }
                              }}>
                                <ShieldOff size={14} />
                                ลบ Factory Reset Protection
                              </button>
                            )}

                            {/* Remove Device Owner (only for Device Owner devices) */}
                            {d.securityMode === 'device-owner' && d.managementTrack === 'standalone' && (
                              <button className="dropdown-item" style={{ color: 'var(--purple-400)' }} onClick={async () => {
                                document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none');
                                if (!confirm(`Remove Device Owner from "${d.name}"? Device will fall back to Device Admin mode.`)) return;
                                try {
                                  const res = await api.post(`/adb-bridge/deactivate-device-owner/${d._id}`);
                                  if (res.data.success) {
                                    toast('Device Owner removed. Device is now Device Admin.', 'success');
                                    load();
                                  } else {
                                    toast(`Failed: ${res.data.message}`, 'error');
                                  }
                                } catch (err: any) {
                                  toast(err.response?.data?.message || 'ADB Bridge not connected', 'error');
                                }
                              }}>
                                <Shield size={14} />
                                Remove Device Owner
                              </button>
                            )}

                            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                            
                            {/* Edit & Delete */}
                            <button className="dropdown-item" onClick={() => { setModal({ open: true, device: d }); document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none'); }}>
                              <Edit3 size={14} />
                              Edit Device
                            </button>
                            <button className="dropdown-item" style={{ color: 'var(--red-400)' }} onClick={() => { del(d._id, d.name); document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none'); }}>
                              <Trash2 size={14} />
                              Remove Device
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && <DeviceModal device={modal.device} onClose={() => setModal({ open: false })} onSave={() => { setModal({ open: false }); load(); }} />}
      
      {restrictionsModal.open && restrictionsModal.device && (
        <RestrictionsModal
          device={restrictionsModal.device}
          onClose={() => setRestrictionsModal({ open: false, device: null })}
          onSave={() => { setRestrictionsModal({ open: false, device: null }); load(); }}
        />
      )}

      {standaloneEnrollModal.open && standaloneEnrollModal.device && (
        <StandaloneEnrollModal
          device={standaloneEnrollModal.device}
          onClose={() => setStandaloneEnrollModal({ open: false, device: null })}
          onSave={() => { setStandaloneEnrollModal({ open: false, device: null }); load(); }}
        />
      )}

      {globalRegisterModalOpen && (
        <GlobalRegisterModal
          initialDeviceCount={devices.length}
          onClose={() => { setGlobalRegisterModalOpen(false); load(); }}
          onDeviceRegistered={(dev) => { setConfigureDevice({ ...dev, _fromSetupWizard: true } as any); }}
        />
      )}

      {configureDevice && (
        <ConfigureModal
          device={configureDevice}
          isDeviceOwner={!!(configureDevice as any)._fromSetupWizard}
          onClose={() => setConfigureDevice(null)}
          onConfigured={() => { setConfigureDevice(null); load(); }}
        />
      )}

      {dangerZoneModal.open && dangerZoneModal.device && (
        <DangerZoneModal
          device={dangerZoneModal.device}
          onClose={() => setDangerZoneModal({ open: false, device: null })}
          onAction={() => { setDangerZoneModal({ open: false, device: null }); load(); }}
        />
      )}
    </AppLayout>
  );
}
