'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard, Users, Smartphone, ClipboardList,
  CreditCard, Bell, Settings, Cpu, Apple, QrCode, BookOpen, LogOut,
} from 'lucide-react';

type NavSection = { section: string };
type NavLink = { href: string; icon: React.ComponentType<{ size?: number }>; label: string };
type NavItem = NavSection | NavLink;

const navItems: NavItem[] = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { section: 'Fleet' },
  { href: '/customers',     icon: Users,           label: 'Customers' },
  { href: '/devices',       icon: Smartphone,      label: 'Devices' },
  { href: '/rentals',       icon: ClipboardList,   label: 'Rentals' },
  { section: 'Finance' },
  { href: '/payments',      icon: CreditCard,      label: 'Payments' },
  { href: '/reminders',     icon: Bell,            label: 'Reminders' },
  { section: 'System' },
  { href: '/settings',      icon: Settings,        label: 'Settings' },
  { href: '/android-setup', icon: Cpu,             label: 'Android EMM' },
  { href: '/ios-setup',     icon: Apple,           label: 'iOS MDM' },
  { href: '/enroll',        icon: QrCode,          label: 'QR Enroll' },
  { href: '/guide',         icon: BookOpen,        label: 'Guide' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Smartphone size={18} color="#fff" />
        </div>
        <div>
          <div className="sidebar-logo-text">RentControl</div>
          <div className="sidebar-logo-sub">Device Management</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} className="nav-section-label">
                {item.section}
              </div>
            );
          }
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? ' active' : ''}`}
            >
              <span className="nav-item-icon">
                <Icon size={16} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name">{user?.name ?? 'Admin'}</div>
            <div className="sidebar-user-role">{user?.role ?? 'admin'}</div>
          </div>
          <button
            onClick={logout}
            className="btn-icon"
            title="Log out"
            style={{ width: 28, height: 28, flexShrink: 0 }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
