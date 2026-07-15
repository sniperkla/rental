'use client';
import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Smartphone, ClipboardList, Cpu, CheckCircle2, Check, XCircle, Clock, CreditCard, Settings, Lock, Unlock } from 'lucide-react';

interface AeDevice {
  name: string;
  state: string;
  hardwareInfo?: {
    brand?: string;
    model?: string;
    serialNumber?: string;
  };
}

function MdmDeviceFetcher() {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<AeDevice[]>([]);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    setError('');
    setFetched(false);
    try {
      const res = await api.get('/mdm/android/devices');
      setDevices(res.data?.devices || []);
      setFetched(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'ไม่สามารถดึงข้อมูลได้ กรุณาตรวจสอบการตั้งค่า Google Service Account');
    } finally {
      setLoading(false);
    }
  };

  const copyName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        หลังจากสแกน QR Code ลงทะเบียนเครื่องเสร็จแล้ว ให้กดปุ่มด้านล่างเพื่อดึงรายชื่ออุปกรณ์จาก Google Enterprise Server
        แล้วกดปุ่ม <strong style={{ color: 'var(--purple-400)' }}><ClipboardList size={14} style={{ verticalAlign: 'middle' }} /> คัดลอก</strong> ที่ชื่อเครื่องที่ต้องการ และนำไปวางในช่อง{' '}
        <strong>MDM Enrollment Name</strong> เมื่อลงทะเบียนอุปกรณ์ในระบบ
      </p>

      <button
        id="fetch-ae-devices"
        onClick={fetchDevices}
        disabled={loading}
        style={{
          padding: '12px 24px',
          background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '14px',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          alignSelf: 'flex-start',
          transition: 'opacity 0.2s',
        }}
      >
        {loading ? (
          <>
            <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            กำลังดึงข้อมูลจาก Google...
          </>
        ) : (
          <><Cpu size={18} /> ดึงรายชื่อเครื่อง Android ทั้งหมด</>
        )}
      </button>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '13px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><XCircle size={16} />{error}</span>
        </div>
      )}

      {fetched && devices.length === 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
          ไม่พบอุปกรณ์ที่ลงทะเบียนไว้ภายใต้ Enterprise นี้
        </div>
      )}

      {devices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            พบ {devices.length} เครื่อง — กด <ClipboardList size={12} style={{ verticalAlign: 'middle' }} /> เพื่อคัดลอก MDM Name ไปใส่ในหน้าลงทะเบียนอุปกรณ์
          </div>
          {devices.map((d, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ color: 'var(--purple-400)' }}><Cpu size={28} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                  {d.hardwareInfo?.brand} {d.hardwareInfo?.model}
                  {d.hardwareInfo?.serialNumber && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                      S/N: {d.hardwareInfo.serialNumber}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: '11.5px',
                  color: 'var(--purple-400)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {d.name}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '99px',
                  background: d.state === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  color: d.state === 'ACTIVE' ? 'var(--green-400)' : 'var(--red-400)',
                }}>
                  ● {d.state}
                </span>
                <button
                  onClick={() => copyName(d.name)}
                  style={{
                    padding: '6px 12px',
                    background: copied === d.name ? 'rgba(34,197,94,0.15)' : 'rgba(139,92,246,0.15)',
                    border: `1px solid ${copied === d.name ? 'rgba(34,197,94,0.3)' : 'rgba(139,92,246,0.3)'}`,
                    borderRadius: '8px',
                    color: copied === d.name ? 'var(--green-400)' : 'var(--purple-400)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copied === d.name ? <><Check size={14} /> คัดลอกแล้ว!</> : <><ClipboardList size={14} /> คัดลอก MDM Name</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GuidePage() {
  return (
    <AppLayout title="คู่มือการใช้งานระบบ" subtitle="เอกสารแนะนำขั้นตอนสำหรับผู้ดูแลระบบ (Admin Manual)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Intro */}
        <div className="card" style={{ background: 'var(--gradient-glow)', borderColor: 'var(--purple-500)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--purple-300)', marginBottom: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Smartphone size={18} /> ยินดีต้อนรับสู่ระบบ RentControl</span>
          </h2>
          <p style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
            ระบบนี้เป็นแพลตฟอร์มจัดการอุปกรณ์เช่าครบวงจร ที่สามารถบันทึกยอดการชำระเงิน ตรวจสอบประวัติสัญญาเช่า และสั่งการ ล็อค/ปลดล็อค
            หน้าจอมือถือของลูกค้าได้อัตโนมัติเมื่อค้างชำระ โดยเชื่อมต่อผ่านระบบ Android Enterprise API และ Apple APNs MDM
          </p>
        </div>

        {/* Step-by-Step Workflow */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={20} /> ลำดับขั้นตอนการปล่อยเช่าเครื่อง (Rental Workflow)</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13.5px' }}>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--purple-400)' }}>ขั้นที่ 1: เพิ่มข้อมูลลูกค้า</strong>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                ไปที่เมนู <strong>Customers</strong> &gt; กดปุ่ม <strong>➕ Add Customer</strong> กรอกข้อมูลชื่อ เบอร์โทร และเลขประจำตัวผู้เสียภาษี/เลขบัตรประชาชน
              </p>
            </div>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--purple-400)' }}>ขั้นที่ 2: เพิ่มเครื่องเข้าระบบ</strong>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                ไปที่เมนู <strong>Devices</strong> &gt; กดปุ่ม <strong>➕ Register Device</strong> กรอกยี่ห้อ รุ่น และ Serial Number ของมือถือ
                พร้อมระบุ MDM Enrollment Name (ดูวิธีหาค่าได้จากหัวข้อด้านล่าง) เพื่อใช้ในการสั่งล็อคระยะไกล
              </p>
            </div>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--purple-400)' }}>ขั้นที่ 3: ออกสัญญาเช่า</strong>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                ไปที่เมนู <strong>Rentals</strong> &gt; กดปุ่ม <strong>📋 New Rental</strong> เลือกตัวลูกค้าและเครื่องที่พร้อมใช้งาน กำหนดอัตราค่าเช่า
                ระบบจะเปลี่ยนสถานะเครื่องเป็น Rented และสร้างยอดค้างชำระงวดแรกให้อัตโนมัติ
              </p>
            </div>
          </div>
        </div>

        {/* MDM ID One-Click Fetcher */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Cpu size={20} /> ค้นหา MDM Enrollment Name จาก Google Enterprise</div>
              <div className="card-subtitle">กดปุ่มเพื่อดึงรายชื่อเครื่องที่ลงทะเบียนแล้วทั้งหมดแบบ One-Click</div>
            </div>
          </div>
          <MdmDeviceFetcher />
        </div>

        {/* Lock Engine Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={20} /> ระบบตรวจชำระเงินและล็อคอัตโนมัติ</div>
            </div>
            <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li><strong style={{ color: 'var(--text-primary)' }}>ตรวจยอดทุกเช้า:</strong> บอร์ดจะรันโปรแกรมตรวจสอบบิลอัตโนมัติทุกๆ เช้าเวลา <strong>08:00 น.</strong></li>
              <li><strong style={{ color: 'var(--text-primary)' }}>ช่วงผ่อนผัน (Grace Period):</strong> บิลค้างชำระเกินวันที่กำหนด แต่ยังไม่เกินกำหนดผ่อนผัน (เช่น &lt; 3 วัน) ระบบจะส่งอีเมลเตือนชำระเงินโดยเครื่องยังใช้งานได้ปกติ</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>ล็อคเครื่องเมื่อเลยกำหนด:</strong> เมื่อบิลค้างชำระเข้าสู่วันที่ 3 เกินช่วงผ่อนผัน ระบบจะส่งสัญญาณล็อกหน้าจอเครื่องทันที</li>
            </ul>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CreditCard size={20} /> การชำระเงินและปลดล็อคอัตโนมัติ</div>
            </div>
            <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li>เมื่อได้รับการโอนเงินจากลูกค้า ให้เข้าหน้ารายการ <strong>Payments</strong> ค้นหาชื่อและคลิกปุ่ม <strong>Record Receipt</strong></li>
              <li>กรอกเลขธุรกรรมสลิปธนาคารและยืนยันยอดเงิน</li>
              <li><strong style={{ color: 'var(--green-400)' }}>ปลดล็อคทันที:</strong> เมื่อกดยืนยันชำระเงิน ระบบจะส่งสัญญาณคำสั่งปลดล็อกไปยังเครื่องลูกค้าโดยอัตโนมัติภายใน 2-3 วินาที พร้อมสร้างรอบบิลถัดไปในระบบ</li>
            </ul>
          </div>
        </div>

        {/* Manual Overrides */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={20} /> ปุ่มสั่งการด่วนด้วยมือ (Manual Overrides)</div>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            หากเกิดกรณีเร่งด่วน หรือต้องการล็อค/ปลดล็อคมือถือนอกเวลาตั้งค่าอัตโนมัติ ผู้ดูแลสามารถกดสั่งการด่วนได้ทันทีที่เมนู <strong>Devices</strong>:
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, padding: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-md)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--red-400)' }}>ปุ่ม <Lock size={14} style={{ verticalAlign: 'middle' }} /> Lock</strong><br />
              ส่งสัญญาณสั่งการปิดหน้าจอแบบ Kiosk ทันที เครื่องเป้าหมายจะแสดงหน้าจอแจ้งเตือนสีแดง และบล็อกการควบคุมทุกอย่างจนกว่าจะได้รับอนุญาต
            </div>
            <div style={{ flex: 1, padding: '12px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 'var(--radius-md)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--green-400)' }}>ปุ่ม <Unlock size={14} style={{ verticalAlign: 'middle' }} /> Unlock</strong><br />
              ส่งสัญญาณสั่งการเปิดระบบ Android Policy ปกติคืนสู่เครื่องปลายทาง และปลดปล่อยหน้าจอให้กลับมาใช้งานแอพทั่วไปได้ทันที
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
