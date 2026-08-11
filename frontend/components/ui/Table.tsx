import { ReactNode } from 'react';

/* ── Table shell ────────────────────────────────────────── */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}

/* ── Head ───────────────────────────────────────────────── */
export function THead({ children }: { children: ReactNode }) {
  return <thead style={{ background: 'var(--paper)', borderBottom: '1px solid var(--border)' }}>{children}</thead>;
}

/* ── Body ───────────────────────────────────────────────── */
export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

/* ── Header cell ────────────────────────────────────────── */
export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
    >
      {children}
    </th>
  );
}

/* ── Row ────────────────────────────────────────────────── */
export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : ''}
      style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#faf9f6')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </tr>
  );
}

/* ── Data cell ──────────────────────────────────────────── */
interface TdProps {
  children?: ReactNode;
  right?: boolean;
  mono?: boolean;
  muted?: boolean;
  bold?: boolean;
}

export function Td({ children, right, mono, muted, bold }: TdProps) {
  return (
    <td
      className={`px-5 py-4 ${right ? 'text-right' : ''}`}
      style={{
        color: muted ? 'var(--text-muted)' : 'var(--navy)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
        fontWeight: bold ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}

/* ── Empty state ────────────────────────────────────────── */
export function TableEmpty({ message = 'No data found.' }: { message?: string }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
    </div>
  );
}

/* ── Loading ────────────────────────────────────────────── */
export function TableLoading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-16">
      <svg
        className="animate-spin"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="16" cy="16" r="13" stroke="var(--border)" strokeWidth="3" />
        <path
          d="M16 3a13 13 0 0 1 13 13"
          stroke="var(--navy)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
    </div>
  );
}
