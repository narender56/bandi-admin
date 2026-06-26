'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play, ShieldCheck, XCircle } from 'lucide-react';

import type { ReportRow } from '@/lib/data';
import { setReportStatus, type ReportStatus } from '@/lib/actions';
import { formatDateTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

const STATUS: Record<string, { label: string; tone: 'warning' | 'neutral' | 'success' | 'danger' }> = {
  open: { label: 'Open', tone: 'warning' },
  reviewing: { label: 'Reviewing', tone: 'neutral' },
  actioned: { label: 'Actioned', tone: 'success' },
  dismissed: { label: 'Dismissed', tone: 'danger' },
};

const CATEGORY_LABEL: Record<string, string> = {
  behavior: 'Behaviour',
  safety: 'Safety',
  payment: 'Payment',
  vehicle: 'Vehicle',
  other: 'Other',
};

export function ReportsManager({ reports }: { reports: ReportRow[] }) {
  const open = reports.filter((r) => r.status === 'open' || r.status === 'reviewing');
  const closed = reports.filter((r) => r.status === 'actioned' || r.status === 'dismissed');

  return (
    <Tabs defaultValue="open">
      <TabsList>
        <TabsTrigger value="open">
          Open
          {open.length > 0 && <Badge variant="warning">{open.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="closed">Resolved</TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>
      <TabsContent value="open">
        <ReportsTable reports={open} />
      </TabsContent>
      <TabsContent value="closed">
        <ReportsTable reports={closed} />
      </TabsContent>
      <TabsContent value="all">
        <ReportsTable reports={reports} />
      </TabsContent>
    </Tabs>
  );
}

function ReportsTable({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Against</TableHead>
            <TableHead>Reported by</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>When</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                No reports here.
              </TableCell>
            </TableRow>
          ) : (
            reports.map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <ReportDialog report={r} />
                    <span className="block text-xs text-muted-foreground capitalize">
                      {r.subject_role}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.reporter ?? '—'}
                    <span className="block text-xs capitalize">{r.reporter_role}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{CATEGORY_LABEL[r.category] ?? r.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={st.tone}>{st.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(r.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {r.status === 'open' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => run(() => setReportStatus(r.id, 'reviewing'))}
                        >
                          <Play className="size-4" /> Review
                        </Button>
                      )}
                      {(r.status === 'open' || r.status === 'reviewing') && (
                        <ResolveReportDialog report={r} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function ReportDialog({ report }: { report: ReportRow }) {
  const st = STATUS[report.status] ?? { label: report.status, tone: 'neutral' as const };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="cursor-pointer text-left hover:underline">
          {report.subject ?? 'Unknown'}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report against {report.subject ?? 'Unknown'}</DialogTitle>
          <DialogDescription>
            Filed by {report.reporter ?? 'Unknown'} ({report.reporter_role}) ·{' '}
            {formatDateTime(report.created_at)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={st.tone}>{st.label}</Badge>
            <Badge variant="neutral">{CATEGORY_LABEL[report.category] ?? report.category}</Badge>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
            {report.description}
          </div>
          {report.resolution_note && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Resolution note</p>
              <div className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap">
                {report.resolution_note}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResolveReportDialog({ report }: { report: ReportRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();

  const submit = (status: ReportStatus) =>
    startTransition(async () => {
      await setReportStatus(report.id, status, note);
      setOpen(false);
      setNote('');
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={isPending}>
          <ShieldCheck className="size-4" /> Resolve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve report</DialogTitle>
          <DialogDescription>
            Choose an outcome. The reporter is notified and this is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Resolution note (optional)</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What action was taken, or why it was dismissed"
            rows={3}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="danger" disabled={isPending} onClick={() => submit('dismissed')}>
            <XCircle className="size-4" /> Dismiss
          </Button>
          <Button disabled={isPending} onClick={() => submit('actioned')}>
            <ShieldCheck className="size-4" /> Action taken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
