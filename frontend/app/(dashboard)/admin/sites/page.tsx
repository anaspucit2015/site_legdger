'use client';
import { useState } from 'react';
import { useGetSitesQuery, useCreateSiteMutation, useDeactivateSiteMutation } from '@/lib/api/sitesApi';
import {
  Button, Input, Modal,
  Table, THead, TBody, Th, Tr, Td, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Plus } from 'lucide-react';

export default function AdminSitesPage() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetSitesQuery({ page });
  const sites = result?.data ?? [];
  const total = result?.total ?? 0;
  const [createSite, { isLoading: creating }] = useCreateSiteMutation();
  const [deactivate] = useDeactivateSiteMutation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createSite(form).unwrap();
      setForm({ name: '', location: '' });
      setShowForm(false);
    } catch {
      setError('Failed to create site');
    }
  }

  return (
    <div>
      <PageHeader
        title="Sites"
        subtitle="Manage construction sites"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add Site
          </Button>
        }
      />

      {isLoading ? (
        <TableLoading />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>ID</Th>
              <Th>Site Name</Th>
              <Th>Location</Th>
              <Th>Status</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {sites.map((s) => (
              <Tr key={s.id}>
                <Td mono muted>{`S-${String(s.siteCode).padStart(3, '0')}`}</Td>
                <Td bold>{s.name}</Td>
                <Td muted>{s.location}</Td>
                <Td>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={s.isActive ? { background: '#edf7f2', color: '#1e6e49' } : { background: '#f2f2f2', color: '#888' }}
                  >
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </Td>
                <Td right>
                  {s.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => deactivate(s.id)} style={{ color: 'var(--rust)' }}>
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Site">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Location"
            required
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          {error && <p className="text-sm" style={{ color: 'var(--rust)' }}>{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>{creating ? 'Creating…' : 'Create Site'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
