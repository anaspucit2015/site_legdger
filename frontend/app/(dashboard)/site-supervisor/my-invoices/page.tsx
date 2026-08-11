'use client';
import { useState } from 'react';
import { useGetInvoicesQuery, useRequestDeleteInvoiceMutation, Invoice } from '@/lib/api/invoicesApi';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { StatusStamp } from '@/components/status-stamp';
import { InvoiceDetailModal } from '@/components/invoice-detail-modal';
import {
  Button, NativeSelect,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader,
} from '@/components/ui';
import { Eye, Info, Plus } from 'lucide-react';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid',     label: 'Paid'     },
];

export default function MyInvoicesPage() {
  const { data: sites = [] } = useGetActiveSitesQuery();
  const [siteFilter, setSiteFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewTarget, setViewTarget] = useState<Invoice | null>(null);
  const [infoTarget, setInfoTarget] = useState<{ inv: Invoice; top: number; left: number } | null>(null);
  const [requestDelete] = useRequestDeleteInvoiceMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleRequestDelete(id: string) {
    setDeletingId(id);
    try { await requestDelete(id); } finally { setDeletingId(null); }
  }

  function handleInfoClick(e: React.MouseEvent<HTMLButtonElement>, inv: Invoice) {
    if (infoTarget?.inv.id === inv.id) { setInfoTarget(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setInfoTarget({ inv, top: rect.top - 8, left: rect.right + 8 });
  }

  // No siteId in query → backend returns this supervisor's own invoices
  const { data: invoices = [], isLoading } = useGetInvoicesQuery({
    mine: true,
    ...(siteFilter   ? { siteId:  siteFilter   } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const totalAmount = invoices.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div>
      <PageHeader
        title="My Invoices"
        subtitle={
          invoices.length > 0
            ? `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} · Rs. ${totalAmount.toLocaleString()}`
            : 'All invoices you have submitted'
        }
        action={
          <div className="flex gap-2">
            <Link
              href="/site-supervisor/invoices/new"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--navy)', color: '#fff' }}
            >
              <Plus size={14} /> New Invoice
            </Link>
            <NativeSelect
              value={siteFilter}
              onChange={setSiteFilter}
              options={siteOptions}
              placeholder="All sites"
            />
            <NativeSelect
              value={statusFilter}
              onChange={setStatusFilter}
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
                    <StatusStamp status={inv.deleteRequested ? 'delete_requested' : inv.status} />
                    {inv.status === 'rejected' && inv.rejectionReason && (
                      <p className="text-xs mt-1" style={{ color: 'var(--rust)' }}>{inv.rejectionReason}</p>
                    )}
                  </div>
                </Td>
                <Td muted>{new Date(inv.submittedAt).toLocaleDateString()}</Td>
                <Td right>
                  <div className="flex gap-2 justify-end items-center">
                    <Button size="sm" variant="ghost" onClick={() => setViewTarget(inv)}>
                      <Eye size={13} /> View
                    </Button>
                    {inv.status === 'pending' && !inv.deleteRequested && (
                      <Button size="sm" variant="ghost" loading={deletingId === inv.id} disabled={!!deletingId} onClick={() => handleRequestDelete(inv.id)} style={{ color: 'var(--rust)' }}>
                        Request Delete
                      </Button>
                    )}
                    {inv.deleteRequested && (
                      <button
                        onClick={(e) => handleInfoClick(e, inv)}
                        className="flex items-center justify-center w-6 h-6 rounded-full cursor-pointer"
                        style={{
                          color: infoTarget?.inv.id === inv.id ? 'var(--navy)' : 'var(--text-muted)',
                          background: infoTarget?.inv.id === inv.id ? 'var(--border)' : 'transparent',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = infoTarget?.inv.id === inv.id ? 'var(--border)' : 'transparent')}
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

      <InvoiceDetailModal invoice={viewTarget} onClose={() => setViewTarget(null)} />

      {/* Fixed info popover — escapes table overflow */}
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
              You requested this invoice to be deleted
              {infoTarget.inv.deleteRequestedAt
                ? ` on ${new Date(infoTarget.inv.deleteRequestedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}.
              An admin will review and either approve the deletion or deny it. This invoice remains active until a decision is made.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
