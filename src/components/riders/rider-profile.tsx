'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Ban, CheckCircle2 } from 'lucide-react';

import type { RiderProfile, RideSimulationPoint } from '@/lib/data';
import { setUserBlocked } from '@/lib/actions';
import { formatINR, formatDateTime, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { RideReplayDialog } from '@/components/rides/ride-replay-dialog';

const RIDE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  cancelled: 'danger',
  in_progress: 'warning',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

export function RiderProfileView({
  rider,
  canBlock,
  canSeeSimulation,
  simulationByRide,
  mapsApiKey,
}: {
  rider: RiderProfile;
  canBlock: boolean;
  canSeeSimulation: boolean;
  simulationByRide: Record<string, RideSimulationPoint[]>;
  mapsApiKey?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-chart-3/10 text-xl font-bold text-chart-3">
            {(rider.full_name ?? '?').charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{rider.full_name ?? 'Unnamed rider'}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {rider.phone ?? 'No phone'} · {rider.total_rides} rides
            </div>
            <div className="mt-2 flex gap-2">
              {rider.is_blocked ? (
                <Badge variant="danger">Blocked</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              )}
            </div>
          </div>
        </div>
        {canBlock &&
          (rider.is_blocked ? (
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => setUserBlocked(rider.id, false))}
            >
              <CheckCircle2 className="size-4" /> Unblock
            </Button>
          ) : (
            <BlockDialog onBlock={(reason) => run(() => setUserBlocked(rider.id, true, reason))} />
          ))}
      </div>

      <Tabs defaultValue="base">
        <TabsList className="flex-wrap">
          <TabsTrigger value="base">Base data</TabsTrigger>
          <TabsTrigger value="rides">Rides</TabsTrigger>
          <TabsTrigger value="ratings">Ratings</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value="base">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Full name">{rider.full_name ?? '—'}</Field>
              <Field label="Phone">{rider.phone ?? '—'}</Field>
              <Field label="Gender">{rider.gender ?? '—'}</Field>
              <Field label="Joined">{formatDateTime(rider.created_at)}</Field>
              <Field label="Total rides">{rider.total_rides}</Field>
            </CardContent>
          </Card>
          {rider.is_blocked && rider.block_reason && (
            <p className="mt-3 text-sm text-danger">Block reason: {rider.block_reason}</p>
          )}
        </TabsContent>

        <TabsContent value="rides">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Fare</TableHead>
                  <TableHead className="text-right">When</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rider.rides.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No rides yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rider.rides.map((r) => (
                    <TableRow key={r.id} className="group">
                      <TableCell className="max-w-xs">
                        <p className="truncate text-sm">{r.pickup_address ?? '—'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          → {r.drop_address ?? '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={RIDE_TONE[r.status] ?? 'neutral'}>
                          {r.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(r.locked_fare)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDateTime(r.requested_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {canSeeSimulation && (
                            <RideReplayDialog
                              ride={r}
                              points={simulationByRide[r.id] ?? []}
                              mapsApiKey={mapsApiKey}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ratings">
          <Card>
            <CardHeader>
              <CardTitle>Ratings received ({rider.ratings.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rider.ratings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No ratings yet.</p>
              ) : (
                rider.ratings.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'size-3.5',
                              i < r.stars ? 'fill-warning text-warning' : 'text-muted',
                            )}
                          />
                        ))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.rater ?? 'Driver'} · {formatDateTime(r.created_at)}
                      </span>
                    </div>
                    {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complaints">
          <Card>
            <CardHeader>
              <CardTitle>Complaints &amp; support tickets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rider.complaints.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No complaints filed.</p>
              ) : (
                rider.complaints.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{c.subject}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.status === 'resolved' ? 'success' : 'warning'}>
                          {c.status}
                        </Badge>
                        <Badge variant="neutral">{c.priority}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(c.created_at)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BlockDialog({ onBlock }: { onBlock: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger">
          <Ban className="size-4" /> Block
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block this rider</DialogTitle>
          <DialogDescription>
            They won&apos;t be able to request rides. Add a reason for the audit log.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger" onClick={() => onBlock(reason)}>
              Block rider
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
