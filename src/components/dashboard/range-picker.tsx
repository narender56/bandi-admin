'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays } from 'lucide-react';

import { RANGE_LABELS, RANGE_KEYS, type RangeKey } from '@/lib/ranges';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RangePicker({
  current,
  from,
  to,
}: {
  current: RangeKey;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from ?? '');
  const [customTo, setCustomTo] = useState(to ?? '');
  const [open, setOpen] = useState(false);

  const setRange = (key: RangeKey) => {
    const next = new URLSearchParams(params.toString());
    next.set('range', key);
    if (key !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    router.push(`${pathname}?${next.toString()}`);
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const next = new URLSearchParams(params.toString());
    next.set('range', 'custom');
    next.set('from', customFrom);
    next.set('to', customTo);
    router.push(`${pathname}?${next.toString()}`);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={current} onValueChange={(v) => setRange(v as RangeKey)}>
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_KEYS.filter((k) => k !== 'custom').map((k) => (
            <SelectItem key={k} value={k}>
              {RANGE_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={current === 'custom' ? 'default' : 'outline'} size="icon" title="Custom range">
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Custom range</p>
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
            <Button onClick={applyCustom} className="w-full" disabled={!customFrom || !customTo}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
