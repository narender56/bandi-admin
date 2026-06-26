import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { listWebsiteLeads } from '@/lib/data';
import { WebsiteRequestsManager } from '@/components/requests/website-requests-manager';

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'support:manage')) redirect(`/${locale}`);

  const leads = await listWebsiteLeads();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Website requests</h1>
        <p className="text-sm text-muted-foreground">
          Review contact messages and driver onboarding interest from the public website.
        </p>
      </div>
      <WebsiteRequestsManager leads={leads} />
    </div>
  );
}
