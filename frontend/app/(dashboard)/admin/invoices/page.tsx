'use client';
import { useState } from 'react';
import { useGetInvoicesQuery, useApproveInvoiceMutation, useRejectInvoiceMutation, Invoice } from '@/lib/api/invoicesApi';
import { StatusStamp } from '@/components/status-stamp';
import {
  Button, Select, Textarea, NativeSelect, Modal,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader,
} from '@/components/ui';
import { Check, X, Eye } from 'lucide-react';
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
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
];

const REJECTION_OPTIONS = REJECTION_REASONS.map((r) => ({ value: r, label: r }));

export default function AdminInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: invoices = [], isLoading } = useGetInvoicesQuery({ status: statusFilter || undefined });
  const [approve] = useApproveInvoiceMutation();
  const [reject] = useRejectInvoiceMutation();

  const [viewTarget, setViewTarget] = useState<Invoice | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Invoice | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionReasonOther, setRejectionReasonOther] = useState('');

  async function handleRejectSubmit() {
    if (!rejectTarget) return;
    await reject({ id: rejectTarget.id, rejectionReason, ...(rejectionReason === 'Other' ? { rejectionReasonOther } : {}) });
    setRejectTarget(null);
    setRejectionReason('');
    setRejectionReasonOther('');
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Review and action all submitted invoices"
        action={
          <NativeSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS.filter((o) => o.value !== '')}
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
              <Th>Site / Task</Th>
              <Th>Quantity</Th>
              <Th>Amount (PKR)</Th>
              <Th>Status</Th>
              <Th>Submitted</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {invoices.map((inv) => (
              <Tr key={inv.id}>
                <Td>
                  <p className="font-medium" style={{ color: 'var(--navy)' }}>{inv.site?.name ?? '—'}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{inv.task?.name ?? inv.customTaskName ?? '—'}</p>
                </Td>
                <Td mono muted>{inv.quantity} {inv.unit}</Td>
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
                        <Button size="sm" variant="primary" onClick={() => approve(inv.id)}>
                          <Check size={13} /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectTarget(inv)}>
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
      )}

      <InvoiceDetailModal invoice={viewTarget} onClose={() => setViewTarget(null)} />

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
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleRejectSubmit} disabled={!rejectionReason}>
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
