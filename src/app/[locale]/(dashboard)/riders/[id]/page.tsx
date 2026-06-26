import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { getRideSimulationPointsForRides, getRiderProfile } from '@/lib/data';
import { RiderProfileView } from '@/components/riders/rider-profile';

export default async function RiderProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  const role = session.role as StaffRole;
  if (!can(role, 'profiles:view')) redirect(`/${locale}/account`);

  const rider = await getRiderProfile(id);
  if (!rider) notFound();
  const canSeeSimulation = role === 'admin' || role === 'super_admin';
  const simulationByRide = canSeeSimulation
    ? await getRideSimulationPointsForRides(rider.rides.map((ride) => ride.id))
    : {};
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/riders`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to riders
      </Link>
      <RiderProfileView
        rider={rider}
        canBlock={can(role, 'users:block')}
        canSeeSimulation={canSeeSimulation}
        simulationByRide={simulationByRide}
        mapsApiKey={mapsApiKey}
      />
    </div>
  );
}
