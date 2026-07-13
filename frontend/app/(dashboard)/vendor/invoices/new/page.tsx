'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { useGetTasksQuery } from '@/lib/api/tasksApi';
import { useCreateInvoiceMutation } from '@/lib/api/invoicesApi';
import {
  Button, Input, Textarea, Select,
  PageHeader,
} from '@/components/ui';

export default function NewInvoicePage() {
  const router = useRouter();
  const { data: sites = [] } = useGetActiveSitesQuery();
  const { data: tasks = [] } = useGetTasksQuery({ active: true });
  const [siteId, setSiteId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const [createInvoice, { isLoading }] = useCreateInvoiceMutation();

  const selectedTask = tasks.find((t) => t.id === taskId);
  const isCustom = selectedTask?.isCustom ?? false;
  const previewAmount =
    selectedTask && !isCustom && selectedTask.unitCost && quantity
      ? (parseFloat(selectedTask.unitCost) * parseFloat(quantity))
      : null;

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const taskOptions = tasks.map((t) => ({
    value: t.id,
    label: `${t.name} · ${t.unit}${t.unitCost ? ` · Rs. ${Number(t.unitCost).toLocaleString()}/unit` : ' (custom amount)'}`,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createInvoice({
        siteId,
        taskId,
        quantity,
        ...(isCustom ? { amount } : {}),
        ...(description ? { description } : {}),
      }).unwrap();
      router.push('/vendor/invoices');
    } catch (err: any) {
      setError(err?.data?.message ?? 'Failed to submit invoice');
    }
  }

  return (
    <div>
      <PageHeader
        title="Submit Invoice"
        subtitle="Select a site and task to submit your invoice"
      />

      <div className="card p-7" style={{ maxWidth: '520px' }}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Select
            label="Site"
            value={siteId}
            onChange={setSiteId}
            options={siteOptions}
            placeholder="Select site…"
          />

          <Select
            label="Task"
            value={taskId}
            onChange={setTaskId}
            options={taskOptions}
            placeholder="Select task…"
          />

          {taskId && (
            <Input
              label={`Quantity (${selectedTask?.unit ?? ''})`}
              required
              type="number"
              step="0.01"
              min="0.01"
              mono
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          )}

          {isCustom && taskId && (
            <Input
              label="Total Amount (PKR)"
              required
              type="number"
              step="0.01"
              min="0.01"
              mono
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}

          {previewAmount !== null && (
            <div className="rounded-xl px-4 py-3.5" style={{ background: '#edf7f2', border: '1.5px dashed var(--green)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--green)' }}>Auto-calculated amount</p>
              <p className="font-ledger text-xl font-semibold" style={{ color: 'var(--navy)' }}>
                Rs. {previewAmount.toLocaleString()}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Locked on submission — cannot be edited</p>
            </div>
          )}

          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#fdf0ed', color: 'var(--rust)' }}>{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button
              type="submit"
              loading={isLoading}
              disabled={isLoading || !siteId || !taskId || !quantity}
            >
              {isLoading ? 'Submitting…' : 'Submit Invoice'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
