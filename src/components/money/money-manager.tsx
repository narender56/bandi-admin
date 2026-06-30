'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Plus, Pencil, Trash2, Gift, Search } from 'lucide-react';

import type { SubscriptionPlan, FreeDriverRow } from '@/lib/data';
import {
  upsertSubscriptionPlan,
  removeSubscriptionPlan,
  grantFreeSubscription,
  revokeFreeSubscription,
  searchAction,
} from '@/lib/actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { VEHICLE_TYPES, vehicleLabel, type VehicleType } from '@/lib/vehicle-types';

type Vehicle = VehicleType;

// Supported geography for plan scopes (mirrors the fares page). Add more here.
const COUNTRIES = ['India'];
const ANY = '__any__';

// ── Subscription plans ───────────────────────────────────────
export function PlansManager({
  plans,
  canManage,
}: {
  plans: SubscriptionPlan[];
  canManage: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <Card className="p-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-5">
        <div>
          <CardTitle>Subscription plans</CardTitle>
          <CardDescription>Daily fee a driver pays per vehicle type & country</CardDescription>
        </div>
        {canManage && <PlanFormDialog mode="create" onSaved={refresh} />}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right">Daily fee</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="py-16 text-center text-muted-foreground">
                  No subscription plans yet.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.country ? p.country : <Badge variant="neutral">Global default</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{vehicleLabel(p.vehicle_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {p.currency === 'INR' ? '₹' : `${p.currency} `}
                    {p.price}
                    <span className="text-muted-foreground"> /day</span>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <PlanFormDialog mode="edit" plan={p} onSaved={refresh} />
                        <RemovePlanButton plan={p} onRemoved={refresh} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const planSchema = Yup.object({
  vehicle_type: Yup.string().oneOf(VEHICLE_TYPES as unknown as string[]).required(),
  country: Yup.string().trim(),
  price: Yup.number()
    .typeError('Daily fee must be a number')
    .min(0, 'Daily fee cannot be negative')
    .required('Daily fee is required'),
  currency: Yup.string().trim().required('Currency is required'),
});

function PlanFormDialog({
  mode,
  plan,
  onSaved,
}: {
  mode: 'create' | 'edit';
  plan?: SubscriptionPlan;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      vehicle_type: (plan?.vehicle_type as Vehicle) ?? 'auto',
      country: plan?.country ?? '',
      price: plan?.price ?? 0,
      currency: plan?.currency ?? 'INR',
    },
    validationSchema: planSchema,
    onSubmit: (values) => {
      setError(null);
      startTransition(async () => {
        const err = await upsertSubscriptionPlan({
          id: plan?.id,
          vehicle_type: values.vehicle_type,
          country: values.country.trim() || null,
          price: Number(values.price),
          currency: values.currency.trim() || 'INR',
        });
        if (err) {
          setError(err);
          return;
        }
        setOpen(false);
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
        {mode === 'create' ? (
          <Button>
            <Plus className="size-4" /> Add plan
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" /> Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add subscription plan' : 'Edit plan'}</DialogTitle>
          <DialogDescription>
            The daily fee applies to the most specific matching country, falling back to the global default.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          {mode === 'create' && (
            <>
              <div className="space-y-1.5">
                <Label>Vehicle type</Label>
                <Select
                  value={formik.values.vehicle_type}
                  onValueChange={(v) => formik.setFieldValue('vehicle_type', v)}
                >
                  <SelectTrigger>
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
                <Label>Country</Label>
                <Select
                  value={formik.values.country || ANY}
                  onValueChange={(v) => formik.setFieldValue('country', v === ANY ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any (global default)</SelectItem>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Daily fee</Label>
              <Input
                id="plan-price"
                type="number"
                step="0.01"
                min="0"
                name="price"
                value={String(formik.values.price)}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.price && formik.errors.price && (
                <p className="text-sm text-danger">{formik.errors.price}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-currency">Currency</Label>
              <Input
                id="plan-currency"
                name="currency"
                value={formik.values.currency}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.currency && formik.errors.currency && (
                <p className="text-sm text-danger">{formik.errors.currency}</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : mode === 'create' ? 'Add plan' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemovePlanButton({ plan, onRemoved }: { plan: SubscriptionPlan; onRemoved: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger" size="sm" disabled={isPending}>
          <Trash2 className="size-4" /> Remove
        </Button>
      }
      title="Remove this plan?"
      description="Drivers in this scope will fall back to the next-broadest plan. This is recorded in the audit log."
      confirmLabel="Remove"
      pending={isPending}
      onConfirm={() =>
        startTransition(async () => {
          await removeSubscriptionPlan(plan.id);
          onRemoved();
        })
      }
    />
  );
}

// ── Free subscription grants ─────────────────────────────────
export function FreeGrants({
  drivers,
  canManage,
}: {
  drivers: FreeDriverRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <Card className="p-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-5">
        <div>
          <CardTitle>Free subscriptions</CardTitle>
          <CardDescription>Drivers whose daily fee is waived until a chosen date</CardDescription>
        </div>
        {canManage && <GrantDialog onSaved={refresh} />}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Free until</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} className="py-16 text-center text-muted-foreground">
                  No drivers on a free subscription.
                </TableCell>
              </TableRow>
            ) : (
              drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.full_name ?? 'Unnamed'}
                    {d.is_founder && (
                      <Badge variant="default" className="ml-2">
                        Founder
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{d.phone ?? '—'}</TableCell>
                  <TableCell>{d.city ?? '—'}</TableCell>
                  <TableCell>{d.free_until}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <RevokeButton driver={d} onRevoked={refresh} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type FoundDriver = { id: string; full_name: string | null; phone: string | null; city: string | null };

function GrantDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<FoundDriver[]>([]);
  const [selected, setSelected] = useState<FoundDriver | null>(null);
  const [until, setUntil] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setTerm('');
    setResults([]);
    setSelected(null);
    setUntil('');
    setError(null);
  };

  const doSearch = (q: string) => {
    setTerm(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const res = await searchAction(q);
      setResults(res.drivers);
    });
  };

  const submit = () => {
    if (!selected) {
      setError('Pick a driver');
      return;
    }
    setError(null);
    startTransition(async () => {
      const err = await grantFreeSubscription(selected.id, until);
      if (err) {
        setError(err);
        return;
      }
      setOpen(false);
      reset();
      onSaved();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Gift className="size-4" /> Grant free
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant a free subscription</DialogTitle>
          <DialogDescription>
            Waive a driver&apos;s daily fee until a chosen date. They&apos;re flagged as a founder and notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selected ? (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="font-medium">{selected.full_name ?? 'Unnamed'}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.phone ?? '—'}
                  {selected.city ? ` · ${selected.city}` : ''}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="grant-search">Find driver</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="grant-search"
                  className="pl-8"
                  placeholder="Search by name or phone"
                  value={term}
                  onChange={(e) => doSearch(e.target.value)}
                />
              </div>
              {isSearching && <p className="text-xs text-muted-foreground">Searching…</p>}
              {results.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
                  {results.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelected(d);
                        setResults([]);
                        setTerm('');
                      }}
                      className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{d.full_name ?? 'Unnamed'}</span>
                      <span className="text-xs text-muted-foreground">{d.phone ?? '—'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="grant-until">Free until</Label>
            <Input
              id="grant-until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={isPending || !selected || !until}>
            {isPending ? 'Granting…' : 'Grant free'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeButton({ driver, onRevoked }: { driver: FreeDriverRow; onRevoked: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger" size="sm" disabled={isPending}>
          End free
        </Button>
      }
      title="End this free subscription?"
      description={`${driver.full_name ?? 'This driver'} will resume paying the daily fee. This is recorded in the audit log.`}
      confirmLabel="End free"
      pending={isPending}
      onConfirm={() =>
        startTransition(async () => {
          await revokeFreeSubscription(driver.id);
          onRevoked();
        })
      }
    />
  );
}
