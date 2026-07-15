'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { ClipboardList, X, Cpu, Apple } from 'lucide-react';

interface Rental {
  _id: string;
  customer: { _id: string; name: string; phone: string; };
  device: { _id: string; name: string; model: string; platform: string; serialNumber: string; status: string; };
  startDate: string;
  endDate?: string;
  billingCycle: 'daily' | 'monthly';
  rateAmount: number;
  status: 'active' | 'completed' | 'cancelled';
  notes?: string;
}

interface Customer { _id: string; name: string; idNumber: string; status: string; }
interface Device { _id: string; name: string; model: string; serialNumber: string; status: string; dailyRate: number; monthlyRate: number; platform: string; }

function RentalModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [form, setForm] = useState({
    customerId: '',
    deviceId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    billingCycle: 'monthly',
    rateAmount: 0,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get('/devices', { params: { status: 'available' } })
    ]).then(([cRes, dRes]) => {
      setCustomers(cRes.data.filter((c: any) => c.status === 'active'));
      setDevices(dRes.data);
      setLoadingOpts(false);
    }).catch(() => {
      toast('Failed to load customers or available devices', 'error');
      onClose();
    });
  }, []);

  const handleDeviceChange = (devId: string) => {
    const dev = devices.find(d => d._id === devId);
    setForm(f => ({
      ...f,
      deviceId: devId,
      rateAmount: dev ? (f.billingCycle === 'monthly' ? dev.monthlyRate : dev.dailyRate) : 0
    }));
  };

  const handleBillingChange = (cycle: string) => {
    const dev = devices.find(d => d._id === form.deviceId);
    setForm(f => ({
      ...f,
      billingCycle: cycle,
      rateAmount: dev ? (cycle === 'monthly' ? dev.monthlyRate : dev.dailyRate) : f.rateAmount
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) return toast('Please select a customer', 'error');
    if (!form.deviceId) return toast('Please select a device', 'error');
    setSaving(true);
    try {
      await api.post('/rentals', form);
      toast('Rental created successfully!');
      onSave();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Error creating rental', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><ClipboardList size={16} /> Create New Rental Contract</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        {loadingOpts ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : (
          <form onSubmit={submit} className="modal-form">
            <div className="form-group">
              <label className="form-label">Customer *</label>
              <select id="rent-cust" className="form-select" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} required>
                <option value="">-- Select Active Customer --</option>
                {customers.map(c => <option key={c._id} value={c._id}>{c.name} ({c.idNumber})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Available Device *</label>
              <select id="rent-dev" className="form-select" value={form.deviceId} onChange={e => handleDeviceChange(e.target.value)} required>
                <option value="">-- Select Available Device --</option>
                {devices.map(d => <option key={d._id} value={d._id}>{d.name} ({d.model} - S/N: {d.serialNumber})</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input id="rent-start" className="form-input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">End Date (Optional)</label>
                <input id="rent-end" className="form-input" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Billing Cycle *</label>
                <select id="rent-cycle" className="form-select" value={form.billingCycle} onChange={e => handleBillingChange(e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rate Amount (฿) *</label>
                <input id="rent-rate" className="form-input" type="number" value={form.rateAmount} onChange={e => setForm(f => ({ ...f, rateAmount: parseInt(e.target.value) || 0 }))} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea id="rent-notes" className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button id="rent-save" type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Issue Contract'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rentals', { params: statusFilter ? { status: statusFilter } : {} });
      setRentals(res.data);
    } catch {
      toast('Failed to load rentals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleComplete = async (id: string) => {
    if (!confirm('Mark this rental as completed? The device will be released back to inventory.')) return;
    try {
      await api.put(`/rentals/${id}/complete`);
      toast('Rental completed and device returned to inventory.');
      load();
    } catch {
      toast('Error completing rental', 'error');
    }
  };

  return (
    <AppLayout
      title="Rentals"
      subtitle="Active and archived rental contracts"
      actions={<button id="new-rental" className="topbar-btn primary" onClick={() => setModalOpen(true)}><ClipboardList size={16} /> New Rental</button>}
    >
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Rental Agreements</div>
            <div className="card-subtitle">{rentals.length} contract{rentals.length !== 1 ? 's' : ''} total</div>
          </div>
          <div className="filters-row" style={{ margin: 0 }}>
            <button className={`filter-chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All Contracts</button>
            <button className={`filter-chip ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
            <button className={`filter-chip ${statusFilter === 'completed' ? 'active' : ''}`} onClick={() => setStatusFilter('completed')}>Completed</button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Device</th>
                <th>Platform</th>
                <th>Rent Period</th>
                <th>Cycle & Rate</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="loading-spinner"><div className="spinner" /></div></td></tr>
              ) : rentals.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon"><ClipboardList size={48} /></div><div className="empty-state-text">No rentals found</div></div></td></tr>
              ) : rentals.map(r => (
                <tr key={r._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.customer?.name || 'Deleted Customer'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.customer?.phone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.device?.name || 'Deleted Device'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>S/N: {r.device?.serialNumber}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{r.device?.platform === 'android' ? <Cpu size={16} /> : <Apple size={16} />}</span>
                      {r.device?.platform === 'android' ? 'Android' : 'iOS'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px' }}>From: {new Date(r.startDate).toLocaleDateString()}</div>
                    {r.endDate && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>To: {new Date(r.endDate).toLocaleDateString()}</div>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>฿{r.rateAmount.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>Per {r.billingCycle}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${r.status === 'active' ? 'blue' : r.status === 'completed' ? 'green' : 'gray'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.status === 'active' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleComplete(r._id)}>
                        Release / Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <RentalModal onClose={() => setModalOpen(false)} onSave={() => { setModalOpen(false); load(); }} />}
    </AppLayout>
  );
}
