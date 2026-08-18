'use client';
import { useState, useEffect } from 'react';
import {
  useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation,
  useDeactivateUserMutation, useArchiveUserMutation, User,
} from '@/lib/api/usersApi';
import { getUser } from '@/lib/auth';
import {
  Button, Input, Select, Modal,
  Table, THead, TBody, Th, Tr, Td, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Plus } from 'lucide-react';

type Filter = 'all' | 'active' | 'inactive' | 'archived';

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

function statusBadge(u: User) {
  if (u.isArchived) return { label: 'Archived', bg: '#fef3e2', color: '#92400e' };
  if (u.isActive)   return { label: 'Active',   bg: '#edf7f2', color: '#1e6e49' };
  return               { label: 'Inactive',  bg: '#f2f2f2', color: '#888'    };
}

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetUsersQuery({ page });
  const users = result?.data ?? [];
  const total = result?.total ?? 0;

  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deactivate] = useDeactivateUserMutation();
  const [archiveUser, { isLoading: archiving }] = useArchiveUserMutation();

  const [showForm, setShowForm] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<User | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  useEffect(() => {
    setCurrentRole(getUser()?.role ?? null);
  }, []);

  const filtered = users.filter((u) => {
    if (filter === 'archived') return u.isArchived;
    if (filter === 'active')   return u.isActive && !u.isArchived;
    if (filter === 'inactive') return !u.isActive && !u.isArchived;
    return !u.isArchived; // 'all' hides archived
  });

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

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    await archiveUser(archiveTarget.id);
    setArchiveTarget(null);
  }

  const isAdmin = currentRole === 'admin';

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage system users and roles"
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
              <Plus size={15} /> Add User
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
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {filtered.map((u) => {
              const badge = statusBadge(u);
              return (
                <Tr key={u.id}>
                  <Td bold>{u.name}</Td>
                  <Td muted>{u.email}</Td>
                  <Td>
                    <span
                      className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                      style={roleColors[u.role]}
                    >
                      {u.role.replace('_', ' ')}
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
                    {isAdmin && (
                      <div className="flex gap-2 justify-end">
                        {!u.isActive && !u.isArchived && (
                          <Button size="sm" variant="ghost" onClick={() => updateUser({ id: u.id, isActive: true })} style={{ color: '#1e6e49' }}>
                            Reactivate
                          </Button>
                        )}
                        {u.isActive && !u.isArchived && (
                          <Button size="sm" variant="ghost" onClick={() => deactivate(u.id)} style={{ color: 'var(--text-muted)' }}>
                            Deactivate
                          </Button>
                        )}
                        {!u.isArchived && (
                          <Button size="sm" variant="ghost" onClick={() => setArchiveTarget(u)} style={{ color: 'var(--rust)' }}>
                            Archive
                          </Button>
                        )}
                      </div>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      {/* Add User Modal */}
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

      {/* Archive Confirmation Modal */}
      <Modal open={!!archiveTarget} onClose={() => setArchiveTarget(null)} title="Archive User">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Are you sure you want to archive{' '}
            <span className="font-semibold" style={{ color: 'var(--navy)' }}>{archiveTarget?.name}</span>?
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Archived users cannot log in and are hidden from all lists. Their activity history is preserved.
          </p>
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancel</Button>
            <Button
              loading={archiving}
              onClick={handleArchiveConfirm}
              style={{ background: 'var(--rust)', color: 'white' }}
            >
              {archiving ? 'Archiving…' : 'Archive User'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
