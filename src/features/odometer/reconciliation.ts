export type ManualReading = Readonly<{
  id: string;
  effectiveAt: string;
  milliMiles: string;
}>;

export type ConfirmedTripDistance = Readonly<{
  endedAt: string;
  effectiveMilliMiles: string;
}>;

export function calculateEstimatedOdometer({ readings, trips }: Readonly<{
  readings: readonly ManualReading[];
  trips: readonly ConfirmedTripDistance[];
}>): string {
  const baseline = readings.reduce<ManualReading | undefined>((latest, reading) => {
    if (!latest || BigInt(reading.effectiveAt) > BigInt(latest.effectiveAt) || (reading.effectiveAt === latest.effectiveAt && BigInt(reading.id) > BigInt(latest.id))) {
      return reading;
    }
    return latest;
  }, undefined);
  if (!baseline) return '0';

  return trips.reduce(
    (estimated, trip) => BigInt(trip.endedAt) > BigInt(baseline.effectiveAt) ? estimated + BigInt(trip.effectiveMilliMiles) : estimated,
    BigInt(baseline.milliMiles),
  ).toString();
}
