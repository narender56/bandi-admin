import 'server-only';
import { serviceClient } from './supabase';
import {
  RANGE_KEYS,
  RANGE_LABELS,
  type RangeKey,
  type Bucket,
  type ResolvedRange,
} from './ranges';

export { RANGE_KEYS, RANGE_LABELS };
export type { RangeKey, ResolvedRange };

const asRows = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};

/** Turn a range key (+ optional custom from/to) into concrete bounds + bucket. */
export function resolveRange(key: RangeKey, from?: string, to?: string): ResolvedRange {
  const now = new Date();
  let start: Date;
  let end = now;

  switch (key) {
    case 'today':
      start = startOfDay(now);
      break;
    case 'week':
      start = startOfDay(new Date(now.getTime() - 6 * DAY));
      break;
    case 'month':
      start = startOfDay(new Date(now.getTime() - 29 * DAY));
      break;
    case '3m':
      start = startOfDay(new Date(now.getTime() - 89 * DAY));
      break;
    case '6m':
      start = startOfDay(new Date(now.getTime() - 179 * DAY));
      break;
    case '1y':
      start = startOfDay(new Date(now.getTime() - 364 * DAY));
      break;
    case 'all':
      start = new Date('2020-01-01T00:00:00Z');
      break;
    case 'custom': {
      start = from ? startOfDay(new Date(from)) : startOfDay(new Date(now.getTime() - 29 * DAY));
      end = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : now;
      break;
    }
  }

  const spanDays = (end.getTime() - start.getTime()) / DAY;
  const bucket: Bucket = spanDays <= 2 ? 'hour' : spanDays <= 120 ? 'day' : 'month';
  return { key, from: start, to: end, bucket };
}

function bucketKey(iso: string, bucket: Bucket): string {
  const d = new Date(iso);
  if (bucket === 'hour') return `${d.toISOString().slice(0, 13)}:00`;
  if (bucket === 'day') return d.toISOString().slice(0, 10);
  return d.toISOString().slice(0, 7); // month
}

