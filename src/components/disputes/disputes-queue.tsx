'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Gavel, Phone, AlertTriangle } from 'lucide-react';

import { resolveDispute, type DisputeOutcome } from '@/lib/actions';
import type { DisputeRow } from '@/lib/data';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const KIND_LABEL: Record<string, string> = {
  no_show: 'No-show',
  early_end: 'Rider ended early',
  driver_end: 'Driver ended ride',
  complaint: 'Complaint',
};

const OUTCOME_COPY: Record<
  DisputeOutcome,
  { verb: string; title: string; body: string; danger: boolean }
> = {
  penalise_rider: {
    verb: 'Penalise rider',
    title: 'Penalise the rider?',
    body: 'This blocks the rider with a ₹ no-show fine — they must pay it before they can book again.',
    danger: true,
  },
  comp_driver: {
    verb: 'Comp driver',
    title: 'Give the driver a free day?',
    body: 'This grants the driver one free subscription day (used automatically on their next daily fee).',
    danger: false,
  },
  none: {
    verb: 'Dismiss',
    title: 'Dismiss with no penalty?',
    body: 'This closes the dispute and penalises no one.',
    danger: false,
  },
};

function Party({
  role,
  name,
  phone,
  href,
}: {
  role: string;
  name: string | null;
  phone: string | null;
  href: string | null;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-12 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {role}
      </span>
      {href ? (
        <Link href={href} className="font-medium hover:text-primary">
          {name ?? role}
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent"
        >
          <Phone className="size-3" /> {phone}
        </a>
      )}
    </div>
  );
}

export function DisputesQueue({
  rows,
  canResolve,
  locale,
}: {
  rows: DisputeRow[];
  canResolve: boolean;
  locale: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Pending confirmation: which dispute + which outcome the admin clicked.
  const [confirm, setConfirm] = useState<{ d: DisputeRow; outcome: DisputeOutcome } | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No open disputes.
      </div>
    );
  }

  const doResolve = () => {
    if (!confirm) return;
    const { d, outcome } = confirm;
    startTransition(async () => {
      await resolveDispute(d.id, outcome, notes[d.id]);
      setConfirm(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {rows.map((d) => {
        const ev = d.evidence ?? {};
        return (
          <div key={d.id} className="rounded-xl border border-border bg-card p-5">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Gavel className="size-4 text-muted-foreground" />
                <span className="font-semibold">{KIND_LABEL[d.kind] ?? d.kind}</span>
                <Badge variant="warning">raised by {d.raised_by}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{d.reason ?? '—'}</p>
              <Party
                role="Rider"
                name={d.rider_name}
                phone={d.rider_phone}
                href={d.rider_id ? `/${locale}/riders/${d.rider_id}` : null}
              />
              <Party
                role="Driver"
                name={d.driver_name}
                phone={d.driver_phone}
                href={d.driver_id ? `/${locale}/drivers/${d.driver_id}` : null}
              />
              <p className="text-xs text-muted-foreground">
                {formatDateTime(d.created_at)} ·{' '}
                <Link href={`/${locale}/rides/${d.ride_id}`} className="underline hover:text-primary">
                  view ride
                </Link>
              </p>
            </div>

            {(ev.gps_distance_m != null || ev.waited_seconds != null || ev.called != null) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {ev.gps_distance_m != null && (
                  <Badge variant="neutral">at pickup: {String(ev.gps_distance_m)} m</Badge>
                )}
                {ev.waited_seconds != null && (
                  <Badge variant="neutral">
                    waited: {Math.round(Number(ev.waited_seconds) / 60)} min
                  </Badge>
                )}
                {ev.called != null && (
                  <Badge variant="neutral">called: {ev.called ? 'yes' : 'no'}</Badge>
                )}
              </div>
            )}

            {(d.pickup_address || d.drop_address) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {d.pickup_address ?? '?'} → {d.drop_address ?? '?'}
              </p>
            )}

            {d.driver_id && d.driver_pending_credits > 0 && (
              <p className="mt-2 text-xs font-medium text-amber-600">
                Driver already has {d.driver_pending_credits} unused free day
                {d.driver_pending_credits === 1 ? '' : 's'}.
              </p>
            )}

            {canResolve ? (
              <div className="mt-4 space-y-2">
                <input
                  value={notes[d.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                  placeholder="Resolution note (optional)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" onClick={() => setConfirm({ d, outcome: 'penalise_rider' })}>
                    Penalise rider (₹ block)
                  </Button>
                  <Button variant="outline" onClick={() => setConfirm({ d, outcome: 'comp_driver' })}>
                    Comp driver (free day)
                  </Button>
                  <Button variant="outline" onClick={() => setConfirm({ d, outcome: 'none' })}>
                    Dismiss (no penalty)
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                You don&apos;t have permission to resolve disputes.
              </p>
            )}
          </div>
        );
      })}

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>{OUTCOME_COPY[confirm.outcome].title}</DialogTitle>
                <DialogDescription>
                  {OUTCOME_COPY[confirm.outcome].body}
                </DialogDescription>
              </DialogHeader>
              {confirm.outcome === 'comp_driver' && confirm.d.driver_pending_credits > 0 && (
                <p className="text-sm font-medium text-amber-600">
                  Heads up: this driver already has {confirm.d.driver_pending_credits} unused
                  free day{confirm.d.driver_pending_credits === 1 ? '' : 's'}.
                </p>
              )}
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                This can&apos;t be undone.
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={isPending} onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant={OUTCOME_COPY[confirm.outcome].danger ? 'danger' : 'default'}
                  disabled={isPending}
                  onClick={doResolve}
                >
                  {isPending ? 'Working…' : OUTCOME_COPY[confirm.outcome].verb}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
