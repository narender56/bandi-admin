'use client';

import { PlayCircle } from 'lucide-react';

import type { DriverRideRow, RideRow, RideSimulationPoint } from '@/lib/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RideSimulationReplay, type SimulationRide } from './ride-detail';

type ReplayRide = RideRow | DriverRideRow;

function toSimulationRide(ride: ReplayRide): SimulationRide {
  return {
    id: ride.id,
    status: ride.status,
    pickup_address: ride.pickup_address,
    drop_address: ride.drop_address,
    pickup_lat: ride.pickup_lat,
    pickup_lng: ride.pickup_lng,
    drop_lat: ride.drop_lat,
    drop_lng: ride.drop_lng,
    requested_at: ride.requested_at,
    accepted_at: ride.accepted_at,
    started_at: ride.started_at,
    completed_at: ride.completed_at,
    driver_id: ride.driver_id,
  };
}

export function RideReplayDialog({
  ride,
  points,
  mapsApiKey,
}: {
  ride: ReplayRide;
  points: RideSimulationPoint[];
  mapsApiKey?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <PlayCircle className="size-4" />
          Replay
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ride replay</DialogTitle>
          <DialogDescription>
            Simple admin simulation using captured driver location events.
          </DialogDescription>
        </DialogHeader>
        <RideSimulationReplay
          ride={toSimulationRide(ride)}
          points={points}
          mapsApiKey={mapsApiKey}
        />
      </DialogContent>
    </Dialog>
  );
}
