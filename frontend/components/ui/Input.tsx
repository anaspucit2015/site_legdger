'use client';
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useState } from 'react';
import * as Label from '@radix-ui/react-label';
import { Eye, EyeOff } from 'lucide-react';

const inputClass =
  'w-full border-[1.5px] border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-black bg-white outline-none transition-colors focus:border-[var(--navy)] placeholder:text-[var(--text-muted)]';

/* ── Input ─────────────────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, mono, className = '', id, type, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;
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
        <div className={isPassword ? 'relative' : undefined}>
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            className={`${inputClass} ${mono ? 'font-mono' : ''} ${error ? 'border-[var(--rust)]' : ''} ${isPassword ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3"
              style={{ color: 'var(--text-muted)' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
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
