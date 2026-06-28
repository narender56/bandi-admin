import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, Star, Car } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import {
  listDriversByTab,
  DRIVERS_PAGE_SIZE,
  type DriverTab,
  type DriverRow,
} from '@/lib/data';
import { formatDateTime, formatINR } from '@/lib/utils';
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
import { DirectoryFilters } from '@/components/data/directory-filters';
import { CreateDriverDialog } from '@/components/drivers/create-driver-dialog';
import { CreateMockUserDialog } from '@/components/drivers/create-mock-user-dialog';

const TABS: { key: DriverTab; label: string }[] = [
  { key: 'approved', label: 'Approved' },
  { key: 'new', label: 'New requests' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'deactivated', label: 'Deactivated' },
];

const TAB_KEYS = TABS.map((t) => t.key);

const DRIVER_FILTERS = [
  {
    key: 'status',
    label: 'Status',
    kind: 'select' as const,
    options: [
      { value: 'online', label: 'Online' },
      { value: 'offline', label: 'Offline' },
      { value: 'on_ride', label: 'On ride' },
      { value: 'on_break', label: 'On break' },
      { value: 'blocked', label: 'Blocked' },
      { value: 'on_hold', label: 'On hold' },
    ],
  },
  {
    key: 'vehicleType',
    label: 'Vehicle type',
    kind: 'select' as const,
    options: [
      { value: 'bike', label: 'Bike' },
      { value: 'auto', label: 'Auto' },
      { value: 'hatchback', label: 'Hatchback' },
      { value: 'sedan', label: 'Sedan' },
      { value: 'premium', label: 'Premium' },
      { value: 'xl', label: 'XL' },
    ],
  },
  { key: 'country', label: 'Country', kind: 'text' as const, placeholder: 'India' },
  { key: 'state', label: 'State', kind: 'text' as const, placeholder: 'Telangana' },
  { key: 'city', label: 'Area / city', kind: 'text' as const, placeholder: 'Hyderabad' },
  {
    key: 'minRating',
    label: 'Minimum rating',
    kind: 'select' as const,
    options: [
      { value: '4.5', label: '4.5+' },
      { value: '4', label: '4.0+' },
      { value: '3', label: '3.0+' },
    ],
  },
  {
    key: 'settlementStatus',
    label: 'Settlement',
    kind: 'select' as const,
    options: [
      { value: 'pending', label: 'Waiting review' },
      { value: 'approved', label: 'Approved, unpaid' },
      { value: 'paid', label: 'Paid / completed' },
      { value: 'rejected', label: 'Issue / rejected' },
      { value: 'none', label: 'No request' },
    ],
  },
  { key: 'createdFrom', label: 'Created from', kind: 'date' as const },
  { key: 'createdTo', label: 'Created to', kind: 'date' as const },
  { key: 'deactivatedFrom', label: 'Deactivated from', kind: 'date' as const },
  { key: 'deactivatedTo', label: 'Deactivated to', kind: 'date' as const },
];

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  online: 'success',
  on_ride: 'success',
  on_break: 'warning',
  offline: 'neutral',
};

function DriverStatusBadge({ d }: { d: DriverRow }) {
  if (d.deactivated_at) return <Badge variant="neutral">Deactivated</Badge>;
  if (d.is_blocked) return <Badge variant="danger">Blocked</Badge>;
  return (
    <Badge variant={STATUS_TONE[d.status] ?? 'neutral'}>
      {d.status.replace('_', ' ')}
    </Badge>
  );
}

