import 'server-only';
import { serviceClient } from './supabase';

// Parsed join selects make supabase-js infer an error union on rows; this
// helper narrows query results to plain records for field access.
type Row = Record<string, unknown>;
const asRows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const ridePaidAmount = (row: Row): number | null =>
  ((row.final_fare as number | null | undefined) ?? (row.locked_fare as number | null | undefined)) ??
  null;
type QueryFilter = {
  eq: (column: string, value: unknown) => QueryFilter;
  gte: (column: string, value: unknown) => QueryFilter;
  lte: (column: string, value: unknown) => QueryFilter;
  ilike: (column: string, pattern: string) => QueryFilter;
  in: (column: string, values: readonly unknown[]) => QueryFilter;
};

/**
 * Resolve a set of user ids that may belong to either a rider or a driver
 * (polymorphic references: ratings, support_tickets, sos_alerts, notifications)
 * to their name + phone. Since the user-table split removed the shared FK, the
 * id is matched against both tables.
 */
type UserInfo = { full_name: string | null; phone: string | null };
async function resolveUsers(ids: string[]): Promise<Map<string, UserInfo>> {
  const map = new Map<string, UserInfo>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const svc = serviceClient();
  const [riders, drivers] = await Promise.all([
    svc.from('riders').select('id, full_name, phone').in('id', unique),
    svc.from('drivers').select('id, full_name, phone').in('id', unique),
  ]);
  for (const r of [...asRows(riders.data), ...asRows(drivers.data)]) {
    map.set(r.id as string, {
      full_name: (r.full_name as string) ?? null,
      phone: (r.phone as string) ?? null,
    });
  }
  return map;
}

export interface DashboardStats {
  totalDrivers: number;
  onlineDrivers: number;
  totalRiders: number;
  ridesToday: number;
  completedRides: number;
  activeRides: number;
}

export interface WebsiteLeadRow {
  id: string;
  lead_type: 'contact' | 'driver_join';
  status: 'new' | 'contacted' | 'qualified' | 'closed' | 'spam';
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  vehicle_type: string | null;
  message: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export async function listWebsiteLeads(): Promise<WebsiteLeadRow[]> {
  const { data } = await serviceClient()
    .from('website_leads')
    .select(
      'id, lead_type, status, name, phone, email, city, vehicle_type, message, source, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  return asRows(data) as unknown as WebsiteLeadRow[];
}

const LIVE_STATUSES = ['requested', 'searching', 'accepted', 'arrived', 'in_progress'];

// head:true + count:'exact' returns only the count, no rows.
const HEAD = { count: 'exact' as const, head: true };

export async function getDashboardStats(): Promise<DashboardStats> {
  const svc = serviceClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [drivers, online, riders, today, completed, active] = await Promise.all([
    svc.from('drivers').select('*', HEAD),
    svc.from('drivers').select('*', HEAD).eq('status', 'online'),
    svc.from('riders').select('*', HEAD),
    svc.from('rides').select('*', HEAD).gte('requested_at', startOfDay.toISOString()),
    svc.from('rides').select('*', HEAD).eq('status', 'completed'),
    svc.from('rides').select('*', HEAD).in('status', LIVE_STATUSES),
  ]);

  return {
    totalDrivers: drivers.count ?? 0,
    onlineDrivers: online.count ?? 0,
    totalRiders: riders.count ?? 0,
    ridesToday: today.count ?? 0,
    completedRides: completed.count ?? 0,
    activeRides: active.count ?? 0,
  };
}

/** Default rows per page for paginated list views. */
export const PAGE_SIZE = 20;

export interface Page<T> {
  rows: T[];
  total: number;
}

export interface ListOptions {
  page?: number;
  search?: string;
  pendingOnly?: boolean; // drivers awaiting approval (onboarding queue)
  status?: string;
  country?: string;
  state?: string;
  city?: string;
  minRating?: number;
  vehicleType?: string;
  createdFrom?: string;
  createdTo?: string;
  deactivatedFrom?: string;
  deactivatedTo?: string;
  settlementStatus?: string;
}

function range(page: number): [number, number] {
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1];
}

export interface DriverRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  is_approved: boolean;
  is_founder: boolean;
  is_blocked: boolean;
  deactivated_at: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  total_rides: number;
  rating: number;
  reg_no: string | null;
  model: string | null;
  vehicle_type: string | null;
  settlement_status: string | null;
  settlement_amount: number | null;
  settlement_requested_at: string | null;
  settlement_paid_at: string | null;
}

export async function listDrivers(opts: ListOptions = {}): Promise<Page<DriverRow>> {
  const svc = serviceClient();
  const [from, to] = range(opts.page ?? 1);
  let q = svc
    .from('drivers')
    .select(
      'id, status, is_approved, is_founder, is_blocked, city, total_rides, rating, ' +
        'full_name, phone, vehicles(reg_no, model, type, is_active)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (opts.pendingOnly) q = q.eq('is_approved', false);
  if (opts.search) {
    q = q.or(`full_name.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`);
  }

  const { data, count } = await q.range(from, to);
  const rows = asRows(data).map(mapDriverRow);
  return { rows, total: count ?? 0 };
}

// ── Drivers by onboarding tab ────────────────────────────────
// The schema only tracks is_approved (bool) + driver_documents.status. We derive
// a 4-state onboarding funnel from those: new (no docs), pending (docs, none
// rejected), rejected (≥1 rejected doc), approved (is_approved=true). Account
// closures are separated into the deactivated queue for settlement follow-up.
export type DriverTab = 'new' | 'pending' | 'rejected' | 'approved' | 'deactivated';

export interface DriverListResult {
  rows: DriverRow[];
  total: number;
  counts: Record<DriverTab, number>;
}

/** Rows per page for the drivers table (user wants ≥10 on load). */
export const DRIVERS_PAGE_SIZE = 10;

const DRIVER_SELECT =
  'id, status, is_approved, is_founder, is_blocked, deactivated_at, country, state, city, total_rides, rating, created_at, ' +
  'full_name, phone, vehicles(reg_no, model, type, is_active)';

function mapDriverRow(d: Row): DriverRow {
  const vehicles = d.vehicles as
    | { reg_no?: string; model?: string; type?: string; is_active?: boolean }[]
    | null;
  // Prefer the active vehicle when a driver has more than one on file.
  const vehicle = vehicles?.find((v) => v.is_active) ?? vehicles?.[0];
  return {
    id: d.id as string,
    full_name: (d.full_name as string) ?? null,
    phone: (d.phone as string) ?? null,
    status: d.status as string,
    is_approved: d.is_approved as boolean,
    is_founder: (d.is_founder as boolean) ?? false,
    is_blocked: (d.is_blocked as boolean) ?? false,
    deactivated_at: (d.deactivated_at as string) ?? null,
    country: (d.country as string) ?? null,
    state: (d.state as string) ?? null,
    city: (d.city as string) ?? null,
    total_rides: (d.total_rides as number) ?? 0,
    rating: (d.rating as number) ?? 5,
    reg_no: vehicle?.reg_no ?? null,
    model: vehicle?.model ?? null,
    vehicle_type: vehicle?.type ?? null,
    settlement_status: null,
    settlement_amount: null,
    settlement_requested_at: null,
    settlement_paid_at: null,
  };
}

async function attachLatestSettlements(rows: DriverRow[]): Promise<DriverRow[]> {
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return rows;
  const { data } = await serviceClient()
    .from('driver_withdrawal_requests')
    .select('driver_id, status, amount, created_at, paid_at')
    .in('driver_id', ids)
    .order('created_at', { ascending: false });
  const latest = new Map<string, Row>();
  for (const item of asRows(data)) {
    const driverId = item.driver_id as string;
    if (!latest.has(driverId)) latest.set(driverId, item);
  }
  return rows.map((row) => {
    const settlement = latest.get(row.id);
    if (!settlement) return row;
    return {
      ...row,
      settlement_status: (settlement.status as string) ?? null,
      settlement_amount: (settlement.amount as number) ?? null,
      settlement_requested_at: (settlement.created_at as string) ?? null,
      settlement_paid_at: (settlement.paid_at as string) ?? null,
    };
  });
}

function categorizeUnapproved(docStatuses: string[]): Exclude<DriverTab, 'approved' | 'deactivated'> {
  if (docStatuses.length === 0) return 'new';
  if (docStatuses.includes('rejected')) return 'rejected';
  return 'pending';
}

export async function listDriversByTab(
  tab: DriverTab,
  opts: ListOptions = {},
): Promise<DriverListResult> {
  const svc = serviceClient();
  const search = opts.search?.trim();
  const page = Math.max(1, opts.page ?? 1);
  const size = DRIVERS_PAGE_SIZE;
  const searchFilter = `full_name.ilike.%${search}%,phone.ilike.%${search}%`;

  // Vehicle-type filter lives on the vehicles table — resolve the matching
  // driver ids first, then constrain every driver query to them.
  let vehicleDriverIds: string[] | null = null;
  if (opts.vehicleType) {
    const { data: vrows } = await svc
      .from('vehicles')
      .select('driver_id')
      .eq('type', opts.vehicleType)
      .eq('is_active', true);
    vehicleDriverIds = [
      ...new Set(asRows(vrows).map((v) => v.driver_id as string)),
    ];
  }

  const applyDriverFilters = (q: QueryFilter, includeDeactivatedDate = false) => {
    let next = q;
    if (vehicleDriverIds) next = next.in('id', vehicleDriverIds);
    if (opts.country) next = next.eq('country', opts.country);
    if (opts.state) next = next.eq('state', opts.state);
    if (opts.city) next = next.ilike('city', `%${opts.city}%`);
    if (opts.minRating) next = next.gte('rating', opts.minRating);
    if (opts.status === 'blocked') next = next.eq('is_blocked', true);
    else if (opts.status === 'on_hold') next = next.eq('is_on_hold', true);
    else if (opts.status) next = next.eq('status', opts.status);
    if (opts.createdFrom) next = next.gte('created_at', opts.createdFrom);
    if (opts.createdTo) next = next.lte('created_at', `${opts.createdTo}T23:59:59.999Z`);
    if (includeDeactivatedDate && opts.deactivatedFrom) {
      next = next.gte('deactivated_at', opts.deactivatedFrom);
    }
    if (includeDeactivatedDate && opts.deactivatedTo) {
      next = next.lte('deactivated_at', `${opts.deactivatedTo}T23:59:59.999Z`);
    }
    return next;
  };

  // Approved tab paginates in the DB (potentially large). Non-approved tabs are an
  // operational backlog (small) — we load + categorize them in memory.
  let approvedHeadQ = svc
    .from('drivers')
    .select('id', HEAD)
    .eq('is_approved', true)
    .is('deactivated_at', null);
  let unapprovedQ = svc
    .from('drivers')
    .select(DRIVER_SELECT)
    .eq('is_approved', false)
    .is('deactivated_at', null)
    .order('created_at', { ascending: false })
    .limit(1000);
  let deactivatedHeadQ = svc
    .from('drivers')
    .select('id', HEAD)
    .not('deactivated_at', 'is', null);
  approvedHeadQ = applyDriverFilters(approvedHeadQ as unknown as QueryFilter) as unknown as typeof approvedHeadQ;
  unapprovedQ = applyDriverFilters(unapprovedQ as unknown as QueryFilter) as unknown as typeof unapprovedQ;
  deactivatedHeadQ = applyDriverFilters(
    deactivatedHeadQ as unknown as QueryFilter,
    true,
  ) as unknown as typeof deactivatedHeadQ;
  if (search) {
    approvedHeadQ = approvedHeadQ.or(searchFilter);
    unapprovedQ = unapprovedQ.or(searchFilter);
    deactivatedHeadQ = deactivatedHeadQ.or(searchFilter);
  }

  const [approvedHead, unapprovedRes, deactivatedHead] = await Promise.all([
    approvedHeadQ,
    unapprovedQ,
    deactivatedHeadQ,
  ]);
  const approvedCount = approvedHead.count ?? 0;
  const deactivatedCount = deactivatedHead.count ?? 0;
  const unapproved = asRows(unapprovedRes.data);

  // Fetch doc statuses for the unapproved set in one query and group by driver.
  const ids = unapproved.map((d) => d.id as string);
  const docsByDriver = new Map<string, string[]>();
  if (ids.length) {
    const { data: docs } = await svc
      .from('driver_documents')
      .select('driver_id, status')
      .in('driver_id', ids);
    for (const doc of asRows(docs)) {
      const k = doc.driver_id as string;
      const list = docsByDriver.get(k) ?? [];
      list.push(doc.status as string);
      docsByDriver.set(k, list);
    }
  }

  const grouped: Record<Exclude<DriverTab, 'approved' | 'deactivated'>, Row[]> = { new: [], pending: [], rejected: [] };
  for (const d of unapproved) {
    grouped[categorizeUnapproved(docsByDriver.get(d.id as string) ?? [])].push(d);
  }

  const counts: Record<DriverTab, number> = {
    new: grouped.new.length,
    pending: grouped.pending.length,
    rejected: grouped.rejected.length,
    approved: approvedCount,
    deactivated: deactivatedCount,
  };

  if (tab === 'deactivated') {
    const from = (page - 1) * size;
    let pageQ = svc
      .from('drivers')
      .select(DRIVER_SELECT)
      .not('deactivated_at', 'is', null)
      .order('deactivated_at', { ascending: false });
    pageQ = applyDriverFilters(pageQ as unknown as QueryFilter, true) as unknown as typeof pageQ;
    if (search) pageQ = pageQ.or(searchFilter);
    const { data } = await (opts.settlementStatus
      ? pageQ.limit(1000)
      : pageQ.range(from, from + size - 1));
    let rows = await attachLatestSettlements(asRows(data).map(mapDriverRow));
    if (opts.settlementStatus) {
      rows = rows.filter((row) =>
        opts.settlementStatus === 'none'
          ? row.settlement_status === null
          : row.settlement_status === opts.settlementStatus,
      );
      return { rows: rows.slice(from, from + size), total: rows.length, counts };
    }
    return { rows, total: deactivatedCount, counts };
  }

  if (tab === 'approved') {
    const from = (page - 1) * size;
    let pageQ = svc
      .from('drivers')
      .select(DRIVER_SELECT)
      .eq('is_approved', true)
      .is('deactivated_at', null)
      .order('created_at', { ascending: false });
    pageQ = applyDriverFilters(pageQ as unknown as QueryFilter) as unknown as typeof pageQ;
    if (search) pageQ = pageQ.or(searchFilter);
    const { data } = await pageQ.range(from, from + size - 1);
    return { rows: asRows(data).map(mapDriverRow), total: approvedCount, counts };
  }

  const all = grouped[tab];
  const from = (page - 1) * size;
  return { rows: all.slice(from, from + size).map(mapDriverRow), total: all.length, counts };
}

export interface RiderRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_blocked: boolean;
  created_at: string;
  /** Has an unpaid no-show fine block (rider_blocks). */
  fine_due?: boolean;
}

