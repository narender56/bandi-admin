'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, XCircle, Radio, ExternalLink, Route, PlayCircle } from 'lucide-react';

import type { RideDetail, RideSimulationPoint } from '@/lib/data';
import { adminCancelRide } from '@/lib/actions';
import { formatINR, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'neutral'> = {
  completed: 'success',
  cancelled: 'danger',
  in_progress: 'warning',
  accepted: 'default',
  arrived: 'default',
  searching: 'warning',
  requested: 'warning',
};

export type SimulationRide = Pick<
  RideDetail,
  | 'id'
  | 'status'
  | 'pickup_address'
  | 'drop_address'
  | 'pickup_lat'
  | 'pickup_lng'
  | 'drop_lat'
  | 'drop_lng'
  | 'requested_at'
  | 'accepted_at'
  | 'started_at'
  | 'completed_at'
  | 'driver_id'
>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

export function RideDetailView({
  ride,
  locale,
  isLive,
  simulationPoints,
  mapsApiKey,
  flags,
}: {
  ride: RideDetail;
  locale: string;
  isLive: boolean;
  simulationPoints: RideSimulationPoint[];
  mapsApiKey?: string;
  flags: { canCancel: boolean; canSeeLive: boolean; canSeeSimulation: boolean };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const cancel = () =>
    startTransition(async () => {
      await adminCancelRide(ride.id);
      router.refresh();
    });

  const showLiveTab = isLive && flags.canSeeLive;
  const showSimulationTab = flags.canSeeSimulation;
  const mapUrl =
    ride.pickup_lat != null && ride.pickup_lng != null
      ? `https://www.google.com/maps?q=${ride.pickup_lat},${ride.pickup_lng}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Ride</h1>
            <Badge variant={TONE[ride.status] ?? 'neutral'}>{ride.status.replace('_', ' ')}</Badge>
            {isLive && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <Radio className="size-3.5 animate-pulse" /> live
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{ride.id}</p>
        </div>
        {flags.canCancel && isLive && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">
                <XCircle className="size-4" /> Cancel ride
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel this ride?</DialogTitle>
                <DialogDescription>
                  This force-cancels the trip and frees the assigned driver.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Keep ride</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" onClick={cancel} disabled={isPending}>
                    {isPending ? 'Cancelling…' : 'Cancel ride'}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue={showSimulationTab ? 'simulation' : showLiveTab ? 'live' : 'details'}>
        <TabsList>
          {showSimulationTab && <TabsTrigger value="simulation">Simulation replay</TabsTrigger>}
          {showLiveTab && <TabsTrigger value="live">Live status</TabsTrigger>}
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {showSimulationTab && (
          <TabsContent value="simulation">
            <RideSimulationReplay
              ride={ride}
              points={simulationPoints}
              mapsApiKey={mapsApiKey}
            />
          </TabsContent>
        )}

        {showLiveTab && (
          <TabsContent value="live">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="size-4" /> Live tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={TONE[ride.status] ?? 'neutral'}>
                    {ride.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Requested {formatDateTime(ride.requested_at)}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Pickup">{ride.pickup_address ?? '—'}</Field>
                  <Field label="Drop">{ride.drop_address ?? '—'}</Field>
                </div>
                {mapUrl ? (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <MapPin className="size-4" /> Open pickup on map <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">No coordinates available.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="details">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Trip</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Pickup">{ride.pickup_address ?? '—'}</Field>
                <Field label="Drop">{ride.drop_address ?? '—'}</Field>
                <Field label="Distance">
                  {ride.distance_km != null ? `${ride.distance_km} km` : '—'}
                </Field>
                <Field label="Duration">
                  {ride.duration_min != null ? `${ride.duration_min} min` : '—'}
                </Field>
                <Field label="Payment">{ride.payment_method ?? '—'}</Field>
                <Field label="Fare">
                  {ride.locked_fare != null
                    ? formatINR(ride.locked_fare)
                    : ride.est_fare_min != null
                      ? `${formatINR(ride.est_fare_min)}–${formatINR(ride.est_fare_max)}`
                      : '—'}
                </Field>
                {ride.status === 'cancelled' && (
                  <>
                    <Field label="Cancelled by">{ride.cancelled_by ?? '—'}</Field>
                    <Field label="Reason">{ride.cancel_reason ?? '—'}</Field>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>People &amp; timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Rider">
                    <a href={`/${locale}/riders/${ride.rider_id}`} className="text-primary hover:underline">
                      {ride.rider_name ?? 'Unnamed'}
                    </a>
                    <span className="block text-xs text-muted-foreground">{ride.rider_phone ?? '—'}</span>
                  </Field>
                  <Field label="Driver">
                    {ride.driver_id ? (
                      <>
                        <a
                          href={`/${locale}/drivers/${ride.driver_id}`}
                          className="text-primary hover:underline"
                        >
                          {ride.driver_name ?? 'Unnamed'}
                        </a>
                        <span className="block text-xs text-muted-foreground">
                          {ride.driver_phone ?? '—'}
                        </span>
                      </>
                    ) : (
                      'Unassigned'
                    )}
                  </Field>
                </div>
                <div className="space-y-2 text-sm">
                  <Timeline label="Requested" at={ride.requested_at} />
                  <Timeline label="Accepted" at={ride.accepted_at} />
                  <Timeline label="Started" at={ride.started_at} />
                  <Timeline label="Completed" at={ride.completed_at} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type BoundsPoint = { latitude: number; longitude: number };

function haversineKm(a: BoundsPoint, b: BoundsPoint): number {
  const radius = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function buildFallbackPoints(ride: SimulationRide): RideSimulationPoint[] {
  const hasPickup = ride.pickup_lat != null && ride.pickup_lng != null;
  const hasDrop = ride.drop_lat != null && ride.drop_lng != null;
  const now = ride.started_at ?? ride.accepted_at ?? ride.requested_at;
  const fallback: RideSimulationPoint[] = [];
  if (hasPickup) {
    fallback.push({
      id: 'pickup',
      ride_id: ride.id,
      driver_id: ride.driver_id ?? 'unassigned',
      ride_status: ride.accepted_at ? 'accepted' : ride.status,
      latitude: ride.pickup_lat!,
      longitude: ride.pickup_lng!,
      heading: null,
      source: 'pickup',
      recorded_at: ride.accepted_at ?? now,
    });
  }
  if (hasDrop) {
    fallback.push({
      id: 'drop',
      ride_id: ride.id,
      driver_id: ride.driver_id ?? 'unassigned',
      ride_status: ride.started_at ? 'in_progress' : ride.status,
      latitude: ride.drop_lat!,
      longitude: ride.drop_lng!,
      heading: null,
      source: 'drop',
      recorded_at: ride.completed_at ?? ride.started_at ?? now,
    });
  }
  return fallback;
}

export function RideSimulationReplay({
  ride,
  points,
  mapsApiKey,
}: {
  ride: SimulationRide;
  points: RideSimulationPoint[];
  mapsApiKey?: string;
}) {
  const trace = points.length > 0 ? points : buildFallbackPoints(ride);
  const hasRealTrace = points.length > 0;
  const first = trace[0];
  const last = trace.at(-1);
  const pickup =
    ride.pickup_lat != null && ride.pickup_lng != null
      ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng }
      : null;
  const drop =
    ride.drop_lat != null && ride.drop_lng != null
      ? { latitude: ride.drop_lat, longitude: ride.drop_lng }
      : null;
  const travelledKm = trace.reduce((sum, point, index) => {
    const previous = trace[index - 1];
    if (!previous) return sum;
    return sum + haversineKm(previous, point);
  }, 0);
  const durationMs =
    first && last
      ? new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()
      : 0;
  const durationMin = Math.max(0, Math.round(durationMs / 60000));
  const statusCounts = trace.reduce<Record<string, number>>((acc, point) => {
    acc[point.ride_status] = (acc[point.ride_status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="size-4" /> Ride simulation replay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasRealTrace && (
            <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
              No captured driver movement events for this ride yet. Showing pickup/drop fallback so admins still
              have spatial context.
            </div>
          )}
          <SimulationMap
            ride={ride}
            points={trace}
            pickup={pickup}
            drop={drop}
            mapsApiKey={mapsApiKey}
          />
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Trace points" value={String(points.length)} />
            <Metric label="Travelled" value={`${travelledKm.toFixed(2)} km`} />
            <Metric label="Replay span" value={durationMin > 0 ? `${durationMin} min` : '—'} />
            <Metric label="Last status" value={last?.ride_status.replace('_', ' ') ?? ride.status} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="size-4" /> Replay timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge key={status} variant={TONE[status] ?? 'neutral'}>
                  {status.replace('_', ' ')} · {count}
                </Badge>
              ))}
            </div>
            <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
              {trace.map((point, index) => (
                <div key={point.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        #{index + 1} · {point.ride_status.replace('_', ' ')}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                      </p>
                    </div>
                    <Badge variant="outline">{point.source}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateTime(point.recorded_at)}</span>
                    <span>{point.heading != null ? `${Math.round(point.heading)}°` : 'No heading'}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SimulationMap({
  ride,
  points,
  pickup,
  drop,
  mapsApiKey,
}: {
  ride: SimulationRide;
  points: RideSimulationPoint[];
  pickup: BoundsPoint | null;
  drop: BoundsPoint | null;
  mapsApiKey?: string;
}) {
  const all = [...points, ...(pickup ? [pickup] : []), ...(drop ? [drop] : [])];
  if (all.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
        No coordinates available for this ride.
      </div>
    );
  }

  if (mapsApiKey) {
    return (
      <GoogleSimulationMap
        apiKey={mapsApiKey}
        ride={ride}
        points={points}
        pickup={pickup}
        drop={drop}
      />
    );
  }

  const minLat = Math.min(...all.map((p) => p.latitude));
  const maxLat = Math.max(...all.map((p) => p.latitude));
  const minLng = Math.min(...all.map((p) => p.longitude));
  const maxLng = Math.max(...all.map((p) => p.longitude));
  const latPad = Math.max((maxLat - minLat) * 0.2, 0.002);
  const lngPad = Math.max((maxLng - minLng) * 0.2, 0.002);
  const width = 900;
  const height = 420;
  const project = (point: BoundsPoint) => {
    const x = ((point.longitude - (minLng - lngPad)) / (maxLng - minLng + lngPad * 2)) * width;
    const y =
      height -
      ((point.latitude - (minLat - latPad)) / (maxLat - minLat + latPad * 2)) * height;
    return { x, y };
  };
  const path = points
    .map((point) => {
      const p = project(point);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
  const pickupP = pickup ? project(pickup) : null;
  const dropP = drop ? project(drop) : null;
  const last = points.at(-1);
  const lastP = last ? project(last) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-slate-950">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[420px] w-full">
        <defs>
          <pattern id={`grid-${ride.id}`} width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M 42 0 L 0 0 0 42" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="1" />
          </pattern>
          <filter id={`glow-${ride.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={width} height={height} fill="#020617" />
        <rect width={width} height={height} fill={`url(#grid-${ride.id})`} />
        <path d="M80 70 C220 110 275 36 450 90 S705 185 830 120" fill="none" stroke="rgba(14,165,233,.16)" strokeWidth="18" strokeLinecap="round" />
        <path d="M40 330 C190 260 320 410 465 305 S700 210 860 315" fill="none" stroke="rgba(14,165,233,.18)" strokeWidth="22" strokeLinecap="round" />
        {path && (
          <polyline
            points={path}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#glow-${ride.id})`}
          />
        )}
        {points.map((point, index) => {
          const p = project(point);
          const radius = index === 0 || index === points.length - 1 ? 5 : 3;
          return (
            <circle
              key={point.id}
              cx={p.x}
              cy={p.y}
              r={radius}
              fill={point.ride_status === 'in_progress' ? '#22c55e' : '#38bdf8'}
              opacity={index === points.length - 1 ? 1 : 0.78}
            />
          );
        })}
        {pickupP && <MapMarker x={pickupP.x} y={pickupP.y} label="P" fill="#22c55e" />}
        {dropP && <MapMarker x={dropP.x} y={dropP.y} label="D" fill="#f43f5e" />}
        {lastP && (
          <g transform={`translate(${lastP.x} ${lastP.y}) rotate(${last?.heading ?? 0})`}>
            <path d="M0,-18 L11,14 L0,8 L-11,14 Z" fill="#facc15" stroke="#020617" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}

declare global {
  interface Window {
    google?: any;
    __bandiGoogleMapsPromise?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__bandiGoogleMapsPromise) return window.__bandiGoogleMapsPromise;

  window.__bandiGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-bandi-google-maps="true"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.bandiGoogleMaps = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
  return window.__bandiGoogleMapsPromise;
}

function GoogleSimulationMap({
  apiKey,
  ride,
  points,
  pickup,
  drop,
}: {
  apiKey: string;
  ride: SimulationRide;
  points: RideSimulationPoint[];
  pickup: BoundsPoint | null;
  drop: BoundsPoint | null;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  const all = useMemo(
    () => [...points, ...(pickup ? [pickup] : []), ...(drop ? [drop] : [])],
    [drop, pickup, points],
  );
  const start = points[0] ?? pickup ?? drop ?? all[0];

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!cancelled) setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Google Maps could not load. Showing fallback map.');
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!isReady || !mapRef.current || !window.google?.maps || !start) return;
    const google = window.google;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: start.latitude, lng: start.longitude },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: true,
    });
    const bounds = new google.maps.LatLngBounds();
    all.forEach((point) => bounds.extend({ lat: point.latitude, lng: point.longitude }));
    if (!bounds.isEmpty()) map.fitBounds(bounds, 64);

    if (pickup) {
      new google.maps.Marker({
        position: { lat: pickup.latitude, lng: pickup.longitude },
        map,
        label: 'P',
        title: ride.pickup_address ?? 'Pickup',
      });
    }
    if (drop) {
      new google.maps.Marker({
        position: { lat: drop.latitude, lng: drop.longitude },
        map,
        label: 'D',
        title: ride.drop_address ?? 'Drop',
      });
    }
    if (points.length > 0) {
      new google.maps.Polyline({
        path: points.map((point) => ({ lat: point.latitude, lng: point.longitude })),
        geodesic: true,
        strokeColor: '#0ea5e9',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map,
      });
      markerRef.current = new google.maps.Marker({
        position: { lat: points[0].latitude, lng: points[0].longitude },
        map,
        title: 'Driver movement',
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#facc15',
          fillOpacity: 1,
          strokeColor: '#111827',
          strokeWeight: 2,
          rotation: points[0].heading ?? 0,
        },
      });
    }
  }, [all, drop, isReady, pickup, points, ride.drop_address, ride.pickup_address, start]);

  useEffect(() => {
    if (!markerRef.current || points.length === 0) return;
    const point = points[Math.min(index, points.length - 1)];
    const google = window.google;
    markerRef.current.setPosition({ lat: point.latitude, lng: point.longitude });
    markerRef.current.setIcon({
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 6,
      fillColor: '#facc15',
      fillOpacity: 1,
      strokeColor: '#111827',
      strokeWeight: 2,
      rotation: point.heading ?? 0,
    });
  }, [index, points]);

  useEffect(() => {
    if (!isPlaying || points.length <= 1) return;
    timerRef.current = window.setInterval(() => {
      setIndex((current) => {
        if (current >= points.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 650);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isPlaying, points.length]);

  if (error) {
    return <SvgFallbackSimulation ride={ride} points={points} pickup={pickup} drop={drop} note={error} />;
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-border">
        <div ref={mapRef} className="h-[420px] w-full bg-muted" />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
            Loading Google Maps…
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="text-sm text-muted-foreground">
          {points.length > 0
            ? `Point ${Math.min(index + 1, points.length)} of ${points.length}`
            : 'No driver trace points yet'}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={points.length <= 1}
            onClick={() => {
              setIndex(0);
              setIsPlaying(true);
            }}
          >
            Replay
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={points.length <= 1}
            onClick={() => setIsPlaying((value) => !value)}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SvgFallbackSimulation({
  ride,
  points,
  pickup,
  drop,
  note,
}: {
  ride: SimulationRide;
  points: RideSimulationPoint[];
  pickup: BoundsPoint | null;
  drop: BoundsPoint | null;
  note: string;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
        {note}
      </div>
      <SimulationMap ride={ride} points={points} pickup={pickup} drop={drop} />
    </div>
  );
}

function MapMarker({
  x,
  y,
  label,
  fill,
}: {
  x: number;
  y: number;
  label: string;
  fill: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="15" fill={fill} stroke="#fff" strokeWidth="3" />
      <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="13" fontWeight="700">
        {label}
      </text>
    </g>
  );
}

function Timeline({ label, at }: { label: string; at: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={at ? '' : 'text-muted-foreground'}>{formatDateTime(at)}</span>
    </div>
  );
}
