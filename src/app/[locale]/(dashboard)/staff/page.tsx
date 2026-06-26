import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { listStaff } from '@/lib/data';
import { StaffManager } from '@/components/staff/staff-manager';

export default async function StaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'staff:manage')) redirect(`/${locale}/account`);

  const staff = await listStaff();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Manage admin console accounts, roles and access
        </p>
      </div>
      <StaffManager staff={staff} currentUserId={session.uid} />
    </div>
  );
}
