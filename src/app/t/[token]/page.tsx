import type { Metadata } from 'next';

import { anonClient } from '@/lib/supabase';

import { TripTracker, type SharedRide } from './TripTracker';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live trip · Bandi',
  description: 'Follow a Bandi trip live.',
  robots: { index: false, follow: false },
};

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { data } = await anonClient().rpc('get_shared_ride', {
    p_token: token,
  });
  const ride = (data as SharedRide | null) ?? null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-background px-4 py-6 text-foreground">
      <header className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-tight">Bandi</span>
        <span className="text-sm text-muted-foreground">Live trip</span>
      </header>
      {ride ? (
        <TripTracker token={token} initial={ride} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold">Trip not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This link is wrong or the trip is no longer shared.
          </p>
        </div>
      )}
    </main>
  );
}
