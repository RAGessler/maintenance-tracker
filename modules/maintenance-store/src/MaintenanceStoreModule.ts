import { NativeModule, requireNativeModule } from 'expo';

import { createMaintenanceStore, type NativeMaintenanceStore } from './MaintenanceStore';

declare class MaintenanceStoreModule extends NativeModule<{}> implements NativeMaintenanceStore {
  getBootstrap(): Promise<{ disclosureAccepted: boolean; schemaVersion: number }>;
  acceptDisclosure(version: number): Promise<{ disclosureAccepted: boolean; schemaVersion: number }>;
  createVehicle(
    nickname: string,
    year: number,
    make: string,
    model: string,
    initialOdometerMilliMiles: string,
  ): Promise<{ id: string; nickname: string; year: number; make: string; model: string }>;
  getTrackingSnapshot(): Promise<{ state: 'idle' | 'tracking' }>;
  startTracking(vehicleId: string, source: 'manual' | 'automatic'): Promise<{ state: 'idle' | 'tracking' }>;
  stopTracking(): Promise<{ state: 'idle' | 'tracking' }>;
}

const nativeMaintenanceStore = requireNativeModule<MaintenanceStoreModule>('MaintenanceStore');

export const maintenanceStore = createMaintenanceStore(nativeMaintenanceStore);
export default maintenanceStore;
