'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Smartphone, Lightbulb, Hand } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon"><Smartphone size={24} /></div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              RentControl
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Device Rental Management</div>
          </div>
        </div>

        <div className="login-title">Welcome back <Hand size={20} style={{ verticalAlign: 'middle' }} /></div>
        <div className="login-subtitle">Sign in to your admin dashboard</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email address</label>
            <input
              id="email"
              className="form-input"
              type="email"
              placeholder="admin@rentcontrol.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button id="login-submit" type="submit" className="login-btn" disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Signing in...</> : 'Sign in →'}
          </button>
        </form>

        <div style={{ marginTop: '24px', padding: '14px', background: 'rgba(139,92,246,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(139,92,246,0.2)', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lightbulb size={16} /> First time? Register an admin account via</span> <code style={{ color: 'var(--purple-400)', fontFamily: 'JetBrains Mono' }}>POST /api/auth/register</code>
        </div>
      </div>
    </div>
  );
}
