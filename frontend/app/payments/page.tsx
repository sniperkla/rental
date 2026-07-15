'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { CreditCard, X } from 'lucide-react';

interface Payment {
  _id: string;
  rental: { billingCycle: string; rateAmount: number; } | null;
  customer: { name: string; phone: string; } | null;
  device: { name: string; model: string; platform: string; } | null;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'pending' | 'paid' | 'overdue';
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
}

function RecordPaymentModal({ payment, onClose, onSave }: { payment: Payment; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    amount: payment.amount,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/payments/record', {
        paymentId: payment._id,
        amount: form.amount,
        notes: form.notes,
      });
      toast('Payment successfully recorded!');
      onSave();
    } catch {
      toast('Error recording payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><CreditCard size={16} /> Record Payment Received</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
              <strong>{payment.customer?.name || 'Unknown'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Device:</span>
              <strong>{payment.device?.name || 'Unknown'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Due Date:</span>
              <strong>{new Date(payment.dueDate).toLocaleDateString()}</strong>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Amount (฿) *</label>
            <input id="pay-amount" className="form-input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))} required />
          </div>

          <div className="form-group">
            <label className="form-label">Reference Notes (e.g. Bank Transfer ID)</label>
            <input id="pay-notes" className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="pay-save" type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Confirm Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalPayment, setModalPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments', { params: statusFilter ? { status: statusFilter } : {} });
      setPayments(res.data);
    } catch {
      toast('Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const statusBadge: Record<string, string> = {
    pending: 'yellow',
    paid: 'green',
    overdue: 'red',
  };

  return (
    <AppLayout title="Payments" subtitle="Track payment histories and schedules">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Billing Ledgers</div>
            <div className="card-subtitle">{payments.length} ledger entry/entries</div>
          </div>
          <div className="filters-row" style={{ margin: 0 }}>
            <button className={`filter-chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
            <button className={`filter-chip ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>Pending</button>
            <button className={`filter-chip ${statusFilter === 'overdue' ? 'active' : ''}`} onClick={() => setStatusFilter('overdue')}>Overdue</button>
            <button className={`filter-chip ${statusFilter === 'paid' ? 'active' : ''}`} onClick={() => setStatusFilter('paid')}>Paid</button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Device</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="loading-spinner"><div className="spinner" /></div></td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon"><CreditCard size={48} /></div><div className="empty-state-text">No payment records found</div></div></td></tr>
              ) : payments.map(p => (
                <tr key={p._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.customer?.name || '—'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.customer?.phone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.device?.name || '—'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.device?.model} • {p.device?.platform}</div>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                    ฿{p.amount.toLocaleString()}
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {new Date(p.dueDate).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {p.paidDate ? new Date(p.paidDate).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span className={`badge badge-${statusBadge[p.status] || 'gray'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    {p.status !== 'paid' ? (
                      <button className="btn btn-primary btn-sm" onClick={() => setModalPayment(p)}>
                        Record Receipt
                      </button>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reference: {p.notes || '—'}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalPayment && (
        <RecordPaymentModal
          payment={modalPayment}
          onClose={() => setModalPayment(null)}
          onSave={() => { setModalPayment(null); load(); }}
        />
      )}
    </AppLayout>
  );
}
