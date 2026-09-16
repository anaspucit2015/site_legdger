'use client';
import { useState } from 'react';
import {
  useGetActiveVendorsQuery,
  useGetVendorTransactionsQuery,
  useGetVendorStatementQuery,
  useReverseVendorTransactionMutation,
  useGiveAdvanceMutation,
  useApplyAdvanceMutation,
  usePayVendorMutation,
  VendorTransaction,
} from '@/lib/api/vendorsApi';
import {
  Button, Input, Modal, Select, SearchableSelect,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { RotateCcw, Eye } from 'lucide-react';
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

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH',               label: 'Cash' },
  { value: 'BANK_TRANSFER',      label: 'Bank Transfer' },
  { value: 'CHEQUE',             label: 'Cheque' },
  { value: 'JAZZCASH_EASYPAISA', label: 'JazzCash / EasyPaisa' },
];

function docRef(txn: VendorTransaction) {
  if (txn.invoice) return `INV-${String(txn.invoice.invoiceNumber).padStart(5, '0')}`;
  if (txn.bill)    return `BILL-${String(txn.bill.billNumber).padStart(5, '0')}`;
  return '—';
}

export function VendorPaymentsPage() {
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [page, setPage] = useState(1);

  const { data: activeVendors = [] } = useGetActiveVendorsQuery();
  const { data, isLoading } = useGetVendorTransactionsQuery(
    { id: selectedVendorId, page },
    { skip: !selectedVendorId },
  );
  const { data: statement } = useGetVendorStatementQuery(
    selectedVendorId,
    { skip: !selectedVendorId },
  );

  const [giveAdvance,         { isLoading: givingAdvance   }] = useGiveAdvanceMutation();
  const [applyAdvance,        { isLoading: applyingAdvance }] = useApplyAdvanceMutation();
  const [payVendor,           { isLoading: payingVendor    }] = usePayVendorMutation();
  const [reverseTransaction,  { isLoading: reversing       }] = useReverseVendorTransactionMutation();

  const transactions = data?.data ?? [];
  const summary      = data?.summary;
  const total        = data?.total ?? 0;

  const vendorOptions = activeVendors.map((v) => ({ value: v.id, label: v.name }));

  const outstanding = summary?.outstandingBalance ?? 0;
  const advance     = summary?.advanceBalance     ?? 0;
  const net         = summary?.netPayable         ?? 0;

  // ── Modal state ───────────────────────────────────────────────────────────
  const [advanceOpen,      setAdvanceOpen]      = useState(false);
  const [applyAdvanceOpen, setApplyAdvanceOpen] = useState(false);
  const [payOpen,          setPayOpen]          = useState(false);
  const [reverseTarget,    setReverseTarget]    = useState<VendorTransaction | null>(null);
  const [viewTarget,       setViewTarget]       = useState<VendorTransaction | null>(null);

  const [advanceForm,      setAdvanceForm]      = useState({ amount: '', notes: '' });
  const [applyAdvanceForm, setApplyAdvanceForm] = useState({ amount: '', notes: '' });
  const [payForm,          setPayForm]          = useState({ amount: '', paymentMethod: '', paymentRef: '', invoiceReferenceNote: '', notes: '' });
  const [reverseReason,    setReverseReason]    = useState('');

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleGiveAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVendorId) return;
    try {
      await giveAdvance({ id: selectedVendorId, amount: Number(advanceForm.amount), ...(advanceForm.notes ? { notes: advanceForm.notes } : {}) }).unwrap();
      toast.success('Advance recorded successfully.');
      setAdvanceOpen(false);
      setAdvanceForm({ amount: '', notes: '' });
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to record advance.');
    }
  }

  async function handleApplyAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVendorId) return;
    try {
      await applyAdvance({ id: selectedVendorId, amount: Number(applyAdvanceForm.amount), ...(applyAdvanceForm.notes ? { notes: applyAdvanceForm.notes } : {}) }).unwrap();
      toast.success('Advance applied successfully.');
      setApplyAdvanceOpen(false);
      setApplyAdvanceForm({ amount: '', notes: '' });
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to apply advance.');
    }
  }

  async function handlePayVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVendorId) return;
    try {
      await payVendor({
        id: selectedVendorId,
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'JAZZCASH_EASYPAISA',
        ...(payForm.paymentRef          ? { paymentRef:          payForm.paymentRef          } : {}),
        ...(payForm.invoiceReferenceNote ? { invoiceReferenceNote: payForm.invoiceReferenceNote } : {}),
        ...(payForm.notes               ? { notes:               payForm.notes               } : {}),
      }).unwrap();
      toast.success('Payment recorded successfully.');
      setPayOpen(false);
      setPayForm({ amount: '', paymentMethod: '', paymentRef: '', invoiceReferenceNote: '', notes: '' });
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to record payment.');
    }
  }

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
        title="Vendor Payments"
        subtitle="Select a vendor to view their ledger and manage payments"
      />

      {/* Vendor selector */}
      <div className="card p-5 mb-6" style={{ maxWidth: 480 }}>
        <SearchableSelect
          label="Select Vendor"
          value={selectedVendorId}
          onChange={(val) => { setSelectedVendorId(val); setPage(1); }}
          options={vendorOptions}
          placeholder="Search and select a vendor…"
        />
      </div>

      {selectedVendorId && (
        <>
          {/* Balance cards + action buttons */}
          <div className="flex items-start gap-4 mb-6">
            <div className="grid grid-cols-4 gap-4 flex-1">
              {[
                { label: 'Outstanding Balance', value: outstanding, color: outstanding > 0 ? 'var(--rust)' : 'var(--navy)' },
                { label: 'Advance Balance',     value: advance,     color: advance > 0 ? '#1e6e49' : 'var(--navy)' },
                { label: 'Net Payable',         value: net,         color: net > 0 ? 'var(--rust)' : net < 0 ? '#1e6e49' : 'var(--navy)' },
                { label: 'Total Paid',          value: statement?.totalVendorPayments ?? 0, color: '#1b3a7a' },
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

            {/* Action buttons — same conditions as vendor list */}
            <div className="flex flex-col gap-2 shrink-0 pt-1">
              {outstanding > 0 && (
                <Button
                  variant="primary"
                  onClick={() => { setPayOpen(true); setPayForm({ amount: '', paymentMethod: '', paymentRef: '', invoiceReferenceNote: '', notes: '' }); }}
                >
                  Pay Vendor
                </Button>
              )}
              {outstanding === 0 && (
                <Button
                  variant="outline"
                  style={{ borderColor: '#1e6e49', color: '#1e6e49' }}
                  onClick={() => { setAdvanceOpen(true); setAdvanceForm({ amount: '', notes: '' }); }}
                >
                  Give Advance
                </Button>
              )}
              {advance > 0 && outstanding > 0 && (
                <Button
                  variant="outline"
                  onClick={() => { setApplyAdvanceOpen(true); setApplyAdvanceForm({ amount: '', notes: '' }); }}
                >
                  Apply Advance
                </Button>
              )}
            </div>
          </div>

          {/* Transaction ledger */}
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
        </>
      )}

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
            { label: 'Amount',           value: <span className="font-semibold font-mono" style={{ color: isReversal ? '#9b1c1c' : 'var(--navy)' }}>{isReversal ? `−${fmt(Number(viewTarget.amount))}` : fmt(Number(viewTarget.amount))}</span> },
            { label: 'Document',         value: docRef(viewTarget) },
            { label: 'Outstanding After', value: <span className="font-mono">{fmt(Number(viewTarget.outstandingAfter))}</span> },
            { label: 'Advance After',    value: <span className="font-mono">{fmt(Number(viewTarget.advanceAfter))}</span> },
            ...(isVendorPayment && viewTarget.paymentMethod ? [{
              label: 'Payment Method',
              value: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fff3cd', color: '#856404' }}>{PAYMENT_METHOD_LABELS[viewTarget.paymentMethod] ?? viewTarget.paymentMethod}</span>,
            }] : []),
            ...(isVendorPayment && viewTarget.paymentRef    ? [{ label: 'Payment Ref',      value: <span className="font-mono">{viewTarget.paymentRef}</span> }] : []),
            ...(isVendorPayment && viewTarget.invoiceReferenceNote ? [{ label: 'Reference Note', value: viewTarget.invoiceReferenceNote }] : []),
            ...(viewTarget.notes && !viewTarget.paymentRef  ? [{ label: 'Notes',            value: viewTarget.notes }] : []),
            { label: 'Performed By',     value: viewTarget.performedBy?.name ?? '—' },
            ...(isReversal && viewTarget.reverses ? [{ label: 'Reverses', value: `${viewTarget.reverses.type.replace(/_/g, ' ')}` }] : []),
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

      {/* Give Advance Modal */}
      <Modal
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        title="Give Advance"
        subtitle={summary?.vendorName}
      >
        <form onSubmit={handleGiveAdvance} className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Current advance balance:{' '}
            <span className="font-semibold" style={{ color: 'var(--navy)' }}>{fmt(advance)}</span>
          </p>
          <Input
            label="Amount (PKR)"
            type="number" min="0.01" step="0.01" required
            value={advanceForm.amount}
            onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
            placeholder="e.g. 500000"
          />
          <Input
            label="Notes (optional)"
            value={advanceForm.notes}
            onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
            placeholder="Any notes…"
          />
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button type="submit" loading={givingAdvance} disabled={!advanceForm.amount}>
              {givingAdvance ? 'Recording…' : 'Record Advance'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Apply Advance Modal */}
      <Modal
        open={applyAdvanceOpen}
        onClose={() => setApplyAdvanceOpen(false)}
        title="Apply Advance to Balance"
        subtitle={summary?.vendorName}
      >
        <form onSubmit={handleApplyAdvance} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Outstanding Balance</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--rust)' }}>{fmt(outstanding)}</p>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Advance Balance</p>
              <p className="font-semibold text-sm" style={{ color: '#1e6e49' }}>{fmt(advance)}</p>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Amount must not exceed either balance. Both will be reduced by the applied amount.
          </p>
          <Input
            label="Amount to Apply (PKR)"
            type="number" min="0.01" step="0.01" required
            value={applyAdvanceForm.amount}
            onChange={(e) => setApplyAdvanceForm({ ...applyAdvanceForm, amount: e.target.value })}
            placeholder="e.g. 200000"
          />
          <Input
            label="Notes (optional)"
            value={applyAdvanceForm.notes}
            onChange={(e) => setApplyAdvanceForm({ ...applyAdvanceForm, notes: e.target.value })}
            placeholder="Any notes…"
          />
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setApplyAdvanceOpen(false)}>Cancel</Button>
            <Button type="submit" loading={applyingAdvance} disabled={!applyAdvanceForm.amount}>
              {applyingAdvance ? 'Applying…' : 'Apply Advance'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Pay Vendor Modal */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Pay Vendor"
        subtitle={summary?.vendorName}
      >
        <form onSubmit={handlePayVendor} className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Outstanding balance:{' '}
            <span className="font-semibold" style={{ color: 'var(--rust)' }}>{fmt(outstanding)}</span>
          </p>
          <Input
            label="Amount (PKR)"
            type="number" min="0.01" step="0.01" required
            value={payForm.amount}
            onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            placeholder="e.g. 200000"
          />
          <Select
            label="Payment Method"
            value={payForm.paymentMethod}
            onChange={(val) => setPayForm({ ...payForm, paymentMethod: val, paymentRef: '' })}
            options={PAYMENT_METHOD_OPTIONS}
            placeholder="Select method…"
          />
          {payForm.paymentMethod && payForm.paymentMethod !== 'CASH' && (
            <Input
              label="Payment Reference"
              mono required
              value={payForm.paymentRef}
              onChange={(e) => setPayForm({ ...payForm, paymentRef: e.target.value })}
              placeholder="e.g. CHQ-2026-001 / TXN-12345"
            />
          )}
          <Input
            label="Reference Note (optional)"
            value={payForm.invoiceReferenceNote}
            onChange={(e) => setPayForm({ ...payForm, invoiceReferenceNote: e.target.value })}
            placeholder="e.g. Covers INV-00012 and INV-00015 (informational only)"
          />
          <Input
            label="Notes (optional)"
            value={payForm.notes}
            onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
            placeholder="Any additional notes…"
          />
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              loading={payingVendor}
              disabled={!payForm.amount || !payForm.paymentMethod || (payForm.paymentMethod !== 'CASH' && !payForm.paymentRef)}
            >
              {payingVendor ? 'Recording…' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reverse Transaction Modal */}
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
