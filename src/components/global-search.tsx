'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Car, User } from 'lucide-react';

import { searchAction } from '@/lib/actions';
import type { SearchResult } from '@/lib/data';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { cn } from '@/lib/utils';

export function GlobalSearch({ locale, dict }: { locale: string; dict: Dictionary }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult>({ drivers: [], riders: [] });
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search: 300ms after the user stops typing.
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResults({ drivers: [], riders: [] });
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAction(q);
        setResults(res);
        setOpen(true);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setTerm('');
    router.push(`/${locale}/${path}`);
  };

  const hasResults = results.drivers.length > 0 || results.riders.length > 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        {pending && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => term.trim().length >= 2 && setOpen(true)}
          placeholder={dict.search.placeholder}
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          {!hasResults && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {pending ? dict.common.loading : dict.search.noResults}
            </p>
          )}
          {results.drivers.length > 0 && (
            <Section label={dict.search.drivers}>
              {results.drivers.map((d) => (
                <ResultRow
                  key={d.id}
                  icon={<Car className="size-4 text-primary" />}
                  title={d.full_name ?? '—'}
                  sub={[d.phone, d.city].filter(Boolean).join(' · ')}
                  onClick={() => go(`drivers/${d.id}`)}
                />
              ))}
            </Section>
          )}
          {results.riders.length > 0 && (
            <Section label={dict.search.riders}>
              {results.riders.map((r) => (
                <ResultRow
                  key={r.id}
                  icon={<User className="size-4 text-chart-3" />}
                  title={r.full_name ?? '—'}
                  sub={r.phone ?? ''}
                  onClick={() => go(`riders/${r.id}`)}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border last:border-0">
      <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <ul className="pb-1.5">{children}</ul>
    </div>
  );
}

function ResultRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-accent',
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-muted">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
        </span>
      </button>
    </li>
  );
}
