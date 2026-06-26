import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { listSupportTickets, listSosAlerts } from '@/lib/data';
import { SupportManager } from '@/components/support/support-manager';

export default async function SupportPage({
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

  const [tickets, sos] = await Promise.all([
    listSupportTickets(),
    listSosAlerts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <p className="text-sm text-muted-foreground">
          Triage support requests and respond to SOS alerts
        </p>
      </div>
      <SupportManager tickets={tickets} sos={sos} canSos={can(role, 'sos:ack')} />
    </div>
  );
}
