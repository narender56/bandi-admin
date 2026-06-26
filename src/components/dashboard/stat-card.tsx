import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const TONES = {
  primary: 'bg-primary/10 text-primary',
  green: 'bg-success/10 text-success',
  purple: 'bg-chart-3/10 text-chart-3',
  amber: 'bg-warning/10 text-warning',
  pink: 'bg-chart-5/10 text-chart-5',
  red: 'bg-danger/10 text-danger',
} as const;

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  href: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('flex size-10 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="size-5" />
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </div>
    </Link>
  );
}
