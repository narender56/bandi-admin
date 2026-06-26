import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { getStaffRegions } from '@/lib/data';
import { AccountForm } from '@/components/account/account-form';

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const dict = getDictionary(locale);

  // super_admin is unrestricted (no region rows); others see their grants.
  const regions =
    session.role === 'super_admin' ? [] : await getStaffRegions(session.uid);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{dict.account.title}</h1>
        <p className="text-sm text-muted-foreground">
          Your profile and sign-in credentials
        </p>
      </div>
      <AccountForm session={session} regions={regions} dict={dict} />
    </div>
  );
}
