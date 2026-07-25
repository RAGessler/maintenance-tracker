import type { MaintenanceRecord, ManualOdometerReading, Trip } from '../../../modules/maintenance-store';

export type ActivityFact =
  | Readonly<{ kind: 'trip'; id: string; vehicleId?: string; occurredAt: number; trip: Trip }>
  | Readonly<{ kind: 'record'; id: string; vehicleId: string; occurredAt: number; record: MaintenanceRecord }>
  | Readonly<{ kind: 'reading'; id: string; vehicleId: string; occurredAt: number; reading: ManualOdometerReading }>;

type ActivityFacts = Readonly<{
  trips: readonly Trip[];
  records: readonly MaintenanceRecord[];
  readings: readonly ManualOdometerReading[];
}>;

const factPriority = { trip: 0, reading: 1, record: 2 } as const;

export function buildActivityHistory({ trips, records, readings }: ActivityFacts, vehicleId?: string): ActivityFact[] {
  return [
    ...trips.map((trip): ActivityFact => ({ kind: 'trip', id: trip.id, vehicleId: trip.vehicleId, occurredAt: Number(trip.endedAt), trip })),
    ...records.map((record): ActivityFact => ({ kind: 'record', id: record.id, vehicleId: record.vehicleId, occurredAt: Date.parse(`${record.completedOn}T00:00:00Z`), record })),
    ...readings.map((reading): ActivityFact => ({ kind: 'reading', id: reading.id, vehicleId: reading.vehicleId, occurredAt: Number(reading.effectiveAt), reading })),
  ].filter((fact) => !vehicleId || fact.vehicleId === vehicleId).sort((left, right) => right.occurredAt - left.occurredAt || factPriority[left.kind] - factPriority[right.kind] || right.id.localeCompare(left.id));
}
