'use client';
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import * as Label from '@radix-ui/react-label';

const inputClass =
  'w-full border-[1.5px] border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-black bg-white outline-none transition-colors focus:border-[var(--navy)] placeholder:text-[var(--text-muted)]';

/* ── Input ─────────────────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, mono, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <Label.Root
            htmlFor={inputId}
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            {label}
          </Label.Root>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${inputClass} ${mono ? 'font-mono' : ''} ${error ? 'border-[var(--rust)]' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-xs mt-1" style={{ color: 'var(--rust)' }}>{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

/* ── Textarea ───────────────────────────────────────────── */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <Label.Root
            htmlFor={inputId}
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            {label}
          </Label.Root>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`${inputClass} resize-none ${error ? 'border-[var(--rust)]' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-xs mt-1" style={{ color: 'var(--rust)' }}>{error}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
