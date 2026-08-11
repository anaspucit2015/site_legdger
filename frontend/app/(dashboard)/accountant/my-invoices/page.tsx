'use client';
import { useState } from 'react';
import { useGetInvoicesQuery, useRequestDeleteInvoiceMutation, Invoice } from '@/lib/api/invoicesApi';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { StatusStamp } from '@/components/status-stamp';
import { InvoiceDetailModal } from '@/components/invoice-detail-modal';
import {
  Button, NativeSelect,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Eye, Plus } from 'lucide-react';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid',     label: 'Paid'     },
];

export default function AccountantMyInvoicesPage() {
  const { data: sites = [] } = useGetActiveSitesQuery();
  const [siteFilter, setSiteFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewTarget, setViewTarget]     = useState<Invoice | null>(null);
  const [requestDelete] = useRequestDeleteInvoiceMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function handleRequestDelete(id: string) {
    setDeletingId(id);
    try { await requestDelete(id); } finally { setDeletingId(null); }
  }

  const { data: result, isLoading } = useGetInvoicesQuery({
    mine: true,
    ...(siteFilter   ? { siteId: siteFilter   } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    page,
  });
  const invoices = result?.data ?? [];
  const total = result?.total ?? 0;

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const totalAmount = invoices.reduce((s, i) => s + Number(i.amount), 0);

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
              href="/accountant/invoices/new"
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
                    {inv.status === 'pending' && !inv.deleteRequested && (
                      <Button size="sm" variant="ghost" loading={deletingId === inv.id} disabled={!!deletingId} onClick={() => handleRequestDelete(inv.id)} style={{ color: 'var(--rust)' }}>
                        Request Delete
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

      <InvoiceDetailModal invoice={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  );
}
