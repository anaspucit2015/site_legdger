'use client';
import { useState } from 'react';
import {
  useGetInvoicesQuery,
  useApproveInvoiceMutation,
  useRejectInvoiceMutation,
  useVoidInvoiceMutation,
  Invoice,
} from '@/lib/api/invoicesApi';
import { StatusStamp } from '@/components/status-stamp';
import {
  Button, Input, Select, Textarea, NativeSelect, Modal,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Check, X, Eye, Ban } from 'lucide-react';
import { InvoiceDetailModal } from '@/components/invoice-detail-modal';

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
  { value: 'voided',   label: 'Voided'   },
];

const REJECTION_OPTIONS = REJECTION_REASONS.map((r) => ({ value: r, label: r }));

export default function AccountantInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetInvoicesQuery({ status: statusFilter || undefined, page });
  const invoices = result?.data ?? [];
  const total = result?.total ?? 0;
  const [approve] = useApproveInvoiceMutation();
  const [reject]  = useRejectInvoiceMutation();
  const [voidInvoice] = useVoidInvoiceMutation();

  const [viewTarget,    setViewTarget]    = useState<Invoice | null>(null);
  const [rejectTarget,  setRejectTarget]  = useState<Invoice | null>(null);
  const [voidTarget,    setVoidTarget]    = useState<Invoice | null>(null);
  const [rejectionReason,      setRejectionReason]      = useState('');
  const [rejectionReasonOther, setRejectionReasonOther] = useState('');
  const [voidReason,   setVoidReason]   = useState('');
  const [approvingId,  setApprovingId]  = useState<string | null>(null);
  const [rejectingId,  setRejectingId]  = useState<string | null>(null);
  const [voiding,      setVoiding]      = useState(false);

  async function handleApprove(id: string) {
    setApprovingId(id);
    try { await approve(id); } finally { setApprovingId(null); }
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

  async function handleVoidSubmit() {
    if (!voidTarget || !voidReason) return;
    setVoiding(true);
    try {
      await voidInvoice({ id: voidTarget.id, reason: voidReason });
      setVoidTarget(null);
      setVoidReason('');
    } finally {
      setVoiding(false);
    }
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${total} invoice${total !== 1 ? 's' : ''} · Rs. ${totalAmount.toLocaleString()}`}
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
      ) : invoices.length === 0 ? (
        <TableEmpty message="No invoices found." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>#</Th>
              <Th>Site / Task</Th>
              <Th>Vendor</Th>
              <Th>Qty</Th>
              <Th>Unit Price</Th>
              <Th>Amount (PKR)</Th>
              <Th>Status</Th>
              <Th>Submitted</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {invoices.map((inv) => (
              <Tr key={inv.id}>
                <Td mono muted>{`INV-${String(inv.invoiceNumber).padStart(5, '0')}`}</Td>
                <Td>
                  <p className="font-medium" style={{ color: 'var(--navy)' }}>{inv.site?.name ?? '—'}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{inv.task?.name ?? inv.customTaskName ?? '—'}</p>
                </Td>
                <Td muted>{inv.vendor?.name ?? '—'}</Td>
                <Td mono muted>{Number(inv.quantity).toLocaleString()} {inv.unit}</Td>
                <Td mono muted>{inv.unitCostSnapshot ? `Rs. ${Number(inv.unitCostSnapshot).toLocaleString()}` : '—'}</Td>
                <Td mono bold>Rs. {Number(inv.amount).toLocaleString()}</Td>
                <Td><StatusStamp status={inv.status} /></Td>
                <Td muted>{new Date(inv.submittedAt).toLocaleDateString()}</Td>
                <Td right>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setViewTarget(inv)}>
                      <Eye size={13} /> View
                    </Button>
                    {inv.status === 'pending' && (
                      <>
                        <Button size="sm" variant="primary" loading={approvingId === inv.id} disabled={!!approvingId || !!rejectingId} onClick={() => handleApprove(inv.id)}>
                          <Check size={13} /> Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!approvingId || !!rejectingId} onClick={() => setRejectTarget(inv)}>
                          <X size={13} /> Reject
                        </Button>
                      </>
                    )}
                    {inv.status === 'approved' && inv.vendorId && (
                      <Button size="sm" variant="ghost" style={{ color: 'var(--rust)' }} onClick={() => { setVoidTarget(inv); setVoidReason(''); }}>
                        <Ban size={13} /> Void
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

      <InvoiceDetailModal
        invoice={viewTarget}
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
            {viewTarget.status === 'approved' && viewTarget.vendorId && (
              <Button size="sm" variant="ghost" style={{ color: 'var(--rust)' }} onClick={() => { setViewTarget(null); setVoidTarget(viewTarget); setVoidReason(''); }}>
                <Ban size={13} /> Void
              </Button>
            )}
          </>
        )}
      />

      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectionReason(''); setRejectionReasonOther(''); }}
        title="Reject Invoice"
        subtitle={rejectTarget ? `${rejectTarget.site?.name} · ${rejectTarget.task?.name ?? rejectTarget.customTaskName} · Rs. ${Number(rejectTarget.amount).toLocaleString()}` : undefined}
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
        open={!!voidTarget}
        onClose={() => { setVoidTarget(null); setVoidReason(''); }}
        title="Void Invoice"
        subtitle={voidTarget ? `${voidTarget.site?.name} · ${voidTarget.task?.name ?? voidTarget.customTaskName} · Rs. ${Number(voidTarget.amount).toLocaleString()}` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Voiding this invoice will reverse the vendor balance credit and mark the invoice as voided. This action cannot be undone.
          </p>
          <Input
            label="Reason for voiding"
            required
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. Invoice submitted in error"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={voiding} onClick={() => setVoidTarget(null)}>Cancel</Button>
            <Button
              loading={voiding}
              disabled={!voidReason}
              style={{ background: 'var(--rust)', color: 'white' }}
              onClick={handleVoidSubmit}
            >
              Confirm Void
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
