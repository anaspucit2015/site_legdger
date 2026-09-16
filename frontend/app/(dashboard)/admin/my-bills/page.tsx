'use client';
import { useState } from 'react';
import { useGetBillsQuery, useAdminDeleteBillMutation, Bill } from '@/lib/api/billsApi';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { StatusStamp } from '@/components/status-stamp';
import { BillDetailModal } from '@/components/bill-detail-modal';
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

export default function AdminMyBillsPage() {
  const { data: sites = [] } = useGetActiveSitesQuery();
  const [siteFilter, setSiteFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewTarget, setViewTarget]     = useState<Bill | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [page, setPage] = useState(1);
  const [adminDelete] = useAdminDeleteBillMutation();

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try { await adminDelete(deleteTarget.id); setDeleteTarget(null); } finally { setDeletingId(null); }
  }

  const { data: result, isLoading } = useGetBillsQuery({
    mine: true,
    ...(siteFilter   ? { siteId:  siteFilter   } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    page,
  });
  const bills = result?.data ?? [];
  const total = result?.total ?? 0;

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const totalAmount = bills.reduce((s, b) => s + Number(b.totalAmount), 0);

  return (
    <div>
      <PageHeader
        title="My Bills"
        subtitle={
          total > 0
            ? `${total} bill${total !== 1 ? 's' : ''} · Rs. ${totalAmount.toLocaleString()}`
            : 'Bills you have personally submitted'
        }
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/bills/new"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--navy)', color: '#fff' }}
            >
              <Plus size={14} /> New Bill
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
                <Td>
                  <div>
                    <StatusStamp status={bill.deleteRequested ? 'delete_requested' : bill.status} />
                    {bill.status === 'rejected' && bill.rejectionReason && (
                      <p className="text-xs mt-1" style={{ color: 'var(--rust)' }}>{bill.rejectionReason}</p>
                    )}
                  </div>
                </Td>
                <Td muted>{new Date(bill.submittedAt).toLocaleDateString()}</Td>
                <Td right>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setViewTarget(bill)}>
                      <Eye size={13} /> View
                    </Button>
                    {['pending', 'approved'].includes(bill.status) && (
                      <Button size="sm" variant="ghost" disabled={!!deletingId} onClick={() => setDeleteTarget(bill)} style={{ color: 'var(--rust)' }}>
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

      <BillDetailModal
        bill={viewTarget}
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
        title="Delete Bill"
        subtitle={deleteTarget ? `BILL-${String(deleteTarget.billNumber).padStart(5, '0')} · Rs. ${Number(deleteTarget.totalAmount).toLocaleString()}` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Are you sure you want to delete this bill? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={!!deletingId} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button loading={!!deletingId} onClick={handleDeleteConfirm} style={{ background: 'var(--rust)', color: 'white' }}>
              Delete Bill
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
