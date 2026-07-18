'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/auth';
import { AuthGuard } from '@/components/auth-guard';
import { Logo } from '@/components/logo';
import {
  FileText, Trash2, ListChecks, MapPin, Users,
  PlusCircle, Wallet, LogOut, LayoutDashboard, ClipboardList, BarChart2,
} from 'lucide-react';

const navByRole = {
  admin: [
    { label: 'Dashboard',       href: '/admin',                          icon: LayoutDashboard },
    { label: 'Invoices',        href: '/admin/invoices',                 icon: FileText },
    { label: 'Delete Requests', href: '/admin/invoices/delete-requests', icon: Trash2 },
    { label: 'Tasks',           href: '/admin/tasks',                    icon: ListChecks },
    { label: 'Sites',           href: '/admin/sites',                    icon: MapPin },
    { label: 'Users',           href: '/admin/users',                    icon: Users },
    { label: 'Reports',         href: '/admin/reports',                  icon: BarChart2 },
  ],
  vendor: [
    { label: 'My Invoices',    href: '/vendor/my-invoices',  icon: ClipboardList },
    { label: 'Site Invoices',  href: '/vendor/invoices',     icon: FileText },
    { label: 'Submit Invoice', href: '/vendor/invoices/new', icon: PlusCircle },
  ],
  accountant: [
    { label: 'Invoices', href: '/accountant/invoices', icon: Wallet },
    { label: 'Reports',  href: '/accountant/reports',  icon: BarChart2 },
  ],
};

const roleLabel: Record<string, string> = {
  admin: 'Admin', vendor: 'Vendor', accountant: 'Accountant',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();
  const nav      = user ? navByRole[user.role] : [];

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 flex flex-col shrink-0" style={{ background: 'var(--navy)' }}>

          {/* Brand */}
          <div
            className="flex items-center gap-3 px-5 py-5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Logo size={34} />
            <div>
              <p className="text-white font-semibold text-sm" style={{ fontFamily: 'var(--font-heading)' }}>
                SiteLedger
              </p>
              <p className="text-xs" style={{ color: 'var(--amber)' }}>
                {user ? roleLabel[user.role] : ''}
              </p>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {nav.map(({ label, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
                  style={{
                    background: active ? 'rgba(232,163,61,0.15)' : 'transparent',
                    color:      active ? 'var(--amber)' : 'rgba(255,255,255,0.6)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* User footer */}
          <div
            className="px-3 pt-3 pb-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-2.5 px-3 mb-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'var(--amber)' }}
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => { clearAuth(); router.replace('/login'); }}
              className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-sm transition-all cursor-pointer"
              style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-body)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--paper)' }}>
          <div className="p-8 max-w-6xl">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
