'use client';
import Link from 'next/link';
import { useGetInvoicesQuery, useGetDeleteRequestsQuery } from '@/lib/api/invoicesApi';
import { useGetBillsQuery, useGetDeleteRequestsBillsQuery } from '@/lib/api/billsApi';
import { useGetSitesQuery } from '@/lib/api/sitesApi';
import { useGetUsersQuery } from '@/lib/api/usersApi';
import { useGetActiveTasksQuery } from '@/lib/api/tasksApi';
import { StatusStamp } from '@/components/status-stamp';
import { TableLoading } from '@/components/ui';
import { getUser } from '@/lib/auth';
import {
  FileText, MapPin, Users, Trash2, ReceiptText,
  Clock, CheckCircle, ListChecks, ArrowRight,
} from 'lucide-react';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  href?: string;
}) {
  const inner = (
    <div
      className="card p-5 flex items-start gap-4 transition-shadow"
      style={{ cursor: href ? 'pointer' : 'default' }}
      onMouseEnter={(e) => href && ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(27,58,92,0.10)')}
      onMouseLeave={(e) => href && ((e.currentTarget as HTMLElement).style.boxShadow = '')}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        <Icon size={18} style={{ color: iconColor }} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
          {value}
        </p>
        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      {href && <ArrowRight size={14} className="shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

export default function AdminDashboard() {
  const user = getUser();
  const { data: pendingResult,  isLoading: loadingPending } = useGetInvoicesQuery({ status: 'pending' });
  const { data: approvedResult }    = useGetInvoicesQuery({ status: 'approved' });
  const { data: pendingBillResult } = useGetBillsQuery({ status: 'pending' });
  const { data: sitesResult }       = useGetSitesQuery();
  const { data: usersResult }       = useGetUsersQuery();
  const { data: tasks = [] }        = useGetActiveTasksQuery();
  const { data: deleteResult }      = useGetDeleteRequestsQuery();
  const { data: billDeleteResult }  = useGetDeleteRequestsBillsQuery();

  const pendingInvoices   = pendingResult?.data     ?? [];
  const approvedInvoices  = approvedResult?.data    ?? [];
  const pendingBills      = pendingBillResult?.data  ?? [];
  const sites             = sitesResult?.data        ?? [];
  const users             = usersResult?.data        ?? [];
  const deleteRequests    = deleteResult?.data       ?? [];
  const billDeleteRequests = billDeleteResult?.data  ?? [];

  const pendingAmount  = pendingInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const approvedAmount = approvedInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const pendingBillAmount = pendingBills.reduce((s, b) => s + Number(b.totalAmount), 0);
  const activeSites    = sites.filter((s) => s.isActive).length;
  const activeVendors  = users.filter((u) => u.role === 'site_supervisor' && u.isActive).length;
  const activeAccts    = users.filter((u) => u.role === 'accountant' && u.isActive).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
          {greeting}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Here's what's happening across your sites today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Pending Invoices"
          value={pendingInvoices.length}
          sub={pendingInvoices.length > 0 ? `Rs. ${pendingAmount.toLocaleString()} awaiting review` : 'All caught up'}
          icon={Clock}
          iconColor="#B87A1A"
          iconBg="#FFF8EC"
          href="/admin/invoices"
        />
        <StatCard
          label="Pending Bills"
          value={pendingBills.length}
          sub={pendingBills.length > 0 ? `Rs. ${pendingBillAmount.toLocaleString()} awaiting review` : 'All caught up'}
          icon={ReceiptText}
          iconColor="#7A5C1E"
          iconBg="#FFF4E0"
          href="/admin/bills"
        />
        <StatCard
          label="Approved · Awaiting Payment"
          value={approvedInvoices.length}
          sub={approvedInvoices.length > 0 ? `Rs. ${approvedAmount.toLocaleString()} to be paid` : 'Nothing pending'}
          icon={CheckCircle}
          iconColor="#1E6E49"
          iconBg="#EDF7F2"
        />
        <StatCard
          label="Active Sites"
          value={activeSites}
          sub={`${sites.length - activeSites} inactive`}
          icon={MapPin}
          iconColor="#1B3A5C"
          iconBg="#EEF2F7"
          href="/admin/sites"
        />
        <StatCard
          label="Site Supervisors"
          value={activeVendors}
          sub={`${activeAccts} accountant${activeAccts !== 1 ? 's' : ''}`}
          icon={Users}
          iconColor="#5A6A7A"
          iconBg="#F2F2F2"
          href="/admin/users"
        />
      </div>

      {/* Alert banners */}
      <div className="flex flex-col gap-3">
        {deleteRequests.length > 0 && (
          <Link href="/admin/invoices/delete-requests" className="block">
            <div
              className="card px-5 py-4 flex items-center gap-3"
              style={{ borderLeft: '3px solid var(--rust)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(27,58,92,0.08)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '')}
            >
              <Trash2 size={15} style={{ color: 'var(--rust)', flexShrink: 0 }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--rust)' }}>
                  {deleteRequests.length} invoice delete request{deleteRequests.length !== 1 ? 's' : ''} pending review
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Click to resolve</p>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          </Link>
        )}

        {billDeleteRequests.length > 0 && (
          <Link href="/admin/bills/delete-requests" className="block">
            <div
              className="card px-5 py-4 flex items-center gap-3"
              style={{ borderLeft: '3px solid var(--rust)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(27,58,92,0.08)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '')}
            >
              <Trash2 size={15} style={{ color: 'var(--rust)', flexShrink: 0 }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--rust)' }}>
                  {billDeleteRequests.length} bill delete request{billDeleteRequests.length !== 1 ? 's' : ''} pending review
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Click to resolve</p>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          </Link>
        )}

        <Link href="/admin/tasks" className="block">
          <div
            className="card px-5 py-4 flex items-center gap-3"
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(27,58,92,0.08)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '')}
          >
            <ListChecks size={15} style={{ color: 'var(--navy)', flexShrink: 0 }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
                {tasks.filter((t) => t.isActive).length} active task{tasks.filter((t) => t.isActive).length !== 1 ? 's' : ''} in catalogue
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage rates and task types</p>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        </Link>
      </div>

      {/* Recent pending invoices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            Pending Invoices
          </h2>
          <Link href="/admin/invoices" className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {loadingPending ? (
          <TableLoading />
        ) : pendingInvoices.length === 0 ? (
          <div className="card px-5 py-10 flex flex-col items-center gap-2">
            <FileText size={22} style={{ color: 'var(--border)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No pending invoices — you're all caught up.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead style={{ background: 'var(--paper)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Site / Task</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.slice(0, 6).map((inv, i, arr) => (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#faf9f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--navy)' }}>{inv.site?.name ?? '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{inv.task?.name ?? inv.customTaskName ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-mono)' }}>
                      Rs. {Number(inv.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {new Date(inv.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusStamp status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
