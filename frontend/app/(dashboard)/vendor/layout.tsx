'use client';
import { AuthGuard } from '@/components/auth-guard';

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={['vendor']}>{children}</AuthGuard>;
}
