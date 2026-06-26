'use client';

import { useActionState } from 'react';

import { loginAction } from '@/lib/actions';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginForm({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const [error, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className="mb-1 block text-sm font-medium">
          {dict.login.email}
        </label>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          {dict.login.password}
        </label>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? '…' : dict.login.submit}
      </Button>
    </form>
  );
}
