'use client';
import * as Label from '@radix-ui/react-label';
import { ChevronDown, Search, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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

/* ── Searchable select (custom dropdown with filter input) ───── */
interface SearchableSelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
}

export function SearchableSelect({
  label, placeholder = 'Select…', value, onChange, options, error,
}: SearchableSelectProps) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const containerRef      = useRef<HTMLDivElement>(null);
  const searchRef         = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  function select(val: string) {
    onChange(val);
    setOpen(false);
    setQuery('');
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setQuery('');
  }

  const selectId = label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <Label.Root
          htmlFor={selectId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          {label}
        </Label.Root>
      )}

      {/* Trigger */}
      <button
        type="button"
        id={selectId}
        onClick={() => { setOpen((o) => !o); }}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-left outline-none transition-colors"
        style={{
          border: `1.5px solid ${open ? 'var(--navy)' : error ? 'var(--rust)' : 'var(--border)'}`,
          fontFamily: 'var(--font-body)',
          background: 'white',
          color: selected ? '#000' : 'var(--text-muted)',
        }}
      >
        <span className="flex-1 truncate">{selected ? selected.label : placeholder}</span>
        {selected && (
          <span
            className="shrink-0 p-0.5 rounded hover:bg-gray-100"
            onMouseDown={clear}
          >
            <X size={12} style={{ color: 'var(--text-muted)' }} />
          </span>
        )}
        <ChevronDown
          size={14}
          className="shrink-0"
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 mt-1 rounded-xl overflow-hidden"
          style={{
            width: containerRef.current?.offsetWidth,
            background: 'white',
            border: '1.5px solid var(--border)',
            boxShadow: '0 8px 24px rgba(27,42,74,0.12)',
          }}
        >
          {/* Search input */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 outline-none text-sm bg-transparent"
              style={{ color: 'var(--navy)', fontFamily: 'var(--font-body)' }}
              onKeyDown={(e) => e.key === 'Escape' && (setOpen(false), setQuery(''))}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}>
                <X size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                No results
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: o.value === value ? 'rgba(232,163,61,0.12)' : 'transparent',
                    color: o.value === value ? 'var(--navy)' : 'var(--text-secondary)',
                    fontWeight: o.value === value ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (o.value !== value) e.currentTarget.style.background = 'var(--paper)';
                  }}
                  onMouseLeave={(e) => {
                    if (o.value !== value) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}

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
