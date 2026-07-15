'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { Bell, Zap } from 'lucide-react';

interface ReminderLog {
  _id: string;
  customer: { name: string; } | null;
  device: { name: string; model: string; } | null;
  channel: 'email' | 'sms' | 'system';
  message: string;
  status: 'sent' | 'failed';
  error?: string;
  createdAt: string;
}

export default function RemindersPage() {
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reminders');
      setLogs(res.data || []);
    } catch {
      toast('Failed to load reminders logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <AppLayout title="Reminders Log" subtitle="Track historical warning messages and billing alerts sent to customers">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Reminder Delivery Logs</div>
            <div className="card-subtitle">Recent automated alerts & locks warnings</div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Device</th>
                <th>Alert Type / Title</th>
                <th>Delivery Channel</th>
                <th>Time Sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="loading-spinner"><div className="spinner" /></div></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon"><Bell size={48} /></div><div className="empty-state-text">No reminders dispatched yet</div></div></td></tr>
              ) : logs.map(l => (
                <tr key={l._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.customer?.name || '—'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.device?.name || '—'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.device?.model}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '13.5px' }}>{l.message}</div>
                    {l.error && <div style={{ fontSize: '11px', color: 'var(--red-400)' }}>Error: {l.error}</div>}
                  </td>
                  <td style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>
                    <Zap size={16} /> {l.channel}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge badge-${l.status === 'sent' ? 'green' : 'red'}`}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
