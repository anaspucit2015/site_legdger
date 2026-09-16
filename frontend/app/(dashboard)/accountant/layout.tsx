'use client';
import { AuthGuard } from '@/components/auth-guard';

export default function AccountantLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={['accountant']}>{children}</AuthGuard>;
}
