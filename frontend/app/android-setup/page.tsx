'use client';
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { Search, CheckCircle2, AlertTriangle, XCircle, Lock, Link, QrCode, PartyPopper, Check, Wand2 } from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────────── */
interface StatusStep {
  key: string;
  label: string;
  description: string;
  done: boolean;
  detail: string;
}
interface StatusData {
  steps: StatusStep[];
  ready: boolean;
}

type WizardStep = 'idle' | 'generating' | 'waiting' | 'completing' | 'done';

/* ── Status Badge Component ──────────────────────────────────────── */
function StepStatus({ step, index }: { step: StatusStep; index: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16,
      padding: '14px 16px',
      background: step.done ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
      border: `1px solid ${step.done ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}`,
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700,
        background: step.done ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
        color: step.done ? 'var(--green-400)' : '#f87171',
        border: `2px solid ${step.done ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
      }}>
        {step.done ? <Check size={14} /> : index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 13.5,
          color: step.done ? 'var(--green-400)' : '#f87171',
          marginBottom: 2,
        }}>
          {step.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          {step.description}
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px',
          background: step.done ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
          borderRadius: 99, fontSize: 11,
          color: step.done ? 'var(--green-400)' : '#fca5a5',
        }}>
          {step.done ? '● ตั้งค่าแล้ว:' : '○ ยังไม่ได้ตั้งค่า:'} {step.detail}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function AndroidSetupPage() {
  /* Status detection */
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  /* Wizard state */
  const [wizardStep, setWizardStep] = useState<WizardStep>('idle');
  const [signupUrl, setSignupUrl] = useState('');
  const [signupUrlName, setSignupUrlName] = useState('');
  const [enterpriseTokenInput, setEnterpriseTokenInput] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [error, setError] = useState('');

  /* ── Load status on mount ─────────────────────────────────────── */
  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await api.get('/mdm/android/status');
      setStatusData(res.data);
    } catch {
      setStatusData(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const [applyingPolicy, setApplyingPolicy] = useState(false);
  const applyPolicy = async () => {
    setApplyingPolicy(true);
    try {
      await api.post('/mdm/android/apply-policy');
      toast('✅ สร้าง rental-base policy สำเร็จ! เครื่องทุกเครื่องที่ QR ใหม่จะป้องกัน Reset อัตโนมัติ', 'success');
    } catch (err: any) {
      toast(err.response?.data?.message || 'ไม่สามารถสร้าง Policy ได้', 'error');
    } finally {
      setApplyingPolicy(false);
    }
  };

  useEffect(() => { loadStatus(); }, [loadStatus]);

  /* ── Wizard: Step 1 ────────────────────────────────────────────── */
  const handleGenerate = async () => {
    setWizardStep('generating');
    setError('');
    try {
      const res = await api.post('/mdm/android/signup-url');
      setSignupUrl(res.data.url);
      setSignupUrlName(res.data.name);
      setWizardStep('waiting');
    } catch (err: any) {
      setError(err.response?.data?.message || 'ไม่สามารถสร้างลิงก์ได้');
      setWizardStep('idle');
    }
  };

  /* ── Wizard: Step 2 ────────────────────────────────────────────── */
  const extractToken = (input: string): string => {
    try {
      const url = new URL(input);
      return url.searchParams.get('enterpriseToken') || input.trim();
    } catch { return input.trim(); }
  };

  const handleRegister = async () => {
    const token = extractToken(enterpriseTokenInput);
    if (!token) { setError('กรุณาวาง URL หรือ Token ที่ได้จากกูเกิ้ลก่อนครับ'); return; }
    setWizardStep('completing');
    setError('');
    try {
      const res = await api.post('/mdm/android/register-enterprise', {
        enterpriseToken: token,
        signupUrlName,
      });
      setEnterpriseId(res.data.enterpriseId);
      setWizardStep('done');
      toast('ลงทะเบียน Android Enterprise สำเร็จ!', 'success');
      await loadStatus(); // Refresh status badges
    } catch (err: any) {
      setError(err.response?.data?.message || 'Token อาจหมดอายุ กรุณาเริ่มใหม่');
      setWizardStep('waiting');
    }
  };

  const resetWizard = () => {
    setWizardStep('idle');
    setSignupUrl('');
    setSignupUrlName('');
    setEnterpriseTokenInput('');
    setEnterpriseId('');
    setError('');
  };

  /* ── Wizard progress helper ───────────────────────────────────── */
  const wizardOrder: WizardStep[] = ['idle', 'generating', 'waiting', 'completing', 'done'];
  const isDone = (s: WizardStep) => wizardOrder.indexOf(wizardStep) > wizardOrder.indexOf(s);

  const dot = (active: boolean, done: boolean) => ({
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0,
    background: done ? 'var(--green-400)' : active ? 'linear-gradient(135deg,#8b5cf6,#3b82f6)' : 'rgba(255,255,255,0.06)',
    color: done || active ? '#fff' : 'var(--text-muted)',
    border: active ? '2px solid var(--purple-400)' : '2px solid transparent',
  } as React.CSSProperties);

  const line = (done: boolean) => ({
    flex: 1, height: 2,
    background: done ? 'var(--green-400)' : 'rgba(255,255,255,0.08)',
    margin: '0 8px', borderRadius: 2,
  } as React.CSSProperties);

  /* ── Spinner ──────────────────────────────────────────────────── */
  const Spin = () => (
    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
  );

  return (
    <AppLayout title="ตั้งค่า Android Enterprise MDM" subtitle="ตรวจสอบสถานะการตั้งค่าและเชื่อมโยงบัญชี Google Android Management API">
      <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Configuration Status Panel ─────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><Search size={16} /> สถานะการตั้งค่าระบบ MDM</div>
              <div className="card-subtitle">ตรวจสอบ 3 ขั้นตอนที่จำเป็นก่อนเริ่มใช้งาน</div>
            </div>
            <button
              onClick={loadStatus}
              disabled={statusLoading}
              style={{
                padding: '7px 14px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {statusLoading ? <Spin /> : '↻'} ตรวจสอบใหม่
            </button>
          </div>

          {statusLoading && !statusData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              <Spin /> กำลังตรวจสอบการตั้งค่า...
            </div>
          ) : statusData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {statusData.steps.map((step, i) => (
                <StepStatus key={step.key} step={step} index={i} />
              ))}

              {/* Overall summary */}
              <div style={{
                marginTop: 4,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: statusData.ready ? 'rgba(34,197,94,0.06)' : 'rgba(251,191,36,0.06)',
                border: `1px solid ${statusData.ready ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.2)'}`,
                display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
              }}>
                <span style={{ fontSize: 20 }}>{statusData.ready ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}</span>
                <div>
                  <div style={{ fontWeight: 700, color: statusData.ready ? 'var(--green-400)' : '#fbbf24' }}>
                    {statusData.ready
                      ? 'ระบบพร้อมใช้งานเต็มรูปแบบ — สามารถสร้าง QR Code ลงทะเบียนเครื่องได้ทันที'
                      : 'ยังตั้งค่าไม่ครบ — ทำตามขั้นตอน Wizard ด้านล่างเพื่อเปิดใช้งาน'}
                  </div>
                  {statusData.ready && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <a href="/enroll" style={{ color: 'var(--purple-400)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                        → ไปสร้าง QR Code ลงทะเบียนเครื่อง
                      </a>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>·</span>
                      <button
                        onClick={applyPolicy}
                        disabled={applyingPolicy}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          color: applyingPolicy ? 'var(--text-muted)' : 'var(--purple-400)',
                          fontSize: 12, fontWeight: 600, cursor: applyingPolicy ? 'wait' : 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {applyingPolicy ? <><Spin /> กำลังสร้าง...</> : <><Lock size={16} /> Apply Anti-Reset Policy ให้ Enterprise นี้</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 0', color: '#f87171', fontSize: 13 }}>
              <XCircle size={14} /> ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบว่า Backend กำลังรันอยู่
            </div>
          )}
        </div>

        {/* ── Wizard: only show when Enterprise ID not set ────────── */}
        {(!statusData?.steps.find(s => s.key === 'enterprise_id')?.done || wizardStep !== 'idle') && (
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Wand2 size={16} style={{ marginRight: 6 }} /> วิซาร์ดตั้งค่า Enterprise ID (Android EMM Setup)</div>
            </div>

            {/* Progress dots */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={dot(wizardStep === 'idle' || wizardStep === 'generating', isDone('idle'))}>
                  {isDone('idle') ? <Check size={12} /> : '1'}
                </div>
                <div style={line(isDone('idle'))} />
                <div style={dot(wizardStep === 'waiting', isDone('waiting'))}>
                  {isDone('waiting') ? <Check size={12} /> : '2'}
                </div>
                <div style={line(isDone('waiting'))} />
                <div style={dot(wizardStep === 'done', wizardStep === 'done')}>
                  {wizardStep === 'done' ? <Check size={12} /> : '3'}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ color: wizardStep === 'idle' || isDone('idle') ? 'var(--purple-300)' : undefined }}>สร้างลิงก์</span>
                <span style={{ color: wizardStep === 'waiting' || isDone('waiting') ? 'var(--purple-300)' : undefined }}>ผูกบัญชี</span>
                <span style={{ color: wizardStep === 'done' ? 'var(--green-400)' : undefined }}>สำเร็จ</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: 13 }}>
                <XCircle size={14} /> {error}
              </div>
            )}

            {/* Step 1 */}
            {(wizardStep === 'idle' || wizardStep === 'generating') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  กดปุ่มด้านล่างเพื่อให้ระบบสร้างลิงก์พิเศษจาก Google Management API
                  เพื่อนำไปผูกบัญชี Google Workspace ขององค์กรของคุณเข้ากับระบบ RentControl
                </p>
                <div style={{ padding: '12px 14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#fbbf24' }}>
                  <AlertTriangle size={14} /> ต้องตั้งค่า <code>ANDROID_SERVICE_ACCOUNT_KEY_JSON</code> ใน <code>backend/.env</code> ก่อน
                </div>
                <button
                  id="android-wizard-generate"
                  onClick={handleGenerate}
                  disabled={wizardStep === 'generating'}
                  style={{
                    alignSelf: 'flex-start', padding: '12px 28px',
                    background: wizardStep === 'generating' ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#8b5cf6,#3b82f6)',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    color: '#fff', fontWeight: 700, fontSize: 14,
                    cursor: wizardStep === 'generating' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  {wizardStep === 'generating' ? <><Spin /> กำลังสร้างลิงก์...</> : <><Link size={16} /> สร้างลิงก์เชื่อมโยงบัญชี</>}
                </button>
              </div>
            )}

            {/* Step 2 */}
            {(wizardStep === 'waiting' || wizardStep === 'completing') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* The link */}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>ลิงก์เชื่อมโยงบัญชีจาก Google:</div>
                  <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
                    <span style={{ flex: 1, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--purple-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {signupUrl}
                    </span>
                    <a href={signupUrl} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      <Link size={16} /> เปิดลิงก์
                    </a>
                  </div>
                </div>

                {/* Mini steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['เปิดลิงก์ด้านบนในบราวเซอร์', 'ล็อกอินด้วยบัญชี Google Workspace ขององค์กร (@eaqdragon.com)', 'กรอกชื่อองค์กรและกดยอมรับการเชื่อมโยง EMM', 'คัดลอก URL ที่เบราว์เซอร์เด้งไป (มีคำว่า enterpriseToken=...) มาวางด้านล่าง'].map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--purple-400)', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      {t}
                    </div>
                  ))}
                </div>

                {/* Token input */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    วาง URL ปลายทาง หรือ enterpriseToken ที่นี่:
                  </label>
                  <textarea
                    id="enterprise-token-input"
                    value={enterpriseTokenInput}
                    onChange={e => setEnterpriseTokenInput(e.target.value)}
                    placeholder="https://www.google.com/?enterpriseToken=EABBn3p..."
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontFamily: 'JetBrains Mono', fontSize: 11.5, resize: 'vertical', outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    id="android-wizard-register"
                    onClick={handleRegister}
                    disabled={wizardStep === 'completing' || !enterpriseTokenInput.trim()}
                    style={{
                      padding: '12px 28px',
                      background: (wizardStep === 'completing' || !enterpriseTokenInput.trim()) ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#8b5cf6,#3b82f6)',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      color: '#fff', fontWeight: 700, fontSize: 14,
                      cursor: (wizardStep === 'completing' || !enterpriseTokenInput.trim()) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    {wizardStep === 'completing' ? <><Spin /> กำลังยืนยัน...</> : <><CheckCircle2 size={14} /> ยืนยันการลงทะเบียน</>}
                  </button>
                  <button onClick={resetWizard} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    ← เริ่มใหม่
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Done */}
            {wizardStep === 'done' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 10 }}><PartyPopper size={48} /></div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green-400)', marginBottom: 6 }}>ลงทะเบียน Android Enterprise สำเร็จ!</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 15, color: 'var(--purple-300)', marginBottom: 20 }}>Enterprise ID: {enterpriseId}</div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="/enroll" style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', borderRadius: 'var(--radius-md)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                    <QrCode size={16} /> สร้าง QR Code ลงทะเบียนเครื่อง
                  </a>
                  <button onClick={resetWizard} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    ตั้งค่าใหม่
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
