'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Star,
  ShieldCheck,
  ShieldX,
  Ban,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Pencil,
  FileText,
  ExternalLink,
  Upload,
  Wallet as WalletIcon,
  RefreshCw,
} from 'lucide-react';

import type { DriverProfile } from '@/lib/data';
import {
  updateDriverBaseData,
  reviewDocument,
  updateDocumentExpiry,
  replaceDriverDocument,
  uploadDriverOnboardingFile,
  setDriverApproval,
  setUserBlocked,
  setDriverHold,
  rechargeWallet,
  reviewWithdrawalRequest,
} from '@/lib/actions';
import { EXPIRING_DOC_TYPES } from '@/lib/driver-docs';
import { VEHICLE_TYPES, vehicleLabel } from '@/lib/vehicle-types';
import { formatINR, formatDateTime, cn, adultCutoff } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DOC_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

const RIDE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> =
  {
    completed: 'success',
    cancelled: 'danger',
    in_progress: 'warning',
  };

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

export function DriverProfileView({
  driver,
  locale,
  flags,
}: {
  driver: DriverProfile;
  locale: string;
  flags: {
    canOnboard: boolean;
    canBlock: boolean;
    canSeeRides: boolean;
    canRecharge: boolean;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ label: string; url: string } | null>(
    null,
  );
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setActionError(null);
      try {
        await fn();
        router.refresh();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : 'Action failed',
        );
      }
    });

  const cancelledRides = driver.rides.filter((r) => r.status === 'cancelled');
  const onActiveRide = driver.rides.some((r) =>
    ['accepted', 'arrived', 'in_progress'].includes(r.status),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {driver.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={driver.avatar_url} target="_blank" rel="noreferrer">
              <img
                src={driver.avatar_url}
                alt="Driver"
                className="size-14 rounded-full border border-border object-cover"
              />
            </a>
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {(driver.full_name ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {driver.full_name ?? 'Unnamed driver'}
              </h1>
              {driver.is_founder && <Badge variant="warning">Founder</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{driver.phone ?? 'No phone'}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5 fill-warning text-warning" />
                {driver.rating.toFixed(2)} overall · {driver.total_rides} rides
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {driver.is_approved ? (
                <Badge variant="success">Approved</Badge>
              ) : (
                <Badge variant="warning">Not approved</Badge>
              )}
              {driver.is_blocked && <Badge variant="danger">Blocked</Badge>}
              {driver.is_on_hold && <Badge variant="warning">On hold</Badge>}
              {driver.deactivated_at && (
                <Badge variant="neutral">Deactivated</Badge>
              )}
              <Badge variant="neutral">{driver.status.replace('_', ' ')}</Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}
          >
            <RefreshCw
              className={cn('size-4', refreshing && 'animate-spin')}
            />
            Refresh
          </Button>
          {flags.canOnboard &&
            (driver.is_approved ? (
              <RevokeApprovalDialog
                onActiveRide={onActiveRide}
                onRevoke={() => run(() => setDriverApproval(driver.id, false))}
              />
            ) : (
              <Button
                disabled={isPending}
                onClick={() => run(() => setDriverApproval(driver.id, true))}
              >
                <ShieldCheck className="size-4" /> Approve
              </Button>
            ))}
          {flags.canBlock &&
            (driver.is_blocked ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => setUserBlocked(driver.id, false))}
              >
                <CheckCircle2 className="size-4" /> Unblock
              </Button>
            ) : (
              <BlockDialog
                onActiveRide={onActiveRide}
                onBlock={(reason) =>
                  run(() => setUserBlocked(driver.id, true, reason))
                }
              />
            ))}
          {flags.canBlock &&
            !driver.is_blocked &&
            (driver.is_on_hold ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => setDriverHold(driver.id, false))}
              >
                <PlayCircle className="size-4" /> Release hold
              </Button>
            ) : (
              <HoldDialog
                onActiveRide={onActiveRide}
                onHold={(reason) =>
                  run(() => setDriverHold(driver.id, true, reason))
                }
              />
            ))}
        </div>
      </div>
      {driver.deactivated_at && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold">Account closure requested</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Deactivated on {formatDateTime(driver.deactivated_at)}. Review
              the closure settlement below, verify the driver&apos;s saved
              payout details, then approve and mark it paid after transfer.
            </p>
            {driver.deactivation_reason && (
              <p className="mt-2 text-sm">
                <span className="font-medium">Reason:</span>{' '}
                {driver.deactivation_reason}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {driver.deactivated_at && (
        <Card>
          <CardHeader>
            <CardTitle>Saved payout details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="UPI ID">{driver.upi_id ?? '—'}</Field>
            <Field label="Payment phone">{driver.payment_phone ?? '—'}</Field>
            <Field label="UPI QR">
              {driver.upi_qr_url ? (
                <a
                  href={driver.upi_qr_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open QR <ExternalLink className="size-3" />
                </a>
              ) : (
                '—'
              )}
            </Field>
          </CardContent>
        </Card>
      )}
      {actionError && (
        <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {actionError}
        </p>
      )}

      <Tabs defaultValue="base">
        <TabsList className="flex-wrap">
          <TabsTrigger value="base">Base data</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {flags.canSeeRides && <TabsTrigger value="rides">Rides</TabsTrigger>}
          {flags.canSeeRides && (
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          )}
          {flags.canSeeRides && (
            <TabsTrigger value="earnings">Money earned</TabsTrigger>
          )}
          <TabsTrigger value="ratings">Ratings</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>

        {/* Base data */}
        <TabsContent value="base">
          {flags.canOnboard ? (
            <BaseDataForm driver={driver} />
          ) : (
            <Card>
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Full name">{driver.full_name ?? '—'}</Field>
                <Field label="Phone">{driver.phone ?? '—'}</Field>
                <Field label="Email">{driver.email ?? '—'}</Field>
                <Field label="UPI ID">{driver.upi_id ?? '—'}</Field>
                <Field label="Payment phone">
                  {driver.payment_phone ?? '—'}
                </Field>
                <Field label="Date of birth">{driver.dob ?? '—'}</Field>
                <Field label="Gender">{driver.gender ?? '—'}</Field>
                <Field label="Location">
                  {[driver.city, driver.state, driver.country]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </Field>
                <Field label="Manager">{driver.manager_name ?? '—'}</Field>
                <Field label="Joined">
                  {formatDateTime(driver.created_at)}
                </Field>
                <Field label="Vehicle">
                  {driver.vehicle?.reg_no
                    ? `${driver.vehicle.reg_no} · ${driver.vehicle.model ?? ''} ${driver.vehicle.color ?? ''}`
                    : '—'}
                </Field>
              </CardContent>
            </Card>
          )}
          {driver.is_blocked && driver.block_reason && (
            <p className="mt-3 text-sm text-danger">
              Block reason: {driver.block_reason}
            </p>
          )}
          {driver.is_on_hold && driver.hold_reason && (
            <p className="mt-3 text-sm text-warning">
              Hold reason: {driver.hold_reason}
            </p>
          )}
          {driver.vehicle?.photos.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {driver.vehicle.photos.map((url, index) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Vehicle ${index + 1}`}
                    className="h-32 w-full rounded-lg border border-border object-cover"
                  />
                </a>
              ))}
            </div>
          ) : null}
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>KYC documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {driver.documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No documents uploaded.
                </p>
              ) : (
                driver.documents.map((doc) => {
                  const expiring = EXPIRING_DOC_TYPES.includes(
                    doc.type as never,
                  );
                  const expiry = docExpiryState(doc.expires_at);
                  return (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="size-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{docLabel(doc.type)}</p>
                          <button
                            type="button"
                            onClick={() =>
                              setPreview({
                                label: docLabel(doc.type),
                                url: doc.file_url,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Preview <ExternalLink className="size-3" />
                          </button>
                          {expiring && (
                            <p className={cn('mt-0.5 text-xs', expiry.tone)}>
                              {expiry.text}
                            </p>
                          )}
                          {doc.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {doc.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={DOC_TONE[doc.status] ?? 'neutral'}>
                          {doc.status}
                        </Badge>
                        {flags.canOnboard &&
                          doc.status !== 'approved' &&
                          (expiring ? (
                            <ApproveDocDialog
                              docType={doc.type}
                              onApprove={(expiresAt) =>
                                run(() =>
                                  reviewDocument(
                                    doc.id,
                                    driver.id,
                                    'approved',
                                    undefined,
                                    expiresAt,
                                  ),
                                )
                              }
                            />
                          ) : (
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={() =>
                                run(() =>
                                  reviewDocument(doc.id, driver.id, 'approved'),
                                )
                              }
                            >
                              Approve
                            </Button>
                          ))}
                        {flags.canOnboard && doc.status !== 'rejected' && (
                          <RejectDocDialog
                            onReject={(notes) =>
                              run(() =>
                                reviewDocument(
                                  doc.id,
                                  driver.id,
                                  'rejected',
                                  notes,
                                ),
                              )
                            }
                          />
                        )}
                        {flags.canOnboard &&
                          expiring &&
                          doc.status === 'approved' && (
                            <UpdateExpiryDialog
                              current={doc.expires_at}
                              onSave={(expiresAt) =>
                                run(() =>
                                  updateDocumentExpiry(
                                    doc.id,
                                    driver.id,
                                    expiresAt,
                                  ),
                                )
                              }
                            />
                          )}
                        {flags.canOnboard && (
                          <ReplaceDocDialog
                            docType={doc.type}
                            expiring={expiring}
                            onReplace={(fileUrl, expiresAt) =>
                              run(() =>
                                replaceDriverDocument(
                                  doc.id,
                                  driver.id,
                                  fileUrl,
                                  expiresAt,
                                ),
                              )
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rides */}
        {flags.canSeeRides && (
          <TabsContent value="rides">
            <RideTable
              rides={driver.rides}
              locale={locale}
              empty="No rides yet."
            />
          </TabsContent>
        )}

        {/* Cancelled */}
        {flags.canSeeRides && (
          <TabsContent value="cancelled">
            <RideTable
              rides={cancelledRides}
              locale={locale}
              empty="No cancelled rides."
            />
          </TabsContent>
        )}

        {/* Money earned */}
        {flags.canSeeRides && (
          <TabsContent value="earnings">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total earned
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatINR(driver.earnings_total)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Wallet balance
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {formatINR(driver.wallet_balance)}
                      </p>
                    </div>
                    {flags.canRecharge && (
                      <RechargeDialog
                        driverId={driver.id}
                        onSaved={() => router.refresh()}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Subscriptions
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {driver.subscriptions.length}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>
                  Free-day credits ·{' '}
                  {driver.freeDayCredits.filter((c) => c.status === 'pending').length}{' '}
                  unused
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Granted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driver.freeDayCredits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                          No free subscription days given to this driver.
                        </TableCell>
                      </TableRow>
                    ) : (
                      driver.freeDayCredits.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            {c.source === 'noshow_reward' ? 'No-show comp' : c.source}
                          </TableCell>
                          <TableCell>
                            <Badge variant={c.status === 'pending' ? 'success' : 'neutral'}>
                              {c.status === 'pending' ? 'Unused' : c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDateTime(c.created_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Closure settlements</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      {flags.canRecharge && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driver.withdrawals.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={flags.canRecharge ? 5 : 4}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No closure settlement requests.
                        </TableCell>
                      </TableRow>
                    ) : (
                      driver.withdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>
                            <Badge variant={withdrawalTone(w.status)}>
                              {w.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-sm text-muted-foreground">
                            <p className="truncate">{w.driver_notes ?? '—'}</p>
                            {w.admin_notes && (
                              <p className="truncate text-xs">
                                Admin: {w.admin_notes}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatINR(w.amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDateTime(w.created_at)}
                          </TableCell>
                          {flags.canRecharge && (
                            <TableCell className="text-right">
                              <WithdrawalActions
                                driverId={driver.id}
                                requestId={w.id}
                                status={w.status}
                                onSaved={() => router.refresh()}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Wallet transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driver.wallet_txns.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No transactions.
                        </TableCell>
                      </TableRow>
                    ) : (
                      driver.wallet_txns.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="capitalize">{t.type}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.reason ?? '—'}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right tabular-nums',
                              t.amount < 0 ? 'text-danger' : 'text-success',
                            )}
                          >
                            {formatINR(t.amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDateTime(t.created_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Ratings */}
        <TabsContent value="ratings">
          <Card>
            <CardHeader>
              <CardTitle>
                Ratings · {driver.rating.toFixed(2)} overall (
                {driver.ratings.length} reviews)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {driver.ratings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No ratings yet.
                </p>
              ) : (
                driver.ratings.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'size-3.5',
                              i < r.stars
                                ? 'fill-warning text-warning'
                                : 'text-muted',
                            )}
                          />
                        ))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.rater ?? 'Rider'} · {formatDateTime(r.created_at)}
                      </span>
                    </div>
                    {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Complaints */}
        <TabsContent value="complaints">
          <Card>
            <CardHeader>
              <CardTitle>Complaints &amp; support tickets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {driver.complaints.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No complaints filed.
                </p>
              ) : (
                driver.complaints.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{c.subject}</p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            c.status === 'resolved' ? 'success' : 'warning'
                          }
                        >
                          {c.status}
                        </Badge>
                        <Badge variant="neutral">{c.priority}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {c.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(c.created_at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!preview}
        onOpenChange={(value) => {
          if (!value) setPreview(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.label}</DialogTitle>
            <DialogDescription>
              {preview && (
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open original <ExternalLink className="size-3" />
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          {preview &&
            (isPdf(preview.url) ? (
              <iframe
                src={preview.url}
                title={preview.label}
                className="h-[75vh] w-full rounded-lg border border-border"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.label}
                className="max-h-[75vh] w-full rounded-lg object-contain"
              />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const rechargeSchema = Yup.object({
  type: Yup.string().oneOf(['credit', 'debit']).required(),
  amount: Yup.number()
    .typeError('Amount must be a number')
    .positive('Amount must be greater than zero')
    .required('Amount is required'),
  reason: Yup.string().trim().required('A reason is required'),
});

function RechargeDialog({
  driverId,
  onSaved,
}: {
  driverId: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formik = useFormik({
    initialValues: {
      type: 'credit' as 'credit' | 'debit',
      amount: '',
      reason: '',
    },
    validationSchema: rechargeSchema,
    onSubmit: (values) => {
      setError(null);
      startTransition(async () => {
        const err = await rechargeWallet(
          driverId,
          Number(values.amount),
          values.type,
          values.reason,
        );
        if (err) {
          setError(err);
          return;
        }
        setOpen(false);
        formik.resetForm();
        onSaved();
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          formik.resetForm();
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <WalletIcon className="size-4" /> Top up / adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up or adjust wallet</DialogTitle>
          <DialogDescription>
            Credit (e.g. a cash subscription payment) or debit the driver&apos;s
            wallet. The driver is notified and it&apos;s recorded in the audit
            log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={formik.values.type}
                onValueChange={(v) => formik.setFieldValue('type', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit (add)</SelectItem>
                  <SelectItem value="debit">Debit (deduct)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recharge-amount">Amount (₹)</Label>
              <Input
                id="recharge-amount"
                type="number"
                step="0.01"
                min="0"
                name="amount"
                value={formik.values.amount}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.amount && formik.errors.amount && (
                <p className="text-sm text-danger">{formik.errors.amount}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recharge-reason">Reason</Label>
            <Input
              id="recharge-reason"
              name="reason"
              placeholder="e.g. Cash subscription payment for June"
              value={formik.values.reason}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
            {formik.touched.reason && formik.errors.reason && (
              <p className="text-sm text-danger">{formik.errors.reason}</p>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Apply'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawalActions({
  driverId,
  requestId,
  status,
  onSaved,
}: {
  driverId: string;
  requestId: string;
  status: string;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (
    action: 'approve' | 'reject' | 'mark_paid',
    notes?: string | null,
  ) => {
    setError(null);
    startTransition(async () => {
      const err = await reviewWithdrawalRequest(
        driverId,
        requestId,
        action,
        notes ?? undefined,
      );
      if (err) {
        setError(err);
        return;
      }
      onSaved();
    });
  };

  if (status === 'paid' || status === 'rejected') {
    return <span className="text-xs text-muted-foreground">Done</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {status === 'pending' && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run('approve')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={isPending}
              onClick={() => {
                const reason = window.prompt('Reason for rejection?');
                if (reason === null) return;
                run('reject', reason);
              }}
            >
              Reject
            </Button>
          </>
        )}
        {status === 'approved' && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run('mark_paid')}
          >
            Mark paid
          </Button>
        )}
      </div>
      {error && <p className="max-w-xs text-xs text-danger">{error}</p>}
    </div>
  );
}

function withdrawalTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'approved' || status === 'pending') return 'warning';
  if (status === 'rejected') return 'danger';
  return 'neutral';
}

function RideTable({
  rides,
  locale,
  empty,
}: {
  rides: DriverProfile['rides'];
  locale: string;
  empty: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Route</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Distance</TableHead>
            <TableHead className="text-right">Fare</TableHead>
            <TableHead className="text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rides.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-10 text-center text-muted-foreground"
              >
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rides.map((r) => (
              <TableRow key={r.id}>
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
                  {r.distance_km != null ? `${r.distance_km} km` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(r.paid_amount)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDateTime(r.requested_at)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function BaseDataForm({ driver }: { driver: DriverProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const initial = () => ({
    fullName: driver.full_name ?? '',
    phone: driver.phone ?? '',
    email: driver.email ?? '',
    dob: driver.dob ?? '',
    gender: driver.gender ?? '',
    country: driver.country ?? '',
    state: driver.state ?? '',
    city: driver.city ?? '',
    vehicleType: driver.vehicle?.type ?? 'auto',
    regNo: driver.vehicle?.reg_no ?? '',
    model: driver.vehicle?.model ?? '',
    color: driver.vehicle?.color ?? '',
  });
  const [v, setV] = useState(initial);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));
  const setVal = (k: keyof typeof v) => (value: string) =>
    setV((p) => ({ ...p, [k]: value }));

  const cancel = () => {
    setV(initial());
    setEditing(false);
    setError(null);
  };

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const err = await updateDriverBaseData(driver.id, v);
      if (err) setError(err);
      else {
        setSaved(true);
        setEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          {editing ? (
            <>
              <Pencil className="size-4" /> Editing base data
            </>
          ) : (
            'Base data'
          )}
        </CardTitle>
        {!editing && (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-4" /> Edit details
              </Button>
            }
            title="Edit this driver's details?"
            description="You are about to change verified onboarding data. Make sure any change reflects a real, checked document or detail."
            confirmLabel="Start editing"
            onConfirm={() => {
              setSaved(false);
              setEditing(true);
            }}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={v.fullName}
              onChange={set('fullName')}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={v.phone}
              onChange={set('phone')}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={v.email}
              onChange={set('email')}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={v.dob}
              onChange={set('dob')}
              max={adultCutoff()}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={v.gender}
              onValueChange={setVal('gender')}
              disabled={!editing}
            >
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={v.country}
              onChange={set('country')}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={v.state}
              onChange={set('state')}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={v.city}
              onChange={set('city')}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicleType">Vehicle type</Label>
            <Select
              value={v.vehicleType}
              onValueChange={setVal('vehicleType')}
              disabled={!editing}
            >
              <SelectTrigger id="vehicleType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {vehicleLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="regNo">Vehicle reg. no</Label>
            <Input
              id="regNo"
              value={v.regNo}
              onChange={set('regNo')}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={v.model}
              onChange={set('model')}
              disabled={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              value={v.color}
              onChange={set('color')}
              disabled={!editing}
            />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && !editing && <p className="text-sm text-success">Saved.</p>}
        {editing && (
          <div className="flex items-center gap-2">
            <ConfirmDialog
              trigger={
                <Button disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save changes'}
                </Button>
              }
              title="Save these changes?"
              description="The updated details will replace the current record for this driver."
              confirmLabel="Save changes"
              onConfirm={submit}
            />
            <Button variant="ghost" onClick={cancel} disabled={isPending}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant={destructive ? 'danger' : 'default'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActiveRideNotice({ action }: { action: string }) {
  return (
    <p className="rounded-md bg-warning/10 p-3 text-sm text-warning">
      This driver is on an active ride. The {action} is recorded now and takes
      effect once the current ride is completed — the ride in progress will not
      be interrupted.
    </p>
  );
}

function RevokeApprovalDialog({
  onActiveRide,
  onRevoke,
}: {
  onActiveRide: boolean;
  onRevoke: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ShieldX className="size-4" /> Revoke approval
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke this driver&apos;s approval?</DialogTitle>
          <DialogDescription>
            They will be taken offline and cannot go online or accept rides
            until they are approved again.
          </DialogDescription>
        </DialogHeader>
        {onActiveRide && <ActiveRideNotice action="revocation" />}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger" onClick={onRevoke}>
              Revoke approval
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({
  onActiveRide,
  onBlock,
}: {
  onActiveRide: boolean;
  onBlock: (reason: string) => void;
}) {
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
          <DialogTitle>Block this driver</DialogTitle>
          <DialogDescription>
            They won&apos;t be able to go online or accept rides. Add a reason
            for the audit log.
          </DialogDescription>
        </DialogHeader>
        {onActiveRide && <ActiveRideNotice action="block" />}
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (e.g. repeated cancellations)"
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger" onClick={() => onBlock(reason)}>
              Block driver
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HoldDialog({
  onActiveRide,
  onHold,
}: {
  onActiveRide: boolean;
  onHold: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PauseCircle className="size-4" /> Put on hold
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Put this driver on hold?</DialogTitle>
          <DialogDescription>
            They will be forced offline and cannot take rides until the hold is
            released. The driver will be notified.
          </DialogDescription>
        </DialogHeader>
        {onActiveRide && <ActiveRideNotice action="hold" />}
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for the temporary hold"
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onHold(reason)}>Put on hold</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Human-readable expiry state for an expiry-tracked document.
const DOC_LABELS: Record<string, string> = {
  license: 'Driving licence',
  rc: 'Vehicle RC',
  permit: 'Commercial permit',
  insurance: 'Vehicle insurance',
  puc: 'Pollution certificate (PUC)',
  aadhaar: 'Aadhaar / identity proof',
  photo: 'Photo',
};

const docLabel = (type: string) => DOC_LABELS[type] ?? type.replace('_', ' ');
const isPdf = (url: string) => /\.pdf($|\?)/i.test(url);

function docExpiryState(expiresAt: string | null): {
  text: string;
  tone: string;
} {
  if (!expiresAt)
    return { text: 'No expiry date recorded', tone: 'text-amber-600' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiresAt);
  const days = Math.round((exp.getTime() - today.getTime()) / 86_400_000);
  const dateStr = exp.toLocaleDateString();
  if (days < 0) return { text: `Expired on ${dateStr}`, tone: 'text-red-600' };
  if (days <= 7)
    return {
      text: `Expires ${dateStr} (in ${days} day${days === 1 ? '' : 's'})`,
      tone: 'text-amber-600',
    };
  return { text: `Valid until ${dateStr}`, tone: 'text-muted-foreground' };
}

function ApproveDocDialog({
  docType,
  onApprove,
}: {
  docType: string;
  onApprove: (expiresAt: string) => void;
}) {
  const [expiresAt, setExpiresAt] = useState('');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Approve</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {docType.replace('_', ' ')}</DialogTitle>
          <DialogDescription>
            Enter the expiry date printed on the document. The driver is warned
            before it expires and cannot go online once it has expired.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="doc-expiry">Expiry date</Label>
          <Input
            id="doc-expiry"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              disabled={!expiresAt}
              onClick={() => expiresAt && onApprove(expiresAt)}
            >
              Approve
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDocDialog({ onReject }: { onReject: (notes: string) => void }) {
  const [notes, setNotes] = useState('');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject document</DialogTitle>
          <DialogDescription>
            Tell the driver what to fix and re-upload.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why is this being rejected?"
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger" onClick={() => onReject(notes)}>
              Reject
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateExpiryDialog({
  current,
  onSave,
}: {
  current: string | null;
  onSave: (expiresAt: string) => void;
}) {
  const [expiresAt, setExpiresAt] = useState(current ?? '');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Update expiry
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update expiry date</DialogTitle>
          <DialogDescription>
            Set the new expiry date after the driver has renewed this document.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="update-expiry">Expiry date</Label>
          <Input
            id="update-expiry"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              disabled={!expiresAt}
              onClick={() => expiresAt && onSave(expiresAt)}
            >
              Save expiry
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceDocDialog({
  docType,
  expiring,
  onReplace,
}: {
  docType: string;
  expiring: boolean;
  onReplace: (fileUrl: string, expiresAt?: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFileUrl('');
    setFileName('');
    setExpiresAt('');
    setError(null);
    setBusy(false);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const data = new FormData();
    data.set('file', file);
    const res = await uploadDriverOnboardingFile(data, 'document');
    setBusy(false);
    if (res.error || !res.file) {
      setError(res.error ?? 'Upload failed');
      return;
    }
    setFileUrl(res.file.publicUrl);
    setFileName(res.file.fileName);
  };

  const canSave = !!fileUrl && (!expiring || !!expiresAt) && !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="size-4" /> Update
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {docLabel(docType)}</DialogTitle>
          <DialogDescription>
            Upload the new, verified document. Saving marks it approved
            {expiring ? ' and records the new expiry date.' : '.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            <Upload className="size-4" />{' '}
            {busy ? 'Uploading…' : fileName ? 'Replace file' : 'Choose file'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {fileName && (
            <p className="truncate text-xs text-success">{fileName}</p>
          )}
          {expiring && (
            <div className="space-y-1.5">
              <Label htmlFor="replace-expiry">Expiry date</Label>
              <Input
                id="replace-expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onReplace(fileUrl, expiring ? expiresAt : null);
              setOpen(false);
            }}
          >
            Verify &amp; update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
