'use client';
import { useState } from 'react';
import { useGetInvoicesQuery, useReleasePaymentMutation, Invoice } from '@/lib/api/invoicesApi';
import { StatusStamp } from '@/components/status-stamp';
import {
  Button, Input, NativeSelect, Modal,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader,
} from '@/components/ui';
import { CreditCard, Eye } from 'lucide-react';
import { InvoiceDetailModal } from '@/components/invoice-detail-modal';

const STATUS_OPTIONS = [
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
];

export default function AccountantInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState('approved');
  const { data: invoices = [], isLoading } = useGetInvoicesQuery({ status: statusFilter });
  const [releasePayment] = useReleasePaymentMutation();

  const [viewTarget, setViewTarget] = useState<Invoice | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [paymentRef, setPaymentRef] = useState('');

  async function handlePay() {
    if (!payTarget) return;
    await releasePayment({ id: payTarget.id, paymentRef });
    setPayTarget(null);
    setPaymentRef('');
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} · Rs. ${totalAmount.toLocaleString()}`}
        action={
          <NativeSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
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
              <Th>Site / Task</Th>
              <Th>Vendor ID</Th>
              <Th>Quantity</Th>
              <Th>Amount (PKR)</Th>
              <Th>Status</Th>
              <Th>Payment Ref</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {invoices.map((inv) => (
              <Tr key={inv.id}>
                <Td>
                  <p className="font-medium" style={{ color: 'var(--navy)' }}>{inv.site?.name ?? '—'}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{inv.task?.name ?? '—'}</p>
                </Td>
                <Td mono muted>{inv.vendorId.slice(-8)}</Td>
                <Td mono muted>{inv.quantity} {inv.unit}</Td>
                <Td mono bold>Rs. {Number(inv.amount).toLocaleString()}</Td>
                <Td><StatusStamp status={inv.status} /></Td>
                <Td mono muted>{inv.paymentRef ?? '—'}</Td>
                <Td right>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setViewTarget(inv)}>
                      <Eye size={13} /> View
                    </Button>
                    {inv.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => { setPayTarget(inv); setPaymentRef(''); }}
                      >
                        <CreditCard size={13} /> Release Payment
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <InvoiceDetailModal invoice={viewTarget} onClose={() => setViewTarget(null)} />

      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title="Release Payment"
        subtitle={payTarget ? `${payTarget.site?.name} · ${payTarget.task?.name}` : undefined}
      >
        <div className="space-y-4">
          {payTarget && (
            <p className="font-ledger text-2xl font-semibold" style={{ color: 'var(--navy)' }}>
              Rs. {Number(payTarget.amount).toLocaleString()}
            </p>
          )}
          <Input
            label="Payment Reference"
            mono
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="e.g. TXN-2026-001 / Bank Ref"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={!paymentRef}>Confirm Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
