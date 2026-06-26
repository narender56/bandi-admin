'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CheckCircle2, Clock3, RotateCcw, SearchCheck, XCircle } from 'lucide-react';

import type {
  OperationsCase,
  OperationsCategory,
  OperationsStatus,
} from '@/lib/data';
import { setOperationsCaseStatus, type OperationsCaseInput } from '@/lib/actions';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'default' | 'neutral'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'default',
  low: 'neutral',
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'default' | 'neutral'> = {
  open: 'warning',
  in_review: 'default',
  resolved: 'success',
  dismissed: 'neutral',
};

const CATEGORIES: { value: 'all' | OperationsCategory; label: string }[] = [
  { value: 'all', label: 'All areas' },
  { value: 'ride', label: 'Rides' },
  { value: 'billing', label: 'Billing' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'account', label: 'Accounts' },
];

function actionInput(item: OperationsCase): OperationsCaseInput {
  return {
    signalKey: item.signal_key,
    category: item.category,
    priority: item.priority,
    entityType: item.entity_type,
    entityId: item.entity_id,
    title: item.title,
    summary: item.summary,
    firstSeenAt: item.first_seen_at,
  };
}

export function OperationsManager({
  cases,
  counts,
  locale,
  currentUserId,
}: {
  cases: OperationsCase[];
  counts: Record<OperationsStatus, number>;
  locale: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OperationsStatus>('open');
  const [category, setCategory] = useState<'all' | OperationsCategory>('all');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () => cases.filter((item) => item.status === status && (category === 'all' || item.category === category)),
    [cases, status, category],
  );

  const run = (item: OperationsCase, next: OperationsStatus, note?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setOperationsCaseStatus(actionInput(item), next, note);
      if (result) setError(result);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(value) => setStatus(value as OperationsStatus)}>
          <TabsList>
            <TabsTrigger value="open">Open · {counts.open}</TabsTrigger>
            <TabsTrigger value="in_review">In review · {counts.in_review}</TabsTrigger>
            <TabsTrigger value="resolved">Resolved · {counts.resolved}</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed · {counts.dismissed}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={category === item.value ? 'default' : 'outline'}
              onClick={() => setCategory(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Priority</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                  No {status.replace('_', ' ')} cases in this area.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.signal_key}>
                  <TableCell>
                    <Badge variant={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xl">
                    <p className="font-medium">{item.title}</p>
                    {item.summary && <p className="mt-0.5 text-xs text-muted-foreground">{item.summary}</p>}
                    {item.resolution_note && (
                      <p className="mt-1 text-xs text-success">Outcome: {item.resolution_note}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" className="capitalize">{item.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.assigned_to === currentUserId ? 'You' : item.assigned_name ?? 'Unassigned'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(item.first_seen_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {item.href && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/${locale}${item.href}`}>
                            Open <ArrowUpRight className="size-3.5" />
                          </Link>
                        </Button>
                      )}
                      {item.status === 'open' && (
                        <Button size="sm" disabled={isPending} onClick={() => run(item, 'in_review')}>
                          <SearchCheck className="size-4" /> Review
                        </Button>
                      )}
                      {item.status === 'in_review' && (
                        <ResolutionDialog item={item} pending={isPending} onSubmit={run} />
                      )}
                      {(item.status === 'resolved' || item.status === 'dismissed') && (
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(item, 'open')}>
                          <RotateCcw className="size-4" /> Reopen
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" /> Signals are recalculated from current marketplace data whenever this page loads.
      </p>
    </div>
  );
}

function ResolutionDialog({
  item,
  pending,
  onSubmit,
}: {
  item: OperationsCase;
  pending: boolean;
  onSubmit: (item: OperationsCase, status: OperationsStatus, note?: string) => void;
}) {
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const submit = (status: 'resolved' | 'dismissed') => {
    onSubmit(item, status, note);
    if (note.trim().length >= 5) {
      setOpen(false);
      setNote('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><CheckCircle2 className="size-4" /> Close case</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record review outcome</DialogTitle>
          <DialogDescription>
            Explain what was verified or why no action is needed. This becomes part of the audit trail.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Investigation performed, evidence checked, and action taken"
          rows={5}
        />
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button variant="outline" disabled={pending || note.trim().length < 5} onClick={() => submit('dismissed')}>
            <XCircle className="size-4" /> Dismiss
          </Button>
          <Button disabled={pending || note.trim().length < 5} onClick={() => submit('resolved')}>
            <CheckCircle2 className="size-4" /> Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