export async function listRiders(opts: ListOptions = {}): Promise<Page<RiderRow>> {
  const svc = serviceClient();
  const [from, to] = range(opts.page ?? 1);
  let q = svc
    .from('riders')
    .select('id, full_name, phone, is_blocked, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (opts.search) {
    q = q.or(`full_name.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`);
  }
  if (opts.status === 'blocked') q = q.eq('is_blocked', true);
  if (opts.status === 'active') q = q.eq('is_blocked', false);
  if (opts.createdFrom) q = q.gte('created_at', opts.createdFrom);
  if (opts.createdTo) q = q.lte('created_at', `${opts.createdTo}T23:59:59.999Z`);

  const { data, count } = await q.range(from, to);
  const rows = (data ?? []) as RiderRow[];
  // Flag riders with an unpaid no-show fine block so the list can badge them
  // (the rider app blocks on rider_blocks, which is separate from is_blocked).
  if (rows.length) {
    const { data: blocks } = await svc
      .from('rider_blocks')
      .select('rider_id')
      .eq('fine_status', 'pending')
      .is('unblocked_at', null)
      .in(
        'rider_id',
        rows.map((r) => r.id),
      );
    const due = new Set(
      (blocks ?? []).map((b) => (b as { rider_id: string }).rider_id),
    );
    for (const r of rows) r.fine_due = due.has(r.id);
  }
  return { rows, total: count ?? 0 };
}

export interface DisputeRow {
  id: string;
  ride_id: string;
  kind: string;
  raised_by: string;
  reason: string | null;
  evidence: Record<string, unknown>;
  status: string;
  created_at: string;
  rider_id: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_pending_credits: number;
  pickup_address: string | null;
  drop_address: string | null;
}

export const DISPUTES_PAGE_SIZE = 15;

/** Open ride disputes awaiting review, paginated + searchable by rider/driver
 *  name or phone. */
export async function listDisputes(
  opts: { page?: number; search?: string } = {},
): Promise<{ rows: DisputeRow[]; total: number }> {
  const svc = serviceClient();
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * DISPUTES_PAGE_SIZE;

  // Search matches the rider's or driver's name/phone: resolve their ids first,
  // then filter disputes to those parties.
  let matchIds: string[] | null = null;
  if (opts.search) {
    const q = `%${opts.search}%`;
    const [riders, drivers] = await Promise.all([
      svc.from('riders').select('id').or(`full_name.ilike.${q},phone.ilike.${q}`),
      svc.from('drivers').select('id').or(`full_name.ilike.${q},phone.ilike.${q}`),
    ]);
    matchIds = [
      ...asRows(riders.data).map((r) => r.id as string),
      ...asRows(drivers.data).map((r) => r.id as string),
    ];
    if (matchIds.length === 0) return { rows: [], total: 0 };
  }

  let query = svc
    .from('ride_disputes')
    .select(
      'id, ride_id, kind, raised_by, reason, evidence, status, created_at, rider_id, driver_id, ' +
        'rider:riders(full_name, phone), driver:drivers(full_name, phone), ride:rides(pickup_address, drop_address)',
      { count: 'exact' },
    )
    .eq('status', 'open');
  if (matchIds) {
    const inList = `(${matchIds.join(',')})`;
    query = query.or(`rider_id.in.${inList},driver_id.in.${inList}`);
  }

  const { data, count } = await query
    .order('created_at', { ascending: true })
    .range(from, from + DISPUTES_PAGE_SIZE - 1);

  // How many unused free-day credits each driver on this page already has —
  // shown next to "Comp driver" so an admin doesn't over-grant.
  const driverIds = [
    ...new Set(asRows(data).map((r) => r.driver_id as string).filter(Boolean)),
  ];
  const pendingByDriver = new Map<string, number>();
  if (driverIds.length) {
    const { data: credits } = await svc
      .from('driver_free_day_credits')
      .select('driver_id')
      .eq('status', 'pending')
      .in('driver_id', driverIds);
    for (const c of asRows(credits)) {
      const id = c.driver_id as string;
      pendingByDriver.set(id, (pendingByDriver.get(id) ?? 0) + 1);
    }
  }

  const rows = asRows(data).map((r) => {
    const rider = (r as { rider?: { full_name?: string; phone?: string } }).rider;
    const driver = (r as { driver?: { full_name?: string; phone?: string } }).driver;
    const ride = (r as { ride?: { pickup_address?: string; drop_address?: string } }).ride;
    return {
      id: r.id as string,
      ride_id: r.ride_id as string,
      kind: r.kind as string,
      raised_by: r.raised_by as string,
      reason: (r.reason as string) ?? null,
      evidence: (r.evidence as Record<string, unknown>) ?? {},
      status: r.status as string,
      created_at: r.created_at as string,
      rider_id: (r.rider_id as string) ?? null,
      rider_name: rider?.full_name ?? null,
      rider_phone: rider?.phone ?? null,
      driver_id: (r.driver_id as string) ?? null,
      driver_name: driver?.full_name ?? null,
      driver_phone: driver?.phone ?? null,
      driver_pending_credits: pendingByDriver.get(r.driver_id as string) ?? 0,
      pickup_address: ride?.pickup_address ?? null,
      drop_address: ride?.drop_address ?? null,
    };
  });
  return { rows, total: count ?? 0 };
}

