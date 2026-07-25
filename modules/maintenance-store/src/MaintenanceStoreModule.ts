import { NativeModule, requireNativeModule } from 'expo';

import { createMaintenanceStore, type Bootstrap, type GarageVehicle, type MaintenanceRecord, type ManualOdometerReading, type NativeMaintenanceStore, type OdometerFacts, type RecoveryState, type ReviewTripInput, type TrackingSetup, type TrackingSnapshot, type Trip, type TripRevision, type Vehicle } from './MaintenanceStore';

declare class MaintenanceStoreModule extends NativeModule<{}> implements NativeMaintenanceStore {
  getBootstrap(): Promise<Bootstrap>;
  getRecoveryState(): Promise<RecoveryState>;
  acceptDisclosure(version: number): Promise<Bootstrap>;
  deleteAllData(): Promise<Bootstrap>;
  getVehicles(): Promise<GarageVehicle[]>;
  getArchivedVehicles(): Promise<GarageVehicle[]>;
  createVehicle(
    nickname: string,
    year: number,
    make: string,
    model: string,
    initialOdometerMilliMiles: string,
  ): Promise<Vehicle>;
  updateVehicle(id: string, nickname: string, year: number, make: string, model: string): Promise<Vehicle>;
  archiveVehicle(vehicleId: string): Promise<void>;
  restoreVehicle(vehicleId: string): Promise<void>;
  getManualOdometerReadings(vehicleId: string): Promise<ManualOdometerReading[]>;
  appendManualOdometerReading(vehicleId: string, milliMiles: string, effectiveAt: string): Promise<ManualOdometerReading>;
  getOdometerFacts(vehicleId: string): Promise<OdometerFacts>;
  getTrackingSnapshot(): Promise<TrackingSnapshot>;
  getTrackingSetup(vehicleId: string): Promise<TrackingSetup>;
  startTracking(vehicleId: string, source: 'manual' | 'automatic'): Promise<TrackingSnapshot>;
  stopTracking(): Promise<TrackingSnapshot>;
  getTrips(vehicleId: string): Promise<Trip[]>;
  getTripRevisions(tripId: string): Promise<TripRevision[]>;
  reviewTrip(tripId: string, action: ReviewTripInput['action'], effectiveMilliMiles?: string, vehicleId?: string): Promise<Trip>;
  getMaintenanceRecords(vehicleId: string): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(vehicleId: string, serviceName: string, completedOn: string, milliMiles: string, note?: string): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(id: string, vehicleId: string, serviceName: string, completedOn: string, milliMiles: string, note?: string): Promise<MaintenanceRecord>;
  deleteMaintenanceRecord(id: string): Promise<void>;
}

const nativeMaintenanceStore = requireNativeModule<MaintenanceStoreModule>('MaintenanceStore');

export const maintenanceStore = createMaintenanceStore(nativeMaintenanceStore);
export default maintenanceStore;
