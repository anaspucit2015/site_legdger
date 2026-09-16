'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
      router.replace('/login');
      return;
    }
    const roleHome: Record<string, string> = {
      admin: '/admin',
      site_supervisor: '/site-supervisor/my-invoices',
      accountant: '/accountant/invoices',
    };
    router.replace(roleHome[user.role] ?? '/login');
  }, [router]);

  return null;
}
