import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import {
  getFareConfigs,
  getFuelPriceConfigs,
  getVehicleTypeConfigs,
} from '@/lib/data';
import { FaresManager } from '@/components/fares/fares-manager';

export default async function FaresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'fares:write')) redirect(`/${locale}`);

  const [fares, vehicleTypes, fuelPrices] = await Promise.all([
    getFareConfigs(),
    getVehicleTypeConfigs(),
    getFuelPriceConfigs(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fares</h1>
        <p className="text-sm text-muted-foreground">
          Set pricing per region (country / state / city) and vehicle type
        </p>
      </div>
      <FaresManager
        fares={fares}
        vehicleTypes={vehicleTypes}
        fuelPrices={fuelPrices}
      />
    </div>
  );
}
