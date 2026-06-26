import { redirect } from 'next/navigation';
import { Car, Users, UserPlus, Wallet, CheckCircle2, Radio, Siren } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { NAV_ITEMS } from '@/lib/nav';
import { formatINR } from '@/lib/utils';
import { resolveRange, getDashboardMetrics, RANGE_KEYS, RANGE_LABELS, type RangeKey } from '@/lib/metrics';
import { countActiveSos } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { RangePicker } from '@/components/dashboard/range-picker';
import { RidesChart, RevenueChart } from '@/components/dashboard/charts';

function landingFor(role: StaffRole, locale: string): string {
  const first = NAV_ITEMS.find((i) => i.href && can(role, i.capability));
  return first ? `/${locale}/${first.href}` : `/${locale}/account`;
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;

  // Support (no analytics) doesn't get the metrics dashboard — send to their work.
  if (!can(role, 'analytics:read')) redirect(landingFor(role, locale));

  const dict = getDictionary(locale);
  const sp = await searchParams;
  const rangeKey: RangeKey = (RANGE_KEYS as readonly string[]).includes(sp.range ?? '')
    ? (sp.range as RangeKey)
    : 'month';
  const range = resolveRange(rangeKey, sp.from, sp.to);
  const [m, activeSos] = await Promise.all([
    getDashboardMetrics(range),
    can(role, 'sos:ack') ? countActiveSos() : Promise.resolve(0),
  ]);

  const rangeNote =
    rangeKey === 'custom' && sp.from && sp.to
      ? `${sp.from} → ${sp.to}`
      : RANGE_LABELS[rangeKey];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dict.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {session.name.split(' ')[0]} · {rangeNote}
          </p>
        </div>
        <RangePicker current={rangeKey} from={sp.from} to={sp.to} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={dict.rides.title}
          value={m.rides.toLocaleString('en-IN')}
          sub={`${m.completedRides} completed`}
          icon={Car}
          href={`/${locale}/rides`}
          tone="primary"
        />
        <StatCard
          label="New riders"
          value={m.newRiders.toLocaleString('en-IN')}
          icon={Users}
          href={`/${locale}/riders`}
          tone="purple"
        />
        <StatCard
          label="New drivers"
          value={m.newDrivers.toLocaleString('en-IN')}
          icon={UserPlus}
          href={`/${locale}/drivers`}
          tone="amber"
        />
        <StatCard
          label="Amount collected"
          value={formatINR(m.revenue)}
          sub="subscriptions"
          icon={Wallet}
          href={`/${locale}/money`}
          tone="green"
        />
        <StatCard
          label={dict.dashboard.completedRides}
          value={m.completedRides.toLocaleString('en-IN')}
          icon={CheckCircle2}
          href={`/${locale}/rides`}
          tone="green"
        />
        <StatCard
          label={dict.dashboard.activeRides}
          value={m.activeRides.toLocaleString('en-IN')}
          sub={`${m.onlineDrivers} drivers online`}
          icon={Radio}
          href={can(role, 'live:view') ? `/${locale}/live` : `/${locale}/rides`}
          tone="pink"
        />
        {can(role, 'sos:ack') && (
          <StatCard
            label="Active SOS"
            value={activeSos.toLocaleString('en-IN')}
            sub={activeSos > 0 ? 'Needs attention' : 'All clear'}
            icon={Siren}
            href={`/${locale}/support`}
            tone="red"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dict.analytics.ridesOverTime}</CardTitle>
            <CardDescription>{rangeNote}</CardDescription>
          </CardHeader>
          <CardContent>
            <RidesChart data={m.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{dict.analytics.revenueOverTime}</CardTitle>
            <CardDescription>Subscription collection · {rangeNote}</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={m.series} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
