'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountantRoot() {
  const router = useRouter();
  useEffect(() => { router.replace('/accountant/invoices'); }, [router]);
  return null;
}
