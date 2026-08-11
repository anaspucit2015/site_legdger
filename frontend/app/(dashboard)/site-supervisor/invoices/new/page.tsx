'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { useGetTasksQuery } from '@/lib/api/tasksApi';
import { useGetActiveVendorsQuery } from '@/lib/api/vendorsApi';
import { useCreateInvoiceMutation } from '@/lib/api/invoicesApi';
import {
  Button, Input, Textarea, Select,
  PageHeader,
} from '@/components/ui';
import { ReceiptUpload } from '@/components/receipt-upload';

export default function NewInvoicePage() {
  const router = useRouter();
  const { data: sites = [] } = useGetActiveSitesQuery();
  const { data: tasks = [] } = useGetTasksQuery({ active: true });
  const { data: vendors = [] } = useGetActiveVendorsQuery();

  const [siteId, setSiteId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [error, setError] = useState('');

  // Custom task mode
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customTaskName, setCustomTaskName] = useState('');
  const [customTaskUnit, setCustomTaskUnit] = useState('');
  const [customTaskUnitCost, setCustomTaskUnitCost] = useState('');

  const [createInvoice, { isLoading }] = useCreateInvoiceMutation();

  const selectedTask = tasks.find((t) => t.id === taskId);
  const isLegacyCustom = selectedTask?.isCustom ?? false;

  // Auto-calculated amount for predefined tasks
  const previewAmount =
    !isCustomMode && selectedTask && !isLegacyCustom && selectedTask.unitCost && quantity
      ? parseFloat(selectedTask.unitCost) * parseFloat(quantity)
      : null;

  // Auto-calculated amount for custom tasks
  const customPreviewAmount =
    isCustomMode && customTaskUnitCost && quantity
      ? parseFloat(customTaskUnitCost) * parseFloat(quantity)
      : null;

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const taskOptions = tasks.map((t) => ({
    value: t.id,
    label: `${t.name} · ${t.unit}${t.unitCost ? ` · Rs. ${Number(t.unitCost).toLocaleString()}/unit` : ' (custom amount)'}`,
  }));

  function handleToggleCustomMode() {
    setIsCustomMode((prev) => !prev);
    // Reset the other mode's fields
    setTaskId('');
    setQuantity('');
    setAmount('');
    setCustomTaskName('');
    setCustomTaskUnit('');
    setCustomTaskUnitCost('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (isCustomMode) {
        await createInvoice({
          siteId,
          vendorId,
          customTaskName,
          customTaskUnit,
          customTaskUnitCost,
          quantity,
          ...(description ? { description } : {}),
          ...(attachmentUrl ? { attachmentUrl } : {}),
        }).unwrap();
      } else {
        await createInvoice({
          siteId,
          vendorId,
          taskId,
          quantity,
          ...(isLegacyCustom ? { amount } : {}),
          ...(description ? { description } : {}),
          ...(attachmentUrl ? { attachmentUrl } : {}),
        }).unwrap();
      }
      router.push('/site-supervisor/my-invoices');
    } catch (err: any) {
      setError(err?.data?.message ?? 'Failed to submit invoice');
    }
  }

  const canSubmit = isCustomMode
    ? !isLoading && !!siteId && !!vendorId && !!customTaskName && !!customTaskUnit && !!customTaskUnitCost && !!quantity
    : !isLoading && !!siteId && !!vendorId && !!taskId && !!quantity && (!isLegacyCustom || !!amount);

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
            label="Vendor"
            value={vendorId}
            onChange={setVendorId}
            options={vendorOptions}
            placeholder="Select vendor…"
          />

          {!isCustomMode && (
            <Select
              label="Task"
              value={taskId}
              onChange={setTaskId}
              options={taskOptions}
              placeholder="Select task…"
            />
          )}

          {/* Custom task toggle */}
          <label className="flex items-center gap-2 cursor-pointer" style={{ width: 'fit-content' }}>
            <input
              type="checkbox"
              checked={isCustomMode}
              onChange={handleToggleCustomMode}
              className="w-4 h-4 cursor-pointer"
              style={{ accentColor: 'var(--navy)' }}
            />
            <span className="text-sm font-medium" style={{ color: 'var(--navy)' }}>Custom task</span>
          </label>

          {/* Custom task fields */}
          {isCustomMode && (
            <div className="space-y-4 rounded-xl p-4" style={{ background: '#f5f6fa', border: '1.5px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Custom Task</p>
              <Input
                label="Task Name"
                required
                placeholder="e.g. Brick laying, Plastering…"
                value={customTaskName}
                onChange={(e) => setCustomTaskName(e.target.value)}
              />
              <Input
                label="Unit"
                required
                placeholder="e.g. sqft, bags, labor"
                value={customTaskUnit}
                onChange={(e) => setCustomTaskUnit(e.target.value)}
              />
              <Input
                label="Unit Cost (PKR / unit)"
                required
                type="number"
                step="0.01"
                min="0.01"
                mono
                placeholder="0.00"
                value={customTaskUnitCost}
                onChange={(e) => setCustomTaskUnitCost(e.target.value)}
              />
            </div>
          )}

          {/* Quantity */}
          {(taskId || isCustomMode) && (
            <Input
              label={`Quantity${isCustomMode && customTaskUnit ? ` (${customTaskUnit})` : selectedTask ? ` (${selectedTask.unit})` : ''}`}
              required
              type="number"
              step="0.01"
              min="0.01"
              mono
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          )}

          {/* Legacy custom task: manual amount */}
          {isLegacyCustom && taskId && (
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

          {/* Auto-calculated totals */}
          {(previewAmount !== null || customPreviewAmount !== null) && (
            <div className="rounded-xl px-4 py-3.5" style={{ background: '#edf7f2', border: '1.5px dashed var(--green)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--green)' }}>Auto-calculated amount</p>
              <p className="font-ledger text-xl font-semibold" style={{ color: 'var(--navy)' }}>
                Rs. {(previewAmount ?? customPreviewAmount!).toLocaleString()}
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

          <ReceiptUpload
            onUploadComplete={(url) => setAttachmentUrl(url)}
            onClear={() => setAttachmentUrl('')}
          />

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#fdf0ed', color: 'var(--rust)' }}>{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button
              type="submit"
              loading={isLoading}
              disabled={!canSubmit}
            >
              {isLoading ? 'Submitting…' : 'Submit Invoice'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
