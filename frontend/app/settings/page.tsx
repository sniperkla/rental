'use client';
import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { toast } from '@/lib/toast';
import {
  Settings,
  Smartphone,
  Cloud,
  Apple,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Shield,
  Zap,
  Globe,
  Key,
  FileJson,
  Server,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  QrCode,
  ExternalLink,
  Terminal,
  Plus,
} from 'lucide-react';

export default function SettingsPage() {
  const [gracePeriod, setGracePeriod] = useState(3);
  const [activeSection, setActiveSection] = useState<string>('general');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    toast('บันทึกการตั้งค่าสำเร็จ');
  };

  const navItems = [
    { id: 'general', icon: Settings, label: 'ตั้งค่าทั่วไป' },
    { id: 'standalone', icon: Smartphone, label: 'Standalone DPC', status: 'ready' as const },
    { id: 'android-cloud', icon: Cloud, label: 'Android Cloud (Google)', status: 'setup' as const },
    { id: 'ios', icon: Apple, label: 'iOS MDM (Apple)', status: 'setup' as const },
  ];

  return (
    <AppLayout title="Settings" subtitle="ตั้งค่าระบบ MDM และการเรียกเก็บเงิน">
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Sidebar Navigation */}
        <div style={{ minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'rgba(139,92,246,0.15)' : 'transparent',
                  color: isActive ? 'var(--purple-400)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.status === 'ready' && (
                  <CheckCircle2 size={14} style={{ marginLeft: 'auto', color: 'var(--green-400)' }} />
                )}
                {item.status === 'setup' && (
                  <AlertTriangle size={14} style={{ marginLeft: 'auto', color: 'var(--yellow-500)' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1 }}>
          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={20} />
                  ตั้งค่าทั่วไป
                </div>
              </div>
              <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
                <div className="form-group">
                  <label className="form-label">ระยะเวลาผ่อนผันการชำระเงิน (วัน)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={gracePeriod}
                    onChange={e => setGracePeriod(parseInt(e.target.value) || 0)}
                    min={0}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    จำนวนวันหลังจากเลยกำหนดชำระเงิน ก่อนระบบจะล็อคเครื่องอัตโนมัติ
                  </span>
                </div>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>บันทึก</button>
              </form>
            </div>
          )}

          {/* Standalone DPC — Ready */}
          {activeSection === 'standalone' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--green-500)' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Smartphone size={20} />
                      Standalone DPC
                    </div>
                    <div className="card-subtitle">ระบบจัดการเครื่อง Android แบบไม่ต้องพึ่ง Google Enterprise</div>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(34,197,94,0.15)', color: 'var(--green-400)', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                    <CheckCircle2 size={14} />
                    พร้อมใช้
                  </span>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--green-400)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={16} />
                      วิธีใช้งาน (ง่ายมาก!)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { step: '1', icon: Smartphone, title: 'ไปที่หน้า Devices', desc: <>กดปุ่ม <Plus size={14} /> Register Device เพื่อเพิ่มเครื่องใหม่</> },
                        { step: '2', icon: QrCode, title: 'เลือก Platform: Android', desc: 'เลือก Standalone DPC เป็น Management Track' },
                        { step: '3', icon: QrCode, title: 'กด Enroll DPC', desc: 'ในตาราง Devices กดปุ่ม Enroll DPC ที่เครื่องที่ต้องการ' },
                        { step: '4', icon: QrCode, title: 'สแกน QR Code', desc: 'เปิดแอป System Service บนเครื่อง Android → สแกน QR Code' },
                        { step: '5', icon: CheckCircle2, title: 'เสร็จ!', desc: 'แอปจะทำงานเบื้องหลัง พร้อมล็อค/ปลดล็อคจากระยะไกล' },
                      ].map(item => {
                        const StepIcon = item.icon;
                        return (
                          <div key={item.step} style={{ display: 'flex', gap: '12px', padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                            <div style={{ minWidth: '28px', height: '28px', borderRadius: '50%', background: 'var(--green-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>{item.step}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <StepIcon size={14} />
                                {item.title}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#60a5fa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={14} />
                      ฟีเจอร์ที่รองรับ
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {[
                        { icon: Lock, label: 'ล็อค/ปลดล็อคเครื่อง' },
                        { icon: Globe, label: 'แสดงข้อความหน้าจอ' },
                        { icon: QrCode, label: 'ตั้งค่าผ่าน QR Code' },
                        { icon: WifiOff, label: 'ทำงานออฟไลน์' },
                        { icon: Smartphone, label: 'รองรับ GMS-free' },
                        { icon: Shield, label: 'ไม่ต้องมี Google Account' },
                      ].map(item => {
                        const FeatureIcon = item.icon;
                        return (
                          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={12} style={{ color: 'var(--green-400)' }} />
                            <FeatureIcon size={12} />
                            {item.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Cloud — Not Ready */}
          {activeSection === 'android-cloud' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--yellow-500)', opacity: 0.85 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Cloud size={20} />
                      Android Cloud (Google AMAPI)
                    </div>
                    <div className="card-subtitle">จัดการเครื่อง Android ผ่าน Google Enterprise</div>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(234,179,8,0.15)', color: '#eab308', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                    <AlertTriangle size={14} />
                    ต้องตั้งค่าก่อน
                  </span>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#eab308', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} />
                      สิ่งที่ต้องเตรียม
                    </div>
                    <ul style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Globe size={12} /> บัญชี Google Cloud Platform (GCP)</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Key size={12} /> เปิดใช้ Android Management API</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FileJson size={12} /> สร้าง Service Account และดาวน์โหลด JSON key</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Server size={12} /> สร้าง Enterprise ใน Android Enterprise Console</li>
                    </ul>
                  </div>

                  <div style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Terminal size={16} />
                      ขั้นตอนการตั้งค่า
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        { step: '1', icon: Globe, title: 'สร้าง GCP Project', desc: 'ไปที่ console.cloud.google.com → สร้าง Project ใหม่' },
                        { step: '2', icon: Key, title: 'เปิด Android Management API', desc: 'ไปที่ APIs & Services → Library → ค้นหา "Android Management API" → เปิดใช้' },
                        { step: '3', icon: FileJson, title: 'สร้าง Service Account', desc: 'ไปที่ IAM & Admin → Service Accounts → สร้างใหม่ → ดาวน์โหลด JSON key' },
                        { step: '4', icon: Server, title: 'อัพโหลด JSON key ไปยัง Server', desc: 'คัดลอกไฟล์ JSON ไปไว้ที่ backend/config/ แล้วตั้งค่า environment variable' },
                        { step: '5', icon: Cloud, title: 'สร้าง Enterprise', desc: 'ใช้ Android Management API เพื่อสร้าง Enterprise แล้วคัดลอก Enterprise ID' },
                        { step: '6', icon: Settings, title: 'ตั้งค่าในระบบ', desc: 'นำ Enterprise ID มาใส่ใน environment variable ของ backend' },
                      ].map(item => {
                        const StepIcon = item.icon;
                        return (
                          <div key={item.step} style={{ display: 'flex', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                            <div style={{ minWidth: '28px', height: '28px', borderRadius: '50%', background: '#eab308', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>{item.step}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <StepIcon size={14} />
                                {item.title}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#60a5fa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={14} />
                      Environment Variables ที่ต้องตั้งค่า
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', background: '#1a1a2e', padding: '12px', borderRadius: '6px', color: '#4ade80' }}>
                      <div>ANDROID_SERVICE_ACCOUNT_KEY_JSON=config/service-account.json</div>
                      <div>ANDROID_ENTERPRISE_ID=enterprises/LC04xxxxxx</div>
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#eab308', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={14} />
                      เคล็ดลับ
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ถ้าไม่อยากตั้งค่า Google Enterprise ให้ใช้ <strong>Standalone DPC</strong> แทน — ง่ายกว่า แค่สแกน QR Code
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* iOS MDM — Not Ready */}
          {activeSection === 'ios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--red-400)', opacity: 0.85 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Apple size={20} />
                      iOS MDM (Apple Push Notifications)
                    </div>
                    <div className="card-subtitle">จัดการเครื่อง iPhone/iPad ผ่าน Apple MDM</div>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(239,68,68,0.15)', color: 'var(--red-400)', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                    <XCircle size={14} />
                    ยังไม่พร้อม
                  </span>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--red-400)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} />
                      สิ่งที่ต้องเตรียม
                    </div>
                    <ul style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Key size={12} /> Apple Developer Account ($99/ปี)</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={12} /> Mac computer สำหรับจัดการ certificates</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Server size={12} /> Apple Configurator 2 (ติดตั้งจาก Mac App Store)</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={12} /> เครื่อง iPhone/iPad ที่ต้องการจัดการ</li>
                    </ul>
                  </div>

                  <div style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Terminal size={16} />
                      ขั้นตอนการตั้งค่า
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        { step: '1', icon: Key, title: 'สร้าง APNs Certificate', desc: 'ไปที่ Apple Developer Portal → Certificates → สร้าง MDM Push Certificate' },
                        { step: '2', icon: FileJson, title: 'ดาวน์โหลด Certificate', desc: 'ดาวน์โหลดไฟล์ .pem ทั้ง cert และ key' },
                        { step: '3', icon: Server, title: 'อัพโหลดไปยัง Server', desc: 'คัดลอกไฟล์ cert.pem และ key.pem ไปไว้ที่ backend/certs/' },
                        { step: '4', icon: Settings, title: 'ตั้งค่า Environment Variables', desc: 'ตั้งค่า APPLE_MDM_PUSH_CERT_PATH และ APPLE_MDM_PUSH_KEY_PATH' },
                        { step: '5', icon: Smartphone, title: 'Enroll เครื่อง iOS', desc: 'ใช้ Apple Configurator 2 เพื่อ enroll เครื่อง iPhone/iPad' },
                        { step: '6', icon: Key, title: 'คัดลอก UDID และ Push Token', desc: 'หลัง enroll สำเร็จ คัดลอก UDID และ Push Token มาใส่ในระบบ' },
                      ].map(item => {
                        const StepIcon = item.icon;
                        return (
                          <div key={item.step} style={{ display: 'flex', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                            <div style={{ minWidth: '28px', height: '28px', borderRadius: '50%', background: 'var(--red-400)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>{item.step}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <StepIcon size={14} />
                                {item.title}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#60a5fa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={14} />
                      Environment Variables ที่ต้องตั้งค่า
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', background: '#1a1a2e', padding: '12px', borderRadius: '6px', color: '#4ade80' }}>
                      <div>APPLE_MDM_PUSH_CERT_PATH=certs/mdm_push_cert.pem</div>
                      <div>APPLE_MDM_PUSH_KEY_PATH=certs/mdm_push_key.pem</div>
                      <div>APPLE_MDM_TOPIC=com.apple.mgmt.External.xxxxxx</div>
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#eab308', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} />
                      ข้อจำกัด
                    </div>
                    <ul style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, paddingLeft: '16px' }}>
                      <li>ต้องมี Apple Developer Account (เสียค่าใช้จ่าย $99/ปี)</li>
                      <li>ต้องใช้ Mac ในการจัดการ certificates</li>
                      <li>เครื่อง iOS ต้องเป็น Supervised mode (ต้อง factory reset)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
