'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser, AuthUser } from '@/lib/auth';
import { ensureCacheForUser } from '@/lib/db/offlineDb';

type Props = {
  children: React.ReactNode;
  allowedRoles?: AuthUser['role'][];
};

export function AuthGuard({ children, allowedRoles }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
      router.replace('/login');
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      const home: Record<string, string> = {
        admin: '/admin',
        site_supervisor: '/site-supervisor/my-invoices',
        accountant: '/accountant/invoices',
      };
      router.replace(home[user.role] ?? '/login');
      return;
    }
    void ensureCacheForUser(user.id);
    setReady(true);
  }, [router, allowedRoles]);

  if (!ready) return null;
  return <>{children}</>;
}
