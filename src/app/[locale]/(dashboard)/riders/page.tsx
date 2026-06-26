import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { listRiders, PAGE_SIZE } from '@/lib/data';
import { formatDateTime } from '@/lib/utils';
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
import { DirectoryFilters } from '@/components/data/directory-filters';

const RIDER_FILTERS = [
  {
    key: 'status',
    label: 'Status',
    kind: 'select' as const,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'blocked', label: 'Blocked' },
    ],
  },
  { key: 'createdFrom', label: 'Joined from', kind: 'date' as const },
  { key: 'createdTo', label: 'Joined to', kind: 'date' as const },
];

export default async function RidersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    createdFrom?: string;
    createdTo?: string;
  }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'directory:browse')) redirect(`/${locale}/account`);

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.q?.trim() || undefined;
  const { rows, total } = await listRiders({
    page,
    search,
    status: sp.status || undefined,
    createdFrom: sp.createdFrom || undefined,
    createdTo: sp.createdTo || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Riders</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString('en-IN')} riders</p>
        </div>
        <SearchInput placeholder="Search riders by name or phone…" />
      </div>

      <DirectoryFilters filters={RIDER_FILTERS} />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rider</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center text-muted-foreground">
                  No riders {search ? `matching “${search}”` : 'yet'}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell>
                    <Link
                      href={`/${locale}/riders/${r.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {r.full_name ?? 'Unnamed'}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    {r.is_blocked ? (
                      <Badge variant="danger">Blocked</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(r.created_at)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${locale}/riders/${r.id}`}
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

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
