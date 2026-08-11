'use client';
import { useState } from 'react';
import { useGetVendorsQuery, useCreateVendorMutation, useDeactivateVendorMutation } from '@/lib/api/vendorsApi';
import {
  Button, Input, Modal,
  Table, THead, TBody, Th, Tr, Td, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Plus } from 'lucide-react';

export default function AdminVendorsPage() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetVendorsQuery({ page });
  const vendors = result?.data ?? [];
  const total = result?.total ?? 0;
  const [createVendor, { isLoading: creating }] = useCreateVendorMutation();
  const [deactivate] = useDeactivateVendorMutation();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filtered = vendors.filter((v) =>
    filter === 'all' ? true : filter === 'active' ? v.isActive : !v.isActive,
  );
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
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
        ...(form.email ? { email: form.email } : {}),
      }).unwrap();
      setForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      setShowForm(false);
    } catch {
      setError('Failed to create vendor');
    }
  }

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Manage vendors / contractors"
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 text-sm capitalize transition-all cursor-pointer"
                  style={{
                    background: filter === f ? 'var(--navy)' : 'white',
                    color: filter === f ? 'white' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {f}
                </button>
              ))}
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
            {filtered.map((v) => (
              <Tr key={v.id}>
                <Td bold>{v.name}</Td>
                <Td muted>{v.contactPerson ?? '—'}</Td>
                <Td mono muted>{v.phone ?? '—'}</Td>
                <Td muted>{v.email ?? '—'}</Td>
                <Td>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={v.isActive ? { background: '#edf7f2', color: '#1e6e49' } : { background: '#f2f2f2', color: '#888' }}
                  >
                    {v.isActive ? 'Active' : 'Inactive'}
                  </span>
                </Td>
                <Td right>
                  {v.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => deactivate(v.id)} style={{ color: 'var(--rust)' }}>
                      Deactivate
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

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
          {error && <p className="text-sm" style={{ color: 'var(--rust)' }}>{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>{creating ? 'Creating…' : 'Create Vendor'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
