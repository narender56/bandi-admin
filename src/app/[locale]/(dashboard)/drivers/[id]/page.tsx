import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { getDriverProfile } from '@/lib/data';
import { DriverProfileView } from '@/components/drivers/driver-profile';

export default async function DriverProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'profiles:view')) redirect(`/${locale}/account`);

  const driver = await getDriverProfile(id);
  if (!driver) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/drivers`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to drivers
      </Link>
      <DriverProfileView
        driver={driver}
        locale={locale}
        flags={{
          canOnboard: can(role, 'drivers:onboard'),
          canBlock: can(role, 'users:block'),
          canSeeRides: role !== 'support',
          canRecharge: can(role, 'wallet:manage'),
        }}
      />
    </div>
  );
}
