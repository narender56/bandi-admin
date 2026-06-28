import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import {
  getRideSimulationPointsForRides,
  listRidesByTab,
  RIDES_PAGE_SIZE,
  type RideTab,
} from '@/lib/data';
import { formatINR, formatDateTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SearchInput } from '@/components/data/search-input';
import { Pagination } from '@/components/data/pagination';
import { UrlTabs } from '@/components/data/url-tabs';
import { RideReplayDialog } from '@/components/rides/ride-replay-dialog';

const TABS: { key: RideTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'live', label: 'Live' },
];
const TAB_KEYS = TABS.map((t) => t.key);

const RIDE_TONE: Record<
  string,
  'success' | 'warning' | 'danger' | 'default' | 'neutral'
> = {
  completed: 'success',
  cancelled: 'danger',
  in_progress: 'warning',
  accepted: 'default',
  arrived: 'default',
  searching: 'warning',
  requested: 'warning',
};

export default async function RidesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'profiles:view')) redirect(`/${locale}/account`);

  const sp = await searchParams;
  const tab: RideTab = (TAB_KEYS as string[]).includes(sp.tab ?? '')
    ? (sp.tab as RideTab)
    : 'all';
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.q?.trim() || undefined;
  const { rows, total, counts } = await listRidesByTab(tab, { page, search });
  const canSeeSimulation = role === 'admin' || role === 'super_admin';
  const simulationByRide = canSeeSimulation
    ? await getRideSimulationPointsForRides(rows.map((ride) => ride.id))
    : {};
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rides</h1>
        <p className="text-sm text-muted-foreground">
          All trips across the platform
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <UrlTabs
          active={tab}
          tabs={TABS.map((t) => ({ ...t, count: counts[t.key] }))}
        />
        <SearchInput placeholder="Search by pickup or drop…" />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Rider</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Fare</TableHead>
              <TableHead className="text-right">When</TableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-16 text-center text-muted-foreground"
                >
                  No rides {search ? `matching “${search}”` : 'here'}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell className="max-w-xs">
                    <Link
                      href={`/${locale}/rides/${r.id}`}
                      className="block hover:text-primary"
                    >
                      <p className="truncate text-sm font-medium">
                        {r.pickup_address ?? '—'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        → {r.drop_address ?? '—'}
                      </p>
                    </Link>
                  </TableCell>
                  <TableCell>{r.rider ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.driver ?? 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={RIDE_TONE[r.status] ?? 'neutral'}>
                      {r.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(r.paid_amount)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDateTime(r.requested_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {canSeeSimulation && (
                        <RideReplayDialog
                          ride={r}
                          points={simulationByRide[r.id] ?? []}
                          mapsApiKey={mapsApiKey}
                        />
                      )}
                      <Link
                        href={`/${locale}/rides/${r.id}`}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label="Open ride detail"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination page={page} total={total} pageSize={RIDES_PAGE_SIZE} />
    </div>
  );
}
