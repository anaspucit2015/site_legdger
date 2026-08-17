'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { useGetActiveVendorsQuery } from '@/lib/api/vendorsApi';
import { useCreateBillMutation } from '@/lib/api/billsApi';
import {
  Button, Textarea, Select, SearchableSelect, PageHeader,
} from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';

type LineItemRow = {
  id: string;
  taskName: string;
  unit: string;
  unitCost: string;
  quantity: string;
};

function newRow(): LineItemRow {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    taskName: '',
    unit: '',
    unitCost: '',
    quantity: '',
  };
}

interface Props {
  showStatus?: boolean;
  redirectPath: string;
}

export function BillSubmitForm({ showStatus = false, redirectPath }: Props) {
  const router = useRouter();
  const { data: sites   = [] } = useGetActiveSitesQuery();
  const { data: vendors = [] } = useGetActiveVendorsQuery();
  const [createBill, { isLoading }] = useCreateBillMutation();

  const [siteId,        setSiteId]        = useState('');
  const [vendorId,      setVendorId]      = useState('');
  const [description,   setDescription]   = useState('');
  const [status,        setStatus]        = useState<'pending' | 'approved' | 'paid'>('pending');
  const [error,         setError]         = useState('');
  const [rows,          setRows]          = useState<LineItemRow[]>([newRow()]);

  const siteOptions   = sites.map((s) => ({ value: s.id, label: `${s.name} — ${s.location}` }));
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

  function updateRow(id: string, patch: Partial<LineItemRow>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function calcAmount(row: LineItemRow): number | null {
    const qty  = parseFloat(row.quantity);
    const cost = parseFloat(row.unitCost);
    if (!qty || isNaN(qty) || !cost || isNaN(cost)) return null;
    return cost * qty;
  }

  function isRowValid(row: LineItemRow): boolean {
    return !!row.taskName && !!row.unit && !!row.unitCost && !!row.quantity;
  }

  const validRows    = rows.filter(isRowValid);
  const runningTotal = validRows.reduce((sum, row) => sum + (calcAmount(row) ?? 0), 0);
  const canSubmit    = !isLoading && !!siteId && !!vendorId && validRows.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (validRows.length === 0) {
      setError('Add at least one complete line item.');
      return;
    }
    try {
      await createBill({
        siteId,
        vendorId,
        lineItems: validRows.map((row) => ({
          customTaskName: row.taskName,
          customTaskUnit: row.unit,
          customTaskUnitCost: row.unitCost,
          quantity: row.quantity,
        })),
        ...(description   ? { description }   : {}),
        ...(showStatus    ? { status }         : {}),
      }).unwrap();
      router.push(redirectPath);
    } catch (err: any) {
      setError(err?.data?.message ?? 'Failed to submit bill');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader title="Submit Bill" subtitle="Fill in site and vendor on the left, then add line items on the right" />

      <div className="flex gap-6 items-start">

        {/* ── LEFT: bill details (sticky) ─────────────────────────────────── */}
        <div className="shrink-0" style={{ width: 420, position: 'sticky', top: 24 }}>
          <div className="card p-6 space-y-4">
            <SearchableSelect label="Site"   value={siteId}   onChange={setSiteId}   options={siteOptions}   placeholder="Select site…"   />
            <SearchableSelect label="Vendor" value={vendorId} onChange={setVendorId} options={vendorOptions} placeholder="Select vendor…" />

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

        {/* ── RIGHT: inline spreadsheet ────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="card p-6">

            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
                  Line Items
                </h2>
                {validRows.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {validRows.length} of {rows.length} row{rows.length !== 1 ? 's' : ''} complete
                  </p>
                )}
              </div>
              <Button type="button" variant="primary" onClick={() => setRows((prev) => [...prev, newRow()])}>
                <Plus size={14} /> Add Row
              </Button>
            </div>

            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 520 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['#', 'Task Name', 'Unit', 'Rate (PKR)', 'Qty', 'Amount (PKR)', ''].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '6px 10px 8px',
                          textAlign: 'left',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const amt = calcAmount(row);
                    return (
                      <tr
                        key={row.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        {/* # */}
                        <td style={cellStyle}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {idx + 1}
                          </span>
                        </td>

                        {/* Task Name */}
                        <td style={{ ...cellStyle, minWidth: 200 }}>
                          <input
                            type="text"
                            placeholder="e.g. Brick laying…"
                            value={row.taskName}
                            onChange={(e) => updateRow(row.id, { taskName: e.target.value })}
                            style={inputStyle}
                          />
                        </td>

                        {/* Unit */}
                        <td style={{ ...cellStyle, minWidth: 90 }}>
                          <input
                            type="text"
                            placeholder="sqft, bags…"
                            value={row.unit}
                            onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                            style={inputStyle}
                          />
                        </td>

                        {/* Rate */}
                        <td style={{ ...cellStyle, minWidth: 110 }}>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={row.unitCost}
                            onChange={(e) => updateRow(row.id, { unitCost: e.target.value })}
                            step="0.01"
                            min="0.01"
                            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                          />
                        </td>

                        {/* Qty */}
                        <td style={{ ...cellStyle, minWidth: 80 }}>
                          <input
                            type="number"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                            step="0.01"
                            min="0.01"
                            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                          />
                        </td>

                        {/* Amount */}
                        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: amt !== null ? 'var(--navy)' : 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {amt !== null ? `Rs. ${amt.toLocaleString()}` : '—'}
                          </span>
                        </td>

                        {/* Delete */}
                        <td style={cellStyle}>
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            style={{
                              padding: 5,
                              borderRadius: 6,
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: 'var(--rust)',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#fdf0ed')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}
                      >
                        Click &ldquo;Add Row&rdquo; to start adding tasks.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="button" variant="primary" onClick={() => setRows((prev) => [...prev, newRow()])}>
                <Plus size={14} /> Add Row
              </Button>
            </div>

            {validRows.length > 0 && (
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
            )}
          </div>
        </div>

      </div>
    </form>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '8px 10px',
  verticalAlign: 'middle',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 13,
  border: '1.5px solid var(--border)',
  borderRadius: 6,
  background: 'var(--paper)',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color 0.15s',
};
