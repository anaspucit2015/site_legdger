'use client';
import { useGetDeleteRequestsQuery, useResolveDeleteRequestMutation } from '@/lib/api/invoicesApi';
import {
  Button,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader,
} from '@/components/ui';
import { Trash2, X } from 'lucide-react';

export default function DeleteRequestsPage() {
  const { data: invoices = [], isLoading } = useGetDeleteRequestsQuery();
  const [resolve] = useResolveDeleteRequestMutation();

  return (
    <div>
      <PageHeader
        title="Delete Requests"
        subtitle="Vendor-requested invoice deletions awaiting your decision"
      />

      {isLoading ? (
        <TableLoading />
      ) : invoices.length === 0 ? (
        <TableEmpty message="No pending delete requests." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Site / Task</Th>
              <Th>Amount (PKR)</Th>
              <Th>Requested</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {invoices.map((inv) => (
              <Tr key={inv.id}>
                <Td>
                  <p className="font-medium" style={{ color: 'var(--navy)' }}>{inv.site?.name ?? '—'}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{inv.task?.name ?? inv.customTaskName ?? '—'}</p>
                </Td>
                <Td mono bold>Rs. {Number(inv.amount).toLocaleString()}</Td>
                <Td muted>{inv.deleteRequestedAt ? new Date(inv.deleteRequestedAt).toLocaleDateString() : '—'}</Td>
                <Td right>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="danger" onClick={() => resolve({ id: inv.id, approve: true })}>
                      <Trash2 size={13} /> Approve Delete
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolve({ id: inv.id, approve: false })}>
                      <X size={13} /> Deny
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
