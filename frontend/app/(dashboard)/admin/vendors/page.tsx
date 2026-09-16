'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  useGetVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useDeactivateVendorMutation,
  useArchiveVendorMutation,
  useGiveAdvanceMutation,
  useApplyAdvanceMutation,
  usePayVendorMutation,
  Vendor,
} from '@/lib/api/vendorsApi';
import {
  Button, Input, Modal, Select,
  Table, THead, TBody, Th, Tr, Td, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Plus, BookOpen, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

type Filter = 'all' | 'active' | 'inactive' | 'archived';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH',              label: 'Cash' },
  { value: 'BANK_TRANSFER',     label: 'Bank Transfer' },
  { value: 'CHEQUE',            label: 'Cheque' },
  { value: 'JAZZCASH_EASYPAISA', label: 'JazzCash / EasyPaisa' },
];

function RowMenu({ items }: { items: { label: string; color?: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer"
        style={{
          width: 30, height: 30,
          background: open ? 'var(--border)' : 'transparent',
          color: 'var(--text-muted)',
          border: 'none',
        }}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: 160,
            padding: '4px 0',
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.onClick(); }}
              className="w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer"
              style={{
                color: item.color ?? 'var(--navy)',
                background: 'transparent',
                border: 'none',
                display: 'block',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function statusBadge(v: Vendor) {
  if (v.isArchived) return { label: 'Archived', bg: '#fef3e2', color: '#92400e' };
  if (v.isActive)   return { label: 'Active',   bg: '#edf7f2', color: '#1e6e49' };
  return               { label: 'Inactive',  bg: '#f2f2f2', color: '#888'    };
}

function fmt(n: string | number) {
  return `Rs. ${Number(n).toLocaleString()}`;
}

function DetailRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm" style={{ color: value ? 'var(--navy)' : 'var(--text-muted)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)', fontWeight: value ? 500 : 400 }}>
        {value ?? '—'}
      </p>
    </div>
  );
}

export default function AdminVendorsPage() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetVendorsQuery({ page });
  const vendors = result?.data ?? [];
  const total = result?.total ?? 0;

  const [createVendor, { isLoading: creating }] = useCreateVendorMutation();
  const [updateVendor] = useUpdateVendorMutation();
  const [deactivate] = useDeactivateVendorMutation();
  const [archiveVendor, { isLoading: archiving }] = useArchiveVendorMutation();
  const [giveAdvance, { isLoading: givingAdvance }] = useGiveAdvanceMutation();
  const [applyAdvance, { isLoading: applyingAdvance }] = useApplyAdvanceMutation();
  const [payVendor, { isLoading: payingVendor }] = usePayVendorMutation();

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Vendor | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Vendor | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<Vendor | null>(null);
  const [applyAdvanceTarget, setApplyAdvanceTarget] = useState<Vendor | null>(null);
  const [payVendorTarget, setPayVendorTarget] = useState<Vendor | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = vendors.filter((v) => {
    if (filter === 'archived') return v.isArchived;
    if (filter === 'active')   return v.isActive && !v.isArchived;
    if (filter === 'inactive') return !v.isActive && !v.isArchived;
    return !v.isArchived;
  });

  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '', bankName: '', accountTitle: '', accountNumber: '', iban: '', branchCode: '', currentBalance: '' });
  const [formError, setFormError] = useState('');

  const [advanceForm, setAdvanceForm] = useState({ amount: '', notes: '' });
  const [applyAdvanceForm, setApplyAdvanceForm] = useState({ amount: '', notes: '' });
  const [payVendorForm, setPayVendorForm] = useState({ amount: '', paymentMethod: '', paymentRef: '', invoiceReferenceNote: '', notes: '' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      await createVendor({
        name: form.name,
        ...(form.contactPerson  ? { contactPerson:  form.contactPerson }                  : {}),
        ...(form.phone          ? { phone:          form.phone }                           : {}),
        ...(form.address        ? { address:        form.address }                         : {}),
        ...(form.email          ? { email:          form.email }                           : {}),
        ...(form.bankName       ? { bankName:       form.bankName }                        : {}),
        ...(form.accountTitle   ? { accountTitle:   form.accountTitle }                    : {}),
        ...(form.accountNumber  ? { accountNumber:  form.accountNumber }                   : {}),
        ...(form.iban           ? { iban:           form.iban }                            : {}),
        ...(form.branchCode     ? { branchCode:     form.branchCode }                      : {}),
        ...(form.currentBalance ? { currentBalance: Number(form.currentBalance) }          : {}),
      }).unwrap();
      setForm({ name: '', contactPerson: '', phone: '', email: '', address: '', bankName: '', accountTitle: '', accountNumber: '', iban: '', branchCode: '', currentBalance: '' });
      setShowForm(false);
    } catch {
      setFormError('Failed to create vendor');
    }
  }

  function openEdit(v: Vendor) {
    setForm({
      name: v.name,
      contactPerson: v.contactPerson ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      address: v.address ?? '',
      bankName: v.bankName ?? '',
      accountTitle: v.accountTitle ?? '',
      accountNumber: v.accountNumber ?? '',
      iban: v.iban ?? '',
      branchCode: v.branchCode ?? '',
      currentBalance: '',
    });
    setEditTarget(v);
    setFormError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setFormError('');
    try {
      await updateVendor({
        id: editTarget.id,
        name: form.name,
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        bankName: form.bankName || undefined,
        accountTitle: form.accountTitle || undefined,
        accountNumber: form.accountNumber || undefined,
        iban: form.iban || undefined,
        branchCode: form.branchCode || undefined,
      }).unwrap();
      toast.success('Vendor updated successfully.');
      setEditTarget(null);
    } catch {
      setFormError('Failed to update vendor');
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivate(id).unwrap();
      toast.success('Vendor deactivated successfully.');
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to deactivate vendor.');
    }
  }

  async function handleReactivate(id: string) {
    try {
      await updateVendor({ id, isActive: true }).unwrap();
      toast.success('Vendor reactivated successfully.');
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to reactivate vendor.');
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await archiveVendor(archiveTarget.id).unwrap();
      toast.success('Vendor archived successfully.');
      setArchiveTarget(null);
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to archive vendor.');
      setArchiveTarget(null);
    }
  }

  async function handleGiveAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!advanceTarget) return;
    try {
      await giveAdvance({
        id: advanceTarget.id,
        amount: Number(advanceForm.amount),
        ...(advanceForm.notes ? { notes: advanceForm.notes } : {}),
      }).unwrap();
      toast.success('Advance recorded successfully.');
      setAdvanceTarget(null);
      setAdvanceForm({ amount: '', notes: '' });
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to record advance.');
    }
  }

  async function handleApplyAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!applyAdvanceTarget) return;
    try {
      await applyAdvance({
        id: applyAdvanceTarget.id,
        amount: Number(applyAdvanceForm.amount),
        ...(applyAdvanceForm.notes ? { notes: applyAdvanceForm.notes } : {}),
      }).unwrap();
      toast.success('Advance applied successfully.');
      setApplyAdvanceTarget(null);
      setApplyAdvanceForm({ amount: '', notes: '' });
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to apply advance.');
    }
  }

  async function handlePayVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!payVendorTarget) return;
    try {
      await payVendor({
        id: payVendorTarget.id,
        amount: Number(payVendorForm.amount),
        paymentMethod: payVendorForm.paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'JAZZCASH_EASYPAISA',
        ...(payVendorForm.paymentRef          ? { paymentRef:          payVendorForm.paymentRef          } : {}),
        ...(payVendorForm.invoiceReferenceNote ? { invoiceReferenceNote: payVendorForm.invoiceReferenceNote } : {}),
        ...(payVendorForm.notes               ? { notes:               payVendorForm.notes               } : {}),
      }).unwrap();
      toast.success('Payment recorded successfully.');
      setPayVendorTarget(null);
      setPayVendorForm({ amount: '', paymentMethod: '', paymentRef: '', invoiceReferenceNote: '', notes: '' });
    } catch (err: any) {
      toast.error(err?.data?.message ?? 'Failed to record payment.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Manage vendors / contractors"
        action={
          <div className="flex gap-2">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--border)' }}>
              {(['all', 'active', 'inactive', 'archived'] as Filter[]).map((f) => {
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all cursor-pointer"
                    style={{
                      background: active ? 'white' : 'transparent',
                      color:      active ? 'var(--navy)' : 'var(--text-muted)',
                      boxShadow:  active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus size={15} /> Add Vendor
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <TableLoading />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Contact Person</Th>
              <Th>Phone</Th>
              <Th>Outstanding</Th>
              <Th>Advance</Th>
              <Th>Net Payable</Th>
              <Th>Status</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {filtered.map((v) => {
              const badge = statusBadge(v);
              const outstanding = Number(v.currentBalance);
              const advance = Number(v.advanceBalance);
              const net = outstanding - advance;
              return (
                <Tr key={v.id}>
                  <Td bold>{v.name}</Td>
                  <Td muted>{v.contactPerson ?? '—'}</Td>
                  <Td mono muted>{v.phone ?? '—'}</Td>
                  <Td mono muted>
                    <span style={{ color: outstanding > 0 ? 'var(--rust)' : undefined }}>
                      {outstanding > 0 ? fmt(outstanding) : '—'}
                    </span>
                  </Td>
                  <Td mono muted>
                    <span style={{ color: advance > 0 ? '#1e6e49' : undefined }}>
                      {advance > 0 ? fmt(advance) : '—'}
                    </span>
                  </Td>
                  <Td mono bold>
                    <span style={{ color: net > 0 ? 'var(--rust)' : net < 0 ? '#1e6e49' : undefined }}>
                      {net !== 0 ? fmt(Math.abs(net)) : '—'}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </Td>
                  <Td right>
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/admin/vendors/${v.id}/ledger`}>
                        <Button size="sm" variant="ghost">
                          <BookOpen size={13} /> Ledger
                        </Button>
                      </Link>
                      <RowMenu
                        items={[
                          { label: 'View Details', onClick: () => setDetailsTarget(v) },
                          { label: 'Edit Details', onClick: () => openEdit(v) },
                          ...(!v.isArchived ? [
                            ...(v.isActive ? [
                              ...(outstanding === 0 ? [{ label: 'Give Advance', color: '#1e6e49', onClick: () => { setAdvanceTarget(v); setAdvanceForm({ amount: '', notes: '' }); } }] : []),
                              ...(advance > 0 && outstanding > 0 ? [{ label: 'Apply Advance', color: '#1b3a7a', onClick: () => { setApplyAdvanceTarget(v); setApplyAdvanceForm({ amount: '', notes: '' }); } }] : []),
                              ...(outstanding > 0 ? [{ label: 'Pay Vendor', onClick: () => { setPayVendorTarget(v); setPayVendorForm({ amount: '', paymentMethod: '', paymentRef: '', invoiceReferenceNote: '', notes: '' }); } }] : []),
                              { label: 'Deactivate', color: 'var(--text-muted)', onClick: () => handleDeactivate(v.id) },
                            ] : [
                              { label: 'Reactivate', color: '#1e6e49', onClick: () => handleReactivate(v.id) },
                            ]),
                            { label: 'Archive', color: 'var(--rust)', onClick: () => setArchiveTarget(v) },
                          ] : []),
                        ]}
                      />
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      {/* Add Vendor Modal */}
      <Modal
        open={showForm || !!editTarget}
        onClose={() => { setShowForm(false); setEditTarget(null); setFormError(''); }}
        title={editTarget ? 'Edit Vendor' : 'Add Vendor'}
        subtitle={editTarget?.name}
        maxWidth={680}
      >
        <form onSubmit={editTarget ? handleEdit : handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Vendor Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sunrise Contractors"
            />
            <Input
              label="Contact Person (optional)"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="e.g. Ahmed Khan"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 0300-1234567"
            />
            <Input
              label="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. vendor@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Address (optional)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 123 Main St, Lahore"
            />
            <Input
              label="Opening Balance (PKR)"
              type="number"
              min="0"
              step="0.01"
              value={editTarget ? String(editTarget.currentBalance) : form.currentBalance}
              onChange={(e) => setForm({ ...form, currentBalance: e.target.value })}
              placeholder="e.g. 50000"
              disabled={!!editTarget}
            />
          </div>
          <p className="text-xs font-semibold pt-1" style={{ color: 'var(--text-muted)' }}>Bank Information (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Bank Name"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="e.g. HBL"
            />
            <Input
              label="Branch Code"
              mono
              value={form.branchCode}
              onChange={(e) => setForm({ ...form, branchCode: e.target.value })}
              placeholder="e.g. 0123"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Account Title"
              value={form.accountTitle}
              onChange={(e) => setForm({ ...form, accountTitle: e.target.value })}
              placeholder="e.g. Sunrise Contractors Ltd"
            />
            <Input
              label="Account Number"
              mono
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              placeholder="e.g. 01234567890123"
            />
          </div>
          <Input
            label="IBAN"
            mono
            value={form.iban}
            onChange={(e) => setForm({ ...form, iban: e.target.value })}
            placeholder="e.g. PK36HABB0000111234567890"
          />
          {formError && <p className="text-sm" style={{ color: 'var(--rust)' }}>{formError}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditTarget(null); setFormError(''); }}>Cancel</Button>
            <Button type="submit" loading={creating}>{editTarget ? 'Save Changes' : creating ? 'Creating…' : 'Create Vendor'}</Button>
          </div>
        </form>
      </Modal>

      {/* Vendor Details Modal */}
      <Modal open={!!detailsTarget} onClose={() => setDetailsTarget(null)} title="Vendor Details" subtitle={detailsTarget?.name} maxWidth={560}>
        {detailsTarget && (() => {
          const badge = statusBadge(detailsTarget);
          const outstanding = Number(detailsTarget.currentBalance);
          const advance = Number(detailsTarget.advanceBalance);
          const net = outstanding - advance;
          const hasBankInfo = detailsTarget.bankName || detailsTarget.accountNumber || detailsTarget.iban;
          return (
            <div className="space-y-5">
              {/* Status */}
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>

              {/* Balance strip */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Outstanding', value: fmt(outstanding), color: outstanding > 0 ? 'var(--rust)' : 'var(--text-muted)' },
                  { label: 'Advance', value: fmt(advance), color: advance > 0 ? '#1e6e49' : 'var(--text-muted)' },
                  { label: 'Net Payable', value: fmt(Math.abs(net)), color: net > 0 ? 'var(--rust)' : net < 0 ? '#1e6e49' : 'var(--text-muted)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl py-3 px-3 text-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{label}</p>
                    <p className="text-sm font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Contact */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Contact</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <DetailRow label="Contact Person" value={detailsTarget.contactPerson} />
                  <DetailRow label="Phone" value={detailsTarget.phone} mono />
                  <DetailRow label="Email" value={detailsTarget.email} mono />
                  <DetailRow label="Address" value={detailsTarget.address} />
                </div>
              </div>

              {/* Bank Info */}
              {hasBankInfo && (
                <>
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Bank Information</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <DetailRow label="Bank Name" value={detailsTarget.bankName} />
                      <DetailRow label="Branch Code" value={detailsTarget.branchCode} mono />
                      <DetailRow label="Account Title" value={detailsTarget.accountTitle} />
                      <DetailRow label="Account Number" value={detailsTarget.accountNumber} mono />
                      {detailsTarget.iban && (
                        <div className="col-span-2">
                          <DetailRow label="IBAN" value={detailsTarget.iban} mono />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setDetailsTarget(null); openEdit(detailsTarget); }}>Edit</Button>
                <Button onClick={() => setDetailsTarget(null)}>Close</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal open={!!archiveTarget} onClose={() => setArchiveTarget(null)} title="Archive Vendor">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Are you sure you want to archive{' '}
            <span className="font-semibold" style={{ color: 'var(--navy)' }}>{archiveTarget?.name}</span>?
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Archived vendors are hidden from all lists and cannot be selected for new invoices or bills. Their historical data is preserved.
          </p>
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancel</Button>
            <Button
              loading={archiving}
              onClick={handleArchiveConfirm}
              style={{ background: 'var(--rust)', color: 'white' }}
            >
              {archiving ? 'Archiving…' : 'Archive Vendor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Give Advance Modal */}
      <Modal
        open={!!advanceTarget}
        onClose={() => setAdvanceTarget(null)}
        title="Give Advance"
        subtitle={advanceTarget?.name}
      >
        <form onSubmit={handleGiveAdvance} className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Current advance balance:{' '}
            <span className="font-semibold" style={{ color: 'var(--navy)' }}>
              {advanceTarget ? fmt(advanceTarget.advanceBalance) : '—'}
            </span>
          </p>
          <Input
            label="Amount (PKR)"
            type="number"
            min="0.01"
            step="0.01"
            required
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
            <Button type="button" variant="outline" onClick={() => setAdvanceTarget(null)}>Cancel</Button>
            <Button type="submit" loading={givingAdvance} disabled={!advanceForm.amount}>
              {givingAdvance ? 'Recording…' : 'Record Advance'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Apply Advance Modal */}
      <Modal
        open={!!applyAdvanceTarget}
        onClose={() => setApplyAdvanceTarget(null)}
        title="Apply Advance to Balance"
        subtitle={applyAdvanceTarget?.name}
      >
        <form onSubmit={handleApplyAdvance} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Outstanding Balance</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--rust)' }}>
                {applyAdvanceTarget ? fmt(applyAdvanceTarget.currentBalance) : '—'}
              </p>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Advance Balance</p>
              <p className="font-semibold text-sm" style={{ color: '#1e6e49' }}>
                {applyAdvanceTarget ? fmt(applyAdvanceTarget.advanceBalance) : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Amount must not exceed either balance. Both will be reduced by the applied amount.
          </p>
          <Input
            label="Amount to Apply (PKR)"
            type="number"
            min="0.01"
            step="0.01"
            required
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
            <Button type="button" variant="outline" onClick={() => setApplyAdvanceTarget(null)}>Cancel</Button>
            <Button type="submit" loading={applyingAdvance} disabled={!applyAdvanceForm.amount}>
              {applyingAdvance ? 'Applying…' : 'Apply Advance'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Pay Vendor Modal */}
      <Modal
        open={!!payVendorTarget}
        onClose={() => setPayVendorTarget(null)}
        title="Pay Vendor"
        subtitle={payVendorTarget?.name}
      >
        <form onSubmit={handlePayVendor} className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Outstanding balance:{' '}
            <span className="font-semibold" style={{ color: 'var(--rust)' }}>
              {payVendorTarget ? fmt(payVendorTarget.currentBalance) : '—'}
            </span>
          </p>
          <Input
            label="Amount (PKR)"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={payVendorForm.amount}
            onChange={(e) => setPayVendorForm({ ...payVendorForm, amount: e.target.value })}
            placeholder="e.g. 200000"
          />
          <Select
            label="Payment Method"
            value={payVendorForm.paymentMethod}
            onChange={(val) => setPayVendorForm({ ...payVendorForm, paymentMethod: val, paymentRef: '' })}
            options={PAYMENT_METHOD_OPTIONS}
            placeholder="Select method…"
          />
          {payVendorForm.paymentMethod && payVendorForm.paymentMethod !== 'CASH' && (
            <Input
              label="Payment Reference"
              mono
              required
              value={payVendorForm.paymentRef}
              onChange={(e) => setPayVendorForm({ ...payVendorForm, paymentRef: e.target.value })}
              placeholder="e.g. CHQ-2026-001 / TXN-12345"
            />
          )}
          <Input
            label="Reference Note (optional)"
            value={payVendorForm.invoiceReferenceNote}
            onChange={(e) => setPayVendorForm({ ...payVendorForm, invoiceReferenceNote: e.target.value })}
            placeholder="e.g. Covers INV-00012 and INV-00015 (informational only)"
          />
          <Input
            label="Notes (optional)"
            value={payVendorForm.notes}
            onChange={(e) => setPayVendorForm({ ...payVendorForm, notes: e.target.value })}
            placeholder="Any additional notes…"
          />
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setPayVendorTarget(null)}>Cancel</Button>
            <Button
              type="submit"
              loading={payingVendor}
              disabled={!payVendorForm.amount || !payVendorForm.paymentMethod || (payVendorForm.paymentMethod !== 'CASH' && !payVendorForm.paymentRef)}
            >
              {payingVendor ? 'Recording…' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
