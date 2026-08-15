'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { useGetActiveTasksQuery } from '@/lib/api/tasksApi';
import { useGetActiveVendorsQuery } from '@/lib/api/vendorsApi';
import { useCreateBillMutation } from '@/lib/api/billsApi';
import {
  Button, Input, Textarea, Select, SearchableSelect,
  Modal, Table, THead, TBody, Th, Tr, Td, TableEmpty, PageHeader,
} from '@/components/ui';
import { ReceiptUpload } from '@/components/receipt-upload';
import { Plus, Trash2 } from 'lucide-react';

type LineItemState = {
  id: string;
  isCustom: boolean;
  taskId: string;
  customTaskName: string;
  customTaskUnit: string;
  customTaskUnitCost: string;
  quantity: string;
};

function emptyDraft(): LineItemState {
  return { id: '', isCustom: false, taskId: '', customTaskName: '', customTaskUnit: '', customTaskUnitCost: '', quantity: '' };
}

interface Props {
  showStatus?: boolean;
  redirectPath: string;
}

export function BillSubmitForm({ showStatus = false, redirectPath }: Props) {
  const router = useRouter();
  const { data: sites   = [] } = useGetActiveSitesQuery();
  const { data: tasks   = [] } = useGetActiveTasksQuery();
  const { data: vendors = [] } = useGetActiveVendorsQuery();
  const [createBill, { isLoading }] = useCreateBillMutation();

  const [siteId,        setSiteId]        = useState('');
  const [vendorId,      setVendorId]      = useState('');
  const [description,   setDescription]   = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [status,        setStatus]        = useState<'pending' | 'approved' | 'paid'>('pending');
  const [error,         setError]         = useState('');
  const [lineItems,     setLineItems]     = useState<LineItemState[]>([]);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [draft,         setDraft]         = useState<LineItemState>(emptyDraft());

  const siteOptions   = sites.map((s) => ({ value: s.id, label: `${s.name} — ${s.location}` }));
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const taskOptions   = tasks.map((t) => ({
    value: t.id,
    label: `${t.name} · ${t.unit}${t.unitCost ? ` · Rs. ${Number(t.unitCost).toLocaleString()}/unit` : ''}`,
  }));

  function calcAmount(li: LineItemState): number | null {
    const qty = parseFloat(li.quantity);
    if (!qty || isNaN(qty)) return null;
    if (li.isCustom) {
      const cost = parseFloat(li.customTaskUnitCost);
      return (!cost || isNaN(cost)) ? null : cost * qty;
    }
    const task = tasks.find((t) => t.id === li.taskId);
    if (!task?.unitCost) return null;
    return parseFloat(task.unitCost) * qty;
  }

  const runningTotal = lineItems.reduce((sum, li) => sum + (calcAmount(li) ?? 0), 0);
  const draftAmount  = calcAmount(draft);

  const draftValid = draft.isCustom
    ? !!draft.customTaskName && !!draft.customTaskUnit && !!draft.customTaskUnitCost && !!draft.quantity
    : !!draft.taskId && !!draft.quantity;

  function openModal() { setDraft(emptyDraft()); setModalOpen(true); }

  function confirmDraft() {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setLineItems((prev) => [...prev, { ...draft, id }]);
    setModalOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createBill({
        siteId,
        vendorId,
        lineItems: lineItems.map((li) =>
          li.isCustom
            ? { customTaskName: li.customTaskName, customTaskUnit: li.customTaskUnit, customTaskUnitCost: li.customTaskUnitCost, quantity: li.quantity }
            : { taskId: li.taskId, quantity: li.quantity }
        ),
        ...(description   ? { description }   : {}),
        ...(attachmentUrl ? { attachmentUrl }  : {}),
        ...(showStatus    ? { status }         : {}),
      }).unwrap();
      router.push(redirectPath);
    } catch (err: any) {
      setError(err?.data?.message ?? 'Failed to submit bill');
    }
  }

  const canSubmit = !isLoading && !!siteId && !!vendorId && lineItems.length > 0;

  function getTaskLabel(li: LineItemState) {
    return li.isCustom ? li.customTaskName : (tasks.find((t) => t.id === li.taskId)?.name ?? '—');
  }
  function getUnit(li: LineItemState) {
    return li.isCustom ? li.customTaskUnit : (tasks.find((t) => t.id === li.taskId)?.unit ?? '—');
  }
  function getRate(li: LineItemState) {
    if (li.isCustom) return li.customTaskUnitCost ? `Rs. ${Number(li.customTaskUnitCost).toLocaleString()}` : '—';
    const task = tasks.find((t) => t.id === li.taskId);
    return task?.unitCost ? `Rs. ${Number(task.unitCost).toLocaleString()}` : '—';
  }

  const draftSelectedTask = tasks.find((t) => t.id === draft.taskId);

  return (
    <>
      <PageHeader title="Submit Bill" subtitle="Fill in the details on the left, add tasks on the right" />

      <form onSubmit={handleSubmit}>
        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <div className="flex gap-6 items-start">

          {/* ── LEFT: bill details (sticky) ───────────────────────────────── */}
          <div className="shrink-0" style={{ width: 420, position: 'sticky', top: 24 }}>
            <div className="card p-6 space-y-4">
              <SearchableSelect
                label="Site"
                value={siteId}
                onChange={setSiteId}
                options={siteOptions}
                placeholder="Select site…"
              />
              <SearchableSelect
                label="Vendor"
                value={vendorId}
                onChange={setVendorId}
                options={vendorOptions}
                placeholder="Select vendor…"
              />

              {showStatus && (
                <Select
                  label="Status"
                  value={status}
                  onChange={(val) => setStatus(val as 'pending' | 'approved' | 'paid')}
                  options={[
                    { value: 'pending',  label: 'Pending'  },
                    { value: 'approved', label: 'Approved' },
                    { value: 'paid',     label: 'Paid'     },
                  ]}
                />
              )}

              <Textarea
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />

              <ReceiptUpload
                onUploadComplete={(url) => setAttachmentUrl(url)}
                onClear={() => setAttachmentUrl('')}
              />

              {error && (
                <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#fdf0ed', color: 'var(--rust)' }}>
                  {error}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" loading={isLoading} disabled={!canSubmit}>
                  {isLoading ? 'Submitting…' : 'Submit Bill'}
                </Button>
              </div>
            </div>
          </div>

          {/* ── RIGHT: line items ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
                    Line Items
                  </h2>
                  {lineItems.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {lineItems.length} task{lineItems.length !== 1 ? 's' : ''} added
                    </p>
                  )}
                </div>
                <Button type="button" variant="primary" onClick={openModal}>
                  <Plus size={14} /> Add Task
                </Button>
              </div>

              {lineItems.length === 0 ? (
                <TableEmpty message='No tasks added yet. Click "Add Task" to begin.' />
              ) : (
                <>
                  <Table>
                    <THead>
                      <tr>
                        <Th>#</Th>
                        <Th>Task</Th>
                        <Th>Unit</Th>
                        <Th>Qty</Th>
                        <Th>Rate</Th>
                        <Th>Amount (PKR)</Th>
                        <Th right />
                      </tr>
                    </THead>
                    <TBody>
                      {lineItems.map((li, idx) => {
                        const amt = calcAmount(li);
                        return (
                          <Tr key={li.id}>
                            <Td mono muted>{idx + 1}</Td>
                            <Td>
                              <p className="font-medium" style={{ color: 'var(--navy)' }}>{getTaskLabel(li)}</p>
                              {li.isCustom && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Custom</p>
                              )}
                            </Td>
                            <Td muted>{getUnit(li)}</Td>
                            <Td mono muted>{Number(li.quantity).toLocaleString()}</Td>
                            <Td mono muted>{getRate(li)}</Td>
                            <Td mono bold>{amt !== null ? `Rs. ${amt.toLocaleString()}` : '—'}</Td>
                            <Td right>
                              <button
                                type="button"
                                onClick={() => setLineItems((prev) => prev.filter((x) => x.id !== li.id))}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: 'var(--rust)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#fdf0ed')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </Table>

                  {/* Bill total */}
                  <div
                    className="mt-4 flex items-center justify-end gap-4 px-5 py-3.5 rounded-xl"
                    style={{ background: 'var(--navy)' }}
                  >
                    <span className="text-sm font-semibold text-white" style={{ opacity: 0.65 }}>
                      Bill Total
                    </span>
                    <span className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                      Rs. {runningTotal.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* ── Add Task modal ─────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Task"
        subtitle="Choose a predefined task or enter a custom one"
        maxWidth={480}
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {[
              { label: 'Predefined Task', value: false },
              { label: 'Custom Task',     value: true  },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setDraft({ ...emptyDraft(), isCustom: opt.value })}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: draft.isCustom === opt.value ? 'var(--navy)' : 'var(--paper)',
                  color:      draft.isCustom === opt.value ? '#fff'        : 'var(--text-secondary)',
                  border:     `1.5px solid ${draft.isCustom === opt.value ? 'var(--navy)' : 'var(--border)'}`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {draft.isCustom ? (
            <>
              <Input label="Task Name" required placeholder="e.g. Brick laying, Steel cutting…"
                value={draft.customTaskName} onChange={(e) => setDraft((d) => ({ ...d, customTaskName: e.target.value }))} />
              <Input label="Unit" required placeholder="e.g. sqft, bags, labour"
                value={draft.customTaskUnit} onChange={(e) => setDraft((d) => ({ ...d, customTaskUnit: e.target.value }))} />
              <Input label="Unit Cost (PKR / unit)" required type="number" step="0.01" min="0.01" mono placeholder="0.00"
                value={draft.customTaskUnitCost} onChange={(e) => setDraft((d) => ({ ...d, customTaskUnitCost: e.target.value }))} />
            </>
          ) : (
            <SearchableSelect
              label="Task"
              value={draft.taskId}
              onChange={(val) => setDraft((d) => ({ ...d, taskId: val, quantity: '' }))}
              options={taskOptions}
              placeholder="Search tasks…"
            />
          )}

          <Input
            label={`Quantity${draft.isCustom && draft.customTaskUnit ? ` (${draft.customTaskUnit})` : draftSelectedTask ? ` (${draftSelectedTask.unit})` : ''}`}
            required type="number" step="0.01" min="0.01" mono placeholder="0"
            value={draft.quantity} onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
          />

          {draftAmount !== null && (
            <div className="rounded-xl px-4 py-3" style={{ background: '#edf7f2', border: '1.5px dashed var(--green)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--green)' }}>
                Line item amount
              </p>
              <p className="text-xl font-bold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-mono)' }}>
                Rs. {draftAmount.toLocaleString()}
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!draftValid} onClick={confirmDraft}>
              <Plus size={14} /> Add to Bill
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
