'use client';
import { Bill } from '@/lib/api/billsApi';
import { Modal, Table, THead, TBody, Th, Tr, Td } from '@/components/ui';
import { StatusStamp } from '@/components/status-stamp';
import { CheckCircle, Clock, CreditCard, XCircle, Trash2, ExternalLink } from 'lucide-react';

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
  bill: Bill | null;
  onClose: () => void;
  actions?: React.ReactNode;
}

export function BillDetailModal({ bill: b, onClose, actions }: Props) {
  if (!b) return null;

  const isRejected = b.status === 'rejected';
  const isPaid     = b.status === 'paid';
  const isApproved = b.status === 'approved' || isPaid;

  return (
    <Modal
      open={!!b}
      onClose={onClose}
      title={`BILL-${String(b.billNumber).padStart(5, '0')}`}
      subtitle={`${b.site?.name ?? '—'} · ${b.lineItems.length} line item${b.lineItems.length !== 1 ? 's' : ''}`}
      maxWidth={680}
    >
      {/* Amount + status hero */}
      <div
        className="rounded-xl px-5 py-4 mb-5 flex items-center justify-between"
        style={{ background: 'var(--paper)' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Total Amount</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-mono)' }}>
            Rs. {Number(b.totalAmount).toLocaleString()}
          </p>
        </div>
        <StatusStamp status={b.status} />
      </div>

      {/* Detail rows */}
      <div className="mb-5">
        <Row label="Site"         value={b.site?.name ?? '—'} />
        {b.vendor && <Row label="Vendor"       value={b.vendor.name} />}
        {b.submittedBy && <Row label="Submitted By" value={b.submittedBy.name} />}
        <Row label="Submitted"    value={new Date(b.submittedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })} />
        {isPaid && b.paymentRef && (
          <Row label="Payment Ref" value={b.paymentRef} mono />
        )}
      </div>

      {/* Line Items table */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Line Items</p>
        <Table>
          <THead>
            <tr>
              <Th>Task</Th>
              <Th>Unit</Th>
              <Th>Qty</Th>
              <Th>Rate</Th>
              <Th>Amount</Th>
            </tr>
          </THead>
          <TBody>
            {b.lineItems.map((item) => (
              <Tr key={item.id}>
                <Td bold>{item.task?.name ?? item.customTaskName ?? '—'}</Td>
                <Td muted>{item.unit}</Td>
                <Td mono muted>{Number(item.quantity).toLocaleString()}</Td>
                <Td mono muted>{item.unitCostSnapshot ? `Rs. ${Number(item.unitCostSnapshot).toLocaleString()}` : '—'}</Td>
                <Td mono bold>Rs. {Number(item.amount).toLocaleString()}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      {/* Receipt photo */}
      {b.attachmentUrl && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Attachment</p>
          <div className="relative inline-block">
            <a href={b.attachmentUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={b.attachmentUrl}
                alt="Attachment"
                className="rounded-xl object-cover"
                style={{ width: 220, height: 220, border: '1.5px solid var(--border)', display: 'block' }}
              />
              <div
                className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(27,42,76,0.55)' }}
              >
                <ExternalLink size={22} color="white" />
              </div>
            </a>
          </div>
        </div>
      )}

      {/* Description */}
      {b.description && (
        <div className="rounded-lg px-4 py-3 mb-5" style={{ background: 'var(--paper)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Description</p>
          <p className="text-sm" style={{ color: 'var(--navy)' }}>{b.description}</p>
        </div>
      )}

      {/* Delete request notice */}
      {b.deleteRequested && (
        <div className="rounded-lg px-4 py-3 mb-5 flex gap-3" style={{ background: '#FDF0ED', border: '1px solid #f5c4b8' }}>
          <Trash2 size={15} style={{ color: 'var(--rust)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--rust)' }}>Deletion Requested</p>
            <p className="text-sm" style={{ color: 'var(--rust)' }}>
              A request to delete this bill was submitted
              {b.deleteRequestedAt ? ` on ${new Date(b.deleteRequestedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
              An admin will review and either approve the deletion or deny it. Until then, this bill remains active.
            </p>
          </div>
        </div>
      )}

      {/* Rejection reason */}
      {isRejected && b.rejectionReason && (
        <div className="rounded-lg px-4 py-3 mb-5" style={{ background: '#fdf0ed', border: '1px solid #f5c4b8' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--rust)' }}>Rejection Reason</p>
          <p className="text-sm" style={{ color: 'var(--rust)' }}>
            {b.rejectionReason === 'Other' ? (b.rejectionReasonOther ?? b.rejectionReason) : b.rejectionReason}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Timeline</p>
        <div className="flex flex-col gap-3">
          <TimelineStep icon={Clock}       label="Submitted" date={b.submittedAt} done color="#E8A33D" />
          {isRejected
            ? <TimelineStep icon={XCircle}   label="Rejected"  date={b.approvedAt}  done color="#C4522E" />
            : <TimelineStep icon={CheckCircle} label="Approved" date={b.approvedAt}  done={isApproved} color="#2F9E6E" />
          }
          {!isRejected && (
            <TimelineStep icon={CreditCard} label="Paid"     date={b.paidAt}      done={isPaid}     color="#1B3A5C" />
          )}
        </div>
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex gap-2 justify-end pt-4 mt-4" style={{ borderTop: '1px solid var(--border)' }}>
          {actions}
        </div>
      )}
    </Modal>
  );
}
