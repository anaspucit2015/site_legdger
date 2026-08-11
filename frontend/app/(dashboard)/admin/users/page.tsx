'use client';
import { useState, useEffect } from 'react';
import { useGetUsersQuery, useCreateUserMutation, useDeactivateUserMutation } from '@/lib/api/usersApi';
import { getUser } from '@/lib/auth';
import {
  Button, Input, Select, Modal,
  Table, THead, TBody, Th, Tr, Td, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Plus } from 'lucide-react';

const roleColors: Record<string, { bg: string; color: string }> = {
  admin:           { bg: '#eef0fb', color: '#3b47b5' },
  site_supervisor: { bg: '#fff8ec', color: '#b87a10' },
  accountant:      { bg: '#edf7f2', color: '#1e6e49' },
};

const ROLE_OPTIONS = [
  { value: 'site_supervisor', label: 'Site Supervisor' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'admin', label: 'Admin' },
];

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetUsersQuery({ page });
  const users = result?.data ?? [];
  const total = result?.total ?? 0;
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [deactivate] = useDeactivateUserMutation();
  const [showForm, setShowForm] = useState(false);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  useEffect(() => {
    setCurrentRole(getUser()?.role ?? null);
  }, []);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'site_supervisor' });
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createUser(form).unwrap();
      setForm({ name: '', email: '', password: '', role: 'site_supervisor' });
      setShowForm(false);
    } catch (err: any) {
      setError(err?.data?.message ?? 'Failed to create user');
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage system users and roles"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add User
          </Button>
        }
      />

      {isLoading ? (
        <TableLoading />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td bold>{u.name}</Td>
                <Td muted>{u.email}</Td>
                <Td>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                    style={roleColors[u.role]}
                  >
                    {u.role}
                  </span>
                </Td>
                <Td>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={u.isActive ? { background: '#edf7f2', color: '#1e6e49' } : { background: '#f2f2f2', color: '#888' }}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </Td>
                <Td right>
                  {u.isActive && currentRole === 'admin' && (
                    <Button size="sm" variant="ghost" onClick={() => deactivate(u.id)} style={{ color: 'var(--rust)' }}>
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add User">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Name"
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email"
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Password"
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(val) => setForm({ ...form, role: val })}
            options={ROLE_OPTIONS}
          />
          {error && <p className="text-sm" style={{ color: 'var(--rust)' }}>{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>{creating ? 'Creating…' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
