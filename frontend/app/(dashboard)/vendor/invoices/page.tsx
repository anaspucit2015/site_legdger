'use client';
import { useState } from 'react';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { useGetInvoicesQuery, Invoice } from '@/lib/api/invoicesApi';
import { StatusStamp } from '@/components/status-stamp';
import { InvoiceDetailModal } from '@/components/invoice-detail-modal';
import {
  Button, NativeSelect,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader,
} from '@/components/ui';
import { Eye } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid',     label: 'Paid'     },
];

export default function VendorInvoicesPage() {
  const { data: sites = [] } = useGetActiveSitesQuery();
  const [selectedSite, setSelectedSite]     = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const { data: invoices = [], isLoading } = useGetInvoicesQuery(
    { siteId: selectedSite, ...(statusFilter ? { status: statusFilter } : {}) },
    { skip: !selectedSite },
  );
  const [viewTarget, setViewTarget] = useState<Invoice | null>(null);

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div>
      <PageHeader
        title="Site Invoices"
        subtitle="All invoices submitted on this site — across all vendors"
        action={
          <div className="flex gap-2">
            <NativeSelect
              value={selectedSite}
              onChange={setSelectedSite}
              options={siteOptions}
              placeholder="Select site…"
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

      {!selectedSite ? (
        <TableEmpty message="Select a site to view invoices." />
      ) : isLoading ? (
        <TableLoading />
      ) : invoices.length === 0 ? (
        <TableEmpty message="No invoices submitted on this site yet." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Task</Th>
              <Th>Vendor</Th>
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
                <Td bold>{inv.task?.name ?? inv.customTaskName ?? '—'}</Td>
                <Td muted>{inv.vendor?.name ?? '—'}</Td>
                <Td mono muted>{inv.quantity} {inv.unit}</Td>
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
                  <Button size="sm" variant="ghost" onClick={() => setViewTarget(inv)}>
                    <Eye size={13} /> View
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <InvoiceDetailModal invoice={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  );
}
