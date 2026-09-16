'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, total, limit, onChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-1 pt-4">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {from}–{to} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--white)',
            color: page === 1 ? 'var(--text-muted)' : 'var(--navy)',
            cursor: page === 1 ? 'not-allowed' : 'pointer',
            opacity: page === 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={14} />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | '…')[]>((acc, p, i, arr) => {
            if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all"
                style={{
                  background: p === page ? 'var(--navy)' : 'var(--white)',
                  color:      p === page ? '#fff'       : 'var(--navy)',
                  border:     p === page ? 'none'       : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            )
          )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--white)',
            color: page === totalPages ? 'var(--text-muted)' : 'var(--navy)',
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
            opacity: page === totalPages ? 0.4 : 1,
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
