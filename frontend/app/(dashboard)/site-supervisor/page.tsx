'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SiteSupervisorRoot() {
  const router = useRouter();
  useEffect(() => { router.replace('/site-supervisor/my-invoices'); }, [router]);
  return null;
}
