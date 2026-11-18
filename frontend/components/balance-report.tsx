'use client';
import { useState } from 'react';
import {
  useGetInvoiceBalanceQuery, useGetInvoicesQuery,
  useApproveInvoiceMutation, useRejectInvoiceMutation,
  Invoice, BalanceSubSummary,
} from '@/lib/api/invoicesApi';
import {
  useGetBillsQuery, useApproveBillMutation, useRejectBillMutation, Bill,
} from '@/lib/api/billsApi';
import { useGetActiveSitesQuery, useUpdateSiteMutation } from '@/lib/api/sitesApi';
import { useGetActiveVendorsQuery, useUpdateVendorMutation } from '@/lib/api/vendorsApi';
import { StatusStamp } from '@/components/status-stamp';
import { InvoiceDetailModal } from '@/components/invoice-detail-modal';
import { BillDetailModal } from '@/components/bill-detail-modal';
import {
  SearchableSelect, Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  Pagination, PageHeader, Button, Modal, Textarea, Select, Input,
} from '@/components/ui';
import { Eye, TrendingDown, CheckCircle, Clock, XCircle, Check, X, Download, FileText, ReceiptText, Pencil, ChevronDown, Calendar } from 'lucide-react';
import { getToken } from '@/lib/auth';

type Props = { type: 'site' | 'vendor' };

const REJECTION_REASONS = [
  'Duplicate submission',
  'Incorrect quantity',
  'Incorrect amount',
  'Missing receipt',
  'Task not authorized',
  'Other',
];

function fmt(n: number) {
  return `Rs. ${n.toLocaleString()}`;
}

function fmtShortDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SummaryCard({
  label, amount, count, color, bg, icon: Icon, unit = 'invoice',
}: {
  label: string; amount: number; count: number; color: string; bg: string; icon: React.ElementType; unit?: string;
}) {
  return (
    <div className="card p-5" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
          <Icon size={16} style={{ color }} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className="text-xl font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
            {fmt(amount)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {count} {unit}{count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusCards({ s, unit }: { s: BalanceSubSummary; unit?: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <SummaryCard label="Approved" amount={s.approvedAmount} count={s.approvedCount} color="#1E6E49" bg="#EDF7F2" icon={CheckCircle} unit={unit} />
      <SummaryCard label="Pending"  amount={s.pendingAmount}  count={s.pendingCount}  color="#B87A1A" bg="#FFF8EC" icon={Clock}        unit={unit} />
      <SummaryCard label="Rejected" amount={s.rejectedAmount} count={s.rejectedCount} color="#C0392B" bg="#FDF0EF" icon={XCircle}      unit={unit} />
      <SummaryCard label="Voided"   amount={s.voidedAmount}   count={s.voidedCount}   color="#888"    bg="#f2f2f2" icon={TrendingDown}  unit={unit} />
    </div>
  );
}


export function BalanceReport({ type }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const dateRangeInvalid = !!dateFrom && !!dateTo && dateFrom > dateTo;
  const hasDateRange = !!dateFrom || !!dateTo;
  const [activeTab, setActiveTab] = useState<'invoices' | 'bills'>('invoices');
  const [invPage, setInvPage] = useState(1);
  const [billPage, setBillPage] = useState(1);

  // Invoice actions
  const [viewInvoice,  setViewInvoice]  = useState<Invoice | null>(null);
  const [rejectInvoice, setRejectInvoice] = useState<Invoice | null>(null);
  const [invApprovingId, setInvApprovingId] = useState<string | null>(null);
  const [invRejectingId, setInvRejectingId] = useState<string | null>(null);
  const [invRejReason,      setInvRejReason]      = useState('');
  const [invRejReasonOther, setInvRejReasonOther] = useState('');

  // Bill actions
  const [viewBill,    setViewBill]    = useState<Bill | null>(null);
  const [rejectBill,  setRejectBill]  = useState<Bill | null>(null);
  const [billApprovingId, setBillApprovingId] = useState<string | null>(null);
  const [billRejectingId, setBillRejectingId] = useState<string | null>(null);
  const [billRejReason,      setBillRejReason]      = useState('');
  const [billRejReasonOther, setBillRejReasonOther] = useState('');

  const [downloading,   setDownloading]   = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const [downloadingAll,   setDownloadingAll]   = useState(false);
  const [downloadAllError, setDownloadAllError] = useState('');

  const [editBalanceOpen,   setEditBalanceOpen]   = useState(false);
  const [editBalanceValue,  setEditBalanceValue]  = useState('');
  const [editBalanceSaving, setEditBalanceSaving] = useState(false);
  const [lifetimeOpen,      setLifetimeOpen]      = useState(false);

  const { data: sites   = [] } = useGetActiveSitesQuery();
  const { data: vendors = [] } = useGetActiveVendorsQuery();
  const [approveInv] = useApproveInvoiceMutation();
  const [rejectInv]  = useRejectInvoiceMutation();
  const [approveBill] = useApproveBillMutation();
  const [rejectBillMut] = useRejectBillMutation();
  const [updateSite]   = useUpdateSiteMutation();
  const [updateVendor] = useUpdateVendorMutation();

  const options =
    type === 'site'
      ? sites.map((s) => ({ value: s.id, label: `${s.name} — ${s.location}` }))
      : vendors.map((v) => ({ value: v.id, label: v.name }));

  const filterParam = type === 'site' ? { siteId: selectedId } : { vendorId: selectedId };

  const { data: balance, isLoading: balanceLoading } = useGetInvoiceBalanceQuery(filterParam, { skip: !selectedId });
  const { data: invoiceResult, isLoading: invoicesLoading } = useGetInvoicesQuery({ ...filterParam, page: invPage }, { skip: !selectedId });
  const { data: billResult,    isLoading: billsLoading }    = useGetBillsQuery({ ...filterParam, page: billPage }, { skip: !selectedId });

  const invoices = invoiceResult?.data ?? [];
  const invTotal = invoiceResult?.total ?? 0;
  const bills    = billResult?.data ?? [];
  const billTotal = billResult?.total ?? 0;

  const selectedLabel =
    type === 'site'
      ? sites.find((s) => s.id === selectedId)?.name
      : vendors.find((v) => v.id === selectedId)?.name;

  async function handleApproveInv(id: string) {
    setInvApprovingId(id);
    try { await approveInv(id); } finally { setInvApprovingId(null); }
  }

  async function handleInvRejectSubmit() {
    if (!rejectInvoice) return;
    setInvRejectingId(rejectInvoice.id);
    try {
      await rejectInv({ id: rejectInvoice.id, rejectionReason: invRejReason, ...(invRejReason === 'Other' ? { rejectionReasonOther: invRejReasonOther } : {}) });
      setRejectInvoice(null); setInvRejReason(''); setInvRejReasonOther('');
    } finally { setInvRejectingId(null); }
  }

  async function handleApproveBill(id: string) {
    setBillApprovingId(id);
    try { await approveBill(id); } finally { setBillApprovingId(null); }
  }

  async function handleBillRejectSubmit() {
    if (!rejectBill) return;
    setBillRejectingId(rejectBill.id);
    try {
      await rejectBillMut({ id: rejectBill.id, rejectionReason: billRejReason, ...(billRejReason === 'Other' ? { rejectionReasonOther: billRejReasonOther } : {}) });
      setRejectBill(null); setBillRejReason(''); setBillRejReasonOther('');
    } finally { setBillRejectingId(null); }
  }

  async function handleDownload() {
    setDownloadError('');
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (type === 'site')   params.set('siteId',   selectedId);
      if (type === 'vendor') params.set('vendorId', selectedId);
      if (type === 'vendor' && dateFrom) params.set('dateFrom', dateFrom);
      if (type === 'vendor' && dateTo)   params.set('dateTo',   dateTo);

      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(
        `${base}/reports/balance?${params}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDownloadError(body?.message ?? 'Failed to generate report.');
        return;
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const rangeSuffix = dateFrom && dateTo ? `-${dateFrom}-to-${dateTo}` : dateTo ? `-as-of-${dateTo}` : dateFrom ? `-from-${dateFrom}` : '';
      a.download = `balance-${selectedLabel ?? selectedId}${rangeSuffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Failed to generate report.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadAll() {
    setDownloadAllError('');
    setDownloadingAll(true);
    try {
      const params = new URLSearchParams();
      if (type === 'vendor' && dateFrom) params.set('dateFrom', dateFrom);
      if (type === 'vendor' && dateTo)   params.set('dateTo',   dateTo);

      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(
        `${base}/reports/balance/${type === 'site' ? 'sites' : 'vendors'}${params.toString() ? `?${params}` : ''}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDownloadAllError(body?.message ?? 'Failed to generate report.');
        return;
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const rangeSuffix = type === 'vendor' && dateFrom && dateTo ? `-${dateFrom}-to-${dateTo}`
        : type === 'vendor' && dateTo   ? `-as-of-${dateTo}`
        : type === 'vendor' && dateFrom ? `-from-${dateFrom}`
        : '';
      a.download = `all-${type === 'site' ? 'sites' : 'vendors'}-balance-report${rangeSuffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadAllError('Failed to generate report.');
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleSaveBalance() {
    const val = parseFloat(editBalanceValue);
    if (isNaN(val) || val < 0) return;
    setEditBalanceSaving(true);
    try {
      if (type === 'site') {
        await updateSite({ id: selectedId, currentBalance: val });
      } else {
        await updateVendor({ id: selectedId, currentBalance: val });
      }
      setEditBalanceOpen(false);
    } finally {
      setEditBalanceSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={type === 'site' ? 'Site Balance' : 'Vendor Balance'}
        subtitle={
          type === 'site'
            ? 'Select a site to view its complete financial balance report'
            : 'Select a vendor to view its complete financial balance report'
        }
        action={
          type === 'vendor' ? (
            <div className="flex flex-col items-end gap-2">
              <div
                className="flex items-end gap-3 p-3 rounded-xl"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={12} /> Download with date range
                  </p>
                  <div className="flex items-stretch gap-2">
                    <Input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => setDateFrom(e.target.value)}
                      style={{ width: 150 }}
                    />
                    <span className="self-center" style={{ color: 'var(--text-muted)' }}>→</span>
                    <Input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => setDateTo(e.target.value)}
                      style={{ width: 150 }}
                    />
                    {hasDateRange && (
                      <button
                        type="button"
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        title="Clear date range"
                        className="flex items-center justify-center rounded-lg shrink-0 transition-colors"
                        style={{
                          width: 38,
                          background: 'white',
                          border: '1.5px solid var(--border)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--rust)'; e.currentTarget.style.borderColor = 'var(--rust)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <Button variant="outline" loading={downloadingAll} disabled={dateRangeInvalid} onClick={handleDownloadAll}>
                  <Download size={14} />
                  {downloadingAll ? 'Generating…' : 'Download All Vendors Report'}
                </Button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {dateRangeInvalid
                  ? <span style={{ color: 'var(--rust)' }}>Start Date must be on or before End Date.</span>
                  : dateFrom && dateTo ? 'Reconstructs opening + closing balance for this window. Applies to this and the single-vendor report below.'
                  : dateTo   ? 'Shows the balance as it stood at the end of this date. Applies to this and the single-vendor report below.'
                  : dateFrom ? 'Shows activity from this date onward, through today.'
                  : 'Optional — leave blank to use the live balance across full history.'}
              </p>
              {downloadAllError && (
                <p className="text-xs" style={{ color: 'var(--rust)' }}>{downloadAllError}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1.5">
              <Button variant="outline" loading={downloadingAll} onClick={handleDownloadAll}>
                <Download size={14} />
                {downloadingAll ? 'Generating…' : 'Download All Sites Report'}
              </Button>
              {downloadAllError && (
                <p className="text-xs" style={{ color: 'var(--rust)' }}>{downloadAllError}</p>
              )}
            </div>
          )
        }
      />

      {/* Selector */}
      <div className="card p-5" style={{ maxWidth: 480 }}>
        <SearchableSelect
          label={type === 'site' ? 'Select Site' : 'Select Vendor'}
          value={selectedId}
          onChange={(val) => { setSelectedId(val); setInvPage(1); setBillPage(1); }}
          options={options}
          placeholder={type === 'site' ? 'Choose a site…' : 'Choose a vendor…'}
        />
      </div>

      {selectedId && (
        <>
          {/* Combined total banner */}
          {balanceLoading ? (
            <div className="card animate-pulse" style={{ height: 96 }} />
          ) : balance ? (
            <>
              <div
                className="card px-6 py-5 flex items-center justify-between gap-4"
                style={{ background: 'var(--navy)' }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {type === 'vendor' ? 'Outstanding Balance' : 'Total'} · {selectedLabel}
                  </p>
                  <p className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                    {fmt(balance.totalAmount)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {balance.invoices.totalCount} invoice{balance.invoices.totalCount !== 1 ? 's' : ''} · {balance.bills.totalCount} bill{balance.bills.totalCount !== 1 ? 's' : ''}
                    {type === 'site' && balance.currentBalance > 0 && ` · ${fmt(balance.currentBalance)} opening balance`}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {type === 'vendor' && hasDateRange && (
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
                    >
                      <Calendar size={11} />
                      {dateFrom && dateTo ? `${fmtShortDate(dateFrom)} → ${fmtShortDate(dateTo)}`
                        : dateTo ? `As of ${fmtShortDate(dateTo)}`
                        : `From ${fmtShortDate(dateFrom)}`}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {type === 'site' && (
                      <button
                        type="button"
                        onClick={() => { setEditBalanceValue(String(balance.currentBalance)); setEditBalanceOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          color: 'white',
                          border: '1.5px solid rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                      >
                        <Pencil size={13} />
                        Edit Balance
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={downloading || dateRangeInvalid}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: downloading ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
                        color: 'white',
                        border: '1.5px solid rgba(255,255,255,0.25)',
                        cursor: (downloading || dateRangeInvalid) ? 'not-allowed' : 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!downloading) e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
                      onMouseLeave={(e) => { if (!downloading) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                    >
                      <Download size={14} />
                      {downloading ? 'Generating…' : 'Download Report'}
                    </button>
                  </div>
                  {downloadError && (
                    <p className="text-xs" style={{ color: '#ffb3b3' }}>{downloadError}</p>
                  )}
                </div>
              </div>

              {/* ── Lifetime Activity (vendor only) ─────────────────────────
                  Informational breakdown, kept separate from Outstanding Balance above
                  on purpose -- this is a gross, all-time figure (approved invoices/bills
                  since this vendor's opening balance), it does not subtract payments or
                  advances, so it will not match Outstanding Balance once any payment has
                  been made. That's intentional, not a bug: Outstanding is "what we owe
                  right now"; this is "total business done with this vendor." */}
              {type === 'vendor' && balance.openingBalance !== undefined && (
                <div className="card p-5">
                  <button
                    type="button"
                    onClick={() => setLifetimeOpen((o) => !o)}
                    className="w-full flex items-center justify-between"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Lifetime Activity
                    </p>
                    <ChevronDown
                      size={16}
                      style={{
                        color: 'var(--text-muted)',
                        transition: 'transform 0.25s ease',
                        transform: lifetimeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: lifetimeOpen ? '1fr' : '0fr',
                      transition: 'grid-template-rows 0.25s ease',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mt-4">
                        <div>
                          <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Opening Balance</p>
                          <p className="text-lg font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
                            {fmt(balance.openingBalance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Invoices (Approved)</p>
                          <p className="text-lg font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
                            {fmt(balance.invoices.approvedAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Bills (Approved)</p>
                          <p className="text-lg font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
                            {fmt(balance.bills.approvedAmount)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Grand Total</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
                          {fmt(balance.openingBalance + balance.invoices.approvedAmount + balance.bills.approvedAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab switcher ──────────────────────────────────────────── */}
              <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--border)' }}>
                {([
                  { key: 'invoices', label: 'Invoices', icon: FileText },
                  { key: 'bills',    label: 'Bills',    icon: ReceiptText },
                ] as const).map(({ key, label, icon: Icon }) => {
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: active ? 'white' : 'transparent',
                        color:      active ? 'var(--navy)' : 'var(--text-muted)',
                        boxShadow:  active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* ── Invoices: cards + table ───────────────────────────────── */}
              {activeTab === 'invoices' && (
                <div className="space-y-4">
                  <StatusCards s={balance.invoices} unit="invoice" />
                  {invoicesLoading ? (
                    <TableLoading />
                  ) : invoices.length === 0 ? (
                    <TableEmpty message="No invoices found for this selection." />
                  ) : (
                    <>
                      <Table>
                        <THead>
                          <tr>
                            <Th>#</Th>
                            <Th>{type === 'site' ? 'Vendor' : 'Site'} / Task</Th>
                            <Th>Qty</Th>
                            <Th>Amount (PKR)</Th>
                            <Th>Status</Th>
                            <Th>Date</Th>
                            <Th right />
                          </tr>
                        </THead>
                        <TBody>
                          {invoices.map((inv) => (
                            <Tr key={inv.id}>
                              <Td mono muted>{`INV-${String(inv.invoiceNumber).padStart(5, '0')}`}</Td>
                              <Td>
                                <p className="font-medium" style={{ color: 'var(--navy)' }}>
                                  {type === 'site' ? (inv.vendor?.name ?? '—') : (inv.site?.name ?? '—')}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  {inv.task?.name ?? inv.customTaskName ?? '—'}
                                </p>
                              </Td>
                              <Td mono muted>{Number(inv.quantity).toLocaleString()} {inv.unit}</Td>
                              <Td mono bold>Rs. {Number(inv.amount).toLocaleString()}</Td>
                              <Td><StatusStamp status={inv.status} /></Td>
                              <Td muted>{new Date(inv.submittedAt).toLocaleDateString()}</Td>
                              <Td right>
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => setViewInvoice(inv)}>
                                    <Eye size={13} /> View
                                  </Button>
                                  {inv.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        loading={invApprovingId === inv.id}
                                        disabled={!!invApprovingId || !!invRejectingId}
                                        onClick={() => handleApproveInv(inv.id)}
                                      >
                                        <Check size={13} /> Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!!invApprovingId || !!invRejectingId}
                                        onClick={() => setRejectInvoice(inv)}
                                      >
                                        <X size={13} /> Reject
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </Td>
                            </Tr>
                          ))}
                        </TBody>
                      </Table>
                      <Pagination page={invPage} total={invTotal} limit={20} onChange={setInvPage} />
                    </>
                  )}
                </div>
              )}

              {/* ── Bills: cards + table ──────────────────────────────────── */}
              {activeTab === 'bills' && (
                <div className="space-y-4">
                  <StatusCards s={balance.bills} unit="bill" />
                  {billsLoading ? (
                    <TableLoading />
                  ) : bills.length === 0 ? (
                    <TableEmpty message="No bills found for this selection." />
                  ) : (
                    <>
                      <Table>
                        <THead>
                          <tr>
                            <Th>#</Th>
                            <Th>{type === 'site' ? 'Vendor' : 'Site'}</Th>
                            <Th>Items</Th>
                            <Th>Total (PKR)</Th>
                            <Th>Status</Th>
                            <Th>Date</Th>
                            <Th right />
                          </tr>
                        </THead>
                        <TBody>
                          {bills.map((bill) => (
                            <Tr key={bill.id}>
                              <Td mono muted>{`BILL-${String(bill.billNumber).padStart(5, '0')}`}</Td>
                              <Td>
                                <p className="font-medium" style={{ color: 'var(--navy)' }}>
                                  {type === 'site' ? (bill.vendor?.name ?? '—') : (bill.site?.name ?? '—')}
                                </p>
                              </Td>
                              <Td muted>{bill.lineItems.length} item{bill.lineItems.length !== 1 ? 's' : ''}</Td>
                              <Td mono bold>Rs. {Number(bill.totalAmount).toLocaleString()}</Td>
                              <Td><StatusStamp status={bill.status} /></Td>
                              <Td muted>{new Date(bill.submittedAt).toLocaleDateString()}</Td>
                              <Td right>
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => setViewBill(bill)}>
                                    <Eye size={13} /> View
                                  </Button>
                                  {bill.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        loading={billApprovingId === bill.id}
                                        disabled={!!billApprovingId || !!billRejectingId}
                                        onClick={() => handleApproveBill(bill.id)}
                                      >
                                        <Check size={13} /> Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!!billApprovingId || !!billRejectingId}
                                        onClick={() => setRejectBill(bill)}
                                      >
                                        <X size={13} /> Reject
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </Td>
                            </Tr>
                          ))}
                        </TBody>
                      </Table>
                      <Pagination page={billPage} total={billTotal} limit={20} onChange={setBillPage} />
                    </>
                  )}
                </div>
              )}
            </>
          ) : null}
        </>
      )}

      <InvoiceDetailModal
        invoice={viewInvoice}
        onClose={() => setViewInvoice(null)}
        actions={viewInvoice && viewInvoice.status === 'pending' ? (
          <>
            <Button size="sm" variant="primary" loading={invApprovingId === viewInvoice.id} disabled={!!invApprovingId || !!invRejectingId} onClick={() => handleApproveInv(viewInvoice.id)}>
              <Check size={13} /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={!!invApprovingId || !!invRejectingId} onClick={() => { setViewInvoice(null); setRejectInvoice(viewInvoice); }}>
              <X size={13} /> Reject
            </Button>
          </>
        ) : undefined}
      />
      <BillDetailModal
        bill={viewBill}
        onClose={() => setViewBill(null)}
        actions={viewBill && viewBill.status === 'pending' ? (
          <>
            <Button size="sm" variant="primary" loading={billApprovingId === viewBill.id} disabled={!!billApprovingId || !!billRejectingId} onClick={() => handleApproveBill(viewBill.id)}>
              <Check size={13} /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={!!billApprovingId || !!billRejectingId} onClick={() => { setViewBill(null); setRejectBill(viewBill); }}>
              <X size={13} /> Reject
            </Button>
          </>
        ) : undefined}
      />

      {/* Reject invoice modal */}
      <Modal
        open={!!rejectInvoice}
        onClose={() => { setRejectInvoice(null); setInvRejReason(''); setInvRejReasonOther(''); }}
        title="Reject Invoice"
        subtitle={
          rejectInvoice
            ? `${rejectInvoice.site?.name} · ${rejectInvoice.task?.name ?? rejectInvoice.customTaskName} · Rs. ${Number(rejectInvoice.amount).toLocaleString()}`
            : undefined
        }
      >
        <div className="space-y-3">
          <Select
            label="Reason"
            value={invRejReason}
            onChange={setInvRejReason}
            options={REJECTION_REASONS.map((r) => ({ value: r, label: r }))}
            placeholder="Select reason…"
          />
          {invRejReason === 'Other' && (
            <Textarea
              label="Other reason"
              value={invRejReasonOther}
              onChange={(e) => setInvRejReasonOther(e.target.value)}
              placeholder="Describe the reason…"
              rows={3}
            />
          )}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" disabled={!!invRejectingId} onClick={() => setRejectInvoice(null)}>Cancel</Button>
            <Button variant="danger" loading={!!invRejectingId} disabled={!invRejReason} onClick={handleInvRejectSubmit}>
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit current balance modal */}
      <Modal
        open={editBalanceOpen}
        onClose={() => setEditBalanceOpen(false)}
        title="Edit Current Balance"
        subtitle={`Update the opening / existing balance for ${selectedLabel ?? ''}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Current Balance (PKR)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={editBalanceValue}
              onChange={(e) => setEditBalanceValue(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 14,
                border: '1.5px solid var(--border)', borderRadius: 8,
                background: 'var(--paper)', color: 'var(--navy)',
                fontFamily: 'var(--font-mono)', outline: 'none',
              }}
              autoFocus
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              This amount is added to the Paid total and Grand Total for this {type}.
            </p>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" disabled={editBalanceSaving} onClick={() => setEditBalanceOpen(false)}>Cancel</Button>
            <Button loading={editBalanceSaving} onClick={handleSaveBalance}>Save Balance</Button>
          </div>
        </div>
      </Modal>

      {/* Reject bill modal */}
      <Modal
        open={!!rejectBill}
        onClose={() => { setRejectBill(null); setBillRejReason(''); setBillRejReasonOther(''); }}
        title="Reject Bill"
        subtitle={
          rejectBill
            ? `${rejectBill.site?.name} · Rs. ${Number(rejectBill.totalAmount).toLocaleString()}`
            : undefined
        }
      >
        <div className="space-y-3">
          <Select
            label="Reason"
            value={billRejReason}
            onChange={setBillRejReason}
            options={REJECTION_REASONS.map((r) => ({ value: r, label: r }))}
            placeholder="Select reason…"
          />
          {billRejReason === 'Other' && (
            <Textarea
              label="Other reason"
              value={billRejReasonOther}
              onChange={(e) => setBillRejReasonOther(e.target.value)}
              placeholder="Describe the reason…"
              rows={3}
            />
          )}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" disabled={!!billRejectingId} onClick={() => setRejectBill(null)}>Cancel</Button>
            <Button variant="danger" loading={!!billRejectingId} disabled={!billRejReason} onClick={handleBillRejectSubmit}>
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
