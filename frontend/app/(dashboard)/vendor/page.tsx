'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VendorRoot() {
  const router = useRouter();
  useEffect(() => { router.replace('/vendor/my-invoices'); }, [router]);
  return null;
}
