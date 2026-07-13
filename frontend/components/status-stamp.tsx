type Status = 'pending' | 'approved' | 'rejected' | 'paid';

const config: Record<Status, { label: string; bg: string; color: string; dot: string }> = {
  pending:  { label: 'Pending',  bg: '#FFF8EC', color: '#B87A1A', dot: '#E8A33D' },
  approved: { label: 'Approved', bg: '#EDF7F2', color: '#1E6E49', dot: '#2F9E6E' },
  rejected: { label: 'Rejected', bg: '#FDF0ED', color: '#9E3A21', dot: '#C4522E' },
  paid:     { label: 'Paid',     bg: '#EEF2F7', color: '#1B3A5C', dot: '#1B3A5C' },
};

export function StatusStamp({ status }: { status: Status }) {
  const c = config[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px 3px 8px',
        borderRadius: '999px',
        background: c.bg,
        color: c.color,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, display: 'inline-block' }} />
      {c.label}
    </span>
  );
}
