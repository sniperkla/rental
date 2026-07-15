'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard, Users, Smartphone, ClipboardList,
  CreditCard, Bell, Settings, Cpu, Apple, QrCode, BookOpen, LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { section: 'Fleet' },
  { href: '/customers',  icon: Users, label: 'Customers' },
  { href: '/devices',    icon: Smartphone, label: 'Devices' },
  { href: '/rentals',    icon: ClipboardList, label: 'Rentals' },
  { section: 'Finance' },
  { href: '/payments',   icon: CreditCard, label: 'Payments' },
  { href: '/reminders',  icon: Bell, label: 'Reminders' },
  { section: 'System' },
  { href: '/settings',       icon: Settings, label: 'Settings' },
  { href: '/android-setup',  icon: Cpu, label: 'Android EMM Setup' },
  { href: '/ios-setup',      icon: Apple, label: 'iOS MDM Setup' },
  { href: '/enroll',         icon: QrCode, label: 'สร้าง QR ลงทะเบียน' },
  { href: '/guide',          icon: BookOpen, label: 'คู่มือการใช้งาน' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Smartphone size={24} /></div>
        <div>
          <div className="sidebar-logo-text">RentControl</div>
          <div className="sidebar-logo-sub">Device Management</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if ('section' in item) {
            return <div key={i} className="nav-section-label">{item.section}</div>;
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href!} className={`nav-item ${active ? 'active' : ''}`}>
              <span className="nav-item-icon"><Icon size={18} /></span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.name?.[0]?.toUpperCase() || 'A'}</div>
          <div>
            <div className="sidebar-user-name">{user?.name || 'Admin'}</div>
            <div className="sidebar-user-role">{user?.role || 'admin'}</div>
          </div>
          <button
            onClick={logout}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Logout"
          ><LogOut size={18} /></button>
        </div>
      </div>
    </aside>
  );
}
