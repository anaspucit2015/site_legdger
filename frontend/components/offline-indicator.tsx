'use client';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 mb-4 rounded-lg text-xs font-medium w-fit"
      style={{ background: 'rgba(197,90,60,0.12)', color: 'var(--rust)' }}
    >
      <WifiOff size={13} />
      Offline — showing cached data
    </div>
  );
}
