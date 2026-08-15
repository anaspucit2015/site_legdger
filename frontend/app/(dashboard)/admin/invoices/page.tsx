'use client';
import { useState } from 'react';
import {
  useGetInvoicesQuery,
  useApproveInvoiceMutation,
  useRejectInvoiceMutation,
  useAdminDeleteInvoiceMutation,
  useAdminUpdateInvoiceMutation,
  Invoice,
} from '@/lib/api/invoicesApi';
import { useGetActiveVendorsQuery } from '@/lib/api/vendorsApi';
import { StatusStamp } from '@/components/status-stamp';
import {
  Button, Select, Textarea, Input, NativeSelect, Modal,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { ReceiptUpload } from '@/components/receipt-upload';
import { Check, X, Eye, Trash2, Pencil } from 'lucide-react';
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
  { value: 'paid',     label: 'Paid'     },
];

const REJECTION_OPTIONS = REJECTION_REASONS.map((r) => ({ value: r, label: r }));

export default function AdminInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetInvoicesQuery({ status: statusFilter || undefined, page });
  const invoices = result?.data ?? [];
  const total = result?.total ?? 0;
  const { data: vendors = [] } = useGetActiveVendorsQuery();
  const [approve]     = useApproveInvoiceMutation();
  const [reject]      = useRejectInvoiceMutation();
  const [adminDelete] = useAdminDeleteInvoiceMutation();
  const [adminUpdate] = useAdminUpdateInvoiceMutation();

  const [viewTarget,   setViewTarget]   = useState<Invoice | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Invoice | null>(null);
  const [editTarget,   setEditTarget]   = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const [rejectionReason,      setRejectionReason]      = useState('');
  const [rejectionReasonOther, setRejectionReasonOther] = useState('');

  // Edit form state
  const [editVendorId,     setEditVendorId]     = useState('');
  const [editQuantity,     setEditQuantity]     = useState('');
  const [editAmount,       setEditAmount]       = useState('');
  const [editDescription,  setEditDescription]  = useState('');
  const [editAttachmentUrl, setEditAttachmentUrl] = useState('');

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [updating,    setUpdating]    = useState(false);

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    try { await adminDelete(id); setDeleteTarget(null); } finally { setDeletingId(null); }
  }

  function openEdit(inv: Invoice) {
    setEditTarget(inv);
    setEditVendorId(inv.vendorId ?? '');
    setEditQuantity(String(inv.quantity));
    setEditAmount(String(inv.amount));
    setEditDescription(inv.description ?? '');
    setEditAttachmentUrl(inv.attachmentUrl ?? '');
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setUpdating(true);
    try {
      const isCustom = !editTarget.unitCostSnapshot;
      await adminUpdate({
        id:          editTarget.id,
        vendorId:    editVendorId    || undefined,
        quantity:    editQuantity    || undefined,
        description: editDescription || undefined,
        attachmentUrl: editAttachmentUrl || undefined,
        ...(isCustom ? { amount: editAmount || undefined } : {}),
      });
      setEditTarget(null);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Review and action all submitted invoices"
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
                        <Button size="sm" variant="ghost" onClick={() => openEdit(inv)}>
                          <Pencil size={13} /> Edit
                        </Button>
                        <Button size="sm" variant="primary" loading={approvingId === inv.id} disabled={!!approvingId || !!rejectingId} onClick={() => handleApprove(inv.id)}>
                          <Check size={13} /> Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!approvingId || !!rejectingId} onClick={() => setRejectTarget(inv)}>
                          <X size={13} /> Reject
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(inv)} style={{ color: 'var(--rust)' }}>
                          <Trash2 size={13} />
                        </Button>
                      </>
                    )}
                    {inv.status === 'approved' && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(inv)} style={{ color: 'var(--rust)' }}>
                        <Trash2 size={13} />
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
                <Button size="sm" variant="ghost" onClick={() => { openEdit(viewTarget); setViewTarget(null); }}>
                  <Pencil size={13} /> Edit
                </Button>
                <Button size="sm" variant="primary" loading={approvingId === viewTarget.id} disabled={!!approvingId || !!rejectingId} onClick={() => handleApprove(viewTarget.id)}>
                  <Check size={13} /> Approve
                </Button>
                <Button size="sm" variant="outline" disabled={!!approvingId || !!rejectingId} onClick={() => { setViewTarget(null); setRejectTarget(viewTarget); }}>
                  <X size={13} /> Reject
                </Button>
              </>
            )}
            {['pending', 'approved'].includes(viewTarget.status) && (
              <Button size="sm" variant="ghost" onClick={() => { setViewTarget(null); setDeleteTarget(viewTarget); }} style={{ color: 'var(--rust)' }}>
                <Trash2 size={13} /> Delete
              </Button>
            )}
          </>
        )}
      />

      {/* ── Edit modal ── */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Invoice"
        subtitle={editTarget ? `${editTarget.site?.name} · ${editTarget.task?.name ?? editTarget.customTaskName}` : undefined}
        maxWidth={560}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">

          {/* Read-only info */}
          <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: 'var(--paper)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Site</span>
              <span style={{ color: 'var(--navy)', fontWeight: 500 }}>{editTarget?.site?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Task</span>
              <span style={{ color: 'var(--navy)', fontWeight: 500 }}>{editTarget?.task?.name ?? editTarget?.customTaskName ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Submitted By</span>
              <span style={{ color: 'var(--navy)', fontWeight: 500 }}>{editTarget?.submittedBy?.name ?? '—'}</span>
            </div>
          </div>

          <Select
            label="Vendor"
            value={editVendorId}
            onChange={setEditVendorId}
            options={vendorOptions}
            placeholder="Select vendor…"
          />

          <Input
            label={`Quantity${editTarget?.task?.unit ? ` (${editTarget.task.unit})` : ''}`}
            required
            type="number"
            step="0.01"
            min="0.01"
            mono
            value={editQuantity}
            onChange={(e) => setEditQuantity(e.target.value)}
          />

          {editTarget && !editTarget.unitCostSnapshot && (
            <Input
              label="Total Amount (PKR)"
              required
              type="number"
              step="0.01"
              min="0.01"
              mono
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
          )}

          {editTarget?.unitCostSnapshot && editQuantity && (
            <div className="rounded-xl px-4 py-3" style={{ background: '#edf7f2', border: '1.5px dashed var(--green)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--green)' }}>Auto-calculated amount</p>
              <p className="font-ledger text-xl font-semibold" style={{ color: 'var(--navy)' }}>
                Rs. {(parseFloat(editTarget.unitCostSnapshot) * parseFloat(editQuantity || '0')).toLocaleString()}
              </p>
            </div>
          )}

          <Textarea
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={2}
          />

          <ReceiptUpload
            onUploadComplete={(url) => setEditAttachmentUrl(url)}
            onClear={() => setEditAttachmentUrl('')}
          />

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" disabled={updating} onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" loading={updating}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* ── Reject modal ── */}
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

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Invoice"
        subtitle={deleteTarget ? `${deleteTarget.site?.name} · ${deleteTarget.task?.name ?? deleteTarget.customTaskName} · Rs. ${Number(deleteTarget.amount).toLocaleString()}` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            This will permanently delete the invoice. This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={!!deletingId} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={!!deletingId} onClick={() => deleteTarget && handleDelete(deleteTarget.id)}>
              Delete Invoice
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
