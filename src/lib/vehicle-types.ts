// The platform's vehicle catalogue. Kept here (not in the 'use server' actions
// module) so plain values/types can be imported by client components.
// The authoritative seat count and enabled-state live in the DB table
// `vehicle_type_config`; these are the selectable values + display fallbacks.

// 'cab' is legacy (folded into 'sedan' by migration 0055) — kept only so old
// rows still render a label. It is intentionally absent from VEHICLE_TYPES.
export const VEHICLE_TYPES = [
  'bike',
  'auto',
  'hatchback',
  'sedan',
  'premium',
  'xl',
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_LABELS: Record<string, string> = {
  bike: 'Bike',
  auto: 'Auto',
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  premium: 'Premium',
  xl: 'XL',
  cab: 'Cab (legacy)',
};

export const vehicleLabel = (type: string): string =>
  VEHICLE_LABELS[type] ?? type;