export interface RideRow {
  id: string;
  status: string;
  pickup_address: string | null;
  drop_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  drop_lat: number | null;
  drop_lng: number | null;
  locked_fare: number | null;
  final_fare: number | null;
  ended_early: boolean;
  paid_amount: number | null;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  driver_id: string | null;
  rider: string | null;
  driver: string | null;
}

export async function listRides(limit = 100): Promise<RideRow[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('rides')
    .select(
      'id, status, pickup_address, drop_address, locked_fare, final_fare, ended_early, requested_at, ' +
        'rider:riders!rides_rider_id_fkey(full_name), ' +
        'driver:drivers!rides_driver_id_fkey(full_name)',
    )
    .order('requested_at', { ascending: false })
    .limit(limit);

  return asRows(data).map((r) => {
    const rider = r.rider as { full_name?: string } | null;
    const driverObj = r.driver as { full_name?: string } | null;
    return {
      id: r.id as string,
      status: r.status as string,
      pickup_address: (r.pickup_address as string) ?? null,
      drop_address: (r.drop_address as string) ?? null,
      pickup_lat: (r.pickup_lat as number) ?? null,
      pickup_lng: (r.pickup_lng as number) ?? null,
      drop_lat: (r.drop_lat as number) ?? null,
      drop_lng: (r.drop_lng as number) ?? null,
      locked_fare: (r.locked_fare as number) ?? null,
      final_fare: (r.final_fare as number) ?? null,
      ended_early: r.ended_early === true,
      paid_amount: ridePaidAmount(r),
      requested_at: r.requested_at as string,
      accepted_at: (r.accepted_at as string) ?? null,
      started_at: (r.started_at as string) ?? null,
      completed_at: (r.completed_at as string) ?? null,
      driver_id: (r.driver_id as string) ?? null,
      rider: rider?.full_name ?? null,
      driver: driverObj?.full_name ?? null,
    };
  });
}

// ── Rides by status tab (paginated + searchable) ─────────────
export type RideTab = 'live' | 'completed' | 'cancelled' | 'all';

export interface RideListResult {
  rows: RideRow[];
  total: number;
  counts: Record<RideTab, number>;
}

export const RIDES_PAGE_SIZE = 15;

const RIDE_LIST_SELECT =
  'id, status, pickup_address, drop_address, pickup_lat, pickup_lng, drop_lat, drop_lng, ' +
  'locked_fare, final_fare, ended_early, requested_at, accepted_at, started_at, completed_at, driver_id, ' +
  'rider:riders!rides_rider_id_fkey(full_name), ' +
  'driver:drivers!rides_driver_id_fkey(full_name)';

function mapRideRow(r: Row): RideRow {
  const rider = r.rider as { full_name?: string } | null;
  const driverObj = r.driver as { full_name?: string } | null;
  return {
    id: r.id as string,
    status: r.status as string,
    pickup_address: (r.pickup_address as string) ?? null,
    drop_address: (r.drop_address as string) ?? null,
    pickup_lat: (r.pickup_lat as number) ?? null,
    pickup_lng: (r.pickup_lng as number) ?? null,
    drop_lat: (r.drop_lat as number) ?? null,
    drop_lng: (r.drop_lng as number) ?? null,
    locked_fare: (r.locked_fare as number) ?? null,
    final_fare: (r.final_fare as number) ?? null,
    ended_early: r.ended_early === true,
    paid_amount: ridePaidAmount(r),
    requested_at: r.requested_at as string,
    accepted_at: (r.accepted_at as string) ?? null,
    started_at: (r.started_at as string) ?? null,
    completed_at: (r.completed_at as string) ?? null,
    driver_id: (r.driver_id as string) ?? null,
    rider: rider?.full_name ?? null,
    driver: driverObj?.full_name ?? null,
  };
}

export async function listRidesByTab(
  tab: RideTab,
  opts: ListOptions = {},
): Promise<RideListResult> {
  const svc = serviceClient();
  const page = Math.max(1, opts.page ?? 1);
  const search = opts.search?.trim();
  const from = (page - 1) * RIDES_PAGE_SIZE;

  const applyTab = <T extends { in: (c: string, v: string[]) => T; eq: (c: string, v: string) => T }>(
    q: T,
  ): T => {
    if (tab === 'live') return q.in('status', LIVE_STATUSES);
    if (tab === 'completed') return q.eq('status', 'completed');
    if (tab === 'cancelled') return q.eq('status', 'cancelled');
    return q;
  };

  let listQ = svc.from('rides').select(RIDE_LIST_SELECT, { count: 'exact' });
  listQ = applyTab(listQ);
  if (search) listQ = listQ.or(`pickup_address.ilike.%${search}%,drop_address.ilike.%${search}%`);

  const [listRes, liveC, doneC, cancC, allC] = await Promise.all([
    listQ.order('requested_at', { ascending: false }).range(from, from + RIDES_PAGE_SIZE - 1),
    svc.from('rides').select('*', HEAD).in('status', LIVE_STATUSES),
    svc.from('rides').select('*', HEAD).eq('status', 'completed'),
    svc.from('rides').select('*', HEAD).eq('status', 'cancelled'),
    svc.from('rides').select('*', HEAD),
  ]);

  return {
    rows: asRows(listRes.data).map(mapRideRow),
    total: listRes.count ?? 0,
    counts: {
      live: liveC.count ?? 0,
      completed: doneC.count ?? 0,
      cancelled: cancC.count ?? 0,
      all: allC.count ?? 0,
    },
  };
}

export interface RideDetail {
  id: string;
  status: string;
  pickup_address: string | null;
  drop_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  drop_lat: number | null;
  drop_lng: number | null;
  distance_km: number | null;
  duration_min: number | null;
  waiting_min: number | null;
  est_fare_min: number | null;
  est_fare_max: number | null;
  locked_fare: number | null;
  final_fare: number | null;
  ended_early: boolean;
  paid_amount: number | null;
  payment_method: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  rider_id: string;
  rider_name: string | null;
  rider_phone: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
}

export interface RideSimulationPoint {
  id: string;
  ride_id: string;
  driver_id: string;
  ride_status: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  source: string;
  recorded_at: string;
}

const LIVE_SET = new Set(LIVE_STATUSES);
export function isLiveStatus(status: string): boolean {
  return LIVE_SET.has(status);
}

