'use client';
import { useState } from 'react';
import { useGetTasksQuery, useCreateTaskMutation, useUpdateTaskMutation, useDeactivateTaskMutation, Task } from '@/lib/api/tasksApi';
import {
  Button, Input, Modal,
  Table, THead, TBody, Th, Tr, Td, TableEmpty, TableLoading,
  PageHeader, Pagination,
} from '@/components/ui';
import { Plus } from 'lucide-react';

export default function AdminTasksPage() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading } = useGetTasksQuery({ page });
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const allTasks = (result && 'data' in result ? result.data : result) ?? [];
  const total    = (result && 'total' in result ? result.total : 0) ?? 0;
  const tasks    = allTasks.filter((t) =>
    filter === 'all' ? true : filter === 'active' ? t.isActive : !t.isActive,
  );
  const [createTask, { isLoading: creating }] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [deactivate] = useDeactivateTaskMutation();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [form, setForm] = useState({ name: '', unit: '', unitCost: '' });
  const [editRate, setEditRate] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createTask({ ...form }).unwrap();
    setForm({ name: '', unit: '', unitCost: '' });
    setShowForm(false);
  }

  async function handleUpdateRate() {
    if (!editTarget) return;
    await updateTask({ id: editTarget.id, unitCost: editRate }).unwrap();
    setEditTarget(null);
    setEditRate('');
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Global task catalogue — available across all sites"
        action={
          <div className="flex gap-2">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--border)' }}>
              {(['all', 'active', 'inactive'] as const).map((f) => {
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
              <Plus size={15} /> Add Task
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <TableLoading />
      ) : tasks.length === 0 ? (
        <TableEmpty message="No tasks yet. Add your first task." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Task Name</Th>
              <Th>Unit</Th>
              <Th>Unit Cost (PKR)</Th>
              <Th>Status</Th>
              <Th right />
            </tr>
          </THead>
          <TBody>
            {tasks.map((t) => (
              <Tr key={t.id}>
                <Td bold>
                  {t.name}
                  {t.isCustom && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: '#fff8ec', color: 'var(--amber)' }}>
                      custom
                    </span>
                  )}
                </Td>
                <Td muted>{t.unit}</Td>
                <Td mono>
                  {t.unitCost
                    ? `Rs. ${Number(t.unitCost).toLocaleString()}`
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                  }
                </Td>
                <Td>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={t.isActive ? { background: '#edf7f2', color: '#1e6e49' } : { background: '#f2f2f2', color: '#888' }}
                  >
                    {t.isActive ? 'Active' : 'Inactive'}
                  </span>
                </Td>
                <Td right>
                  <div className="flex gap-3 justify-end">
                    {t.isActive && !t.isCustom && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditTarget(t); setEditRate(t.unitCost ?? ''); }}
                      >
                        Edit Rate
                      </Button>
                    )}
                    {t.isActive && (
                      <Button size="sm" variant="ghost" onClick={() => deactivate(t.id)} style={{ color: 'var(--rust)' }}>
                        Deactivate
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      {/* Create task modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Task">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Task Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Unit of Measurement"
            required
            placeholder="e.g. brick, sqft, bag, truck, day"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
          <Input
            label="Unit Cost (PKR)"
            type="number"
            step="0.01"
            mono
            value={form.unitCost}
            onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>{creating ? 'Creating…' : 'Create Task'}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit rate modal */}
      <Modal
        open={!!editTarget}
        onClose={() => { setEditTarget(null); setEditRate(''); }}
        title="Update Rate"
        subtitle={editTarget?.name}
      >
        <div className="space-y-4">
          <Input
            label="New Unit Cost (PKR)"
            type="number"
            step="0.01"
            mono
            value={editRate}
            onChange={(e) => setEditRate(e.target.value)}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdateRate} disabled={!editRate}>Save Rate</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
