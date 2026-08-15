'use client';
import { useState } from 'react';
import { useGetDeleteRequestsBillsQuery, useResolveDeleteBillMutation } from '@/lib/api/billsApi';
import {
  Button,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Trash2, X } from 'lucide-react';

export default function BillDeleteRequestsPage() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetDeleteRequestsBillsQuery({ page });
  const bills = result?.data ?? [];
  const total = result?.total ?? 0;
  const [resolve] = useResolveDeleteBillMutation();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function handleResolve(id: string, approve: boolean) {
    setResolvingId(id);
    try { await resolve({ id, approve }); } finally { setResolvingId(null); }
  }

  return (
    <div>
      <PageHeader
        title="Bill Delete Requests"
        subtitle="Deletion requests on bills awaiting your decision"
      />

      {isLoading ? (
        <TableLoading />
      ) : bills.length === 0 ? (
        <TableEmpty message="No pending delete requests." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>#</Th>
              <Th>Site / Vendor</Th>
              <Th>Items</Th>
              <Th>Total (PKR)</Th>
              <Th>Requested</Th>
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
                <Td muted>{bill.deleteRequestedAt ? new Date(bill.deleteRequestedAt).toLocaleDateString() : '—'}</Td>
                <Td right>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="danger" loading={resolvingId === bill.id} disabled={!!resolvingId} onClick={() => handleResolve(bill.id, true)}>
                      <Trash2 size={13} /> Approve Delete
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!resolvingId} onClick={() => handleResolve(bill.id, false)}>
                      <X size={13} /> Deny
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />
    </div>
  );
}
