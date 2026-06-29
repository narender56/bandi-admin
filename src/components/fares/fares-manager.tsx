'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Fuel, Plus, Pencil, Trash2 } from 'lucide-react';

import type {
  FareConfig,
  FuelPriceConfig,
  VehicleTypeConfig,
} from '@/lib/data';
import {
  createFareConfig,
  updateFareConfig,
  removeFareConfig,
  updateVehicleTypeConfig,
  replaceFuelPriceConfig,
} from '@/lib/actions';
import {
  VEHICLE_TYPES,
  vehicleLabel,
  type VehicleType,
} from '@/lib/vehicle-types';
import { Card } from '@/components/ui/card';
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

function scopeLabel(f: Pick<FareConfig, 'country' | 'state' | 'city'>): string {
  return [f.city, f.state, f.country].filter(Boolean).join(', ') || 'Global default';
}

// Supported geography for fare scopes. Add more here as Bandi expands.
const GEO: Record<string, Record<string, string[]>> = {
  India: { Telangana: ['Hyderabad'] },
};
const ANY = '__any__';

const money = (n: number) => `₹${n}`;
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export function FaresManager({
  fares,
  vehicleTypes,
  fuelPrices,
}: {
  fares: FareConfig[];
  vehicleTypes: VehicleTypeConfig[];
  fuelPrices: FuelPriceConfig[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-8">
      <VehicleCatalogue types={vehicleTypes} onSaved={refresh} />
      <FuelPricePanel prices={fuelPrices} onSaved={refresh} />

      <div className="space-y-4">
      <div className="flex justify-end">
        <FareFormDialog mode="create" onSaved={refresh} />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Region</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">Surcharge</TableHead>
              <TableHead className="text-right">Per min</TableHead>
              <TableHead className="text-right">Waiting / min</TableHead>
              <TableHead className="text-right">Free wait</TableHead>
              <TableHead className="text-right">Per km</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fares.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                  No fares configured yet.
                </TableCell>
              </TableRow>
            ) : (
              fares.map((f) => {
                const isGlobal = !f.country && !f.state && !f.city;
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      {isGlobal ? (
                        <Badge variant="neutral">Global default</Badge>
                      ) : (
                        scopeLabel(f)
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{vehicleLabel(f.vehicle_type)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{money(f.base_fare)}</TableCell>
                    <TableCell className="text-right">{money(f.surcharge)}</TableCell>
                    <TableCell className="text-right">{money(f.time_rate)}</TableCell>
                    <TableCell className="text-right">{money(f.waiting_rate)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {f.free_waiting_minutes} min
                    </TableCell>
                    <TableCell className="text-right">{money(f.distance_rate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <FareFormDialog mode="edit" fare={f} onSaved={refresh} />
                        {!isGlobal && <RemoveFareButton fare={f} onRemoved={refresh} />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
      </div>
    </div>
  );
}

function FuelPricePanel({
  prices,
  onSaved,
}: {
  prices: FuelPriceConfig[];
  onSaved: () => void;
}) {
  const active = prices.filter((p) => p.is_active);
  const history = prices.filter((p) => !p.is_active).slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Fuel prices</h2>
          <p className="text-sm text-muted-foreground">
            Used for approximate driver profit. Updating a price closes the old
            active price and starts a new version.
          </p>
        </div>
        <FuelPriceDialog onSaved={onSaved} />
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Region</TableHead>
              <TableHead>Fuel</TableHead>
              <TableHead className="text-right">Price / litre</TableHead>
              <TableHead>Active from</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-muted-foreground"
                >
                  No active fuel prices yet.
                </TableCell>
              </TableRow>
            ) : (
              active.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{scopeLabel(p)}</TableCell>
                  <TableCell className="capitalize">{p.fuel_type}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {p.currency === 'INR' ? '₹' : p.currency}
                    {p.price_per_litre}
                  </TableCell>
                  <TableCell>{dateTime(p.effective_from)}</TableCell>
                  <TableCell>
                    <Badge variant="success">Active</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
            {history.map((p) => (
              <TableRow key={p.id} className="bg-muted/30">
                <TableCell className="font-medium">{scopeLabel(p)}</TableCell>
                <TableCell className="capitalize">{p.fuel_type}</TableCell>
                <TableCell className="text-right">
                  {p.currency === 'INR' ? '₹' : p.currency}
                  {p.price_per_litre}
                </TableCell>
                <TableCell>{dateTime(p.effective_from)}</TableCell>
                <TableCell>
                  <Badge variant="neutral">
                    Closed {p.effective_to ? dateTime(p.effective_to) : ''}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const fuelValidationSchema = Yup.object({
  country: Yup.string().trim().required('Country is required'),
  state: Yup.string().trim(),
  city: Yup.string()
    .trim()
    .test('city-needs-state', 'A city scope needs a state', function (v) {
      return !v?.trim() || !!this.parent.state?.trim();
    }),
  fuel_type: Yup.string().trim().required('Fuel type is required'),
  price_per_litre: Yup.number()
    .typeError('Fuel price must be a number')
    .moreThan(0, 'Fuel price must be greater than 0')
    .required('Fuel price is required'),
});

function FuelPriceDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formik = useFormik({
    initialValues: {
      country: 'India',
      state: 'Telangana',
      city: 'Hyderabad',
      fuel_type: 'petrol',
      price_per_litre: 110,
    },
    validationSchema: fuelValidationSchema,
    onSubmit: (values) => {
      setError(null);
      startTransition(async () => {
        const err = await replaceFuelPriceConfig({
          country: values.country.trim(),
          state: values.state.trim() || null,
          city: values.city.trim() || null,
          fuel_type: values.fuel_type.trim() || 'petrol',
          price_per_litre: Number(values.price_per_litre),
          currency: 'INR',
        });
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

  const fieldError = (k: keyof typeof formik.values) =>
    formik.touched[k] && formik.errors[k] ? (
      <p className="text-sm text-danger">{formik.errors[k] as string}</p>
    ) : null;

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
        <Button>
          <Fuel className="size-4" /> Set fuel price
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set fuel price</DialogTitle>
          <DialogDescription>
            This creates a new active price and closes the previous active price
            for the same region and fuel type.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select
                value={formik.values.country}
                onValueChange={(v) => {
                  formik.setFieldValue('country', v);
                  formik.setFieldValue('state', '');
                  formik.setFieldValue('city', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(GEO).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError('country')}
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select
                value={formik.values.state || ANY}
                onValueChange={(v) => {
                  const state = v === ANY ? '' : v;
                  formik.setFieldValue('state', state);
                  formik.setFieldValue('city', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {Object.keys(GEO[formik.values.country] ?? {}).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Select
                value={formik.values.city || ANY}
                disabled={!formik.values.state}
                onValueChange={(v) =>
                  formik.setFieldValue('city', v === ANY ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {(GEO[formik.values.country]?.[formik.values.state] ?? []).map(
                    (city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              {fieldError('city')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fuel type</Label>
              <Select
                value={formik.values.fuel_type}
                onValueChange={(v) => formik.setFieldValue('fuel_type', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="cng">CNG</SelectItem>
                  <SelectItem value="ev">EV</SelectItem>
                </SelectContent>
              </Select>
              {fieldError('fuel_type')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fuel-price">Price / litre (₹)</Label>
              <Input
                id="fuel-price"
                type="number"
                min="0.01"
                step="0.01"
                name="price_per_litre"
                value={String(formik.values.price_per_litre)}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {fieldError('price_per_litre')}
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
              {isPending ? 'Saving…' : 'Set new price'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Platform-wide vehicle catalogue: enable/disable a whole type and set its seat
// count. Disabling a type hides it from riders and blocks new bookings; pricing
// rows are left untouched so the type can be switched back on instantly.
function VehicleCatalogue({
  types,
  onSaved,
}: {
  types: VehicleTypeConfig[];
  onSaved: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Vehicle types</h2>
        <p className="text-sm text-muted-foreground">
          Turn a vehicle type on or off for riders and set how many seats it
          offers. Each type is priced separately in the table below.
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Seats</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => (
              <VehicleTypeRow key={t.type} type={t} onSaved={onSaved} />
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function VehicleTypeRow({
  type,
  onSaved,
}: {
  type: VehicleTypeConfig;
  onSaved: () => void;
}) {
  const [seats, setSeats] = useState(String(type.seats));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const seatsChanged = seats.trim() !== String(type.seats);

  const save = (values: { is_enabled?: boolean; seats?: number }) =>
    startTransition(async () => {
      setError(null);
      const err = await updateVehicleTypeConfig(type.type, values);
      if (err) {
        setError(err);
        return;
      }
      onSaved();
    });

  return (
    <TableRow>
      <TableCell className="font-medium">{vehicleLabel(type.type)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Input
            type="number"
            min="1"
            step="1"
            className="w-20 text-right"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
          {seatsChanged && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => save({ seats: Number(seats) })}
            >
              Save
            </Button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </TableCell>
      <TableCell>
        <Badge variant={type.is_enabled ? 'success' : 'neutral'}>
          {type.is_enabled ? 'Available' : 'Disabled'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <ConfirmDialog
          trigger={
            <Button
              variant={type.is_enabled ? 'danger' : 'default'}
              size="sm"
              disabled={isPending}
            >
              {type.is_enabled ? 'Disable' : 'Enable'}
            </Button>
          }
          title={
            type.is_enabled
              ? `Disable ${vehicleLabel(type.type)}?`
              : `Enable ${vehicleLabel(type.type)}?`
          }
          description={
            type.is_enabled
              ? 'Riders will no longer see this type and new bookings for it are blocked. Active rides are unaffected. You can re-enable it any time.'
              : 'Riders will be able to choose this type again, using its existing pricing.'
          }
          confirmLabel={type.is_enabled ? 'Disable' : 'Enable'}
          confirmVariant={type.is_enabled ? 'danger' : 'default'}
          pending={isPending}
          onConfirm={() => save({ is_enabled: !type.is_enabled })}
        />
      </TableCell>
    </TableRow>
  );
}

const num = (label: string) =>
  Yup.number()
    .typeError(`${label} must be a number`)
    .min(0, `${label} cannot be negative`)
    .required(`${label} is required`);

const validationSchema = Yup.object({
  vehicle_type: Yup.string().oneOf(VEHICLE_TYPES as unknown as string[]).required(),
  country: Yup.string().trim(),
  state: Yup.string().trim(),
  city: Yup.string()
    .trim()
    .test('city-needs-state', 'A city scope needs a state', function (v) {
      return !v?.trim() || !!this.parent.state?.trim();
    }),
  base_fare: num('Base fare'),
  surcharge: num('Surcharge'),
  time_rate: num('Per-minute charge'),
  waiting_rate: num('Waiting charge'),
  free_waiting_minutes: num('Free waiting minutes'),
  distance_rate: num('Per-km charge'),
}).test('state-needs-country', 'A state scope needs a country', (vals) => {
  if (vals.state?.trim() && !vals.country?.trim()) {
    return new Yup.ValidationError('A state scope needs a country', null, 'country');
  }
  return true;
});

function FareFormDialog({
  mode,
  fare,
  onSaved,
}: {
  mode: 'create' | 'edit';
  fare?: FareConfig;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      vehicle_type: (fare?.vehicle_type as VehicleType) ?? 'auto',
      country: fare?.country ?? '',
      state: fare?.state ?? '',
      city: fare?.city ?? '',
      base_fare: fare?.base_fare ?? 0,
      surcharge: fare?.surcharge ?? 0,
      time_rate: fare?.time_rate ?? 0,
      waiting_rate: fare?.waiting_rate ?? 0,
      free_waiting_minutes: fare?.free_waiting_minutes ?? 0,
      distance_rate: fare?.distance_rate ?? 0,
    },
    validationSchema,
    onSubmit: (values) => {
      setError(null);
      startTransition(async () => {
        const rates = {
          base_fare: Number(values.base_fare),
          distance_rate: Number(values.distance_rate),
          time_rate: Number(values.time_rate),
          waiting_rate: Number(values.waiting_rate),
          free_waiting_minutes: Number(values.free_waiting_minutes),
          surcharge: Number(values.surcharge),
        };
        if (mode === 'edit' && fare) {
          await updateFareConfig(fare.id, rates);
        } else {
          const err = await createFareConfig({
            vehicle_type: values.vehicle_type,
            country: values.country.trim() || null,
            state: values.state.trim() || null,
            city: values.city.trim() || null,
            ...rates,
          });
          if (err) {
            setError(err);
            return;
          }
        }
        setOpen(false);
        onSaved();
      });
    },
  });

  const fieldError = (k: keyof typeof formik.values) =>
    formik.touched[k] && formik.errors[k] ? (
      <p className="text-sm text-danger">{formik.errors[k] as string}</p>
    ) : null;

  const numberField = (k: keyof typeof formik.values, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`fare-${k}`}>{label}</Label>
      <Input
        id={`fare-${k}`}
        type="number"
        step="0.01"
        min="0"
        value={String(formik.values[k])}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        name={k}
      />
      {fieldError(k)}
    </div>
  );

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
            <Plus className="size-4" /> Add fare
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" /> Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add fare' : 'Edit fare'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? `Pricing for ${vehicleLabel(fare!.vehicle_type)} · ${scopeLabel(fare!)}`
              : 'Pricing applies to the most specific matching region.'}
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
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select
                    value={formik.values.country || ANY}
                    onValueChange={(v) => {
                      const country = v === ANY ? '' : v;
                      formik.setFieldValue('country', country);
                      formik.setFieldValue('state', '');
                      formik.setFieldValue('city', '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any (global)</SelectItem>
                      {Object.keys(GEO).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Select
                    value={formik.values.state || ANY}
                    disabled={!formik.values.country}
                    onValueChange={(v) => {
                      const state = v === ANY ? '' : v;
                      formik.setFieldValue('state', state);
                      formik.setFieldValue('city', '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any</SelectItem>
                      {Object.keys(GEO[formik.values.country] ?? {}).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Select
                    value={formik.values.city || ANY}
                    disabled={!formik.values.state}
                    onValueChange={(v) =>
                      formik.setFieldValue('city', v === ANY ? '' : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any</SelectItem>
                      {(GEO[formik.values.country]?.[formik.values.state] ?? []).map(
                        (city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave as “Any” for the global default. Pick a country to narrow by state, then city.
              </p>
              {fieldError('country')}
              {fieldError('city')}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            {numberField('base_fare', 'Base price (₹)')}
            {numberField('surcharge', 'Surcharge (₹)')}
            {numberField('time_rate', 'Per-minute charge (₹)')}
            {numberField('waiting_rate', 'Waiting charge / min (₹)')}
            {numberField('free_waiting_minutes', 'Free waiting (min)')}
            {numberField('distance_rate', 'Per-km charge (₹)')}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : mode === 'create' ? 'Add fare' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveFareButton({ fare, onRemoved }: { fare: FareConfig; onRemoved: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger" size="sm" disabled={isPending}>
          <Trash2 className="size-4" /> Remove
        </Button>
      }
      title="Remove this regional fare?"
      description="The next-broadest fare will apply for this region. This is recorded in the audit log."
      confirmLabel="Remove"
      pending={isPending}
      onConfirm={() =>
        startTransition(async () => {
          await removeFareConfig(fare.id);
          onRemoved();
        })
      }
    />
  );
}
