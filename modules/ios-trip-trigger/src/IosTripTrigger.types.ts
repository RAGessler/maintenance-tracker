import type { EventSubscription } from 'expo-modules-core';

export type TriggerSource = 'carplay' | 'bluetooth' | 'manual';

export type TrackingState =
  | 'idle'
  | 'start-candidate'
  | 'awaiting-movement'
  | 'active'
  | 'reconnect-grace-period'
  | 'completed'
  | 'failed';

export interface NativeStatus {
  state: TrackingState;
  locationAuthorization: string;
  currentRoute: AudioPort[];
  configuredRouteName: string | null;
  currentVehicleName: string | null;
  selectedRouteName: string | null;
  selectedVehicleName: string | null;
  tripId: string | null;
  graceDeadline: string | null;
  databaseUri: string;
}

export interface AudioPort {
  name: string;
  type: string;
  uid: string;
  vehicle: string;
}

export interface TripSummary {
  id: string;
  vehicleName: string | null;
  triggerSource: string;
  startedAt: string;
  endedAt: string | null;
  state: TrackingState;
  distanceMeters: number;
  acceptedSamples: number;
  rejectedSamples: number;
}

export interface TrackingEvent {
  id: number;
  eventId: string;
  timestamp: string;
  source: string;
  name: string;
  tripId: string | null;
  payload: string;
}

export interface IosTripTriggerModule {
  addListener(eventName: 'onEvent', listener: (event: TrackingEvent) => void): EventSubscription;
  configureCurrentRoute(): Promise<NativeStatus>;
  deleteAllData(): Promise<NativeStatus>;
  endTrip(source: TriggerSource): Promise<NativeStatus>;
  getEvents(limit: number): Promise<TrackingEvent[]>;
  getStatus(): Promise<NativeStatus>;
  getTripSummaries(limit: number): Promise<TripSummary[]>;
  requestLocationPermissions(): Promise<NativeStatus>;
  startTrip(source: TriggerSource): Promise<NativeStatus>;
}
