'use client';
import { useState, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import QRCode from 'react-qr-code';
import { Smartphone, RotateCcw, Fingerprint, Camera, CheckCircle2, Ticket, Key, XCircle, Download, ClipboardList, Lightbulb, BookOpen, Loader2 } from 'lucide-react';

interface EnrollmentToken {
  token: string;
  qrCode: string;
  expiresAt: string;
  name: string;
}

export default function EnrollPage() {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrollmentToken | null>(null);
  const [error, setError] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);

  const generate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/mdm/android/enrollment-token', {
        displayName: displayName.trim() || undefined,
      });
      setResult(res.data);
      toast('สร้าง QR Code สำเร็จ! ใช้ได้ 24 ชั่วโมง', 'success');
    } catch (err: any) {
      setError(err.response?.data?.message || 'ไม่สามารถสร้าง Token ได้ กรุณาตรวจสอบ Enterprise ID ใน .env');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx!.fillStyle = '#ffffff';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = `android-enroll-qr-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const expiresStr = result?.expiresAt
    ? new Date(result.expiresAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <AppLayout title="สร้าง QR Code ลงทะเบียนเครื่อง Android" subtitle="Generate Enrollment Token & QR Code for Android Enterprise">
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* How it works banner */}
        <div className="card" style={{ background: 'var(--gradient-glow)', borderColor: 'var(--purple-500)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple-300)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={20} /> วิธีการลงทะเบียนเครื่อง Android เข้าระบบ
          </div>
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            {[
              { icon: <RotateCcw size={22} />, step: '1', text: 'Factory Reset มือถือ' },
              { icon: '→', step: '', text: '' },
              { icon: <Fingerprint size={22} />, step: '2', text: 'เคาะหน้าจอ 6 ครั้ง' },
              { icon: '→', step: '', text: '' },
              { icon: <Camera size={22} />, step: '3', text: 'สแกน QR ด้านล่าง' },
              { icon: '→', step: '', text: '' },
              { icon: <CheckCircle2 size={22} />, step: '4', text: 'เครื่องเชื่อมต่ออัตโนมัติ' },
            ].map((item, i) => (
              item.step ? (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 8px', minWidth: 80 }}>
                  <span style={{ color: 'var(--purple-400)' }}>{item.icon}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ขั้นที่ {item.step}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{item.text}</span>
                </div>
              ) : (
                <div key={i} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 18, paddingBottom: 20 }}>{item.icon}</div>
              )
            ))}
          </div>
        </div>

        {/* Generator card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ticket size={20} /> สร้าง Enrollment Token & QR Code</div>
            <div className="card-subtitle">Token มีอายุการใช้งาน 24 ชั่วโมง และใช้ลงทะเบียนได้ทุกจำนวนเครื่อง</div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                ชื่อกลุ่มอุปกรณ์ (ไม่บังคับ)
              </label>
              <input
                id="enrollment-display-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="เช่น: ชุดเช่าที่ 1, สาขาสุขุมวิท"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 13.5,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                id="generate-qr-btn"
                onClick={generate}
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#8b5cf6,#3b82f6)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    กำลังสร้าง...
                  </>
                ) : <><Key size={16} /> สร้าง QR Code</>}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: 13 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><XCircle size={16} />{error}</span>
            </div>
          )}
        </div>

        {/* QR Result */}
        {result && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={20} /> QR Code พร้อมใช้งาน</div>
                <div className="card-subtitle">หมดอายุ: {expiresStr} · ใช้ได้ไม่จำกัดจำนวนเครื่อง</div>
              </div>
              <button
                onClick={downloadQR}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(139,92,246,0.15)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--purple-400)', fontWeight: 600, fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Download size={16} /> ดาวน์โหลด PNG</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* QR Code */}
              <div
                ref={qrRef}
                style={{
                  padding: 20,
                  background: '#ffffff',
                  borderRadius: 12,
                  flexShrink: 0,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
                }}
              >
                <QRCode
                  value={result.qrCode}
                  size={200}
                  level="H"
                  style={{ display: 'block' }}
                />
              </div>

              {/* Instructions */}
              <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClipboardList size={18} /> วิธีใช้ QR Code นี้:
                </div>
                {[
                  { icon: <RotateCcw size={16} />, text: 'Factory Reset มือถือที่ต้องการนำเข้าระบบ' },
                  { icon: <Fingerprint size={16} />, text: 'เมื่อขึ้นหน้าจอ "Welcome" ให้เคาะหน้าจอ 6 ครั้งติดกัน' },
                  { icon: <Camera size={16} />, text: 'ระบบจะเปิดกล้องให้สแกน QR Code — ชี้กล้องที่ QR นี้' },
                  { icon: <Loader2 size={16} />, text: 'รอประมาณ 2–5 นาที ระบบจะติดตั้งและตั้งค่าอัตโนมัติ' },
                  { icon: <Smartphone size={16} />, text: 'เมื่อเสร็จ เครื่องจะปรากฏในหน้าคู่มือ → "ดึงรายชื่อเครื่อง"' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, color: 'var(--purple-400)' }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}

                <div style={{
                  marginTop: 8,
                  padding: '10px 14px',
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--purple-300)',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lightbulb size={16} /> Token นี้ใช้ได้กับทุกเครื่องที่ต้องการลงทะเบียน ไม่ต้องสร้างใหม่ทุกครั้ง</span>
                </div>

                <a
                  href="/guide"
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)',
                    borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 12,
                    textDecoration: 'none', alignSelf: 'flex-start', marginTop: 4,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookOpen size={16} /> ดูรายชื่อเครื่องที่ลงทะเบียนแล้ว →</span>
                </a>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
