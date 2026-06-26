'use client';

import { useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

export interface UrlTab {
  key: string;
  label: string;
  count?: number;
}

/** Pill tabs backed by a URL search param (resets `page` on change). */
export function UrlTabs({
  tabs,
  active,
  param = 'tab',
}: {
  tabs: UrlTab[];
  active: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const select = (key: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(param, key);
    next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  };

  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1',
        isPending && 'opacity-70',
      )}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => select(t.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              on
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                  on ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