function bucketLabel(key: string, bucket: Bucket): string {
  if (bucket === 'hour') return `${key.slice(11, 13)}:00`;
  if (bucket === 'day') {
    const d = new Date(key);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  const d = new Date(`${key}-01`);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

/** Pre-seed every bucket between from..to so the chart has no gaps. */
function emptyBuckets(range: ResolvedRange): Map<string, { rides: number; revenue: number }> {
  const map = new Map<string, { rides: number; revenue: number }>();
  const cursor = new Date(range.from);
  const guard = 1000;
  let i = 0;
  while (cursor <= range.to && i < guard) {
    map.set(bucketKey(cursor.toISOString(), range.bucket), { rides: 0, revenue: 0 });
    if (range.bucket === 'hour') cursor.setHours(cursor.getHours() + 1);
    else if (range.bucket === 'day') cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
    i++;
  }
  return map;
}

export interface SubscriptionStats {
  range: ResolvedRange;
  subscribers: number; // distinct drivers with a non-refunded subscription in range
  revenue: number; // sum of non-refunded subscription amounts in range
  refunded: number; // sum of refunded amounts in range
  freeDrivers: number; // drivers currently on a waived (free) subscription
  byVehicle: { vehicle_type: string; subscribers: number; revenue: number }[];
  series: { label: string; revenue: number; subscribers: number }[];
}

/**
 * Subscription performance for a date range: how many drivers subscribed, how
 * much was collected, a revenue/subscriber trend, and a per-vehicle breakdown.
 * Vehicle type comes from each driver's primary vehicle (subscriptions carry
 * only driver_id + amount).
 */
export async function getSubscriptionStats(range: ResolvedRange): Promise<SubscriptionStats> {
  const svc = serviceClient();
  const fromDate = range.from.toISOString().slice(0, 10);
  const toDate = range.to.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [subsRes, freeRes] = await Promise.all([
    svc
      .from('subscriptions')
      .select('driver_id, for_date, amount, status, paid_at')
      .gte('for_date', fromDate)
      .lte('for_date', toDate),
    svc
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .gte('founder_free_until', today),
  ]);

  const subRows = asRows(subsRes.data);
  const driverIds = [...new Set(subRows.map((s) => s.driver_id as string))];

  // Map each subscribing driver to a vehicle type for the breakdown.
  const vehicleByDriver = new Map<string, string>();
  if (driverIds.length) {
    const { data: vehicles } = await svc
      .from('vehicles')
      .select('driver_id, type')
      .in('driver_id', driverIds);
    for (const v of asRows(vehicles)) {
      if (!vehicleByDriver.has(v.driver_id as string)) {
        vehicleByDriver.set(v.driver_id as string, (v.type as string) ?? 'auto');
      }
    }
  }

  const buckets = new Map<string, { revenue: number; subscribers: Set<string> }>();
  const seedBuckets = emptyBuckets(range);
  for (const key of seedBuckets.keys()) buckets.set(key, { revenue: 0, subscribers: new Set() });

  const paidDrivers = new Set<string>();
  const byVehicle = new Map<string, { subscribers: Set<string>; revenue: number }>();
  let revenue = 0;
  let refunded = 0;

  for (const s of subRows) {
    const amount = (s.amount as number) ?? 0;
    const driverId = s.driver_id as string;
    if (s.status === 'refunded') {
      refunded += amount;
      continue;
    }
    revenue += amount;
    paidDrivers.add(driverId);

    const at = (s.paid_at as string) ?? `${s.for_date as string}T00:00:00Z`;
    const slot = buckets.get(bucketKey(at, range.bucket));
    if (slot) {
      slot.revenue += amount;
      slot.subscribers.add(driverId);
    }

    const vt = vehicleByDriver.get(driverId) ?? 'auto';
    const v = byVehicle.get(vt) ?? { subscribers: new Set<string>(), revenue: 0 };
    v.subscribers.add(driverId);
    v.revenue += amount;
    byVehicle.set(vt, v);
  }

  const series = [...buckets.entries()].map(([key, v]) => ({
    label: bucketLabel(key, range.bucket),
    revenue: v.revenue,
    subscribers: v.subscribers.size,
  }));

  return {
    range,
    subscribers: paidDrivers.size,
    revenue,
    refunded,
    freeDrivers: freeRes.count ?? 0,
    byVehicle: [...byVehicle.entries()]
      .map(([vehicle_type, v]) => ({
        vehicle_type,
        subscribers: v.subscribers.size,
        revenue: v.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    series,
  };
}

export interface DashboardMetrics {
  range: ResolvedRange;
  rides: number;
  completedRides: number;
  cancelledRides: number;
  newRiders: number;
  newDrivers: number;
  revenue: number;
  activeRides: number;
  onlineDrivers: number;
  series: { label: string; rides: number; revenue: number }[];
}

const LIVE_STATUSES = ['requested', 'searching', 'accepted', 'arrived', 'in_progress'];

export async function getDashboardMetrics(range: ResolvedRange): Promise<DashboardMetrics> {
  const svc = serviceClient();
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);
  const HEAD = { count: 'exact' as const, head: true };

  const [ridesRes, newRidersRes, newDriversRes, subsRes, active, online] = await Promise.all([
    svc
      .from('rides')
      .select('status, requested_at, completed_at, locked_fare')
      .gte('requested_at', fromIso)
      .lte('requested_at', toIso),
    svc
      .from('riders')
      .select('*', HEAD)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    svc
      .from('drivers')
      .select('*', HEAD)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    svc
      .from('subscriptions')
      .select('for_date, amount, status, paid_at')
      .gte('for_date', fromDate)
      .lte('for_date', toDate),
    svc.from('rides').select('*', HEAD).in('status', LIVE_STATUSES),
    svc.from('drivers').select('*', HEAD).in('status', ['online', 'on_ride']),
  ]);

  const rideRows = asRows(ridesRes.data);
  const subRows = asRows(subsRes.data);

  const buckets = emptyBuckets(range);
  let completed = 0;
  let cancelled = 0;
  for (const r of rideRows) {
    const status = r.status as string;
    if (status === 'completed') completed++;
    if (status === 'cancelled') cancelled++;
    const slot = buckets.get(bucketKey(r.requested_at as string, range.bucket));
    if (slot) slot.rides += 1;
  }

  let revenue = 0;
  for (const s of subRows) {
    if (s.status === 'refunded') continue;
    const amount = (s.amount as number) ?? 0;
    revenue += amount;
    const at = (s.paid_at as string) ?? `${s.for_date as string}T00:00:00Z`;
    const slot = buckets.get(bucketKey(at, range.bucket));
    if (slot) slot.revenue += amount;
  }

  const newRiders = newRidersRes.count ?? 0;
  const newDrivers = newDriversRes.count ?? 0;

  const series = [...buckets.entries()].map(([key, v]) => ({
    label: bucketLabel(key, range.bucket),
    rides: v.rides,
    revenue: v.revenue,
  }));

  return {
    range,
    rides: rideRows.length,
    completedRides: completed,
    cancelledRides: cancelled,
    newRiders,
    newDrivers,
    revenue,
    activeRides: active.count ?? 0,
    onlineDrivers: online.count ?? 0,
    series,
  };
}
