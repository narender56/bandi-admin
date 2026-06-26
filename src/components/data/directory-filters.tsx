'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type FilterOption = { value: string; label: string };

export interface DirectoryFilter {
  key: string;
  label: string;
  kind: 'select' | 'text' | 'date';
  placeholder?: string;
  options?: FilterOption[];
}

export function DirectoryFilters({ filters }: { filters: DirectoryFilter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== 'any') next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  };

  const clear = () => {
    const next = new URLSearchParams(params.toString());
    for (const filter of filters) next.delete(filter.key);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  };

  const hasAny = filters.some((filter) => params.has(filter.key));

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {filters.map((filter) => (
          <label key={filter.key} className="space-y-1.5 text-sm">
            <span className="font-medium text-muted-foreground">
              {filter.label}
            </span>
            {filter.kind === 'select' ? (
              <Select
                value={params.get(filter.key) ?? 'any'}
                onValueChange={(value) => setParam(filter.key, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filter.placeholder ?? 'Any'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {(filter.options ?? []).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={filter.kind}
                value={params.get(filter.key) ?? ''}
                placeholder={filter.placeholder}
                onChange={(event) => setParam(filter.key, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      {hasAny && (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
