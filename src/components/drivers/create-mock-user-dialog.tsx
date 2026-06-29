'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';

import { createMockUser } from '@/lib/actions';
import { VEHICLE_TYPES, vehicleLabel, type VehicleType } from '@/lib/vehicle-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PHONE_RE = /^(\+91[-\s]?|0)?[6-9]\d{9}$/;
const DEFAULT_MILEAGE_BY_TYPE: Record<VehicleType, number> = {
  bike: 45,
  auto: 28,
  hatchback: 17,
  sedan: 15,
  premium: 12,
  xl: 10,
};

/**
 * Quick mock-account creator for testing: spins up an auth user + a ready
 * profile (auto-approved driver with vehicle & wallet, or a plain rider) that
 * can sign in immediately with the mock OTP. Not the verified-onboarding flow.
 */
export function CreateMockUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<'driver' | 'rider'>('driver');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('auto');
  const [fuelType, setFuelType] = useState('petrol');
  const [mileageKmpl, setMileageKmpl] = useState(String(DEFAULT_MILEAGE_BY_TYPE.auto));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setRole('driver');
    setFullName('');
    setPhone('');
    setVehicleType('auto');
    setFuelType('petrol');
    setMileageKmpl(String(DEFAULT_MILEAGE_BY_TYPE.auto));
    setError(null);
    setDone(false);
  };

  const submit = () => {
    setError(null);
    if (!fullName.trim()) return setError('Enter a name');
    if (!PHONE_RE.test(phone.trim())) return setError('Enter a valid Indian mobile number');
    const mileage = Number(mileageKmpl);
    if (role === 'driver' && (!Number.isFinite(mileage) || mileage <= 0)) {
      return setError('Enter valid vehicle mileage');
    }
    startTransition(async () => {
      const result = await createMockUser({
        role,
        fullName: fullName.trim(),
        phone: phone.trim(),
        vehicleType: role === 'driver' ? vehicleType : undefined,
        fuelType: role === 'driver' ? fuelType : undefined,
        mileageKmpl: role === 'driver' ? mileage : undefined,
      });
      if (result) {
        setError(result);
        return;
      }
      setDone(true);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="size-4" /> Add mock user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create mock user</DialogTitle>
          <DialogDescription>
            Spins up a test account that can log in right away with the mock OTP.
            Drivers are auto-approved with a vehicle and ₹500 wallet.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
              <Check className="size-4" /> Created. Log in with this number using
              the mock OTP code.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDone(false)}>
                Add another
              </Button>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Account type</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'driver' | 'rider')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="rider">Rider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mock-name">Full name</Label>
              <Input
                id="mock-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Test Driver"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mock-phone">Mobile number</Label>
              <Input
                id="mock-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                inputMode="tel"
              />
            </div>
            {role === 'driver' && (
              <>
                <div className="space-y-1.5">
                  <Label>Vehicle type</Label>
                  <Select
                    value={vehicleType}
                    onValueChange={(v) => {
                      const nextType = v as VehicleType;
                      setVehicleType(nextType);
                      setMileageKmpl(String(DEFAULT_MILEAGE_BY_TYPE[nextType] ?? 18));
                    }}
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fuel type</Label>
                    <Select value={fuelType} onValueChange={setFuelType}>
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
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mock-mileage">Mileage</Label>
                    <Input
                      id="mock-mileage"
                      value={mileageKmpl}
                      onChange={(e) => setMileageKmpl(e.target.value)}
                      type="number"
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={isPending}>
                {isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
