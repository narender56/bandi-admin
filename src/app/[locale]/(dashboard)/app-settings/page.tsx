import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { getPenaltyConfig } from '@/lib/actions';
import { PenaltySettings } from '@/components/settings/penalty-settings';

export default async function AppSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  if (!can(session.role as StaffRole, 'settings:write')) redirect(`/${locale}`);

  const config = await getPenaltyConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">App settings</h1>
        <p className="text-sm text-muted-foreground">
          Cancellation &amp; no-show penalties. The master switch stays off until
          you&apos;re ready to launch them — nothing penalises riders or drivers
          while it&apos;s off. Blocked riders are managed under{' '}
          <span className="font-medium">Riders</span>.
        </p>
      </div>
      <PenaltySettings config={config} />
    </div>
  );
}
