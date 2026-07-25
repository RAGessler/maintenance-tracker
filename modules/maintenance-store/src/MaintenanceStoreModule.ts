import { NativeModule, requireNativeModule } from 'expo';

import { createMaintenanceStore, type Bootstrap, type GarageVehicle, type MaintenanceRecord, type NativeMaintenanceStore, type RecoveryState, type TrackingSnapshot, type Vehicle } from './MaintenanceStore';

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
  getTrackingSnapshot(): Promise<TrackingSnapshot>;
  startTracking(vehicleId: string, source: 'manual' | 'automatic'): Promise<TrackingSnapshot>;
  stopTracking(): Promise<TrackingSnapshot>;
  getMaintenanceRecords(vehicleId: string): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(vehicleId: string, serviceName: string, completedOn: string, milliMiles: string, note?: string): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(id: string, vehicleId: string, serviceName: string, completedOn: string, milliMiles: string, note?: string): Promise<MaintenanceRecord>;
  deleteMaintenanceRecord(id: string): Promise<void>;
}

const nativeMaintenanceStore = requireNativeModule<MaintenanceStoreModule>('MaintenanceStore');

export const maintenanceStore = createMaintenanceStore(nativeMaintenanceStore);
export default maintenanceStore;
