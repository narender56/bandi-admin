import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { can, type StaffRole } from '@/lib/rbac';
import { getRideDetail, getRideSimulationPoints, isLiveStatus } from '@/lib/data';
import { RideDetailView } from '@/components/rides/ride-detail';

export default async function RideDetailPage({
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

  const ride = await getRideDetail(id);
  if (!ride) notFound();

  const isLive = isLiveStatus(ride.status);
  const canSeeSimulation = role === 'admin' || role === 'super_admin';
  const simulationPoints = canSeeSimulation
    ? await getRideSimulationPoints(ride.id)
    : [];
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/rides`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to rides
      </Link>
      <RideDetailView
        ride={ride}
        locale={locale}
        isLive={isLive}
        simulationPoints={simulationPoints}
        mapsApiKey={mapsApiKey}
        flags={{
          canCancel: can(role, 'rides:cancel'),
          canSeeLive: can(role, 'live:view'),
          canSeeSimulation,
        }}
      />
    </div>
  );
}
