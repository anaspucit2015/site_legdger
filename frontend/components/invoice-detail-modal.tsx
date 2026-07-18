'use client';
import { Invoice } from '@/lib/api/invoicesApi';
import { Modal } from '@/components/ui';
import { StatusStamp } from '@/components/status-stamp';
import { CheckCircle, Clock, CreditCard, XCircle, Trash2 } from 'lucide-react';

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs font-medium uppercase tracking-wide shrink-0" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', minWidth: 120 }}>
        {label}
      </span>
      <span
        className="text-sm text-right"
        style={{
          color: 'var(--navy)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
          fontWeight: mono ? 500 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TimelineStep({
  icon: Icon,
  label,
  date,
  done,
  color,
}: {
  icon: React.ElementType;
  label: string;
  date?: string | null;
  done: boolean;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: done ? color + '1a' : '#f2f2f2' }}
      >
        <Icon size={13} style={{ color: done ? color : 'var(--text-muted)' }} />
      </div>
      <div>
        <p className="text-xs font-semibold" style={{ color: done ? 'var(--navy)' : 'var(--text-muted)' }}>{label}</p>
        {date && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
      </div>
    </div>
  );
}

interface Props {
  invoice: Invoice | null;
  onClose: () => void;
}

export function InvoiceDetailModal({ invoice: inv, onClose }: Props) {
  if (!inv) return null;

  const isRejected = inv.status === 'rejected';
  const isPaid     = inv.status === 'paid';
  const isApproved = inv.status === 'approved' || isPaid;

  return (
    <Modal
      open={!!inv}
      onClose={onClose}
      title="Invoice Details"
      subtitle={`${inv.site?.name ?? '—'} · ${inv.task?.name ?? inv.customTaskName ?? '—'}`}
    >
      {/* Amount + status hero */}
      <div
        className="rounded-xl px-5 py-4 mb-5 flex items-center justify-between"
        style={{ background: 'var(--paper)' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Total Amount</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-mono)' }}>
            Rs. {Number(inv.amount).toLocaleString()}
          </p>
        </div>
        <StatusStamp status={inv.status} />
      </div>

      {/* Detail rows */}
      <div className="mb-5">
        <Row label="Site"       value={inv.site?.name ?? '—'} />
        <Row label="Task"       value={inv.task?.name ?? inv.customTaskName ?? '—'} />
        <Row label="Quantity"   value={`${Number(inv.quantity).toLocaleString()} ${inv.unit}`} mono />
        {inv.unitCostSnapshot && (
          <Row label="Rate"     value={`Rs. ${Number(inv.unitCostSnapshot).toLocaleString()} / ${inv.unit}`} mono />
        )}
        <Row label="Vendor ID"  value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{inv.vendorId.slice(-12)}</span>} />
        <Row label="Submitted"  value={new Date(inv.submittedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })} />
        {isPaid && inv.paymentRef && (
          <Row label="Payment Ref" value={inv.paymentRef} mono />
        )}
      </div>

      {/* Description */}
      {inv.description && (
        <div className="rounded-lg px-4 py-3 mb-5" style={{ background: 'var(--paper)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Description</p>
          <p className="text-sm" style={{ color: 'var(--navy)' }}>{inv.description}</p>
        </div>
      )}

      {/* Delete request notice */}
      {inv.deleteRequested && (
        <div className="rounded-lg px-4 py-3 mb-5 flex gap-3" style={{ background: '#FDF0ED', border: '1px solid #f5c4b8' }}>
          <Trash2 size={15} style={{ color: 'var(--rust)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--rust)' }}>Deletion Requested</p>
            <p className="text-sm" style={{ color: 'var(--rust)' }}>
              You submitted a request to delete this invoice
              {inv.deleteRequestedAt ? ` on ${new Date(inv.deleteRequestedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
              An admin will review and either approve the deletion or deny it. Until then, this invoice remains active.
            </p>
          </div>
        </div>
      )}

      {/* Rejection reason */}
      {isRejected && inv.rejectionReason && (
        <div className="rounded-lg px-4 py-3 mb-5" style={{ background: '#fdf0ed', border: '1px solid #f5c4b8' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--rust)' }}>Rejection Reason</p>
          <p className="text-sm" style={{ color: 'var(--rust)' }}>
            {inv.rejectionReason === 'Other' ? (inv.rejectionReasonOther ?? inv.rejectionReason) : inv.rejectionReason}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Timeline</p>
        <div className="flex flex-col gap-3">
          <TimelineStep icon={Clock}       label="Submitted" date={inv.submittedAt} done color="#E8A33D" />
          {isRejected
            ? <TimelineStep icon={XCircle}   label="Rejected"  date={inv.submittedAt} done color="#C4522E" />
            : <TimelineStep icon={CheckCircle} label="Approved" date={inv.approvedAt}  done={isApproved} color="#2F9E6E" />
          }
          {!isRejected && (
            <TimelineStep icon={CreditCard} label="Paid"     date={inv.paidAt}      done={isPaid}     color="#1B3A5C" />
          )}
        </div>
      </div>
    </Modal>
  );
}
