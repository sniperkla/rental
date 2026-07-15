'use client';
import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Users, Smartphone, ClipboardList, AlertTriangle, Clock, DollarSign, Bell } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
  },
};

function StatCard({ icon: Icon, label, value, color, change }: any) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `rgba(${color},0.15)` }}><Icon size={20} /></div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {change && <div className={`stat-change ${change.startsWith('+') ? 'up' : 'down'}`}>{change}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleRunCheck = async () => {
    try {
      await api.post('/dashboard/run-check');
      alert('✅ Payment check triggered! Check reminders & device statuses.');
    } catch { alert('❌ Failed to run check.'); }
  };

  const monthLabels = stats?.monthlyRevenue?.map((m: any) =>
    new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
  ) || [];
  const monthData = stats?.monthlyRevenue?.map((m: any) => m.total) || [];

  const deviceStatusMap: Record<string, number> = {};
  stats?.devicesByStatus?.forEach((d: any) => { deviceStatusMap[d._id] = d.count; });

  const paymentStatusMap: Record<string, { count: number; total: number }> = {};
  stats?.paymentStats?.forEach((p: any) => { paymentStatusMap[p._id] = { count: p.count, total: p.total }; });

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Overview of your rental fleet"
      actions={
        <button id="run-payment-check" className="topbar-btn primary" onClick={handleRunCheck}>
          ▶ Run Payment Check
        </button>
      }
    >
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <>
          {/* ── Stat Cards ── */}
          <div className="stat-grid">
            <StatCard icon={Users} label="Total Customers" value={stats?.summary?.totalCustomers ?? 0} color="139,92,246" />
            <StatCard icon={Smartphone} label="Total Devices"   value={stats?.summary?.totalDevices ?? 0}   color="59,130,246" />
            <StatCard icon={ClipboardList} label="Active Rentals"  value={stats?.summary?.activeRentals ?? 0}  color="6,182,212" />
            <StatCard icon={AlertTriangle} label="Overdue Payments" value={stats?.summary?.overduePayments ?? 0} color="239,68,68" />
            <StatCard icon={Clock} label="Pending Payments" value={stats?.summary?.pendingPayments ?? 0} color="234,179,8" />
            <StatCard icon={DollarSign} label="Revenue Collected"
              value={`฿${(stats?.summary?.paidThisMonth ?? 0).toLocaleString()}`}
              color="34,197,94"
            />
          </div>

          {/* ── Charts Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '28px' }}>
            {/* Monthly Revenue */}
            <div className="card" style={{ gridColumn: '1 / 3' }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Monthly Revenue</div>
                  <div className="card-subtitle">Collected payments over time</div>
                </div>
              </div>
              <div style={{ height: 220 }}>
                <Bar
                  data={{
                    labels: monthLabels,
                    datasets: [{
                      label: 'Revenue (฿)',
                      data: monthData,
                      backgroundColor: 'rgba(139,92,246,0.5)',
                      borderColor: 'rgba(139,92,246,1)',
                      borderWidth: 2,
                      borderRadius: 6,
                    }],
                  }}
                  options={chartDefaults as any}
                />
              </div>
            </div>

            {/* Device Status */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Device Status</div>
                  <div className="card-subtitle">Fleet breakdown</div>
                </div>
              </div>
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={{
                    labels: ['Available', 'Rented', 'Locked', 'Maintenance'],
                    datasets: [{
                      data: [
                        deviceStatusMap['available'] || 0,
                        deviceStatusMap['rented'] || 0,
                        deviceStatusMap['locked'] || 0,
                        deviceStatusMap['maintenance'] || 0,
                      ],
                      backgroundColor: ['rgba(34,197,94,0.7)', 'rgba(59,130,246,0.7)', 'rgba(239,68,68,0.7)', 'rgba(234,179,8,0.7)'],
                      borderColor: 'rgba(255,255,255,0.05)',
                      borderWidth: 2,
                    }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } } } as any}
                />
              </div>
            </div>
          </div>

          {/* ── Recent Activity ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Recent Payments</div>
                <a href="/payments" style={{ fontSize: '12px', color: 'var(--purple-400)' }}>View all →</a>
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Customer</th><th>Device</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {(stats?.recentPayments || []).slice(0, 6).map((p: any) => (
                      <tr key={p._id}>
                        <td>{p.customer?.name || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{p.device?.name || '—'}</td>
                        <td style={{ fontFamily: 'JetBrains Mono', fontSize: '13px' }}>฿{p.amount?.toLocaleString()}</td>
                        <td>
                          <span className={`badge badge-${p.status === 'paid' ? 'green' : p.status === 'overdue' ? 'red' : 'yellow'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!stats?.recentPayments?.length && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No payments yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Recent Reminders</div>
                <a href="/reminders" style={{ fontSize: '12px', color: 'var(--purple-400)' }}>View all →</a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(stats?.recentReminders || []).map((r: any) => (
                  <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(234,179,8,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bell size={16} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{r.customer?.name || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</div>
                    </div>
                    <span className={`badge badge-${r.status === 'sent' ? 'green' : 'red'}`}>{r.status}</span>
                  </div>
                ))}
                {!stats?.recentReminders?.length && (
                  <div className="empty-state"><div className="empty-state-text">No reminders sent yet</div></div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
