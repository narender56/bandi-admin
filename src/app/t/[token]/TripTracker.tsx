'use client';

import { Car, MapPin, Navigation } from 'lucide-react';
import { useEffect, useState } from 'react';

export type SharedRide = {
  status: string;
  pickup_address: string | null;
  drop_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  drop_lat: number | null;
  drop_lng: number | null;
  driver_name: string | null;
  vehicle_type: string | null;
  vehicle_reg_no: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_heading: number | null;
  driver_updated_at: string | null;
};

const ACTIVE = new Set([
  'requested',
  'searching',
  'accepted',
  'arrived',
  'in_progress',
]);

function statusLabel(status: string): { title: string; live: boolean } {
  switch (status) {
    case 'requested':
    case 'searching':
      return { title: 'Finding a driver', live: true };
    case 'accepted':
      return { title: 'Driver is coming', live: true };
    case 'arrived':
      return { title: 'Driver has arrived', live: true };
    case 'in_progress':
      return { title: 'On the way', live: true };
    case 'completed':
    case 'unconfirmed':
      return { title: 'Trip finished', live: false };
    case 'cancelled':
      return { title: 'Trip cancelled', live: false };
    case 'expired':
      return { title: 'No driver found', live: false };
    default:
      return { title: 'Trip', live: false };
  }
}

export function TripTracker({
  token,
  initial,
}: {
  token: string;
  initial: SharedRide;
}) {
  const [ride, setRide] = useState<SharedRide>(initial);

  useEffect(() => {
    if (!ACTIVE.has(ride.status)) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/t/${token}/track`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.found) setRide(json.ride as SharedRide);
      } catch {
        // transient; next tick retries
      }
    };
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, ride.status]);

  const { title, live } = statusLabel(ride.status);
  const hasDriverLoc = ride.driver_lat != null && ride.driver_lng != null;
  const mapsUrl = hasDriverLoc
    ? `https://www.google.com/maps?q=${ride.driver_lat},${ride.driver_lng}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          {live && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
          )}
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        {ride.driver_updated_at && live && (
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {timeAgo(ride.driver_updated_at)}
          </p>
        )}
      </section>

      {ride.driver_name && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Car className="h-4 w-4" />
            <span>Driver</span>
          </div>
          <p className="mt-1 text-lg font-semibold">{ride.driver_name}</p>
          <p className="text-sm text-muted-foreground">
            {[
              ride.vehicle_color,
              ride.vehicle_model,
              ride.vehicle_type,
            ]
              .filter(Boolean)
              .join(' · ')}
            {ride.vehicle_reg_no ? ` (${ride.vehicle_reg_no})` : ''}
          </p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex gap-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div>
            <p className="text-xs text-muted-foreground">Pickup</p>
            <p className="text-sm font-medium">
              {ride.pickup_address ?? '—'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="text-xs text-muted-foreground">Drop</p>
            <p className="text-sm font-medium">{ride.drop_address ?? '—'}</p>
          </div>
        </div>
      </section>

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          <Navigation className="h-4 w-4" />
          See live location on map
        </a>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Shared from the Bandi app · safe travels
      </p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}
