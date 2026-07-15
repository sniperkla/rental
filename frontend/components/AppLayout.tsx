'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import { ToastContainer, useToast } from '@/lib/toast';

export default function AppLayout({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toasts } = useToast();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) {
    return <div className="loading-spinner" style={{ minHeight: '100vh' }}><div className="spinner" /></div>;
  }

  if (!user) return null;

  return (
    <div className="app-layout">
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />
      <Sidebar />
      <div className="main-content">
        {(title || actions) && (
          <header className="topbar">
            <div>
              {title && <div className="topbar-title">{title}</div>}
              {subtitle && <div className="topbar-breadcrumb">{subtitle}</div>}
            </div>
            {actions && <div className="topbar-right">{actions}</div>}
          </header>
        )}
        <div className="page-body">
          {children}
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
