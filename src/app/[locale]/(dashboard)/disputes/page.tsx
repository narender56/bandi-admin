import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { listDisputes, DISPUTES_PAGE_SIZE } from '@/lib/data';
import { SearchInput } from '@/components/data/search-input';
import { Pagination } from '@/components/data/pagination';
import { DisputesQueue } from '@/components/disputes/disputes-queue';

export default async function DisputesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'support:manage')) redirect(`/${locale}/account`);

  const sp = (await searchParams) ?? {};
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.q?.trim() || undefined;
  const { rows, total } = await listDisputes({ page, search });
  const canResolve = can(role, 'users:block');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Disputes</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString('en-IN')} open · review the evidence, call the
            rider or driver, then decide. Nothing is automatic.
          </p>
        </div>
        <SearchInput placeholder="Search by rider/driver name or phone…" />
      </div>

      <DisputesQueue rows={rows} canResolve={canResolve} locale={locale} />

      <Pagination page={page} total={total} pageSize={DISPUTES_PAGE_SIZE} />
    </div>
  );
}
