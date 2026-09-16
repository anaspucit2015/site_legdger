'use client';
import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import {
  useGetVendorTransactionsQuery,
  useReverseVendorTransactionMutation,
  VendorTransaction,
} from '@/lib/api/vendorsApi';
import { getToken } from '@/lib/auth';
import {
  Button, Input, Modal,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { ArrowLeft, RotateCcw, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';

function fmt(n: number) {
  return `Rs. ${n.toLocaleString()}`;
}

const TYPE_LABELS: Record<string, string> = {
  ADVANCE_GIVEN:    'Advance Given',
  INVOICE_APPROVED: 'Invoice Approved',
  BILL_APPROVED:    'Bill Approved',
  ADVANCE_APPLIED:  'Advance Applied',
  VENDOR_PAYMENT:   'Vendor Payment',
  REVERSAL:         'Reversal',
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  ADVANCE_GIVEN:    { bg: '#edf7f2', color: '#1e6e49' },
  INVOICE_APPROVED: { bg: '#e8f0fc', color: '#1b3a7a' },
  BILL_APPROVED:    { bg: '#ede8fc', color: '#4a1b7a' },
  ADVANCE_APPLIED:  { bg: '#e8f7fc', color: '#1b5e7a' },
  VENDOR_PAYMENT:   { bg: '#fff3cd', color: '#856404' },
  REVERSAL:         { bg: '#fde8e8', color: '#9b1c1c' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH:               'Cash',
  BANK_TRANSFER:      'Bank Transfer',
  CHEQUE:             'Cheque',
  JAZZCASH_EASYPAISA: 'JazzCash / EasyPaisa',
};

function docRef(txn: VendorTransaction) {
  if (txn.invoice) return `INV-${String(txn.invoice.invoiceNumber).padStart(5, '0')}`;
  if (txn.bill) return `BILL-${String(txn.bill.billNumber).padStart(5, '0')}`;
  return '—';
}

export default function VendorLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetVendorTransactionsQuery({ id, page });
  const [reverseTransaction, { isLoading: reversing }] = useReverseVendorTransactionMutation();

  const [reverseTarget, setReverseTarget] = useState<VendorTransaction | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [viewTarget,    setViewTarget]    = useState<VendorTransaction | null>(null);
  const [downloading,   setDownloading]   = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${base}/vendors/${id}/transactions?limit=9999`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json: { data: VendorTransaction[]; summary: typeof summary } = await res.json();
      const rows = json.data;
      const vendorName = json.summary?.vendorName ?? 'Vendor';

      const PAYMENT_METHOD_LABELS: Record<string, string> = {
        CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer',
        CHEQUE: 'Cheque', JAZZCASH_EASYPAISA: 'JazzCash / EasyPaisa',
      };

      const csvRows = [
        ['Date', 'Type', 'Document', 'Amount (PKR)', 'Outstanding After (PKR)', 'Advance After (PKR)', 'Payment Method', 'Payment Ref', 'Reference Note', 'Notes', 'Performed By'],
        ...rows.map((t) => {
          const docRef = t.invoice
            ? `INV-${String(t.invoice.invoiceNumber).padStart(5, '0')}`
            : t.bill
            ? `BILL-${String(t.bill.billNumber).padStart(5, '0')}`
            : '';
          const isReversal = t.type === 'REVERSAL';
          const amountStr = isReversal ? `-${Number(t.amount).toFixed(2)}` : Number(t.amount).toFixed(2);
          return [
            new Date(t.createdAt).toLocaleDateString(),
            TYPE_LABELS[t.type] ?? t.type,
            docRef,
            amountStr,
            Number(t.outstandingAfter).toFixed(2),
            Number(t.advanceAfter).toFixed(2),
            t.paymentMethod ? (PAYMENT_METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod) : '',
            t.paymentRef ?? '',
            t.invoiceReferenceNote ?? '',
            t.notes ?? '',
            t.performedBy?.name ?? '',
          ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        }),
      ];

      const csv = csvRows.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${vendorName.replace(/\s+/g, '_')}_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const transactions = data?.data ?? [];
  const summary = data?.summary;
  const total = data?.total ?? 0;

  async function handleReverse(e: React.FormEvent) {
    e.preventDefault();
    if (!reverseTarget) return;
    try {
      await reverseTransaction({ txnId: reverseTarget.id, reason: reverseReason }).unwrap();
      toast.success('Transaction reversed successfully.');
      setReverseTarget(null);
      setReverseReason('');
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to reverse transaction.');
    }
  }

  return (
    <div>
      <PageHeader
        title={summary ? summary.vendorName : 'Vendor Ledger'}
        subtitle="Transaction Ledger"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" loading={downloading} onClick={handleDownload}>
              <Download size={14} /> Download Report
            </Button>
            <Link href="/admin/vendors">
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} /> Back to Vendors
              </Button>
            </Link>
          </div>
        }
      />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Outstanding Balance', value: summary.outstandingBalance, color: summary.outstandingBalance > 0 ? 'var(--rust)' : 'var(--navy)' },
            { label: 'Advance Balance', value: summary.advanceBalance, color: summary.advanceBalance > 0 ? '#1e6e49' : 'var(--navy)' },
            { label: 'Net Payable', value: summary.netPayable, color: summary.netPayable > 0 ? 'var(--rust)' : summary.netPayable < 0 ? '#1e6e49' : 'var(--navy)' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: 'white', border: '1px solid var(--border)' }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{label}</p>
              <p className="text-xl font-semibold font-ledger" style={{ color }}>
                {value < 0 ? `−${fmt(Math.abs(value))}` : fmt(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <TableLoading />
      ) : transactions.length === 0 ? (
        <TableEmpty message="No transactions yet." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Amount</Th>
              <Th>Performed By</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {transactions.map((txn) => {
              const typeStyle       = TYPE_COLORS[txn.type] ?? { bg: '#f2f2f2', color: '#888' };
              const alreadyReversed = (txn.reversedBy?.length ?? 0) > 0;
              const isReversal      = txn.type === 'REVERSAL';

              return (
                <Tr key={txn.id}>
                  <Td muted>{new Date(txn.createdAt).toLocaleDateString()}</Td>
                  <Td>
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: typeStyle.bg, color: typeStyle.color, whiteSpace: 'nowrap', fontSize: 11 }}
                    >
                      {TYPE_LABELS[txn.type] ?? txn.type}
                    </span>
                    {alreadyReversed && (
                      <p className="text-xs mt-0.5" style={{ color: '#9b1c1c' }}>reversed</p>
                    )}
                  </Td>
                  <Td mono bold>
                    <span style={{ color: isReversal ? '#9b1c1c' : undefined }}>
                      {isReversal ? `−${fmt(Number(txn.amount))}` : fmt(Number(txn.amount))}
                    </span>
                  </Td>
                  <Td muted>{txn.performedBy?.name ?? '—'}</Td>
                  <Td right>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setViewTarget(txn)}>
                        <Eye size={13} /> View
                      </Button>
                      {!isReversal && !alreadyReversed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setReverseTarget(txn); setReverseReason(''); }}
                          style={{ color: 'var(--rust)' }}
                        >
                          <RotateCcw size={12} /> Reverse
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      {/* View Transaction Modal */}
      <Modal
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title="Transaction Detail"
        subtitle={viewTarget ? `${TYPE_LABELS[viewTarget.type] ?? viewTarget.type} · ${new Date(viewTarget.createdAt).toLocaleDateString()}` : undefined}
      >
        {viewTarget && (() => {
          const isReversal      = viewTarget.type === 'REVERSAL';
          const isVendorPayment = viewTarget.type === 'VENDOR_PAYMENT';
          const alreadyReversed = (viewTarget.reversedBy?.length ?? 0) > 0;
          const typeStyle       = TYPE_COLORS[viewTarget.type] ?? { bg: '#f2f2f2', color: '#888' };
          const rows: { label: string; value: React.ReactNode }[] = [
            {
              label: 'Type',
              value: (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: typeStyle.bg, color: typeStyle.color, whiteSpace: 'nowrap' }}>
                  {TYPE_LABELS[viewTarget.type] ?? viewTarget.type}
                </span>
              ),
            },
            { label: 'Amount',            value: <span className="font-semibold font-mono" style={{ color: isReversal ? '#9b1c1c' : 'var(--navy)' }}>{isReversal ? `−${fmt(Number(viewTarget.amount))}` : fmt(Number(viewTarget.amount))}</span> },
            { label: 'Document',          value: docRef(viewTarget) },
            { label: 'Outstanding After', value: <span className="font-mono">{fmt(Number(viewTarget.outstandingAfter))}</span> },
            { label: 'Advance After',     value: <span className="font-mono">{fmt(Number(viewTarget.advanceAfter))}</span> },
            ...(isVendorPayment && viewTarget.paymentMethod ? [{
              label: 'Payment Method',
              value: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fff3cd', color: '#856404' }}>{PAYMENT_METHOD_LABELS[viewTarget.paymentMethod] ?? viewTarget.paymentMethod}</span>,
            }] : []),
            ...(isVendorPayment && viewTarget.paymentRef           ? [{ label: 'Payment Ref',    value: <span className="font-mono">{viewTarget.paymentRef}</span> }] : []),
            ...(isVendorPayment && viewTarget.invoiceReferenceNote ? [{ label: 'Reference Note', value: viewTarget.invoiceReferenceNote }] : []),
            ...(viewTarget.notes && !viewTarget.paymentRef         ? [{ label: 'Notes',          value: viewTarget.notes }] : []),
            { label: 'Performed By',      value: viewTarget.performedBy?.name ?? '—' },
            ...(isReversal && viewTarget.reverses ? [{ label: 'Reverses', value: viewTarget.reverses.type.replace(/_/g, ' ') }] : []),
            ...(alreadyReversed ? [{ label: 'Status', value: <span style={{ color: '#9b1c1c', fontWeight: 600 }}>Reversed</span> }] : []),
          ];
          return (
            <div className="space-y-0 divide-y" style={{ borderTop: '1px solid var(--border)' }}>
              {rows.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 gap-4">
                  <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)', minWidth: 140 }}>{label}</span>
                  <span className="text-sm text-right" style={{ color: 'var(--navy)' }}>{value}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>

      {/* Reverse Modal */}
      <Modal
        open={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        title="Reverse Transaction"
        subtitle={reverseTarget ? `${TYPE_LABELS[reverseTarget.type] ?? reverseTarget.type} · ${fmt(Number(reverseTarget.amount))}` : undefined}
      >
        <form onSubmit={handleReverse} className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            This will create an offsetting transaction that cancels the effect of the original. The original transaction is preserved for audit purposes.
          </p>
          <Input
            label="Reason for reversal"
            required
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            placeholder="e.g. Wrong amount entered"
          />
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button>
            <Button
              type="submit"
              loading={reversing}
              disabled={!reverseReason}
              style={{ background: 'var(--rust)', color: 'white' }}
            >
              {reversing ? 'Reversing…' : 'Confirm Reversal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
