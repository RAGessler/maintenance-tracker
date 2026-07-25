export type Vehicle = Readonly<{
  id: string;
  nickname: string;
  year: number;
  make: string;
  model: string;
}>;

export type CreateVehicleInput = Readonly<{
  nickname: string;
  year: number;
  make: string;
  model: string;
  initialOdometerMilliMiles: string;
}>;

export type UpdateVehicleInput = Readonly<{
  id: string;
  nickname: string;
  year: number;
  make: string;
  model: string;
}>;

export type Bootstrap = Readonly<{
  disclosureAccepted: boolean;
  disclosureVersion: number;
  schemaVersion: number;
}>;

export type RecoveryState = Readonly<{
  state: 'ready';
}> | Readonly<{
  state: 'recovery_required';
  reason: 'unsupported_schema' | 'opening_failed';
}>;

export type GarageVehicle = Vehicle & Readonly<{
  currentOdometerMilliMiles: string;
  scheduleCount: number;
  trackingReadiness: 'manual_only' | 'automatic_setup';
}>;

export type TrackingSnapshot = Readonly<{
  state: 'idle' | 'tracking' | 'recovering';
}>;

export interface NativeMaintenanceStore {
  getBootstrap(): Promise<Bootstrap>;
  getRecoveryState(): Promise<RecoveryState>;
  acceptDisclosure(version: number): Promise<Bootstrap>;
  deleteAllData(): Promise<Bootstrap>;
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
  getArchivedVehicles(): Promise<GarageVehicle[]>;
  updateVehicle(id: string, nickname: string, year: number, make: string, model: string): Promise<Vehicle>;
  archiveVehicle(vehicleId: string): Promise<void>;
  restoreVehicle(vehicleId: string): Promise<void>;
}

export type MaintenanceStore = Readonly<{
  product: Readonly<{
    getBootstrap(): Promise<Bootstrap>;
    getRecoveryState(): Promise<RecoveryState>;
    acceptDisclosure(version: number): Promise<Bootstrap>;
    deleteAllData(): Promise<Bootstrap>;
    getVehicles(): Promise<GarageVehicle[]>;
    getArchivedVehicles(): Promise<GarageVehicle[]>;
    createVehicle(input: CreateVehicleInput): Promise<Vehicle>;
    updateVehicle(input: UpdateVehicleInput): Promise<Vehicle>;
    archiveVehicle(vehicleId: string): Promise<void>;
    restoreVehicle(vehicleId: string): Promise<void>;
  }>;
  tracking: Readonly<{
    getSnapshot(): Promise<TrackingSnapshot>;
    start(vehicleId: string, source: 'manual' | 'automatic'): Promise<TrackingSnapshot>;
    stop(): Promise<TrackingSnapshot>;
  }>;
}>;

export function createMaintenanceStore(native: NativeMaintenanceStore): MaintenanceStore {
  return {
    product: {
      getBootstrap: () => native.getBootstrap(),
      getRecoveryState: () => native.getRecoveryState(),
      acceptDisclosure: (version) => native.acceptDisclosure(version),
      deleteAllData: () => native.deleteAllData(),
      getVehicles: () => {
        if (typeof native.getVehicles !== 'function') {
          return Promise.reject(new Error('Rebuild the iOS development client to load Garage vehicles.'));
        }
        return native.getVehicles();
      },
      getArchivedVehicles: () => {
        if (typeof native.getArchivedVehicles !== 'function') {
          return Promise.reject(new Error('Rebuild the iOS development client to load archived vehicles.'));
        }
        return native.getArchivedVehicles();
      },
      createVehicle: (input) =>
        native.createVehicle(
          input.nickname,
          input.year,
          input.make,
          input.model,
          input.initialOdometerMilliMiles,
        ),
      updateVehicle: (input) => native.updateVehicle(input.id, input.nickname, input.year, input.make, input.model),
      archiveVehicle: (vehicleId) => native.archiveVehicle(vehicleId),
      restoreVehicle: (vehicleId) => native.restoreVehicle(vehicleId),
    },
    tracking: {
      getSnapshot: () => native.getTrackingSnapshot(),
      start: (vehicleId, source) => native.startTracking(vehicleId, source),
      stop: () => native.stopTracking(),
    },
  };
}
