'use client';
import { useState } from 'react';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { useGetBillsQuery, Bill } from '@/lib/api/billsApi';
import { StatusStamp } from '@/components/status-stamp';
import { BillDetailModal } from '@/components/bill-detail-modal';
import {
  Button, NativeSelect,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Eye } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid',     label: 'Paid'     },
];

export default function SiteSupervisorBillsPage() {
  const { data: sites = [] } = useGetActiveSitesQuery();
  const [selectedSite, setSelectedSite] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetBillsQuery(
    { siteId: selectedSite, ...(statusFilter ? { status: statusFilter } : {}), page },
    { skip: !selectedSite },
  );
  const bills = result?.data ?? [];
  const total = result?.total ?? 0;
  const [viewTarget, setViewTarget] = useState<Bill | null>(null);

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div>
      <PageHeader
        title="Site Bills"
        subtitle="All bills submitted on this site — across all supervisors"
        action={
          <div className="flex gap-2">
            <NativeSelect
              value={selectedSite}
              onChange={(val) => { setSelectedSite(val); setPage(1); }}
              options={siteOptions}
              placeholder="Select site…"
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

      {!selectedSite ? (
        <TableEmpty message="Select a site to view bills." />
      ) : isLoading ? (
        <TableLoading />
      ) : bills.length === 0 ? (
        <TableEmpty message="No bills submitted on this site yet." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>#</Th>
              <Th>Vendor</Th>
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
                <Td muted>{bill.vendor?.name ?? 'No vendor'}</Td>
                <Td muted>{bill.lineItems.length} item{bill.lineItems.length !== 1 ? 's' : ''}</Td>
                <Td mono bold>Rs. {Number(bill.totalAmount).toLocaleString()}</Td>
                <Td>
                  <div>
                    <StatusStamp status={bill.status} />
                    {bill.status === 'rejected' && bill.rejectionReason && (
                      <p className="text-xs mt-1" style={{ color: 'var(--rust)' }}>{bill.rejectionReason}</p>
                    )}
                  </div>
                </Td>
                <Td muted>{new Date(bill.submittedAt).toLocaleDateString()}</Td>
                <Td right>
                  <Button size="sm" variant="ghost" onClick={() => setViewTarget(bill)}>
                    <Eye size={13} /> View
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />
      <BillDetailModal bill={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  );
}
