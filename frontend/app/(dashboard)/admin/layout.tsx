'use client';
import { AuthGuard } from '@/components/auth-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={['admin', 'accountant']}>{children}</AuthGuard>;
}
