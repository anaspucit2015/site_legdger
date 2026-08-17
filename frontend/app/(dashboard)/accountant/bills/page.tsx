'use client';
import { useState } from 'react';
import {
  useGetBillsQuery,
  useApproveBillMutation,
  useRejectBillMutation,
  useReleasePaymentBillMutation,
  Bill,
} from '@/lib/api/billsApi';
import { StatusStamp } from '@/components/status-stamp';
import {
  Button, Input, Select, Textarea, NativeSelect, Modal,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { BillDetailModal } from '@/components/bill-detail-modal';
import { Check, X, Eye, CreditCard } from 'lucide-react';

const REJECTION_REASONS = [
  'Duplicate submission',
  'Incorrect quantity',
  'Incorrect amount',
  'Missing receipt',
  'Task not authorized',
  'Other',
];

const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid',     label: 'Paid'     },
];

const REJECTION_OPTIONS = REJECTION_REASONS.map((r) => ({ value: r, label: r }));

export default function AccountantBillsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetBillsQuery({ status: statusFilter || undefined, page });
  const bills = result?.data ?? [];
  const total = result?.total ?? 0;

  const [approve]        = useApproveBillMutation();
  const [reject]         = useRejectBillMutation();
  const [releasePayment] = useReleasePaymentBillMutation();

  const [viewTarget,   setViewTarget]   = useState<Bill | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Bill | null>(null);
  const [payTarget,    setPayTarget]    = useState<Bill | null>(null);

  const [rejectionReason,      setRejectionReason]      = useState('');
  const [rejectionReasonOther, setRejectionReasonOther] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [paying,      setPaying]      = useState(false);

  async function handleApprove(id: string) {
    setApprovingId(id);
    try { await approve(id); setViewTarget(null); } finally { setApprovingId(null); }
  }

  async function handleRejectSubmit() {
    if (!rejectTarget) return;
    setRejectingId(rejectTarget.id);
    try {
      await reject({ id: rejectTarget.id, rejectionReason, ...(rejectionReason === 'Other' ? { rejectionReasonOther } : {}) });
      setRejectTarget(null);
      setRejectionReason('');
      setRejectionReasonOther('');
    } finally {
      setRejectingId(null);
    }
  }

  async function handlePay() {
    if (!payTarget) return;
    setPaying(true);
    try {
      await releasePayment({ id: payTarget.id, paymentRef });
      setPayTarget(null);
      setPaymentRef('');
    } finally {
      setPaying(false);
    }
  }

  const totalAmount = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0);

  return (
    <div>
      <PageHeader
        title="Bills"
        subtitle={`${total} bill${total !== 1 ? 's' : ''} · Rs. ${totalAmount.toLocaleString()}`}
        action={
          <NativeSelect
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
          />
        }
      />

      {isLoading ? (
        <TableLoading />
      ) : bills.length === 0 ? (
        <TableEmpty message="No bills found." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>#</Th>
              <Th>Site / Vendor</Th>
              <Th>Line Items</Th>
              <Th>Total (PKR)</Th>
              <Th>Status</Th>
              <Th>Submitted</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {bills.map((bill) => (
              <Tr key={bill.id}>
                <Td mono muted>{`BILL-${String(bill.billNumber).padStart(5, '0')}`}</Td>
                <Td>
                  <p className="font-medium" style={{ color: 'var(--navy)' }}>{bill.site?.name ?? '—'}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{bill.vendor?.name ?? 'No vendor'}</p>
                </Td>
                <Td muted>{bill.lineItems.length} item{bill.lineItems.length !== 1 ? 's' : ''}</Td>
                <Td mono bold>Rs. {Number(bill.totalAmount).toLocaleString()}</Td>
                <Td><StatusStamp status={bill.status} /></Td>
                <Td muted>{new Date(bill.submittedAt).toLocaleDateString()}</Td>
                <Td right>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setViewTarget(bill)}>
                      <Eye size={13} /> View
                    </Button>
                    {bill.status === 'pending' && (
                      <>
                        <Button size="sm" variant="primary" loading={approvingId === bill.id} disabled={!!approvingId || !!rejectingId} onClick={() => handleApprove(bill.id)}>
                          <Check size={13} /> Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!approvingId || !!rejectingId} onClick={() => setRejectTarget(bill)}>
                          <X size={13} /> Reject
                        </Button>
                      </>
                    )}
                    {bill.status === 'approved' && (
                      <Button size="sm" variant="primary" onClick={() => { setPayTarget(bill); setPaymentRef(''); }}>
                        <CreditCard size={13} /> Release Payment
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      <BillDetailModal
        bill={viewTarget}
        onClose={() => setViewTarget(null)}
        actions={viewTarget && (
          <>
            {viewTarget.status === 'pending' && (
              <>
                <Button size="sm" variant="primary" loading={approvingId === viewTarget.id} disabled={!!approvingId || !!rejectingId} onClick={() => handleApprove(viewTarget.id)}>
                  <Check size={13} /> Approve
                </Button>
                <Button size="sm" variant="outline" disabled={!!approvingId || !!rejectingId} onClick={() => { setViewTarget(null); setRejectTarget(viewTarget); }}>
                  <X size={13} /> Reject
                </Button>
              </>
            )}
            {viewTarget.status === 'approved' && (
              <Button size="sm" variant="primary" onClick={() => { setViewTarget(null); setPayTarget(viewTarget); setPaymentRef(''); }}>
                <CreditCard size={13} /> Release Payment
              </Button>
            )}
          </>
        )}
      />

      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectionReason(''); setRejectionReasonOther(''); }}
        title="Reject Bill"
        subtitle={rejectTarget ? `${rejectTarget.site?.name} · Rs. ${Number(rejectTarget.totalAmount).toLocaleString()}` : undefined}
      >
        <div className="space-y-3">
          <Select
            label="Reason"
            value={rejectionReason}
            onChange={setRejectionReason}
            options={REJECTION_OPTIONS}
            placeholder="Select reason…"
          />
          {rejectionReason === 'Other' && (
            <Textarea
              label="Other reason"
              value={rejectionReasonOther}
              onChange={(e) => setRejectionReasonOther(e.target.value)}
              placeholder="Describe the reason…"
              rows={3}
            />
          )}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" disabled={!!rejectingId} onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={!!rejectingId} disabled={!rejectionReason} onClick={handleRejectSubmit}>
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title="Release Payment"
        subtitle={payTarget ? `${payTarget.site?.name} · ${payTarget.vendor?.name ?? 'No vendor'}` : undefined}
      >
        <div className="space-y-4">
          {payTarget && (
            <p className="font-ledger text-2xl font-semibold" style={{ color: 'var(--navy)' }}>
              Rs. {Number(payTarget.totalAmount).toLocaleString()}
            </p>
          )}
          <Input
            label="Payment Reference"
            mono
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="e.g. TXN-2026-001 / Bank Ref"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={paying} onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button loading={paying} disabled={!paymentRef} onClick={handlePay}>Confirm Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
