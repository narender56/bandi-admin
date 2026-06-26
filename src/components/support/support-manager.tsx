'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  LifeBuoy,
  Siren,
  Play,
  CheckCircle2,
  RotateCcw,
  MapPin,
  Save,
} from 'lucide-react';

import type { SupportRow, SosRow } from '@/lib/data';
import {
  setTicketStatus,
  setTicketPriority,
  setTicketNote,
  acknowledgeSos,
  resolveSos,
  type TicketStatus,
} from '@/lib/actions';
import { formatDateTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
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
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const TICKET_STATUS: Record<string, { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  open: { label: 'Open', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'neutral' },
  resolved: { label: 'Resolved', tone: 'success' },
};

const PRIORITY_TONE: Record<string, 'neutral' | 'default' | 'warning' | 'danger'> = {
  low: 'neutral',
  normal: 'default',
  high: 'warning',
  urgent: 'danger',
};

const SOS_STATUS: Record<string, { label: string; tone: 'danger' | 'warning' | 'success' }> = {
  active: { label: 'Active', tone: 'danger' },
  acknowledged: { label: 'Acknowledged', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export function SupportManager({
  tickets,
  sos,
  canSos,
}: {
  tickets: SupportRow[];
  sos: SosRow[];
  canSos: boolean;
}) {
  const openTickets = tickets.filter((t) => t.status !== 'resolved').length;
  const liveSos = sos.filter((s) => s.status !== 'resolved').length;

  return (
    <Tabs defaultValue="tickets">
      <TabsList>
        <TabsTrigger value="tickets">
          <LifeBuoy className="size-4" /> Support requests
          {openTickets > 0 && <Badge variant="warning">{openTickets}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="sos">
          <Siren className="size-4" /> SOS requests
          {liveSos > 0 && <Badge variant="danger">{liveSos}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tickets">
        <TicketsTable tickets={tickets} />
      </TabsContent>
      <TabsContent value="sos">
        <SosTable sos={sos} canSos={canSos} />
      </TabsContent>
    </Tabs>
  );
}

function TicketsTable({ tickets }: { tickets: SupportRow[] }) {
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
            <TableHead>Subject</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Raised</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                No support requests.
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((t) => {
              const st = TICKET_STATUS[t.status] ?? { label: t.status, tone: 'neutral' as const };
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <TicketDialog ticket={t} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.user ?? '—'}</TableCell>
                  <TableCell>
                    <Select
                      value={t.priority}
                      onValueChange={(v) =>
                        run(() => setTicketPriority(t.id, v as 'low' | 'normal' | 'high' | 'urgent'))
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={st.tone}>{st.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(t.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {t.status === 'open' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => run(() => setTicketStatus(t.id, 'in_progress'))}
                        >
                          <Play className="size-4" /> Start
                        </Button>
                      )}
                      {t.status !== 'resolved' ? (
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => run(() => setTicketStatus(t.id, 'resolved'))}
                        >
                          <CheckCircle2 className="size-4" /> Resolve
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => run(() => setTicketStatus(t.id, 'open'))}
                        >
                          <RotateCcw className="size-4" /> Reopen
                        </Button>
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

function TicketDialog({ ticket }: { ticket: SupportRow }) {
  const router = useRouter();
  const [note, setNote] = useState(ticket.internal_note ?? '');
  const [isPending, startTransition] = useTransition();
  const st = TICKET_STATUS[ticket.status] ?? { label: ticket.status, tone: 'neutral' as const };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="cursor-pointer text-left hover:underline">{ticket.subject}</button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ticket.subject}</DialogTitle>
          <DialogDescription>
            From {ticket.user ?? 'Unknown'}
            {ticket.user_phone ? ` · ${ticket.user_phone}` : ''} · {formatDateTime(ticket.created_at)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={st.tone}>{st.label}</Badge>
            <Badge variant={PRIORITY_TONE[ticket.priority] ?? 'neutral'}>{ticket.priority}</Badge>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{ticket.body}</div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Internal note (staff only)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Not visible to the user"
              rows={3}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await setTicketNote(ticket.id, note);
                  router.refresh();
                })
              }
            >
              <Save className="size-4" /> Save note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SosTable({ sos, canSos }: { sos: SosRow[]; canSos: boolean }) {
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
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Raised</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                No SOS alerts.
              </TableCell>
            </TableRow>
          ) : (
            sos.map((s) => {
              const st = SOS_STATUS[s.status] ?? { label: s.status, tone: 'neutral' as const };
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.user ?? '—'}
                    {s.user_phone && (
                      <span className="block text-xs text-muted-foreground">{s.user_phone}</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{s.role}</TableCell>
                  <TableCell className="text-muted-foreground">{s.note ?? '—'}</TableCell>
                  <TableCell>
                    {s.lat != null && s.lng != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <MapPin className="size-3.5" /> Map
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={st.tone}>{st.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(s.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {!canSos ? (
                      <span className="text-muted-foreground">—</span>
                    ) : s.status === 'resolved' ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        {s.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() => run(() => acknowledgeSos(s.id))}
                          >
                            <CheckCircle2 className="size-4" /> Acknowledge
                          </Button>
                        )}
                        <ConfirmDialog
                          trigger={
                            <Button variant="danger" size="sm" disabled={isPending}>
                              <CheckCircle2 className="size-4" /> Resolve
                            </Button>
                          }
                          title="Resolve this SOS alert?"
                          description="Confirm the situation is handled and the user is safe. They will be notified and this is recorded in the audit log."
                          confirmLabel="Resolve"
                          pending={isPending}
                          onConfirm={() => run(() => resolveSos(s.id))}
                        />
                      </div>
                    )}
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
