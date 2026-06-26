import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import type { StaffRole } from '@/lib/rbac';
import { AppSidebar } from '@/components/app-sidebar';
import { Topbar } from '@/components/topbar';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar role={session.role as StaffRole} locale={locale} dict={dict} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar session={session} locale={locale} dict={dict} />
        <main className="bandi-aurora flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
