'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { Pencil, Plus, X, Search, User, Trash2 } from 'lucide-react';

interface Customer { _id: string; name: string; idNumber: string; phone: string; email: string; address: string; status: string; notes: string; createdAt: string; }

function CustomerModal({ customer, onClose, onSave }: { customer?: Customer | null; onClose: () => void; onSave: () => void }) {
  const isEdit = !!customer;
  const [form, setForm] = useState({ name: customer?.name || '', idNumber: customer?.idNumber || '', phone: customer?.phone || '', email: customer?.email || '', address: customer?.address || '', notes: customer?.notes || '', status: customer?.status || 'active' });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) await api.put(`/customers/${customer._id}`, form);
      else await api.post('/customers', form);
      toast(isEdit ? 'Customer updated!' : 'Customer created!');
      onSave();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Error saving customer', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? <><Pencil size={16} /> Edit Customer</> : <><Plus size={16} /> New Customer</>}</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group"><label className="form-label">Full Name *</label><input id="cust-name" className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">ID Number *</label><input id="cust-id" className="form-input" value={form.idNumber} onChange={e => set('idNumber', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Phone *</label><input id="cust-phone" className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Email</label><input id="cust-email" className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Address</label><input id="cust-address" className="form-input" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          {isEdit && <div className="form-group"><label className="form-label">Status</label><select id="cust-status" className="form-select" value={form.status} onChange={e => set('status', e.target.value)}><option value="active">Active</option><option value="suspended">Suspended</option><option value="blacklisted">Blacklisted</option></select></div>}
          <div className="form-group"><label className="form-label">Notes</label><textarea id="cust-notes" className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="cust-save" type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Customer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; customer?: Customer | null }>({ open: false });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await api.get('/customers', { params: search ? { search } : {} });
    setCustomers(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search]);

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return;
    await api.delete(`/customers/${id}`);
    toast('Customer deleted');
    load();
  };

  const statusBadge: Record<string, string> = { active: 'green', suspended: 'yellow', blacklisted: 'red' };

  return (
    <AppLayout title="Customers" subtitle="Manage your rental customers"
      actions={<button id="add-customer" className="topbar-btn primary" onClick={() => setModal({ open: true, customer: null })}><Plus size={16} /> Add Customer</button>}>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Customer Database</div>
            <div className="card-subtitle">{customers.length} customer{customers.length !== 1 ? 's' : ''} total</div>
          </div>
          <div className="search-bar">
            <span className="search-icon"><Search size={16} /></span>
            <input placeholder="Search name, phone, ID..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Name</th><th>ID Number</th><th>Phone</th><th>Email</th><th>Status</th><th>Since</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="loading-spinner"><div className="spinner" /></div></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon"><User size={48} /></div><div className="empty-state-text">No customers found</div></div></td></tr>
              ) : customers.map(c => (
                <tr key={c._id}>
                  <td><div style={{ fontWeight: 600 }}>{c.name}</div></td>
                  <td><span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'var(--text-secondary)' }}>{c.idNumber}</span></td>
                  <td>{c.phone}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{c.email || '—'}</td>
                  <td><span className={`badge badge-${statusBadge[c.status] || 'gray'}`}>{c.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal({ open: true, customer: c })}><Pencil size={16} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(c._id, c.name)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal.open && <CustomerModal customer={modal.customer} onClose={() => setModal({ open: false })} onSave={() => { setModal({ open: false }); load(); }} />}
    </AppLayout>
  );
}
