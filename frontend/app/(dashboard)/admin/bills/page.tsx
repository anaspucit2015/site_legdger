'use client';
import { useState } from 'react';
import {
  useGetBillsQuery,
  useApproveBillMutation,
  useRejectBillMutation,
  useAdminDeleteBillMutation,
  useAdminUpdateBillMutation,
  Bill,
} from '@/lib/api/billsApi';
import { useGetActiveVendorsQuery } from '@/lib/api/vendorsApi';
import { StatusStamp } from '@/components/status-stamp';
import {
  Button, Select, Textarea, NativeSelect, Modal,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { BillDetailModal } from '@/components/bill-detail-modal';
import { ReceiptUpload } from '@/components/receipt-upload';
import { Check, X, Eye, Trash2, Pencil } from 'lucide-react';

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

export default function AdminBillsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetBillsQuery({ status: statusFilter || undefined, page });
  const bills = result?.data ?? [];
  const total = result?.total ?? 0;

  const { data: vendors = [] } = useGetActiveVendorsQuery();
  const [approve]      = useApproveBillMutation();
  const [reject]       = useRejectBillMutation();
  const [adminDelete]  = useAdminDeleteBillMutation();
  const [adminUpdate]  = useAdminUpdateBillMutation();

  const [viewTarget,   setViewTarget]   = useState<Bill | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Bill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [editTarget,   setEditTarget]   = useState<Bill | null>(null);

  const [rejectionReason,      setRejectionReason]      = useState('');
  const [rejectionReasonOther, setRejectionReasonOther] = useState('');

  // Edit form state
  const [editVendorId,     setEditVendorId]     = useState('');
  const [editDescription,  setEditDescription]  = useState('');
  const [editAttachmentUrl, setEditAttachmentUrl] = useState('');

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [updating,    setUpdating]    = useState(false);

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    try { await adminDelete(id); setDeleteTarget(null); } finally { setDeletingId(null); }
  }

  function openEdit(bill: Bill) {
    setEditTarget(bill);
    setEditVendorId(bill.vendorId ?? '');
    setEditDescription(bill.description ?? '');
    setEditAttachmentUrl(bill.attachmentUrl ?? '');
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setUpdating(true);
    try {
      await adminUpdate({
        id: editTarget.id,
        vendorId:      editVendorId     || undefined,
        description:   editDescription  || undefined,
        attachmentUrl: editAttachmentUrl || undefined,
      });
      setEditTarget(null);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Bills"
        subtitle="Review and action all submitted bills"
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
                        <Button size="sm" variant="ghost" onClick={() => openEdit(bill)}>
                          <Pencil size={13} /> Edit
                        </Button>
                        <Button size="sm" variant="primary" loading={approvingId === bill.id} disabled={!!approvingId || !!rejectingId} onClick={() => handleApprove(bill.id)}>
                          <Check size={13} /> Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!approvingId || !!rejectingId} onClick={() => setRejectTarget(bill)}>
                          <X size={13} /> Reject
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(bill)} style={{ color: 'var(--rust)' }}>
                          <Trash2 size={13} />
                        </Button>
                      </>
                    )}
                    {bill.status === 'approved' && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(bill)} style={{ color: 'var(--rust)' }}>
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

      <BillDetailModal
        bill={viewTarget}
        onClose={() => setViewTarget(null)}
        actions={viewTarget && (
          <>
            {viewTarget.status === 'pending' && (
              <>
                <Button size="sm" variant="ghost" onClick={() => { setViewTarget(null); openEdit(viewTarget); }}>
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

      {/* Reject modal */}
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

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Bill"
        subtitle={editTarget ? `${editTarget.site?.name} · BILL-${String(editTarget.billNumber).padStart(5, '0')}` : undefined}
        maxWidth={520}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--paper)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Line items cannot be changed after submission</p>
            <p className="text-sm" style={{ color: 'var(--navy)' }}>
              {editTarget?.lineItems.length} item{editTarget?.lineItems.length !== 1 ? 's' : ''} · Rs. {Number(editTarget?.totalAmount ?? 0).toLocaleString()}
            </p>
          </div>
          <Select
            label="Vendor"
            value={editVendorId}
            onChange={setEditVendorId}
            options={vendorOptions}
            placeholder="Select vendor…"
          />
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

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Bill"
        subtitle={deleteTarget ? `${deleteTarget.site?.name} · Rs. ${Number(deleteTarget.totalAmount).toLocaleString()}` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            This will permanently delete the bill and all its line items. This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={!!deletingId} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={!!deletingId} onClick={() => deleteTarget && handleDelete(deleteTarget.id)}>
              Delete Bill
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
