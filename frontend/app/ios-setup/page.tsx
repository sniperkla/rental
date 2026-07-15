'use client';
import { useCallback, useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { Globe, Building2, Mail, CheckCircle2, Monitor, Upload, Settings, Smartphone, Rocket, Loader2, AlertTriangle, Wrench, Shield, FlaskConical, Lightbulb, X, Check, Folder, Download } from 'lucide-react';

type StatusCheck = { label: string; ok: boolean; detail: string };
type StatusData = { ready: boolean; checks: StatusCheck[] } | null;

const Spin = () => (
  <span style={{ display: 'inline-flex', animation: 'spin 1s linear infinite', marginRight: 6, alignItems: 'center' }}><Loader2 size={16} /></span>
);

/* ── Step pill ─────────────────────────────────────────────────────── */
function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      borderRadius: 40, fontWeight: 700, fontSize: 13,
      background: done ? 'rgba(34,197,94,0.1)' : active ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : active ? 'rgba(139,92,246,0.35)' : 'var(--border)'}`,
      color: done ? 'var(--green-400)' : active ? 'var(--purple-400)' : 'var(--text-muted)',
      transition: 'all .3s ease',
    }}>
      <span>{done ? <Check size={14} /> : n}</span>
      {label}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */
export default function IosSetupPage() {
  const [step, setStep] = useState(1);
  const [mdmMode, setMdmMode] = useState<'abm' | 'ota'>('abm');
  const [statusData, setStatusData] = useState<StatusData>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  /* Status health check */
  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await api.get('/mdm/apple/status');
      setStatusData(res.data);
      // If server is ready and user is not manually navigating steps, default to Step 4
      if (res.data.ready && step === 1) setStep(4);
    } catch {
      setStatusData(null);
    } finally {
      setStatusLoading(false);
    }
  }, [step]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  return (
    <AppLayout title="iOS MDM Setup" subtitle="Apple Business Manager & APNs Configuration Wizard">
      
      {/* ── Status Banner ─────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${statusData?.ready ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)'}`,
        background: statusData?.ready ? 'rgba(34,197,94,0.05)' : 'rgba(251,191,36,0.05)',
        marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 24, lineHeight: 1.1, display: 'inline-flex', alignItems: 'center' }}>
          {statusLoading ? <Loader2 size={24} className="animate-spin" /> : statusData?.ready ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: statusData?.ready ? 'var(--green-400)' : '#fbbf24' }}>
            {statusLoading ? 'กำลังตรวจสอบสถานะเซิร์ฟเวอร์...' :
              statusData?.ready
                ? 'iOS MDM เซิร์ฟเวอร์พร้อมทำงานแล้ว (APNs Certificates ถูกเปิดใช้งานแล้ว)'
                : 'เซิร์ฟเวอร์ยังตั้งค่าใบรับรองไม่ครบ — โปรดดำเนินขั้นตอนด้านล่าง'}
          </div>
          {statusData && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {statusData.checks.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: c.ok ? 'var(--green-400)' : '#fbbf24', fontWeight: 600,
                  background: c.ok ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.08)',
                  border: `1px solid ${c.ok ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)'}`,
                  borderRadius: 6, padding: '2px 8px',
                }}>
                  <span style={{ display: 'inline-flex' }}>{c.ok ? <Check size={14} /> : <X size={14} />}</span> {c.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mode Switcher Card ─────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 8 }}><Wrench size={16} /> เลือกรูปแบบการใช้งาน iOS MDM ขององค์กรคุณ:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          
          {/* ABM Option */}
          <div
            onClick={() => setMdmMode('abm')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `2px solid ${mdmMode === 'abm' ? 'var(--purple-400)' : 'var(--border)'}`,
              background: mdmMode === 'abm' ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><Shield size={18} /></span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: mdmMode === 'abm' ? 'var(--purple-400)' : 'inherit' }}>
                ใช้งานทางการผ่าน ABM/DEP (ปลอดภัยสูงสุด)
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              บล็อคล้างเครื่อง 100%, ปิดสิทธิ์ไม่ให้ลูกค้าแอบกดลบโปรไฟล์ควบคุมใน Settings, ทนทานต่อการ Reset
            </div>
          </div>

          {/* OTA Option */}
          <div
            onClick={() => setMdmMode('ota')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `2px solid ${mdmMode === 'ota' ? 'var(--purple-400)' : 'var(--border)'}`,
              background: mdmMode === 'ota' ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><FlaskConical size={16} /></span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: mdmMode === 'ota' ? 'var(--purple-400)' : 'inherit' }}>
                ใช้งานแบบไม่มี ABM (OTA Web-only / ทดสอบ)
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              ไม่ต้องสมัคร ABM นิติบุคคล, ลูกค้าติดตั้งโปรไฟล์ผ่านเว็บ Safari ได้ทันที แต่ลูกค้ากดลบโปรไฟล์ควบคุมทิ้งเองได้ในภายหลัง
            </div>
          </div>

        </div>
      </div>

      {/* ── Step pills ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        <StepPill n={1} label={mdmMode === 'abm' ? "Apple Business Manager" : "ข้ามขั้นตอน ABM"} active={step === 1} done={step > 1} />
        <StepPill n={2} label="MDM Certificate (APNs)" active={step === 2} done={step > 2} />
        <StepPill n={3} label="ตั้งค่า Environment" active={step === 3} done={step > 3} />
        <StepPill n={4} label="ลงทะเบียนเครื่อง" active={step === 4} done={false} />
      </div>

      {/* ── Step 1 ─────────────────────────────────────────────────── */}
      {step === 1 && (
        mdmMode === 'abm' ? (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Step 1 — สร้างบัญชี Apple Business Manager (ABM)</div>
                <div className="card-subtitle">ฟรี — สำหรับร้านค้าที่จดทะเบียนพาณิชย์/นิติบุคคล</div>
              </div>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { n: '1', title: 'เปิดเว็บไซต์', desc: 'ไปที่ business.apple.com แล้วกด "Enroll Now"', icon: <Globe size={14} /> },
                  { n: '2', title: 'ยืนยันตัวตนบริษัท', desc: 'กรอกข้อมูลบริษัท / ทะเบียนการค้า (ชื่อร้าน, ที่อยู่, D-U-N-S Number)', icon: <Building2 size={14} /> },
                  { n: '3', title: 'รอการอนุมัติ 1-3 วัน', desc: 'Apple จะโทรติดต่อตรวจสอบและส่งอีเมล์ยืนยันสิทธิ์', icon: <Mail size={14} /> },
                  { n: '4', title: 'เข้าสู่ระบบ ABM', desc: 'Login ที่ business.apple.com ด้วยบัญชีองค์กรที่ได้รับการอนุมัติ', icon: <CheckCircle2 size={14} /> },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', gap: 14, padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>{s.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.n}. {s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 14, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, fontSize: 12, color: '#93c5fd' }}>
                <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}><Lightbulb size={14} /></span> <strong>หมายเหตุ:</strong> หากธุรกิจของคุณไม่มี D-U-N-S Number สามารถนำใบทะเบียนพาณิชย์ไปขอฟรีออนไลน์ที่ <strong>dnb.com</strong>
              </div>

              <div style={{ textAlign: 'right' }}>
                <button className="btn btn-primary" onClick={() => setStep(2)}>ถัดไป → ตั้งค่า APNs Certificate</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Step 1 — ข้ามขั้นตอนการสมัครบัญชี ABM (OTA Mode)</div>
                <div className="card-subtitle">เปิดให้ทดสอบทันทีโดยยอมรับความเสี่ยงเครื่องหลุดได้</div>
              </div>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{
                padding: '16px', background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 10
              }}>
                <div style={{ fontWeight: 700, color: 'var(--red-400)', fontSize: '13.5px', marginBottom: '6px' }}>
                  <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}><AlertTriangle size={14} /></span> ยอมรับเงื่อนไขความเสี่ยงการลงทะเบียนแบบไม่มี ABM (OTA):
                </div>
                <ul style={{ fontSize: '12px', color: '#fca5a5', paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                  <li>ลูกค้าจะสามารถกดเข้าไปลบโปรไฟล์ควบคุม (Remove Profile) ทิ้งได้จากเมนูการตั้งค่าตัวเครื่อง</li>
                  <li>ลูกค้าสามารถสั่งล้างเครื่อง (Factory Reset) เพื่อถอดการเชื่อมต่อควบคุมออกถาวรได้</li>
                  <li>ไม่สามารถล็อกปุ่มเมนูล้างเครื่องในระบบ และไม่สามารถล็อกการลบโปรไฟล์ได้</li>
                </ul>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}><Lightbulb size={14} /></span> <strong>สิทธิ์การใช้งานที่ยังทำได้:</strong> แม้จะป้องกันเครื่องล้างไม่ได้ถาวร แต่แอดมินยังสามารถส่งคำสั่งสั่ง 
                <strong>ล็อกเครื่องระยะไกล (Lock Screen)</strong> และสั่ง <strong>ปลดล็อก (Unlock)</strong> ผ่านหน้าเว็บได้ปกติ 
                ตราบใดที่ลูกค้าไม่ได้ลบโปรไฟล์ควบคุมออก เหมาะสำหรับการนำมาใช้เทสการเชื่อมต่อจำลองการเช่า
              </div>

              <div style={{ textAlign: 'right' }}>
                <button className="btn btn-primary" onClick={() => setStep(2)}>ข้ามขั้นตอน ABM → ตั้งค่า APNs Certificate</button>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Step 2 ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Step 2 — สร้าง APNs Push Certificate สำหรับ MDM</div>
              <div className="card-subtitle">ต้องทำบนเครื่อง Mac เท่านั้น (ยังคงต้องใช้ทั้งสองโหมดเพื่อสั่งคำสั่ง Lock/Unlock)</div>
            </div>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  n: '1', icon: <Monitor size={14} />, title: 'สร้าง Certificate Signing Request (CSR)',
                  desc: 'เปิด Keychain Access → Certificate Assistant → "Request a Certificate from a Certificate Authority" → บันทึกเป็นไฟล์ mdm.csr',
                  code: null,
                },
                {
                  n: '2', icon: <Building2 size={14} />, title: 'สร้าง MDM Vendor Certificate บน Apple Developer',
                  desc: 'ไปที่ developer.apple.com → Certificates → เลือก "MDM CSR" → อัพโหลด mdm.csr → ดาวน์โหลด mdm_vendor.cer',
                  code: null,
                },
                {
                  n: '3', icon: <Upload size={14} />, title: 'สร้าง Push Certificate บน Apple Push Certificates Portal',
                  desc: 'ไปที่ identity.apple.com → "Create a Certificate" → อัพโหลด mdm_vendor.cer → ดาวน์โหลด MDM_xxxxx.pem',
                  code: null,
                },
                {
                  n: '4', icon: <Settings size={14} />, title: 'แปลง Certificate เป็น PEM ด้วย openssl',
                  desc: 'รันคำสั่งนี้ใน Terminal เพื่อแตกไฟล์ key และ cert:',
                  code: 'openssl pkcs12 -in MDM_xxxxx.p12 -nocerts -nodes -out mdm_push_key.pem\nopenssl pkcs12 -in MDM_xxxxx.p12 -clcerts -nokeys -out mdm_push_cert.pem',
                },
                {
                  n: '5', icon: <Folder size={14} />, title: 'วางไฟล์ใน backend/certs/',
                  desc: 'สร้าง directory และวางไฟล์ทั้งสองไว้ที่:',
                  code: 'backend/certs/mdm_push_cert.pem\nbackend/certs/mdm_push_key.pem',
                },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>{s.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.n}. {s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
                    </div>
                  </div>
                  {s.code && (
                    <pre style={{
                      background: 'rgba(0,0,0,0.4)', color: '#a5f3fc', borderRadius: 8, padding: '10px 14px',
                      fontSize: 11, margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap',
                    }}>{s.code}</pre>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← ย้อนกลับ</button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>ถัดไป → ตั้งค่า Environment</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3 ─────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Step 3 — ตั้งค่า Environment Variables</div>
              <div className="card-subtitle">เพิ่มค่าเหล่านี้ใน backend/.env เพื่อให้ระบบเชื่อมโยงข้อมูลสำเร็จ</div>
            </div>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ENV vars */}
            {[
              {
                key: 'APPLE_MDM_TOPIC',
                desc: 'APNs Topic — ดูได้จากไฟล์ mdm_push_cert.pem บรรทัด Subject UID',
                example: 'com.apple.mgmt.External.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
              },
              {
                key: 'APPLE_MDM_PUSH_CERT_PATH',
                desc: 'Path ไปยัง APNs push certificate PEM file',
                example: './certs/mdm_push_cert.pem',
              },
              {
                key: 'APPLE_MDM_PUSH_KEY_PATH',
                desc: 'Path ไปยัง APNs push private key PEM file',
                example: './certs/mdm_push_key.pem',
              },
            ].map(v => (
              <div key={v.key} style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <code style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple-400)', fontFamily: 'JetBrains Mono' }}>{v.key}</code>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{v.desc}</div>
                <pre style={{
                  background: 'rgba(0,0,0,0.35)', borderRadius: 6, padding: '8px 12px',
                  color: '#a5f3fc', fontSize: 11, fontFamily: 'JetBrains Mono', margin: 0,
                }}>{v.key}={v.example}</pre>
              </div>
            ))}

            <div style={{ padding: 14, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, fontSize: 12, color: '#fbbf24' }}>
              <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}><AlertTriangle size={14} /></span> <strong>หลังจากแก้ไข .env แล้ว ต้องทำการ Restart backend</strong>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← ย้อนกลับ</button>
              <button className="btn btn-primary" onClick={() => { loadStatus(); setStep(4); }}>ตรวจสอบสถานะ →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4 — Final ─────────────────────────────────────────── */}
      {step === 4 && (
        mdmMode === 'abm' ? (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Step 4 — ลงทะเบียนเครื่อง iOS (แบบทางการผ่าน ABM/DEP)</div>
                <div className="card-subtitle">Supervised Device Enrollment</div>
              </div>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  {
                    n: '1', icon: <Building2 size={14} />, title: 'เพิ่มเครื่องเข้า Apple Business Manager',
                    desc: 'ซื้อเครื่อง iPhone/iPad จากร้านที่เป็น Apple Authorized Reseller — เครื่องจะเข้า ABM อัตโนมัติผ่าน DEP',
                    alt: 'หรือ: ABM → Devices → "Assign by Serial Number" สำหรับเครื่องที่มีอยู่แล้ว',
                  },
                  {
                    n: '2', icon: <Settings size={14} />, title: 'กำหนด MDM Server ให้เครื่องใน ABM',
                    desc: 'ABM → Devices → เลือกเครื่อง → "Assign to MDM Server" → เลือก URL ของ RentControl backend (e.g. https://yourserver.com/mdm/apple)',
                    alt: null,
                  },
                  {
                    n: '3', icon: <Smartphone size={14} />, title: 'รีเซ็ตและลงทะเบียนเครื่อง',
                    desc: 'ล้างเครื่อง (Factory Reset) จากนั้นเปิดเครื่องขึ้นใหม่ ระบบจะทำการ Enrollment อัตโนมัติผ่าน DEP Setup Screen',
                    alt: null,
                  },
                  {
                    n: '4', icon: <CheckCircle2 size={14} />, title: 'บันทึก UDID และ Push Token อัตโนมัติ',
                    desc: 'เมื่อลงทะเบียนสำเร็จ เครื่องผู้เช่าจะปรากฏในหน้า Devices Dashboard อัตโนมัติโดยไม่ต้องพิมพ์รหัสเอง',
                    alt: null,
                  },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', gap: 14, padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>{s.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.n}. {s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
                      {s.alt && <div style={{ fontSize: 11, color: 'var(--purple-400)', marginTop: 4, fontStyle: 'italic' }}>{s.alt}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)}>← ย้อนกลับ</button>
                <a href="/devices" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Smartphone size={14} /> ไปหน้ารายการอุปกรณ์ (Devices)
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Step 4 — ลงทะเบียนเครื่อง iOS (แบบไม่มี ABM / OTA)</div>
                <div className="card-subtitle">ลงทะเบียนผ่านเบราว์เซอร์ Safari บนมือถือของลูกค้าโดยตรง</div>
              </div>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  {
                    n: '1', icon: <Globe size={14} />, title: 'เปิด Safari บนเครื่องเป้าหมาย',
                    desc: 'หยิบ iPhone/iPad เครื่องทดสอบขึ้นมาแล้วเปิดเว็บเบราว์เซอร์ Safari ไปที่ลิงก์ด้านล่างนี้:',
                    link: '/ios-enroll'
                  },
                  {
                    n: '2', icon: <Download size={14} />, title: 'ดาวน์โหลดไฟล์โปรไฟล์ควบคุม',
                    desc: 'กดปุ่มดาวน์โหลดบนหน้าจอมือถือ และเลือก "อนุญาต" เพื่อเก็บโปรไฟล์ลงเครื่อง',
                  },
                  {
                    n: '3', icon: <Settings size={14} />, title: 'เปิด Settings เพื่อทำการติดตั้ง',
                    desc: 'ไปที่ Settings → VPN & Device Management → เลือก "RentControl MDM" → กดติดตั้ง (Install) และใส่รหัสผ่านเครื่อง',
                  },
                  {
                    n: '4', icon: <Rocket size={14} />, title: 'รอผลตอบรับสำเร็จ',
                    desc: 'เมื่อตัวเครื่องกดยอมรับโปรไฟล์สำเร็จ เครื่องของลูกค้าจะเข้าบอร์ด RentControl อัตโนมัติทันที',
                  }
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', gap: 14, padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.n}. {s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
                      {'link' in s && (
                        <div style={{ marginTop: 8 }}>
                          <a href={s.link} target="_blank" style={{ color: 'var(--purple-400)', fontWeight: 700, textDecoration: 'underline', fontSize: 12 }}>
                            → เปิดหน้าลงทะเบียนเครื่องทดสอบ (/ios-enroll)
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)}>← ย้อนกลับ</button>
                <a href="/devices" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Smartphone size={14} /> ไปหน้ารายการอุปกรณ์ (Devices)
                </a>
              </div>
            </div>
          </div>
        )
      )}
    </AppLayout>
  );
}
