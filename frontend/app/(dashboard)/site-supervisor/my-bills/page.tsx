'use client';
import { useState } from 'react';
import { useGetBillsQuery, useRequestDeleteBillMutation, Bill } from '@/lib/api/billsApi';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { StatusStamp } from '@/components/status-stamp';
import { BillDetailModal } from '@/components/bill-detail-modal';
import {
  Button, NativeSelect,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Eye, Info, Plus } from 'lucide-react';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid',     label: 'Paid'     },
];

export default function MyBillsPage() {
  const { data: sites = [] } = useGetActiveSitesQuery();
  const [siteFilter, setSiteFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewTarget, setViewTarget] = useState<Bill | null>(null);
  const [infoTarget, setInfoTarget] = useState<{ bill: Bill; top: number; left: number } | null>(null);
  const [requestDelete] = useRequestDeleteBillMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function handleRequestDelete(id: string) {
    setDeletingId(id);
    try { await requestDelete(id); } finally { setDeletingId(null); }
  }

  function handleInfoClick(e: React.MouseEvent<HTMLButtonElement>, bill: Bill) {
    if (infoTarget?.bill.id === bill.id) { setInfoTarget(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setInfoTarget({ bill, top: rect.top - 8, left: rect.right + 8 });
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
            : 'All bills you have submitted'
        }
        action={
          <div className="flex gap-2">
            <Link
              href="/site-supervisor/bills/new"
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
                  <div className="flex gap-2 justify-end items-center">
                    <Button size="sm" variant="ghost" onClick={() => setViewTarget(bill)}>
                      <Eye size={13} /> View
                    </Button>
                    {bill.status === 'pending' && !bill.deleteRequested && (
                      <Button size="sm" variant="ghost" loading={deletingId === bill.id} disabled={!!deletingId} onClick={() => handleRequestDelete(bill.id)} style={{ color: 'var(--rust)' }}>
                        Request Delete
                      </Button>
                    )}
                    {bill.deleteRequested && (
                      <button
                        onClick={(e) => handleInfoClick(e, bill)}
                        className="flex items-center justify-center w-6 h-6 rounded-full cursor-pointer"
                        style={{
                          color: infoTarget?.bill.id === bill.id ? 'var(--navy)' : 'var(--text-muted)',
                          background: infoTarget?.bill.id === bill.id ? 'var(--border)' : 'transparent',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = infoTarget?.bill.id === bill.id ? 'var(--border)' : 'transparent')}
                      >
                        <Info size={13} />
                      </button>
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
        actions={viewTarget && viewTarget.status === 'pending' && !viewTarget.deleteRequested ? (
          <Button size="sm" variant="ghost" loading={deletingId === viewTarget.id} disabled={!!deletingId} onClick={() => handleRequestDelete(viewTarget.id)} style={{ color: 'var(--rust)' }}>
            Request Delete
          </Button>
        ) : undefined}
      />

      {/* Fixed info popover */}
      {infoTarget && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setInfoTarget(null)} />
          <div
            style={{
              position: 'fixed',
              top: infoTarget.top,
              left: Math.min(infoTarget.left, window.innerWidth - 308),
              width: 300,
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '14px 16px',
              boxShadow: '0 8px 24px rgba(27,58,92,0.14)',
              zIndex: 50,
              transform: 'translateY(-100%)',
            }}
          >
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--rust)' }}>Deletion Request Pending</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              You requested this bill to be deleted
              {infoTarget.bill.deleteRequestedAt
                ? ` on ${new Date(infoTarget.bill.deleteRequestedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}.
              An admin will review and either approve the deletion or deny it. This bill remains active until a decision is made.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
