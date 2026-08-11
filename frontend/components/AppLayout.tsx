'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import { ToastContainer, useToast } from '@/lib/toast';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toasts } = useToast();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app-layout">
      {/* Subtle ambient orbs */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      <Sidebar />

      <div className="main-content">
        {/* Top bar */}
        {(title || actions) && (
          <header className="topbar">
            <div>
              {title && <div className="topbar-title">{title}</div>}
              {subtitle && <div className="topbar-breadcrumb">{subtitle}</div>}
            </div>
            {actions && <div className="topbar-right">{actions}</div>}
          </header>
        )}

        {/* Page content */}
        <div className="page-body">{children}</div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
