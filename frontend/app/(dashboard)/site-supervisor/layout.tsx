'use client';
import { AuthGuard } from '@/components/auth-guard';

export default function SiteSupervisorLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={['site_supervisor']}>{children}</AuthGuard>;
}
