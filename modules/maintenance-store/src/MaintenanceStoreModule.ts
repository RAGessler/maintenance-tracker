import { NativeModule, requireNativeModule } from 'expo';

import { createMaintenanceStore, type Bootstrap, type GarageVehicle, type NativeMaintenanceStore, type TrackingSnapshot, type Vehicle } from './MaintenanceStore';

declare class MaintenanceStoreModule extends NativeModule<{}> implements NativeMaintenanceStore {
  getBootstrap(): Promise<Bootstrap>;
  acceptDisclosure(version: number): Promise<Bootstrap>;
  getVehicles(): Promise<GarageVehicle[]>;
  createVehicle(
    nickname: string,
    year: number,
    make: string,
    model: string,
    initialOdometerMilliMiles: string,
  ): Promise<Vehicle>;
  getTrackingSnapshot(): Promise<TrackingSnapshot>;
  startTracking(vehicleId: string, source: 'manual' | 'automatic'): Promise<TrackingSnapshot>;
  stopTracking(): Promise<TrackingSnapshot>;
}

const nativeMaintenanceStore = requireNativeModule<MaintenanceStoreModule>('MaintenanceStore');

export const maintenanceStore = createMaintenanceStore(nativeMaintenanceStore);
export default maintenanceStore;