export async function getRideDetail(id: string): Promise<RideDetail | null> {
  const svc = serviceClient();
  const { data } = await svc
    .from('rides')
    .select(
        'id, status, pickup_address, drop_address, pickup_lat, pickup_lng, distance_km, ' +
        'drop_lat, drop_lng, duration_min, waiting_min, est_fare_min, est_fare_max, locked_fare, final_fare, ended_early, payment_method, ' +
        'cancelled_by, cancel_reason, requested_at, accepted_at, started_at, completed_at, ' +
        'rider_id, driver_id, ' +
        'rider:riders!rides_rider_id_fkey(full_name, phone), ' +
        'driver:drivers!rides_driver_id_fkey(full_name, phone)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Row;
  const rider = r.rider as { full_name?: string; phone?: string } | null;
  const driverObj = r.driver as { full_name?: string; phone?: string } | null;
  return {
    id: r.id as string,
    status: r.status as string,
    pickup_address: (r.pickup_address as string) ?? null,
    drop_address: (r.drop_address as string) ?? null,
    pickup_lat: (r.pickup_lat as number) ?? null,
    pickup_lng: (r.pickup_lng as number) ?? null,
    drop_lat: (r.drop_lat as number) ?? null,
    drop_lng: (r.drop_lng as number) ?? null,
    distance_km: (r.distance_km as number) ?? null,
    duration_min: (r.duration_min as number) ?? null,
    waiting_min: (r.waiting_min as number) ?? null,
    est_fare_min: (r.est_fare_min as number) ?? null,
    est_fare_max: (r.est_fare_max as number) ?? null,
    locked_fare: (r.locked_fare as number) ?? null,
    final_fare: (r.final_fare as number) ?? null,
    ended_early: r.ended_early === true,
    paid_amount: ridePaidAmount(r),
    payment_method: (r.payment_method as string) ?? null,
    cancelled_by: (r.cancelled_by as string) ?? null,
    cancel_reason: (r.cancel_reason as string) ?? null,
    requested_at: r.requested_at as string,
    accepted_at: (r.accepted_at as string) ?? null,
    started_at: (r.started_at as string) ?? null,
    completed_at: (r.completed_at as string) ?? null,
    rider_id: r.rider_id as string,
    rider_name: rider?.full_name ?? null,
    rider_phone: rider?.phone ?? null,
    driver_id: (r.driver_id as string) ?? null,
    driver_name: driverObj?.full_name ?? null,
    driver_phone: driverObj?.phone ?? null,
  };
}

export async function getRideSimulationPoints(
  rideId: string,
): Promise<RideSimulationPoint[]> {
  const { data } = await serviceClient()
    .from('ride_location_events')
    .select(
      'id, ride_id, driver_id, ride_status, latitude, longitude, heading, source, recorded_at',
    )
    .eq('ride_id', rideId)
    .order('recorded_at', { ascending: true })
    .limit(1000);

  return asRows(data).map((row) => ({
    id: row.id as string,
    ride_id: row.ride_id as string,
    driver_id: row.driver_id as string,
    ride_status: row.ride_status as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    heading: row.heading == null ? null : Number(row.heading),
    source: row.source as string,
    recorded_at: row.recorded_at as string,
  }));
}

export async function getRideSimulationPointsForRides(
  rideIds: string[],
): Promise<Record<string, RideSimulationPoint[]>> {
  const ids = [...new Set(rideIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data } = await serviceClient()
    .from('ride_location_events')
    .select(
      'id, ride_id, driver_id, ride_status, latitude, longitude, heading, source, recorded_at',
    )
    .in('ride_id', ids)
    .order('recorded_at', { ascending: true });

  return asRows(data).reduce<Record<string, RideSimulationPoint[]>>((acc, row) => {
    const rideId = row.ride_id as string;
    acc[rideId] ??= [];
    acc[rideId].push({
      id: row.id as string,
      ride_id: rideId,
      driver_id: row.driver_id as string,
      ride_status: row.ride_status as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      heading: row.heading == null ? null : Number(row.heading),
      source: row.source as string,
      recorded_at: row.recorded_at as string,
    });
    return acc;
  }, {});
}

export interface LiveRideRow {
  id: string;
  status: string;
  pickup_address: string | null;
  drop_address: string | null;
  locked_fare: number | null;
  est_fare_min: number | null;
  est_fare_max: number | null;
  women_only: boolean;
  requested_at: string;
  accepted_at: string | null;
  rider: string | null;
  driver: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
}

export async function listLiveRides(): Promise<LiveRideRow[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('rides')
    .select(
      'id, status, pickup_address, drop_address, locked_fare, est_fare_min, est_fare_max, ' +
        'women_only, requested_at, accepted_at, pickup_lat, pickup_lng, ' +
        'rider:riders!rides_rider_id_fkey(full_name), ' +
        'driver:drivers!rides_driver_id_fkey(full_name)',
    )
    .in('status', LIVE_STATUSES)
    .order('requested_at', { ascending: false });

  return asRows(data).map((r) => {
    const rider = r.rider as { full_name?: string } | null;
    const driverObj = r.driver as { full_name?: string } | null;
    return {
      id: r.id as string,
      status: r.status as string,
      pickup_address: (r.pickup_address as string) ?? null,
      drop_address: (r.drop_address as string) ?? null,
      locked_fare: (r.locked_fare as number) ?? null,
      est_fare_min: (r.est_fare_min as number) ?? null,
      est_fare_max: (r.est_fare_max as number) ?? null,
      women_only: (r.women_only as boolean) ?? false,
      requested_at: r.requested_at as string,
      accepted_at: (r.accepted_at as string) ?? null,
      rider: rider?.full_name ?? null,
      driver: driverObj?.full_name ?? null,
      pickup_lat: (r.pickup_lat as number) ?? null,
      pickup_lng: (r.pickup_lng as number) ?? null,
    };
  });
}

export interface SosRow {
  id: string;
  role: string;
  user: string | null;
  user_phone: string | null;
  ride_id: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  note: string | null;
  created_at: string;
}

export async function listActiveSos(): Promise<SosRow[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('sos_alerts')
    .select('id, user_id, role, ride_id, lat, lng, status, note, created_at')
    .in('status', ['active', 'acknowledged'])
    .order('created_at', { ascending: false });

  const rows = asRows(data);
  const users = await resolveUsers(rows.map((s) => s.user_id as string));
  return rows.map((s) => {
    const user = users.get(s.user_id as string);
    return {
      id: s.id as string,
      role: s.role as string,
      user: user?.full_name ?? null,
      user_phone: user?.phone ?? null,
      ride_id: (s.ride_id as string) ?? null,
      lat: (s.lat as number) ?? null,
      lng: (s.lng as number) ?? null,
      status: s.status as string,
      note: (s.note as string) ?? null,
      created_at: s.created_at as string,
    };
  });
}

export interface FareConfig {
  id: string;
  vehicle_type: string;
  base_fare: number;
  distance_rate: number;
  time_rate: number;
  waiting_rate: number;
  free_waiting_minutes: number;
  surcharge: number;
  country: string | null;
  state: string | null;
  city: string | null;
}

/** A row of the vehicle catalogue (label, seat capacity, on/off switch). */
export interface VehicleTypeConfig {
  type: string;
  label: string;
  seats: number;
  sort_order: number;
  is_enabled: boolean;
}

export async function getVehicleTypeConfigs(): Promise<VehicleTypeConfig[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('vehicle_type_config')
    .select('type, label, seats, sort_order, is_enabled')
    .order('sort_order');
  return (data ?? []) as VehicleTypeConfig[];
}

/** A geographic grant for a staff member. NULL state/city widen the scope. */
export interface StaffRegion {
  id: string;
  country: string;
  state: string | null;
  city: string | null;
}

/** A fare scope (geo dimensions only) — used for region containment checks. */
export type FareScope = Pick<FareConfig, 'country' | 'state' | 'city'>;

export async function getFareConfigs(): Promise<FareConfig[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('fare_config')
    .select('id, vehicle_type, base_fare, distance_rate, time_rate, waiting_rate, free_waiting_minutes, surcharge, country, state, city')
    .eq('is_active', true)
    .order('country', { ascending: true, nullsFirst: true })
    .order('state', { ascending: true, nullsFirst: true })
    .order('city', { ascending: true, nullsFirst: true })
    .order('vehicle_type');
  return (data ?? []) as FareConfig[];
}

/** Region grants for one staff member (empty = unrestricted for super_admin). */
export async function getStaffRegions(staffId: string): Promise<StaffRegion[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('staff_regions')
    .select('id, country, state, city')
    .eq('staff_id', staffId)
    .order('country')
    .order('state', { nullsFirst: true })
    .order('city', { nullsFirst: true });
  return (data ?? []) as StaffRegion[];
}

/**
 * Is `scope` contained within `region`? A NULL field on the region is a
 * wildcard (whole country / whole state); the scope must match every
 * non-null field. This prevents an admin granted a state from editing a
 * broader (country-wide or global) fare row.
 */
export function regionContainsScope(region: StaffRegion, scope: FareScope): boolean {
  if (scope.country !== region.country) return false;
  if (region.state !== null && scope.state !== region.state) return false;
  if (region.city !== null && scope.city !== region.city) return false;
  return true;
}

export interface SupportRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  created_at: string;
  user: string | null;
  user_id: string;
  user_phone: string | null;
  internal_note: string | null;
}

export async function listSupportTickets(): Promise<SupportRow[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('support_tickets')
    .select('id, user_id, subject, body, status, priority, internal_note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = asRows(data);
  const users = await resolveUsers(rows.map((t) => t.user_id as string));
  return rows.map((t) => {
    const u = users.get(t.user_id as string);
    return {
      id: t.id as string,
      subject: t.subject as string,
      body: t.body as string,
      status: t.status as string,
      priority: (t.priority as string) ?? 'normal',
      created_at: t.created_at as string,
      user: u?.full_name ?? null,
      user_id: t.user_id as string,
      user_phone: u?.phone ?? null,
      internal_note: (t.internal_note as string) ?? null,
    };
  });
}

/** All SOS alerts (every status) for the safety queue. */
export async function listSosAlerts(): Promise<SosRow[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('sos_alerts')
    .select('id, user_id, role, ride_id, lat, lng, status, note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = asRows(data);
  const users = await resolveUsers(rows.map((s) => s.user_id as string));
  return rows.map((s) => {
    const user = users.get(s.user_id as string);
    return {
      id: s.id as string,
      role: s.role as string,
      user: user?.full_name ?? null,
      user_phone: user?.phone ?? null,
      ride_id: (s.ride_id as string) ?? null,
      lat: (s.lat as number) ?? null,
      lng: (s.lng as number) ?? null,
      status: s.status as string,
      note: (s.note as string) ?? null,
      created_at: s.created_at as string,
    };
  });
}

/** Count of SOS alerts still needing attention (active or acknowledged). */
export async function countActiveSos(): Promise<number> {
  const svc = serviceClient();
  const { count } = await svc
    .from('sos_alerts')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'acknowledged']);
  return count ?? 0;
}

export interface ReportRow {
  id: string;
  reporter: string | null;
  reporter_id: string;
  reporter_role: string;
  subject: string | null;
  subject_id: string;
  subject_role: string;
  ride_id: string | null;
  category: string;
  description: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
}

export async function listReports(): Promise<ReportRow[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('reports')
    .select('id, reporter_id, reporter_role, subject_id, subject_role, ride_id, category, description, status, resolution_note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = asRows(data);
  const users = await resolveUsers(
    rows.flatMap((r) => [r.reporter_id as string, r.subject_id as string]),
  );
  return rows.map((r) => ({
    id: r.id as string,
    reporter: users.get(r.reporter_id as string)?.full_name ?? null,
    reporter_id: r.reporter_id as string,
    reporter_role: r.reporter_role as string,
    subject: users.get(r.subject_id as string)?.full_name ?? null,
    subject_id: r.subject_id as string,
    subject_role: r.subject_role as string,
    ride_id: (r.ride_id as string) ?? null,
    category: r.category as string,
    description: r.description as string,
    status: r.status as string,
    resolution_note: (r.resolution_note as string) ?? null,
    created_at: r.created_at as string,
  }));
}

// ── Driver profile (all tabs) ────────────────────────────────
export interface DriverDocument {
  id: string;
  type: string;
  file_url: string;
  status: string;
  notes: string | null;
  expires_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface DriverRideRow {
  id: string;
  status: string;
  pickup_address: string | null;
  drop_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  drop_lat: number | null;
  drop_lng: number | null;
  locked_fare: number | null;
  final_fare: number | null;
  ended_early: boolean;
  paid_amount: number | null;
  distance_km: number | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  requested_at: string;
  driver_id: string | null;
  rider: string | null;
  driver: string | null;
}

function mapProfileRideRow(row: Row): DriverRideRow {
  const rider = row.rider as { full_name?: string } | null;
  const driver = row.driver as { full_name?: string } | null;
  return {
    id: row.id as string,
    status: row.status as string,
    pickup_address: (row.pickup_address as string) ?? null,
    drop_address: (row.drop_address as string) ?? null,
    pickup_lat: (row.pickup_lat as number) ?? null,
    pickup_lng: (row.pickup_lng as number) ?? null,
    drop_lat: (row.drop_lat as number) ?? null,
    drop_lng: (row.drop_lng as number) ?? null,
    locked_fare: (row.locked_fare as number) ?? null,
    final_fare: (row.final_fare as number) ?? null,
    ended_early: row.ended_early === true,
    paid_amount: ridePaidAmount(row),
    distance_km: (row.distance_km as number) ?? null,
    accepted_at: (row.accepted_at as string) ?? null,
    started_at: (row.started_at as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
    requested_at: row.requested_at as string,
    driver_id: (row.driver_id as string) ?? null,
    rider: rider?.full_name ?? null,
    driver: driver?.full_name ?? null,
  };
}

export interface DriverRatingRow {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  rater: string | null;
}

export interface SubscriptionRow {
  id: string;
  for_date: string;
  amount: number;
  status: string;
  paid_from_wallet: boolean;
  paid_at: string | null;
}

export interface WalletTxnRow {
  id: string;
  amount: number;
  type: string;
  reason: string | null;
  created_at: string;
}

export interface WithdrawalRequestRow {
  id: string;
  amount: number;
  payout_method: string;
  driver_notes: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface ComplaintRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  created_at: string;
}

export interface DriverProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  upi_id: string | null;
  payment_phone: string | null;
  upi_qr_url: string | null;
  dob: string | null;
  gender: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  avatar_url: string | null;
  status: string;
  is_approved: boolean;
  is_founder: boolean;
  is_blocked: boolean;
  block_reason: string | null;
  is_on_hold: boolean;
  hold_reason: string | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  rating: number;
  total_rides: number;
  created_at: string;
  manager_name: string | null;
  vehicle: { reg_no: string | null; model: string | null; color: string | null; type: string; photos: string[] } | null;
  documents: DriverDocument[];
  rides: DriverRideRow[];
  ratings: DriverRatingRow[];
  subscriptions: SubscriptionRow[];
  complaints: ComplaintRow[];
  wallet_balance: number;
  wallet_txns: WalletTxnRow[];
  withdrawals: WithdrawalRequestRow[];
  earnings_total: number;
  freeDayCredits: FreeDayCreditRow[];
}

export interface FreeDayCreditRow {
  id: string;
  source: string;
  status: string;
  created_at: string;
}

export async function getDriverProfile(id: string): Promise<DriverProfile | null> {
  const svc = serviceClient();

  const { data: d } = await svc
    .from('drivers')
    .select(
      'id, status, is_approved, is_founder, city, rating, total_rides, created_at, ' +
        'full_name, phone, email, dob, gender, country, state, avatar_url, is_blocked, block_reason, is_on_hold, hold_reason, deactivated_at, deactivation_reason, ' +
        'upi_id, payment_phone, upi_qr_url, ' +
        'manager:admin_profiles!drivers_manager_id_fkey(full_name), ' +
        'vehicles(reg_no, model, color, type, photos)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!d) return null;
  const row = d as unknown as Row;
  const profile = row as {
    full_name?: string;
    phone?: string;
    email?: string;
    upi_id?: string;
    payment_phone?: string;
    upi_qr_url?: string;
    dob?: string;
    gender?: string;
    country?: string;
    state?: string;
    avatar_url?: string;
    is_blocked?: boolean;
    block_reason?: string;
    is_on_hold?: boolean;
    hold_reason?: string;
    deactivated_at?: string;
    deactivation_reason?: string;
  };
  const manager = row.manager as { full_name?: string } | null;
  const vehicles = row.vehicles as
    | { reg_no?: string; model?: string; color?: string; type?: string; photos?: string[] }[]
    | null;
  const v = vehicles?.[0];

  const [docs, rides, ratings, subs, wallet, txns, withdrawals, complaints] = await Promise.all([
    svc
      .from('driver_documents')
      .select('id, type, file_url, status, notes, expires_at, reviewed_at, created_at')
      .eq('driver_id', id)
      .order('created_at', { ascending: false }),
    svc
      .from('rides')
      .select(
        'id, status, pickup_address, drop_address, pickup_lat, pickup_lng, drop_lat, drop_lng, ' +
          'locked_fare, final_fare, ended_early, distance_km, accepted_at, started_at, completed_at, requested_at, driver_id, ' +
          'rider:riders!rides_rider_id_fkey(full_name), driver:drivers!rides_driver_id_fkey(full_name)',
      )
      .eq('driver_id', id)
      .order('requested_at', { ascending: false })
      .limit(50),
    svc
      .from('ratings')
      .select('id, stars, comment, created_at, rater_id')
      .eq('ratee_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    svc
      .from('subscriptions')
      .select('id, for_date, amount, status, paid_from_wallet, paid_at')
      .eq('driver_id', id)
      .order('for_date', { ascending: false })
      .limit(60),
    svc.from('wallets').select('balance').eq('driver_id', id).maybeSingle(),
    svc
      .from('wallet_transactions')
      .select('id, amount, type, reason, created_at')
      .eq('driver_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    svc
      .from('driver_withdrawal_requests')
      .select('id, amount, payout_method, driver_notes, status, admin_notes, reviewed_at, paid_at, created_at')
      .eq('driver_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    svc
      .from('support_tickets')
      .select('id, subject, body, status, priority, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const rideRows = asRows(rides.data).map(mapProfileRideRow);
  const earnings = rideRows
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + (r.paid_amount ?? 0), 0);

  const ratingRows = asRows(ratings.data);
  const raters = await resolveUsers(ratingRows.map((r) => r.rater_id as string));

  // Free-day credits granted to this driver (e.g. dispute comp). Lets an admin
  // see, before comping again, what they've already given.
  const { data: creditsData } = await svc
    .from('driver_free_day_credits')
    .select('id, source, status, created_at')
    .eq('driver_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    id: row.id as string,
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    email: profile?.email ?? null,
    upi_id: profile?.upi_id ?? null,
    payment_phone: profile?.payment_phone ?? null,
    upi_qr_url: profile?.upi_qr_url ?? null,
    dob: profile?.dob ?? null,
    gender: profile?.gender ?? null,
    country: profile?.country ?? null,
    state: profile?.state ?? null,
    city: (row.city as string) ?? null,
    avatar_url: profile?.avatar_url ?? null,
    status: row.status as string,
    is_approved: row.is_approved as boolean,
    is_founder: row.is_founder as boolean,
    is_blocked: profile?.is_blocked ?? false,
    block_reason: profile?.block_reason ?? null,
    is_on_hold: profile?.is_on_hold ?? false,
    hold_reason: profile?.hold_reason ?? null,
    deactivated_at: profile?.deactivated_at ?? null,
    deactivation_reason: profile?.deactivation_reason ?? null,
    rating: (row.rating as number) ?? 5,
    total_rides: (row.total_rides as number) ?? 0,
    created_at: row.created_at as string,
    manager_name: manager?.full_name ?? null,
    vehicle: v
      ? {
          reg_no: v.reg_no ?? null,
          model: v.model ?? null,
          color: v.color ?? null,
          type: v.type ?? 'auto',
          photos: v.photos ?? [],
        }
      : null,
    documents: (docs.data ?? []) as DriverDocument[],
    rides: rideRows,
    ratings: ratingRows.map((r) => ({
      id: r.id as string,
      stars: r.stars as number,
      comment: (r.comment as string) ?? null,
      created_at: r.created_at as string,
      rater: raters.get(r.rater_id as string)?.full_name ?? null,
    })),
    subscriptions: (subs.data ?? []) as SubscriptionRow[],
    complaints: (complaints.data ?? []) as ComplaintRow[],
    wallet_balance: ((wallet.data as { balance?: number } | null)?.balance as number) ?? 0,
    wallet_txns: (txns.data ?? []) as WalletTxnRow[],
    withdrawals: (withdrawals.data ?? []) as WithdrawalRequestRow[],
    earnings_total: earnings,
    freeDayCredits: (creditsData ?? []) as FreeDayCreditRow[],
  };
}

// ── Rider profile ────────────────────────────────────────────
export interface RiderProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  gender: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  created_at: string;
  rides: DriverRideRow[];
  total_rides: number;
  ratings: DriverRatingRow[];
  complaints: ComplaintRow[];
  /** Active no-show fine block (rider_blocks), or null if not fine-blocked. */
  noShowBlock: {
    fineAmount: number;
    fineStatus: string;
    blockedAt: string;
    strikes: number;
  } | null;
}

export async function getRiderProfile(id: string): Promise<RiderProfile | null> {
  const svc = serviceClient();
  const { data: p } = await svc
    .from('riders')
    .select('id, full_name, phone, gender, is_blocked, block_reason, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!p) return null;

  // No-show fine block: the rider app reads rider_blocks (not riders.is_blocked),
  // so surface it here with the distinct-driver strike count for context.
  const { data: blockRow } = await svc
    .from('rider_blocks')
    .select('fine_amount, fine_status, blocked_at')
    .eq('rider_id', id)
    .eq('fine_status', 'pending')
    .is('unblocked_at', null)
    .maybeSingle();
  let noShowBlock: RiderProfile['noShowBlock'] = null;
  if (blockRow) {
    const { data: strikeRows } = await svc
      .from('rider_strikes')
      .select('driver_id')
      .eq('rider_id', id)
      .eq('status', 'active');
    const distinctDrivers = new Set(
      (strikeRows ?? []).map((s) => (s as { driver_id: string }).driver_id),
    );
    noShowBlock = {
      fineAmount: Number((blockRow as { fine_amount: number }).fine_amount),
      fineStatus: (blockRow as { fine_status: string }).fine_status,
      blockedAt: (blockRow as { blocked_at: string }).blocked_at,
      strikes: distinctDrivers.size,
    };
  }

  const [ridesRes, ratingsRes, complaintsRes] = await Promise.all([
    svc
      .from('rides')
      .select(
        'id, status, pickup_address, drop_address, pickup_lat, pickup_lng, drop_lat, drop_lng, ' +
          'locked_fare, final_fare, ended_early, distance_km, accepted_at, started_at, completed_at, requested_at, driver_id, ' +
          'rider:riders!rides_rider_id_fkey(full_name), driver:drivers!rides_driver_id_fkey(full_name)',
        { count: 'exact' },
      )
      .eq('rider_id', id)
      .order('requested_at', { ascending: false })
      .limit(50),
    svc
      .from('ratings')
      .select('id, stars, comment, created_at, rater_id')
      .eq('ratee_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    svc
      .from('support_tickets')
      .select('id, subject, body, status, priority, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const ratingRows = asRows(ratingsRes.data);
  const raters = await resolveUsers(ratingRows.map((r) => r.rater_id as string));
  const row = p as unknown as Row;
  return {
    id: row.id as string,
    full_name: (row.full_name as string) ?? null,
    phone: (row.phone as string) ?? null,
    gender: (row.gender as string) ?? null,
    is_blocked: (row.is_blocked as boolean) ?? false,
    block_reason: (row.block_reason as string) ?? null,
    created_at: row.created_at as string,
    rides: asRows(ridesRes.data).map(mapProfileRideRow),
    total_rides: ridesRes.count ?? 0,
    ratings: ratingRows.map((r) => ({
      id: r.id as string,
      stars: r.stars as number,
      comment: (r.comment as string) ?? null,
      created_at: r.created_at as string,
      rater: raters.get(r.rater_id as string)?.full_name ?? null,
    })),
    complaints: (complaintsRes.data ?? []) as ComplaintRow[],
    noShowBlock,
  };
}

// ── Staff management ─────────────────────────────────────────
export interface StaffRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_blocked: boolean;
  created_at: string;
  regions: StaffRegion[];
}

export async function listStaff(): Promise<StaffRow[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('admin_profiles')
    .select('id, full_name, phone, role, is_blocked, created_at')
    .order('created_at', { ascending: false });
  const staff = asRows(data);
  if (staff.length === 0) return [];

  const { data: regionData } = await svc
    .from('staff_regions')
    .select('id, staff_id, country, state, city')
    .in(
      'staff_id',
      staff.map((s) => s.id as string),
    );
  const byStaff = new Map<string, StaffRegion[]>();
  for (const r of asRows(regionData)) {
    const list = byStaff.get(r.staff_id as string) ?? [];
    list.push({
      id: r.id as string,
      country: r.country as string,
      state: (r.state as string) ?? null,
      city: (r.city as string) ?? null,
    });
    byStaff.set(r.staff_id as string, list);
  }

  return staff.map((s) => ({
    id: s.id as string,
    full_name: (s.full_name as string) ?? null,
    phone: (s.phone as string) ?? null,
    role: s.role as string,
    is_blocked: (s.is_blocked as boolean) ?? false,
    created_at: s.created_at as string,
    regions: byStaff.get(s.id as string) ?? [],
  }));
}

// ── Global search ────────────────────────────────────────────
export interface SearchResult {
  drivers: { id: string; full_name: string | null; phone: string | null; city: string | null }[];
  riders: { id: string; full_name: string | null; phone: string | null }[];
}

/** Cross-entity lookup by name or phone for the header search. */
export async function globalSearch(term: string): Promise<SearchResult> {
  const q = term.trim();
  if (!q) return { drivers: [], riders: [] };
  const svc = serviceClient();
  const filter = `full_name.ilike.%${q}%,phone.ilike.%${q}%`;

  const [drivers, riders] = await Promise.all([
    svc
      .from('drivers')
      .select('id, city, full_name, phone')
      .or(filter)
      .limit(10),
    svc
      .from('riders')
      .select('id, full_name, phone')
      .or(filter)
      .limit(10),
  ]);

  return {
    drivers: asRows(drivers.data).map((d) => ({
      id: d.id as string,
      full_name: (d.full_name as string) ?? null,
      phone: (d.phone as string) ?? null,
      city: (d.city as string) ?? null,
    })),
    riders: asRows(riders.data).map((r) => ({
      id: r.id as string,
      full_name: (r.full_name as string) ?? null,
      phone: (r.phone as string) ?? null,
    })),
  };
}

// ── Money: revenue & subscriptions ───────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD for Bandi's India service day, regardless of server timezone. */
function isoDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export interface DailyCollection {
  date: string;
  collected: number;
  paidCount: number;
}

export interface RevenueOverview {
  date: string;
  collectedToday: number;
  paidCount: number;
  unpaidCount: number;
  approvedDrivers: number;
  refundedToday: number;
  walletFloat: number; // sum of all wallet balances
  collectionRate: number; // paid / approved, 0..1
  trend: DailyCollection[]; // last 14 days, oldest → newest
}

export async function getRevenueOverview(date?: string): Promise<RevenueOverview> {
  const svc = serviceClient();
  const today = date ?? isoDate(new Date());
  const since = isoDate(new Date(Date.now() - 13 * DAY_MS));

  const [approved, todaySubs, trendSubs, wallets] = await Promise.all([
    svc.from('drivers').select('*', HEAD).eq('is_approved', true),
    svc.from('subscriptions').select('amount, status, paid_at').eq('for_date', today),
    svc
      .from('subscriptions')
      .select('for_date, amount, status')
      .gte('for_date', since)
      .order('for_date', { ascending: true }),
    svc.from('wallets').select('balance'),
  ]);

  const approvedDrivers = approved.count ?? 0;
  const todayRows = asRows(todaySubs.data);
  const paid = todayRows.filter((s) => s.status !== 'refunded');
  const collectedToday = paid.reduce((sum, s) => sum + ((s.amount as number) ?? 0), 0);
  const refundedToday = todayRows
    .filter((s) => s.status === 'refunded')
    .reduce((sum, s) => sum + ((s.amount as number) ?? 0), 0);
  const paidCount = paid.length;

  // bucket trend by date
  const byDate = new Map<string, DailyCollection>();
  for (let i = 13; i >= 0; i--) {
    const d = isoDate(new Date(Date.now() - i * DAY_MS));
    byDate.set(d, { date: d, collected: 0, paidCount: 0 });
  }
  for (const s of asRows(trendSubs.data)) {
    if (s.status === 'refunded') continue;
    const key = s.for_date as string;
    const slot = byDate.get(key);
    if (slot) {
      slot.collected += (s.amount as number) ?? 0;
      slot.paidCount += 1;
    }
  }

  const walletFloat = asRows(wallets.data).reduce(
    (sum, w) => sum + ((w.balance as number) ?? 0),
    0,
  );

  return {
    date: today,
    collectedToday,
    paidCount,
    unpaidCount: Math.max(0, approvedDrivers - paidCount),
    approvedDrivers,
    refundedToday,
    walletFloat,
    collectionRate: approvedDrivers ? paidCount / approvedDrivers : 0,
    trend: [...byDate.values()],
  };
}

// ── Subscription plans (daily fee config) ────────────────────
export interface SubscriptionPlan {
  id: string;
  country: string | null; // null = global default
  vehicle_type: string;
  price: number;
  currency: string;
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('subscription_plans')
    .select('id, country, vehicle_type, price, currency')
    .eq('is_active', true)
    .order('country', { ascending: true, nullsFirst: true })
    .order('vehicle_type');
  return (data ?? []) as SubscriptionPlan[];
}

// ── Free subscription grants (reuse drivers.founder_free_until) ──
export interface FreeDriverRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  is_founder: boolean;
  free_until: string; // YYYY-MM-DD
}

/** Drivers whose subscription is currently waived (free_until today or later). */
export async function listFreeDrivers(): Promise<FreeDriverRow[]> {
  const svc = serviceClient();
  const today = isoDate(new Date());
  const { data } = await svc
    .from('drivers')
    .select('id, full_name, phone, city, is_founder, founder_free_until')
    .gte('founder_free_until', today)
    .order('founder_free_until', { ascending: true });
  return asRows(data).map((d) => ({
    id: d.id as string,
    full_name: (d.full_name as string) ?? null,
    phone: (d.phone as string) ?? null,
    city: (d.city as string) ?? null,
    is_founder: (d.is_founder as boolean) ?? false,
    free_until: d.founder_free_until as string,
  }));
}

export interface DriverPaymentRow {
  id: string; // driver id
  full_name: string | null;
  phone: string | null;
  city: string | null;
  paid: boolean;
  amount: number | null;
  paid_from_wallet: boolean;
  status: string | null; // subscription status, null if unpaid
}

/**
 * Reconciliation view for a date: every approved driver with their subscription
 * status (paid / unpaid). Supports search + a paidOnly/unpaidOnly filter.
 */
export async function listDriverPayments(
  date: string,
  opts: ListOptions & { filter?: 'paid' | 'unpaid' } = {},
): Promise<Page<DriverPaymentRow>> {
  const svc = serviceClient();
  const [from, to] = range(opts.page ?? 1);

  let q = svc
    .from('drivers')
    .select('id, city, full_name, phone', { count: 'exact' })
    .eq('is_approved', true)
    .order('created_at', { ascending: false });
  if (opts.search) {
    q = q.or(`full_name.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`);
  }
  const { data: drivers, count } = await q.range(from, to);
  const driverRows = asRows(drivers);
  const ids = driverRows.map((d) => d.id as string);

  const { data: subs } = await svc
    .from('subscriptions')
    .select('driver_id, amount, status, paid_from_wallet')
    .eq('for_date', date)
    .in('driver_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const subByDriver = new Map<string, Row>();
  for (const s of asRows(subs)) subByDriver.set(s.driver_id as string, s);

  let rows: DriverPaymentRow[] = driverRows.map((d) => {
    const sub = subByDriver.get(d.id as string);
    const paid = !!sub && sub.status !== 'refunded';
    return {
      id: d.id as string,
      full_name: (d.full_name as string) ?? null,
      phone: (d.phone as string) ?? null,
      city: (d.city as string) ?? null,
      paid,
      amount: sub ? ((sub.amount as number) ?? null) : null,
      paid_from_wallet: !!sub?.paid_from_wallet,
      status: sub ? (sub.status as string) : null,
    };
  });

  if (opts.filter === 'paid') rows = rows.filter((r) => r.paid);
  if (opts.filter === 'unpaid') rows = rows.filter((r) => !r.paid);

  return { rows, total: count ?? 0 };
}

// ── Analytics ────────────────────────────────────────────────
export type Granularity = 'day' | 'month' | 'quarter' | 'year';

export interface AnalyticsBucket {
  label: string;
  rides: number; // completed rides in bucket
  rideRevenue: number; // sum of completed actual paid fare (goes to drivers)
  subsRevenue: number; // subscription income (platform)
}

export interface AnalyticsResult {
  granularity: Granularity;
  buckets: AnalyticsBucket[];
  totalRides: number;
  totalRideRevenue: number;
  totalSubsRevenue: number;
}

const GRAIN_SINCE: Record<Granularity, () => Date> = {
  day: () => new Date(Date.now() - 13 * DAY_MS),
  month: () => new Date(Date.now() - 364 * DAY_MS),
  quarter: () => new Date(Date.now() - 730 * DAY_MS),
  year: () => new Date(Date.now() - 365 * 4 * DAY_MS),
};

function bucketKey(iso: string, grain: Granularity): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based
  switch (grain) {
    case 'day':
      return iso.slice(0, 10);
    case 'month':
      return `${y}-${String(m + 1).padStart(2, '0')}`;
    case 'quarter':
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case 'year':
      return String(y);
  }
}

export async function getAnalytics(grain: Granularity): Promise<AnalyticsResult> {
  const svc = serviceClient();
  const since = GRAIN_SINCE[grain]().toISOString();
  const sinceDate = since.slice(0, 10);

  const [ridesRes, subsRes] = await Promise.all([
    svc
      .from('rides')
      .select('completed_at, locked_fare, final_fare, status')
      .eq('status', 'completed')
      .gte('completed_at', since)
      .order('completed_at', { ascending: true }),
    svc
      .from('subscriptions')
      .select('for_date, amount, status')
      .gte('for_date', sinceDate)
      .order('for_date', { ascending: true }),
  ]);

  const map = new Map<string, AnalyticsBucket>();
  const slot = (key: string): AnalyticsBucket => {
    let s = map.get(key);
    if (!s) {
      s = { label: key, rides: 0, rideRevenue: 0, subsRevenue: 0 };
      map.set(key, s);
    }
    return s;
  };

  for (const r of asRows(ridesRes.data)) {
    const at = r.completed_at as string | null;
    if (!at) continue;
    const s = slot(bucketKey(at, grain));
    s.rides += 1;
    s.rideRevenue += ridePaidAmount(r) ?? 0;
  }
  for (const sub of asRows(subsRes.data)) {
    if (sub.status === 'refunded') continue;
    const s = slot(bucketKey(sub.for_date as string, grain));
    s.subsRevenue += (sub.amount as number) ?? 0;
  }

  const buckets = [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  return {
    granularity: grain,
    buckets,
    totalRides: buckets.reduce((n, b) => n + b.rides, 0),
    totalRideRevenue: buckets.reduce((n, b) => n + b.rideRevenue, 0),
    totalSubsRevenue: buckets.reduce((n, b) => n + b.subsRevenue, 0),
  };
}

export interface CityPerformance {
  city: string;
  drivers: number;
  onlineDrivers: number;
  totalRides: number;
  avgRating: number;
}

export async function getCityPerformance(): Promise<CityPerformance[]> {
  const svc = serviceClient();
  const { data } = await svc
    .from('drivers')
    .select('city, status, total_rides, rating')
    .eq('is_approved', true);

  const map = new Map<string, { drivers: number; online: number; rides: number; ratingSum: number }>();
  for (const d of asRows(data)) {
    const city = ((d.city as string) || 'Unassigned').trim() || 'Unassigned';
    const slot = map.get(city) ?? { drivers: 0, online: 0, rides: 0, ratingSum: 0 };
    slot.drivers += 1;
    if (d.status === 'online' || d.status === 'on_ride') slot.online += 1;
    slot.rides += (d.total_rides as number) ?? 0;
    slot.ratingSum += (d.rating as number) ?? 5;
    map.set(city, slot);
  }

  return [...map.entries()]
    .map(([city, s]) => ({
      city,
      drivers: s.drivers,
      onlineDrivers: s.online,
      totalRides: s.rides,
      avgRating: s.drivers ? s.ratingSum / s.drivers : 0,
    }))
    .sort((a, b) => b.totalRides - a.totalRides);
}

export interface LeaderRow {
  id: string;
  full_name: string | null;
  city: string | null;
  total_rides: number;
  rating: number;
}

export interface Leaderboards {
  topByRides: LeaderRow[];
  topByRating: LeaderRow[];
  needsAttention: LeaderRow[]; // lowest-rated active drivers
}

export async function getLeaderboards(): Promise<Leaderboards> {
  const svc = serviceClient();
  const { data } = await svc
    .from('drivers')
    .select('id, total_rides, rating, city, full_name')
    .eq('is_approved', true);

  const rows: LeaderRow[] = asRows(data).map((d) => ({
    id: d.id as string,
    full_name: (d.full_name as string) ?? null,
    city: (d.city as string) ?? null,
    total_rides: (d.total_rides as number) ?? 0,
    rating: (d.rating as number) ?? 5,
  }));

  const byRides = [...rows].sort((a, b) => b.total_rides - a.total_rides);
  const rated = rows.filter((r) => r.total_rides > 0);
  const byRating = [...rated].sort((a, b) => b.rating - a.rating);
  const needsAttention = [...rated].sort((a, b) => a.rating - b.rating);

  return {
    topByRides: byRides.slice(0, 10),
    topByRating: byRating.slice(0, 10),
    needsAttention: needsAttention.slice(0, 10),
  };
}

// ── Ratings review ───────────────────────────────────────────
export interface RatingReviewRow {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  rater: string | null;
  ratee: string | null;
}

export async function listRatings(
  opts: ListOptions & { maxStars?: number } = {},
): Promise<Page<RatingReviewRow>> {
  const svc = serviceClient();
  const [from, to] = range(opts.page ?? 1);
  let q = svc
    .from('ratings')
    .select('id, stars, comment, created_at, rater_id, ratee_id', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (opts.maxStars) q = q.lte('stars', opts.maxStars);

  const { data, count } = await q.range(from, to);
  const data_rows = asRows(data);
  const users = await resolveUsers(
    data_rows.flatMap((r) => [r.rater_id as string, r.ratee_id as string]),
  );
  const rows = data_rows.map((r) => ({
    id: r.id as string,
    stars: r.stars as number,
    comment: (r.comment as string) ?? null,
    created_at: r.created_at as string,
    rater: users.get(r.rater_id as string)?.full_name ?? null,
    ratee: users.get(r.ratee_id as string)?.full_name ?? null,
  }));
  return { rows, total: count ?? 0 };
}

// ── Production operations queue ─────────────────────────────
export type OperationsCategory = 'ride' | 'billing' | 'subscription' | 'onboarding' | 'account';
export type OperationsPriority = 'critical' | 'high' | 'medium' | 'low';
export type OperationsStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

export interface OperationsCase {
  id: string | null;
  signal_key: string;
  category: OperationsCategory;
  priority: OperationsPriority;
  status: OperationsStatus;
  entity_type: string;
  entity_id: string | null;
  title: string;
  summary: string | null;
  href: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  resolution_note: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface OperationsDashboard {
  cases: OperationsCase[];
  counts: Record<OperationsStatus, number>;
  categoryCounts: Record<OperationsCategory, number>;
}

const PRIORITY_ORDER: Record<OperationsPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function hoursOld(value: unknown): number {
  const time = new Date(String(value ?? '')).getTime();
  return Number.isFinite(time) ? (Date.now() - time) / 3_600_000 : 0;
}

/**
 * Detect operational exceptions from source-of-truth tables and overlay any
 * persisted staff ownership/outcome from admin_operations_cases.
 */
export async function getOperationsDashboard(): Promise<OperationsDashboard> {
  const svc = serviceClient();
  const [ridesRes, paymentsRes, subscriptionsRes, driversRes, docsRes, disputesRes, casesRes] = await Promise.all([
    svc
      .from('rides')
      .select(
        'id, status, requested_at, accepted_at, started_at, paid_confirmed, cancelled_by, cancel_reason, ' +
          'rider:riders!rides_rider_id_fkey(full_name), driver:drivers!rides_driver_id_fkey(full_name)',
      )
      .in('status', [...LIVE_STATUSES, 'unconfirmed', 'cancelled'])
      .order('requested_at', { ascending: false })
      .limit(150),
    svc
      .from('payments')
      .select('id, driver_id, razorpay_payment_id, amount, status, credited, created_at, driver:drivers(full_name)')
      .order('created_at', { ascending: false })
      .limit(150),
    svc
      .from('subscriptions')
      .select('id, driver_id, for_date, amount, status, paid_from_wallet, paid_at, driver:drivers(full_name)')
      .order('paid_at', { ascending: false })
      .limit(150),
    svc
      .from('drivers')
      .select('id, full_name, phone, is_approved, is_blocked, created_at')
      .eq('is_approved', false)
      .order('created_at', { ascending: true })
      .limit(150),
    svc.from('driver_documents').select('driver_id, status'),
    svc
      .from('disputes')
      .select('id, ride_id, reason, note, status, created_at')
      .in('status', ['open', 'reviewing'])
      .order('created_at', { ascending: false })
      .limit(150),
    svc
      .from('admin_operations_cases')
      .select('*, assignee:admin_profiles!admin_operations_cases_assigned_to_fkey(full_name)')
      .order('last_seen_at', { ascending: false })
      .limit(300),
  ]);

  const now = new Date().toISOString();
  const detected: OperationsCase[] = [];
  const add = (input: Omit<OperationsCase, 'id' | 'status' | 'assigned_to' | 'assigned_name' | 'resolution_note' | 'first_seen_at' | 'last_seen_at'> & { seenAt?: string }) => {
    detected.push({
      ...input,
      id: null,
      status: 'open',
      assigned_to: null,
      assigned_name: null,
      resolution_note: null,
      first_seen_at: input.seenAt ?? now,
      last_seen_at: now,
    });
  };

  for (const ride of asRows(ridesRes.data)) {
    const id = ride.id as string;
    const status = ride.status as string;
    const rider = (ride.rider as { full_name?: string } | null)?.full_name ?? 'Unknown rider';
    const driver = (ride.driver as { full_name?: string } | null)?.full_name ?? 'unassigned';
    const age = hoursOld(ride.requested_at);
    let priority: OperationsPriority | null = null;
    let title = '';
    let summary = '';
    if (status === 'unconfirmed') {
      priority = 'high';
      title = 'Ride completed without payment confirmation';
      summary = `${rider} and ${driver}; verify payment and completion evidence.`;
    } else if (['requested', 'searching'].includes(status) && age > 0.08) {
      priority = age > 0.5 ? 'critical' : 'high';
      title = 'Ride request is stalled';
      summary = `Still ${status} after ${Math.max(1, Math.round(age * 60))} minutes; check dispatch supply and offers.`;
    } else if (['accepted', 'arrived'].includes(status) && age > 0.5) {
      priority = age > 2 ? 'critical' : 'high';
      title = 'Accepted ride has not started';
      summary = `${rider} and ${driver}; ride has remained ${status} for ${age.toFixed(1)} hours.`;
    } else if (status === 'in_progress' && hoursOld(ride.started_at) > 3) {
      priority = 'critical';
      title = 'Ride has been in progress unusually long';
      summary = `Trip has remained active for ${hoursOld(ride.started_at).toFixed(1)} hours.`;
    } else if (status === 'cancelled' && age < 24) {
      priority = 'medium';
      title = 'Recent ride cancellation';
      summary = `Cancelled by ${String(ride.cancelled_by ?? 'unknown')}: ${String(ride.cancel_reason ?? 'no reason supplied')}.`;
    }
    if (priority) add({ signal_key: `ride:${id}:${status}`, category: 'ride', priority, entity_type: 'ride', entity_id: id, title, summary, href: `/rides/${id}`, seenAt: ride.requested_at as string });
  }

  for (const payment of asRows(paymentsRes.data)) {
    const failed = payment.status === 'failed';
    const missingCredit = payment.status === 'captured' && payment.credited !== true;
    if (!failed && !missingCredit) continue;
    const driver = (payment.driver as { full_name?: string } | null)?.full_name ?? 'Unknown driver';
    const id = payment.id as string;
    add({
      signal_key: `payment:${id}:${failed ? 'failed' : 'uncredited'}`,
      category: 'billing',
      priority: missingCredit ? 'critical' : 'high',
      entity_type: 'payment',
      entity_id: id,
      title: failed ? 'Wallet recharge payment failed' : 'Captured payment was not credited',
      summary: `${driver}; INR ${Number(payment.amount ?? 0).toFixed(2)}; payment ${String(payment.razorpay_payment_id ?? id)}.`,
      href: `/drivers/${String(payment.driver_id)}`,
      seenAt: payment.created_at as string,
    });
  }

  for (const dispute of asRows(disputesRes.data)) {
    const id = dispute.id as string;
    const rideId = dispute.ride_id as string;
    const reason = String(dispute.reason ?? 'other');
    const paymentIssue = reason === 'payment';
    add({
      signal_key: `dispute:${id}`,
      category: paymentIssue ? 'billing' : 'ride',
      priority: reason === 'safety' ? 'critical' : paymentIssue ? 'high' : 'medium',
      entity_type: 'dispute',
      entity_id: id,
      title: `Driver dispute: ${reason.replaceAll('_', ' ')}`,
      summary: String(dispute.note ?? 'No additional details supplied.'),
      href: `/rides/${rideId}`,
      seenAt: dispute.created_at as string,
    });
  }

  for (const sub of asRows(subscriptionsRes.data)) {
    if (!['refunded', 'expired'].includes(String(sub.status))) continue;
    const driver = (sub.driver as { full_name?: string } | null)?.full_name ?? 'Unknown driver';
    const id = sub.id as string;
    add({
      signal_key: `subscription:${id}:${String(sub.status)}`,
      category: 'subscription',
      priority: sub.status === 'refunded' ? 'medium' : 'low',
      entity_type: 'subscription',
      entity_id: id,
      title: sub.status === 'refunded' ? 'Daily subscription was refunded' : 'Subscription expired',
      summary: `${driver}; service date ${String(sub.for_date)}; INR ${Number(sub.amount ?? 0).toFixed(2)}.`,
      href: `/drivers/${String(sub.driver_id)}`,
      seenAt: (sub.paid_at as string) ?? now,
    });
  }

  const docsByDriver = new Map<string, string[]>();
  for (const doc of asRows(docsRes.data)) {
    const id = doc.driver_id as string;
    docsByDriver.set(id, [...(docsByDriver.get(id) ?? []), doc.status as string]);
  }
  for (const driver of asRows(driversRes.data)) {
    if (driver.is_blocked) continue;
    const id = driver.id as string;
    const statuses = docsByDriver.get(id) ?? [];
    const age = hoursOld(driver.created_at);
    const hasRejected = statuses.includes('rejected');
    const hasPending = statuses.includes('pending');
    const priority: OperationsPriority = age > 72 ? 'high' : 'medium';
    const state = statuses.length === 0 ? 'No KYC documents uploaded' : hasRejected ? 'KYC has rejected documents' : hasPending ? 'KYC review is pending' : 'Approval decision is pending';
    add({
      signal_key: `onboarding:${id}:${hasRejected ? 'rejected' : hasPending ? 'pending' : statuses.length ? 'approval' : 'missing'}`,
      category: 'onboarding',
      priority,
      entity_type: 'driver',
      entity_id: id,
      title: state,
      summary: `${String(driver.full_name ?? driver.phone ?? 'Unnamed driver')}; waiting ${Math.max(1, Math.round(age))} hours.`,
      href: `/drivers/${id}`,
      seenAt: driver.created_at as string,
    });
  }

  const persisted = new Map<string, Row>();
  for (const row of asRows(casesRes.data)) persisted.set(row.signal_key as string, row);
  const currentKeys = new Set(detected.map((item) => item.signal_key));
  const merged = detected.map((item) => {
    const saved = persisted.get(item.signal_key);
    if (!saved) return item;
    const assignee = saved.assignee as { full_name?: string } | null;
    return {
      ...item,
      id: saved.id as string,
      status: saved.status as OperationsStatus,
      assigned_to: (saved.assigned_to as string) ?? null,
      assigned_name: assignee?.full_name ?? null,
      resolution_note: (saved.resolution_note as string) ?? null,
      first_seen_at: saved.first_seen_at as string,
      last_seen_at: saved.last_seen_at as string,
    };
  });

  for (const saved of persisted.values()) {
    if (currentKeys.has(saved.signal_key as string)) continue;
    const assignee = saved.assignee as { full_name?: string } | null;
    merged.push({
      id: saved.id as string,
      signal_key: saved.signal_key as string,
      category: saved.category as OperationsCategory,
      priority: saved.priority as OperationsPriority,
      status: saved.status as OperationsStatus,
      entity_type: saved.entity_type as string,
      entity_id: (saved.entity_id as string) ?? null,
      title: saved.title as string,
      summary: (saved.summary as string) ?? null,
      href: null,
      assigned_to: (saved.assigned_to as string) ?? null,
      assigned_name: assignee?.full_name ?? null,
      resolution_note: (saved.resolution_note as string) ?? null,
      first_seen_at: saved.first_seen_at as string,
      last_seen_at: saved.last_seen_at as string,
    });
  }

  merged.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
  const statuses: OperationsStatus[] = ['open', 'in_review', 'resolved', 'dismissed'];
  const categories: OperationsCategory[] = ['ride', 'billing', 'subscription', 'onboarding', 'account'];
  return {
    cases: merged,
    counts: Object.fromEntries(statuses.map((status) => [status, merged.filter((item) => item.status === status).length])) as Record<OperationsStatus, number>,
    categoryCounts: Object.fromEntries(categories.map((category) => [category, merged.filter((item) => item.category === category && ['open', 'in_review'].includes(item.status)).length])) as Record<OperationsCategory, number>,
  };
}