export default async function DriversPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    q?: string;
    page?: string;
    status?: string;
    vehicleType?: string;
    country?: string;
    state?: string;
    city?: string;
    minRating?: string;
    createdFrom?: string;
    createdTo?: string;
    deactivatedFrom?: string;
    deactivatedTo?: string;
    settlementStatus?: string;
  }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'directory:browse')) redirect(`/${locale}/account`);

  const sp = await searchParams;
  const tab: DriverTab = (TAB_KEYS as string[]).includes(sp.tab ?? '')
    ? (sp.tab as DriverTab)
    : 'approved';
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.q?.trim() || undefined;
  const minRating = Number(sp.minRating);

  const { rows, total, counts } = await listDriversByTab(tab, {
    page,
    search,
    status: sp.status || undefined,
    vehicleType: sp.vehicleType || undefined,
    country: sp.country?.trim() || undefined,
    state: sp.state?.trim() || undefined,
    city: sp.city?.trim() || undefined,
    minRating: Number.isFinite(minRating) && minRating > 0 ? minRating : undefined,
    createdFrom: sp.createdFrom || undefined,
    createdTo: sp.createdTo || undefined,
    deactivatedFrom: sp.deactivatedFrom || undefined,
    deactivatedTo: sp.deactivatedTo || undefined,
    settlementStatus: sp.settlementStatus || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="text-sm text-muted-foreground">
            Onboarding funnel and active roster
          </p>
        </div>
        {can(role, 'drivers:onboard') && (
          <div className="flex items-center gap-2">
            <CreateMockUserDialog />
            <CreateDriverDialog />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <UrlTabs
          active={tab}
          tabs={TABS.map((t) => ({ ...t, count: counts[t.key] }))}
        />
        <SearchInput placeholder="Search drivers by name or phone…" />
      </div>

      <DirectoryFilters filters={DRIVER_FILTERS} />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              {tab === 'deactivated' && <TableHead>Settlement</TableHead>}
              <TableHead className="text-right">Rides</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={tab === 'deactivated' ? 9 : 8}
                  className="py-16 text-center text-muted-foreground"
                >
                  No drivers in “{TABS.find((t) => t.key === tab)?.label}”
                  {search ? ` matching “${search}”` : ''}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((d) => (
                <TableRow key={d.id} className="group">
                  <TableCell>
                    <Link
                      href={`/${locale}/drivers/${d.id}`}
                      className="flex items-center gap-2 font-medium hover:text-primary"
                    >
                      {d.full_name ?? 'Unnamed'}
                      {d.is_founder && (
                        <Badge variant="warning" className="text-[10px]">
                          Founder
                        </Badge>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {d.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    {d.vehicle_type || d.reg_no ? (
                      <div className="flex flex-col gap-1">
                        {d.vehicle_type && (
                          <Badge variant="neutral" className="w-fit capitalize">
                            {d.vehicle_type === 'xl' ? 'XL' : d.vehicle_type}
                          </Badge>
                        )}
                        {d.reg_no && (
                          <span className="flex items-center gap-1.5 text-sm">
                            <Car className="size-3.5 text-muted-foreground" />
                            {d.reg_no}
                            {d.model && (
                              <span className="text-muted-foreground">
                                · {d.model}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.city ?? '—'}
                  </TableCell>
                  <TableCell>
                    <DriverStatusBadge d={d} />
                  </TableCell>
                  {tab === 'deactivated' && (
                    <TableCell>
                      <SettlementBadge d={d} />
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    {d.total_rides}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Star className="size-3.5 fill-warning text-warning" />
                      {d.rating.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${locale}/drivers/${d.id}`}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination page={page} total={total} pageSize={DRIVERS_PAGE_SIZE} />
    </div>
  );
}

function SettlementBadge({ d }: { d: DriverRow }) {
  if (!d.deactivated_at) return null;
  if (!d.settlement_status) {
    return <Badge variant="danger">No settlement</Badge>;
  }
  const tone =
    d.settlement_status === 'paid'
      ? 'success'
      : d.settlement_status === 'rejected'
        ? 'danger'
        : 'warning';
  const label =
    d.settlement_status === 'pending'
      ? 'Waiting review'
      : d.settlement_status === 'approved'
        ? 'Approved, unpaid'
        : d.settlement_status === 'paid'
          ? 'Paid'
          : 'Issue';
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={tone}>{label}</Badge>
      <span className="text-xs text-muted-foreground">
        {d.settlement_amount !== null ? formatINR(d.settlement_amount) : '—'}
        {d.settlement_paid_at
          ? ` · paid ${formatDateTime(d.settlement_paid_at)}`
          : d.settlement_requested_at
            ? ` · requested ${formatDateTime(d.settlement_requested_at)}`
            : ''}
      </span>
    </div>
  );
}
