'use client';
import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import {
  Users, Smartphone, ClipboardList, AlertTriangle,
  Clock, DollarSign, Bell, Play,
} from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

/* ── chart theme ─────────────────────────────────────────── */
const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#8b95a9', font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 16 },
    },
    tooltip: {
      backgroundColor: '#121224',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleColor: '#f0f4ff',
      bodyColor: '#8b95a9',
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#8b95a9', font: { family: 'Inter', size: 11 } },
      border: { display: false },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#8b95a9', font: { family: 'Inter', size: 11 } },
      border: { display: false },
    },
  },
};

/* ── stat card ───────────────────────────────────────────── */
interface StatCardProps {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string | number;
  color: string; /* CSS color string */
  change?: string;
}

function StatCard({ icon: Icon, label, value, color, change }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-row">
        <div
          className="stat-icon"
          style={{ background: `${color}1a`, color }}
        >
          <Icon size={18} />
        </div>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {change && (
        <div className={`stat-change ${change.startsWith('+') ? 'up' : 'down'}`}>
          {change}
        </div>
      )}
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRunCheck = async () => {
    try {
      await api.post('/dashboard/run-check');
      alert('✅ Payment check triggered!');
    } catch {
      alert('❌ Failed to run check.');
    }
  };

  /* chart data */
  const monthLabels: string[] =
    stats?.monthlyRevenue?.map((m: any) =>
      new Date(m._id.year, m._id.month - 1).toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      }),
    ) ?? [];
  const monthData: number[] = stats?.monthlyRevenue?.map((m: any) => m.total) ?? [];

  const deviceMap: Record<string, number> = {};
  stats?.devicesByStatus?.forEach((d: any) => { deviceMap[d._id] = d.count; });

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Overview of your rental fleet"
      actions={
        <button className="topbar-btn primary" onClick={handleRunCheck}>
          <Play size={13} />
          Run Payment Check
        </button>
      }
    >
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <>
          {/* ── Stat Cards ── */}
          <div className="stat-grid">
            <StatCard
              icon={Users}
              label="Total Customers"
              value={stats?.summary?.totalCustomers ?? 0}
              color="#a78bfa"
            />
            <StatCard
              icon={Smartphone}
              label="Total Devices"
              value={stats?.summary?.totalDevices ?? 0}
              color="#60a5fa"
            />
            <StatCard
              icon={ClipboardList}
              label="Active Rentals"
              value={stats?.summary?.activeRentals ?? 0}
              color="#22d3ee"
            />
            <StatCard
              icon={AlertTriangle}
              label="Overdue"
              value={stats?.summary?.overduePayments ?? 0}
              color="#f87171"
            />
            <StatCard
              icon={Clock}
              label="Pending"
              value={stats?.summary?.pendingPayments ?? 0}
              color="#facc15"
            />
            <StatCard
              icon={DollarSign}
              label="Revenue This Month"
              value={`฿${(stats?.summary?.paidThisMonth ?? 0).toLocaleString()}`}
              color="#4ade80"
            />
          </div>

          {/* ── Charts ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            {/* Monthly Revenue */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Monthly Revenue</div>
                  <div className="card-subtitle">Collected payments over time</div>
                </div>
              </div>
              <div style={{ height: 210 }}>
                <Bar
                  data={{
                    labels: monthLabels,
                    datasets: [
                      {
                        label: 'Revenue (฿)',
                        data: monthData,
                        backgroundColor: 'rgba(139,92,246,0.45)',
                        borderColor: 'rgba(167,139,250,1)',
                        borderWidth: 1.5,
                        borderRadius: 5,
                      },
                    ],
                  }}
                  options={chartBase as any}
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
              <div
                style={{
                  height: 210,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Doughnut
                  data={{
                    labels: ['Available', 'Rented', 'Locked', 'Maintenance'],
                    datasets: [
                      {
                        data: [
                          deviceMap['available'] ?? 0,
                          deviceMap['rented'] ?? 0,
                          deviceMap['locked'] ?? 0,
                          deviceMap['maintenance'] ?? 0,
                        ],
                        backgroundColor: [
                          'rgba(74,222,128,0.7)',
                          'rgba(96,165,250,0.7)',
                          'rgba(248,113,113,0.7)',
                          'rgba(250,204,21,0.7)',
                        ],
                        borderColor: 'rgba(255,255,255,0.04)',
                        borderWidth: 2,
                        hoverOffset: 4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          color: '#8b95a9',
                          font: { size: 11, family: 'Inter' },
                          boxWidth: 10,
                          padding: 14,
                        },
                      },
                      tooltip: (chartBase as any).plugins.tooltip,
                    },
                    cutout: '68%',
                  } as any}
                />
              </div>
            </div>
          </div>

          {/* ── Recent Activity ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Recent Payments */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Recent Payments</div>
                <a
                  href="/payments"
                  style={{ fontSize: '12px', color: 'var(--purple-400)', fontWeight: 500 }}
                >
                  View all →
                </a>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Device</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.recentPayments ?? []).slice(0, 6).map((p: any) => (
                      <tr key={p._id}>
                        <td style={{ fontWeight: 500 }}>{p.customer?.name ?? '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {p.device?.name ?? '—'}
                        </td>
                        <td
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '12.5px',
                          }}
                        >
                          ฿{p.amount?.toLocaleString()}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${
                              p.status === 'paid'
                                ? 'green'
                                : p.status === 'overdue'
                                ? 'red'
                                : 'yellow'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!stats?.recentPayments?.length && (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            padding: '28px',
                            fontSize: '13px',
                          }}
                        >
                          No payments yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Reminders */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Recent Reminders</div>
                <a
                  href="/reminders"
                  style={{ fontSize: '12px', color: 'var(--purple-400)', fontWeight: 500 }}
                >
                  View all →
                </a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(stats?.recentReminders ?? []).map((r: any) => (
                  <div
                    key={r._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 6px',
                      borderRadius: 'var(--radius-md)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background var(--transition)',
                    }}
                  >
                    <div
                      style={{
                        width: 32, height: 32,
                        borderRadius: '50%',
                        background: 'rgba(250,204,21,0.1)',
                        border: '1px solid rgba(250,204,21,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: 'var(--yellow-400)',
                      }}
                    >
                      <Bell size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 2 }}>
                        {r.customer?.name ?? '—'}
                      </div>
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.message}
                      </div>
                    </div>
                    <span
                      className={`badge badge-${r.status === 'sent' ? 'green' : 'red'}`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
                {!stats?.recentReminders?.length && (
                  <div className="empty-state">
                    <div className="empty-state-text">No reminders sent yet</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
