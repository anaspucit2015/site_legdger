'use client';
import { useState } from 'react';
import { useGetInvoicesQuery, useAdminDeleteInvoiceMutation, Invoice } from '@/lib/api/invoicesApi';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { StatusStamp } from '@/components/status-stamp';
import { InvoiceDetailModal } from '@/components/invoice-detail-modal';
import {
  Button, Modal, NativeSelect,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Eye, Plus } from 'lucide-react';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'voided',   label: 'Voided'   },
];

export default function AdminMyInvoicesPage() {
  const { data: sites = [] } = useGetActiveSitesQuery();
  const [siteFilter, setSiteFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewTarget, setViewTarget]     = useState<Invoice | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<Invoice | null>(null);
  const [adminDelete] = useAdminDeleteInvoiceMutation();
  const [page, setPage] = useState(1);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try { await adminDelete(deleteTarget.id); setDeleteTarget(null); } finally { setDeletingId(null); }
  }

  const { data: result, isLoading } = useGetInvoicesQuery({
    mine: true,
    ...(siteFilter   ? { siteId: siteFilter   } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    page,
  });
  const invoices = result?.data ?? [];
  const total = result?.total ?? 0;

  const siteOptions  = sites.map((s) => ({ value: s.id, label: s.name }));
  const totalAmount  = invoices.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div>
      <PageHeader
        title="My Invoices"
        subtitle={
          total > 0
            ? `${total} invoice${total !== 1 ? 's' : ''} · Rs. ${totalAmount.toLocaleString()}`
            : 'Invoices you have personally submitted'
        }
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/invoices/new"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--navy)', color: '#fff' }}
            >
              <Plus size={14} /> New Invoice
            </Link>
            <NativeSelect
              value={siteFilter}
              onChange={(val) => { setSiteFilter(val); setPage(1); }}
              options={siteOptions}
              placeholder="All sites"
            />
            <NativeSelect
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
            />
          </div>
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
                <Td>
                  <div>
                    <StatusStamp status={inv.status} />
                    {inv.status === 'rejected' && inv.rejectionReason && (
                      <p className="text-xs mt-1" style={{ color: 'var(--rust)' }}>{inv.rejectionReason}</p>
                    )}
                  </div>
                </Td>
                <Td muted>{new Date(inv.submittedAt).toLocaleDateString()}</Td>
                <Td right>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setViewTarget(inv)}>
                      <Eye size={13} /> View
                    </Button>
                    {['pending', 'approved'].includes(inv.status) && (
                      <Button size="sm" variant="ghost" disabled={!!deletingId} onClick={() => setDeleteTarget(inv)} style={{ color: 'var(--rust)' }}>
                        Delete
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
        actions={viewTarget && ['pending', 'approved'].includes(viewTarget.status) ? (
          <Button size="sm" variant="ghost" disabled={!!deletingId} onClick={() => { setViewTarget(null); setDeleteTarget(viewTarget); }} style={{ color: 'var(--rust)' }}>
            Delete
          </Button>
        ) : undefined}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Invoice"
        subtitle={deleteTarget ? `INV-${String(deleteTarget.invoiceNumber).padStart(5, '0')} · Rs. ${Number(deleteTarget.amount).toLocaleString()}` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Are you sure you want to delete this invoice? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={!!deletingId} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button loading={!!deletingId} onClick={handleDeleteConfirm} style={{ background: 'var(--rust)', color: 'white' }}>
              Delete Invoice
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
