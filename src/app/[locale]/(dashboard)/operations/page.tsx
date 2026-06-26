import { redirect } from 'next/navigation';
import { AlertTriangle, Bike, CreditCard, ReceiptText, UserCheck } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { getOperationsDashboard } from '@/lib/data';
import { Card, CardContent } from '@/components/ui/card';
import { OperationsManager } from '@/components/operations/operations-manager';

export default async function OperationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'operations:manage')) redirect(`/${locale}`);

  const dashboard = await getOperationsDashboard();
  const active = dashboard.counts.open + dashboard.counts.in_review;
  const tiles = [
    { label: 'Needs attention', value: active, icon: AlertTriangle, tone: 'text-danger bg-danger/10' },
    { label: 'Ride reviews', value: dashboard.categoryCounts.ride, icon: Bike, tone: 'text-warning bg-warning/10' },
    { label: 'Billing issues', value: dashboard.categoryCounts.billing, icon: CreditCard, tone: 'text-primary bg-primary/10' },
    { label: 'Subscriptions', value: dashboard.categoryCounts.subscription, icon: ReceiptText, tone: 'text-chart-3 bg-chart-3/10' },
    { label: 'Onboarding', value: dashboard.categoryCounts.onboarding, icon: UserCheck, tone: 'text-success bg-success/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operations queue</h1>
        <p className="text-sm text-muted-foreground">
          Review marketplace exceptions, assign ownership, and record auditable outcomes
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className={`flex size-9 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <OperationsManager
        cases={dashboard.cases}
        counts={dashboard.counts}
        locale={locale}
        currentUserId={session.uid}
      />
    </div>
  );
}
