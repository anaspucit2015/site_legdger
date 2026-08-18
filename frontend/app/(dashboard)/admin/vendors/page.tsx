'use client';
import { useState } from 'react';
import { useGetVendorsQuery, useCreateVendorMutation, useUpdateVendorMutation, useDeactivateVendorMutation, useArchiveVendorMutation, Vendor } from '@/lib/api/vendorsApi';
import {
  Button, Input, Modal,
  Table, THead, TBody, Th, Tr, Td, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

type Filter = 'all' | 'active' | 'inactive' | 'archived';

function statusBadge(v: Vendor) {
  if (v.isArchived) return { label: 'Archived', bg: '#fef3e2', color: '#92400e' };
  if (v.isActive)   return { label: 'Active',   bg: '#edf7f2', color: '#1e6e49' };
  return               { label: 'Inactive',  bg: '#f2f2f2', color: '#888'    };
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

  const [showForm, setShowForm] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Vendor | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = vendors.filter((v) => {
    if (filter === 'archived') return v.isArchived;
    if (filter === 'active')   return v.isActive && !v.isArchived;
    if (filter === 'inactive') return !v.isActive && !v.isArchived;
    return !v.isArchived; // 'all' hides archived
  });

  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '', currentBalance: '' });
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createVendor({
        name: form.name,
        contactPerson: form.contactPerson,
        phone: form.phone,
        address: form.address,
        ...(form.email          ? { email: form.email }                           : {}),
        ...(form.currentBalance ? { currentBalance: Number(form.currentBalance) } : {}),
      }).unwrap();
      setForm({ name: '', contactPerson: '', phone: '', email: '', address: '', currentBalance: '' });
      setShowForm(false);
    } catch {
      setError('Failed to create vendor');
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
              <Th>Email</Th>
              <Th>Status</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {filtered.map((v) => {
              const badge = statusBadge(v);
              return (
                <Tr key={v.id}>
                  <Td bold>{v.name}</Td>
                  <Td muted>{v.contactPerson ?? '—'}</Td>
                  <Td mono muted>{v.phone ?? '—'}</Td>
                  <Td muted>{v.email ?? '—'}</Td>
                  <Td>
                    <span
                      className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </Td>
                  <Td right>
                    <div className="flex gap-2 justify-end">
                      {!v.isActive && !v.isArchived && (
                        <Button size="sm" variant="ghost" onClick={() => handleReactivate(v.id)} style={{ color: '#1e6e49' }}>
                          Reactivate
                        </Button>
                      )}
                      {v.isActive && !v.isArchived && (
                        <Button size="sm" variant="ghost" onClick={() => handleDeactivate(v.id)} style={{ color: 'var(--text-muted)' }}>
                          Deactivate
                        </Button>
                      )}
                      {!v.isArchived && (
                        <Button size="sm" variant="ghost" onClick={() => setArchiveTarget(v)} style={{ color: 'var(--rust)' }}>
                          Archive
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

      {/* Add Vendor Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Vendor">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Vendor Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Sunrise Contractors"
          />
          <Input
            label="Contact Person"
            required
            value={form.contactPerson}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            placeholder="e.g. Ahmed Khan"
          />
          <Input
            label="Phone"
            required
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
          <Input
            label="Address"
            required
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="e.g. 123 Main St, Lahore"
          />
          <Input
            label="Current Balance (PKR) — optional"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.currentBalance}
            onChange={(e) => setForm({ ...form, currentBalance: e.target.value })}
          />
          {error && <p className="text-sm" style={{ color: 'var(--rust)' }}>{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>{creating ? 'Creating…' : 'Create Vendor'}</Button>
          </div>
        </form>
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
    </div>
  );
}
