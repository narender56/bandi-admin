import { redirect } from 'next/navigation';
import { Users, Wallet, Undo2, Gift } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { formatINR } from '@/lib/utils';
import { getSubscriptionPlans, listFreeDrivers } from '@/lib/data';
import {
  resolveRange,
  getSubscriptionStats,
  RANGE_KEYS,
  RANGE_LABELS,
  type RangeKey,
} from '@/lib/metrics';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { RangePicker } from '@/components/dashboard/range-picker';
import { RevenueChart } from '@/components/dashboard/charts';
import { PlansManager, FreeGrants } from '@/components/money/money-manager';

const VEHICLE_LABEL: Record<string, string> = { auto: 'Auto', bike: 'Bike', cab: 'Cab' };

export default async function MoneyPage({
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
  if (!can(role, 'finance:view')) redirect(`/${locale}`);
  const canManage = can(role, 'subscriptions:manage');

  const sp = await searchParams;
  const rangeKey: RangeKey = (RANGE_KEYS as readonly string[]).includes(sp.range ?? '')
    ? (sp.range as RangeKey)
    : 'month';
  const range = resolveRange(rangeKey, sp.from, sp.to);
  const rangeNote =
    rangeKey === 'custom' && sp.from && sp.to ? `${sp.from} → ${sp.to}` : RANGE_LABELS[rangeKey];

  const [plans, freeDrivers, stats] = await Promise.all([
    getSubscriptionPlans(),
    listFreeDrivers(),
    getSubscriptionStats(range),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            Driver daily-fee plans, free grants & collection · {rangeNote}
          </p>
        </div>
        <RangePicker current={rangeKey} from={sp.from} to={sp.to} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Subscribers" value={stats.subscribers.toLocaleString('en-IN')} sub="paid in period" icon={Users} tone="bg-primary/10 text-primary" />
        <StatTile label="Collected" value={formatINR(stats.revenue)} sub="subscriptions" icon={Wallet} tone="bg-success/10 text-success" />
        <StatTile label="Refunded" value={formatINR(stats.refunded)} sub="in period" icon={Undo2} tone="bg-warning/10 text-warning" />
        <StatTile label="Free drivers" value={stats.freeDrivers.toLocaleString('en-IN')} sub="active grants" icon={Gift} tone="bg-chart-3/10 text-chart-3" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Collection over time</CardTitle>
            <CardDescription>Subscription revenue · {rangeNote}</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={stats.series.map((s) => ({ ...s, rides: 0 }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By vehicle type</CardTitle>
            <CardDescription>Subscribers & revenue · {rangeNote}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.byVehicle.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No subscriptions yet.</p>
            ) : (
              stats.byVehicle.map((v) => (
                <div key={v.vehicle_type} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{VEHICLE_LABEL[v.vehicle_type] ?? v.vehicle_type}</span>
                  <span className="text-muted-foreground">
                    {v.subscribers} driver{v.subscribers === 1 ? '' : 's'} · {formatINR(v.revenue)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <PlansManager plans={plans} canManage={canManage} />
      <FreeGrants drivers={freeDrivers} canManage={canManage} />
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className={`flex size-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </div>
    </Card>
  );
}
