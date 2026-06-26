import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { Card } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  // Already signed in → straight to the dashboard.
  if (await getSession()) redirect(`/${locale}`);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">{dict.appName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dict.login.subtitle}</p>
        </div>
        <h2 className="mb-4 text-lg font-semibold">{dict.login.title}</h2>
        <LoginForm dict={dict} locale={locale} />
      </Card>
    </main>
  );
}
