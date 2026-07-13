'use client';
import * as Label from '@radix-ui/react-label';
import { ChevronDown } from 'lucide-react';

export type SelectOption = { value: string; label: string };

interface SelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  id?: string;
}

export function Select({ label, placeholder = 'Select…', value, onChange, options, error, id }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && (
        <Label.Root
          htmlFor={selectId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          {label}
        </Label.Root>
      )}
      <div className="relative w-full">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-9 outline-none transition-colors"
          style={{
            border: `1.5px solid ${error ? 'var(--rust)' : 'var(--border)'}`,
            fontFamily: 'var(--font-body)',
            color: value ? '#000' : 'var(--text-muted)',
            background: 'white',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--navy)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = error ? 'var(--rust)' : 'var(--border)')}
        >
          {placeholder && (
            <option value="" disabled hidden>{placeholder}</option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>
      {error && <p className="text-xs mt-1" style={{ color: 'var(--rust)' }}>{error}</p>}
    </div>
  );
}

/* ── Native select (for simple filters in headers) ───── */
interface NativeSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function NativeSelect({ value, onChange, options, placeholder }: NativeSelectProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg px-3 py-2 pr-8 text-sm outline-none transition-colors"
        style={{
          border: '1.5px solid var(--border)',
          fontFamily: 'var(--font-body)',
          color: value ? '#000' : 'var(--text-muted)',
          background: 'white',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--navy)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
    </div>
  );
}
