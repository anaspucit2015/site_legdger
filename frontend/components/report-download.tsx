'use client';
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useGetActiveSitesQuery } from '@/lib/api/sitesApi';
import { Button, PageHeader, Select } from '@/components/ui';
import { getToken } from '@/lib/auth';

function ClearableSelect({
  label, value, onChange, options, placeholder, loading,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; loading?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {loading ? `Loading ${label.toLowerCase()}…` : label}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-0.5 text-xs"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        placeholder={loading ? 'Loading…' : placeholder}
      />
    </div>
  );
}

type Person = { id: string; name: string };
type Preset = 'daily' | 'weekly' | 'monthly' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'daily',   label: 'Today'        },
  { value: 'weekly',  label: 'This Week'    },
  { value: 'monthly', label: 'This Month'   },
  { value: 'custom',  label: 'Custom Range' },
];

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now   = new Date();
  const toStr = now.toISOString().slice(0, 10);
  if (preset === 'daily')   return { from: toStr, to: toStr };
  if (preset === 'weekly') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: monday.toISOString().slice(0, 10), to: toStr };
  }
  if (preset === 'monthly') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    return { from, to: toStr };
  }
  return { from: '', to: '' };
}

export function ReportDownload() {
  const { data: sites = [] } = useGetActiveSitesQuery();

  const [siteId,        setSiteId]        = useState('');
  const [vendorId,      setVendorId]      = useState('');
  const [supervisorId,  setSupervisorId]  = useState('');
  const [status,        setStatus]        = useState('');
  const [vendors,       setVendors]       = useState<Person[]>([]);
  const [supervisors,   setSupervisors]   = useState<Person[]>([]);
  const [loadingVendors,      setLoadingVendors]      = useState(false);
  const [loadingSupervisors,  setLoadingSupervisors]  = useState(false);
  const [preset,        setPreset]        = useState<Preset>('monthly');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [downloading,   setDownloading]   = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    if (preset !== 'custom') {
      const { from, to } = getPresetRange(preset);
      setDateFrom(from);
      setDateTo(to);
    }
  }, [preset]);

  useEffect(() => {
    async function loadVendors() {
      setLoadingVendors(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/reports/vendors`,
          { headers: { Authorization: `Bearer ${getToken()}` } },
        );
        setVendors(await res.json());
      } finally {
        setLoadingVendors(false);
      }
    }
    async function loadSupervisors() {
      setLoadingSupervisors(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/reports/supervisors`,
          { headers: { Authorization: `Bearer ${getToken()}` } },
        );
        setSupervisors(await res.json());
      } finally {
        setLoadingSupervisors(false);
      }
    }
    loadVendors();
    loadSupervisors();
  }, []);

  const siteOptions       = sites.map((s) => ({ value: s.id, label: s.name }));
  const vendorOptions     = vendors.map((v) => ({ value: v.id, label: v.name }));
  const supervisorOptions = supervisors.map((s) => ({ value: s.id, label: s.name }));

  const canDownload = !!dateFrom && !!dateTo;

  async function handleDownload() {
    setError('');
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (siteId)       params.set('siteId',       siteId);
      if (vendorId)     params.set('vendorId',     vendorId);
      if (supervisorId) params.set('supervisorId', supervisorId);
      if (status)       params.set('status',       status);
      if (dateFrom)     params.set('dateFrom',     dateFrom);
      if (dateTo)       params.set('dateTo',       dateTo);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/combined?${params}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? 'Failed to generate report.');
        return;
      }

      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `report-${dateFrom}-to-${dateTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to generate report.');
    } finally {
      setDownloading(false);
    }
  }

  const summaryParts = [
    siteId       ? sites.find((s) => s.id === siteId)?.name              : 'All sites',
    supervisorId ? supervisors.find((s) => s.id === supervisorId)?.name  : 'All supervisors',
    vendorId     ? vendors.find((v) => v.id === vendorId)?.name          : 'All vendors',
    status       ? status.charAt(0).toUpperCase() + status.slice(1)      : 'All statuses',
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Filter and download a combined bills & invoices report as Excel"
      />

      <div className="card p-7" style={{ maxWidth: '560px' }}>
        <div className="space-y-6">

          {/* ── Filters ─────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
              Filters (optional)
            </p>
            <div className="space-y-4">
              <ClearableSelect
                label="Site"
                value={siteId}
                onChange={setSiteId}
                options={siteOptions}
                placeholder="All sites"
              />
              <ClearableSelect
                label="Site Supervisor"
                value={supervisorId}
                onChange={setSupervisorId}
                options={supervisorOptions}
                placeholder="All supervisors"
                loading={loadingSupervisors}
              />
              <ClearableSelect
                label="Vendor"
                value={vendorId}
                onChange={setVendorId}
                options={vendorOptions}
                placeholder="All vendors"
                loading={loadingVendors}
              />
              <ClearableSelect
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'pending',  label: 'Pending'  },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'paid',     label: 'Paid'     },
                ]}
                placeholder="All statuses"
              />
            </div>
          </div>

          {/* ── Date range ──────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
              Date Range
            </p>
            <div className="flex gap-2 flex-wrap mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer"
                  style={{
                    background: preset === p.value ? 'var(--navy)' : 'var(--paper)',
                    color:      preset === p.value ? '#fff'        : 'var(--text-secondary)',
                    border:     `1.5px solid ${preset === p.value ? 'var(--navy)' : 'var(--border)'}`,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  From
                </label>
                <input
                  type="date"
                  className="sl-input"
                  value={dateFrom}
                  onChange={(e) => { setPreset('custom'); setDateFrom(e.target.value); }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  To
                </label>
                <input
                  type="date"
                  className="sl-input"
                  value={dateTo}
                  onChange={(e) => { setPreset('custom'); setDateTo(e.target.value); }}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#fdf0ed', color: 'var(--rust)' }}>
              {error}
            </p>
          )}

          {/* ── Download ─────────────────────────────────── */}
          <div className="flex items-center justify-between gap-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {summaryParts.join(' · ')}
              {dateFrom && ` · ${dateFrom} → ${dateTo}`}
            </p>
            <Button
              onClick={handleDownload}
              disabled={!canDownload || downloading}
              loading={downloading}
            >
              <Download size={14} />
              {downloading ? 'Generating…' : 'Download'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
