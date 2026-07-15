'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Apple, BookOpen, AlertTriangle, Download } from 'lucide-react';

export default function IosEnrollPage() {
  const [backendUrl, setBackendUrl] = useState('');

  useEffect(() => {
    // Dynamically calculate the backend URL based on API client config
    const apiBase = api.defaults.baseURL || '';
    setBackendUrl(apiBase);
  }, []);

  const profileUrl = `${backendUrl}/mdm/apple/enroll-profile`;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #1e1b4b, #0f172a)',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}><Apple size={48} /></div>
        
        <h1 style={{
          fontSize: '24px',
          fontWeight: 800,
          marginBottom: '8px',
          background: 'linear-gradient(to right, #a78bfa, #c084fc)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          ลงทะเบียนเครื่อง iOS (OTA Test)
        </h1>
        
        <p style={{
          fontSize: '14px',
          color: '#94a3b8',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          สำหรับใช้ทดสอบระบบ MDM บนเครื่อง iPhone/iPad ส่วนบุคคล (ไม่มี ABM)
          โปรดเปิดหน้านี้ใน <strong>Safari บนเครื่องเป้าหมายเท่านั้น</strong>
        </p>

        {/* Action Button */}
        <a
          href={profileUrl}
          style={{
            display: 'block',
            width: '100%',
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '15px',
            textDecoration: 'none',
            padding: '14px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            marginBottom: '24px'
          }}
        >
          <Download size={16} style={{ marginRight: 6 }} /> ดาวน์โหลดโปรไฟล์ควบคุมเครื่อง
        </a>

        {/* Steps Info */}
        <div style={{
          textAlign: 'left',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#c084fc', marginBottom: '12px' }}>
            <BookOpen size={16} /> วิธีการติดตั้งและทดสอบ:
          </h2>
          
          <ol style={{
            fontSize: '12px',
            color: '#cbd5e1',
            lineHeight: '1.7',
            paddingLeft: '16px',
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <li>กดปุ่มดาวน์โหลดด้านบนแล้วเลือก <strong>"อนุญาต"</strong> เพื่อบันทึกโปรไฟล์</li>
            <li>ไปที่หน้าจอ <strong>Settings (การตั้งค่า)</strong> ของเครื่อง</li>
            <li>เลือกเมนู <strong>"Profile Downloaded" (ดาวน์โหลดโปรไฟล์แล้ว)</strong> ที่ด้านบน</li>
            <li>กดปุ่ม <strong>Install (ติดตั้ง)</strong> ที่มุมบนขวาและยืนยันรหัสผ่าน</li>
            <li>เมื่อติดตั้งสำเร็จ เครื่องจะเด้งเข้าสู่ <strong>Devices Dashboard</strong> ของ RentControl โดยอัตโนมัติ!</li>
          </ol>
        </div>

        {/* Disclaimer Warning */}
        <div style={{
          marginTop: '20px',
          fontSize: '11px',
          color: '#f87171',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          borderRadius: '8px',
          padding: '10px 14px',
          textAlign: 'left',
          lineHeight: '1.4'
        }}>
          <AlertTriangle size={14} /> <strong>ข้อควรระวัง:</strong> อุปกรณ์ที่ลงทะเบียนด้วยวิธีนี้จะไม่ใช่เครื่อง Supervised
          ลูกค้าสามารถกดเข้าไปลบโปรไฟล์ทิ้งได้ในเมนู Settings ตลอดเวลา
        </div>

      </div>
    </div>
  );
}
