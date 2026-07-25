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

export type ReplaceHeroPhotoInput = Readonly<{
  vehicleId: string;
  sourceUri: string;
}>;

export type MaintenanceRecord = Readonly<{
  id: string;
  vehicleId: string;
  scheduleId?: string;
  serviceName: string;
  completedOn: string;
  milliMiles: string;
  note?: string;
}>;

export type ManualOdometerReading = Readonly<{
  id: string;
  vehicleId: string;
  milliMiles: string;
  effectiveAt: string;
}>;

export type AppendManualOdometerReadingInput = Readonly<{
  vehicleId: string;
  milliMiles: string;
  effectiveAt: string;
}>;

export type OdometerFacts = Readonly<{
  readings: ManualOdometerReading[];
  trips: ReadonlyArray<Readonly<{ endedAt: string; effectiveMilliMiles: string }>>;
}>;

export type MaintenanceSchedule = Readonly<{
  id: string;
  vehicleId: string;
  serviceName: string;
  sourceTemplateKey?: string;
  sourceTemplateVersion?: number;
  mileageIntervalMilliMiles?: string;
  dayInterval?: number;
  baselineDate: string;
  baselineMilliMiles: string;
  initialBaselineDate: string;
  initialBaselineMilliMiles: string;
}>;

export type CreateMaintenanceScheduleInput = Omit<MaintenanceSchedule, 'id' | 'initialBaselineDate' | 'initialBaselineMilliMiles'>;
export type UpdateMaintenanceScheduleInput = Pick<MaintenanceSchedule, 'id' | 'serviceName' | 'mileageIntervalMilliMiles' | 'dayInterval' | 'initialBaselineDate' | 'initialBaselineMilliMiles'>;

export type CreateMaintenanceRecordInput = Readonly<{
  vehicleId: string;
  serviceName: string;
  completedOn: string;
  milliMiles: string;
  note?: string;
}>;

export type CompleteMaintenanceScheduleInput = Readonly<{
  scheduleId: string;
  completedOn: string;
  milliMiles: string;
  note?: string;
}>;

export type UpdateMaintenanceRecordInput = CreateMaintenanceRecordInput & Readonly<{ id: string }>;

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
  heroPhotoUri?: string;
}>;

export type TrackingSnapshot = Readonly<{
  state: 'idle' | 'tracking' | 'recovering';
}>;

export type TrackingSetup = Readonly<{
  vehicleId: string;
  state: 'incomplete' | 'ready';
  locationReady: boolean;
  automationsReady: boolean;
  routeReady: boolean;
  checklistReady: boolean;
  testReady: boolean;
}>;

export type Trip = Readonly<{
  id: string;
  vehicleId?: string;
  startedAt: string;
  endedAt: string;
  capturedMilliMiles?: string;
  effectiveMilliMiles?: string;
  disposition: 'review_required' | 'confirmed' | 'rejected' | 'failed';
  failureReason?: string;
}>;

export type ReviewTripInput = Readonly<{
  tripId: string;
  action: 'confirm' | 'correct' | 'reassign' | 'reject';
  effectiveMilliMiles?: string;
  vehicleId?: string;
}>;

export type TripRevision = Readonly<{
  revisionNumber: number;
  occurredAt: string;
  actor: 'system' | 'user';
  action: 'finalized' | 'confirmed' | 'corrected' | 'reassigned' | 'rejected';
  vehicleId?: string;
  effectiveMilliMiles?: string;
  disposition: Trip['disposition'];
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
  getTrackingSetup?(vehicleId: string): Promise<TrackingSetup>;
  startTracking(vehicleId: string, source: 'manual' | 'automatic'): Promise<TrackingSnapshot>;
  stopTracking(): Promise<TrackingSnapshot>;
  getTrips?(vehicleId: string): Promise<Trip[]>;
  getTripRevisions?(tripId: string): Promise<TripRevision[]>;
  reviewTrip?(tripId: string, action: ReviewTripInput['action'], effectiveMilliMiles?: string, vehicleId?: string): Promise<Trip>;
  getArchivedVehicles(): Promise<GarageVehicle[]>;
  updateVehicle(id: string, nickname: string, year: number, make: string, model: string): Promise<Vehicle>;
  archiveVehicle(vehicleId: string): Promise<void>;
  restoreVehicle(vehicleId: string): Promise<void>;
  replaceHeroPhoto?(vehicleId: string, sourceUri: string): Promise<void>;
  removeHeroPhoto?(vehicleId: string): Promise<void>;
  getManualOdometerReadings?(vehicleId: string): Promise<ManualOdometerReading[]>;
  appendManualOdometerReading?(vehicleId: string, milliMiles: string, effectiveAt: string): Promise<ManualOdometerReading>;
  getOdometerFacts?(vehicleId: string): Promise<OdometerFacts>;
  getMaintenanceRecords?(vehicleId: string): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord?(vehicleId: string, serviceName: string, completedOn: string, milliMiles: string, note?: string): Promise<MaintenanceRecord>;
  updateMaintenanceRecord?(id: string, vehicleId: string, serviceName: string, completedOn: string, milliMiles: string, note?: string): Promise<MaintenanceRecord>;
  deleteMaintenanceRecord?(id: string): Promise<void>;
  getMaintenanceSchedules?(vehicleId: string): Promise<MaintenanceSchedule[]>;
  createMaintenanceSchedule?(vehicleId: string, serviceName: string, sourceTemplateKey: string | undefined, sourceTemplateVersion: number | undefined, mileageIntervalMilliMiles: string | undefined, dayInterval: number | undefined, baselineDate: string, baselineMilliMiles: string): Promise<MaintenanceSchedule>;
  updateMaintenanceSchedule?(id: string, serviceName: string, mileageIntervalMilliMiles: string | undefined, dayInterval: number | undefined, baselineDate: string, baselineMilliMiles: string): Promise<MaintenanceSchedule>;
  deleteMaintenanceSchedule?(id: string): Promise<void>;
  completeMaintenanceSchedule?(scheduleId: string, completedOn: string, milliMiles: string, note?: string): Promise<MaintenanceRecord>;
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
    replaceHeroPhoto(input: ReplaceHeroPhotoInput): Promise<void>;
    removeHeroPhoto(vehicleId: string): Promise<void>;
    getManualOdometerReadings(vehicleId: string): Promise<ManualOdometerReading[]>;
    appendManualOdometerReading(input: AppendManualOdometerReadingInput): Promise<ManualOdometerReading>;
    getMaintenanceRecords(vehicleId: string): Promise<MaintenanceRecord[]>;
    createMaintenanceRecord(input: CreateMaintenanceRecordInput): Promise<MaintenanceRecord>;
    completeMaintenanceSchedule(input: CompleteMaintenanceScheduleInput): Promise<MaintenanceRecord>;
    updateMaintenanceRecord(input: UpdateMaintenanceRecordInput): Promise<MaintenanceRecord>;
    deleteMaintenanceRecord(recordId: string): Promise<void>;
    getMaintenanceSchedules(vehicleId: string): Promise<MaintenanceSchedule[]>;
    createMaintenanceSchedule(input: CreateMaintenanceScheduleInput): Promise<MaintenanceSchedule>;
    updateMaintenanceSchedule(input: UpdateMaintenanceScheduleInput): Promise<MaintenanceSchedule>;
    deleteMaintenanceSchedule(scheduleId: string): Promise<void>;
  }>;
  tracking: Readonly<{
    getSnapshot(): Promise<TrackingSnapshot>;
    getSetup(vehicleId: string): Promise<TrackingSetup>;
    start(vehicleId: string, source: 'manual' | 'automatic'): Promise<TrackingSnapshot>;
    stop(): Promise<TrackingSnapshot>;
    getTrips(vehicleId: string): Promise<Trip[]>;
    getRevisions(tripId: string): Promise<TripRevision[]>;
    review(input: ReviewTripInput): Promise<Trip>;
  }>;
}>;

export function createMaintenanceStore(native: NativeMaintenanceStore): MaintenanceStore {
  const estimateVehicles = async (vehicles: GarageVehicle[]) => Promise.all(vehicles.map(async (vehicle) => {
    if (typeof native.getOdometerFacts !== 'function') return vehicle;
    const facts = await native.getOdometerFacts(vehicle.id);
    return { ...vehicle, currentOdometerMilliMiles: calculateEstimatedOdometer(facts) };
  }));
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
        return native.getVehicles().then(estimateVehicles);
      },
      getArchivedVehicles: () => {
        if (typeof native.getArchivedVehicles !== 'function') {
          return Promise.reject(new Error('Rebuild the iOS development client to load archived vehicles.'));
        }
        return native.getArchivedVehicles().then(estimateVehicles);
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
      replaceHeroPhoto: (input) => {
        if (typeof native.replaceHeroPhoto !== 'function') {
          return Promise.reject(new Error('Rebuild the iOS development client to manage hero photos.'));
        }
        return native.replaceHeroPhoto(input.vehicleId, input.sourceUri);
      },
      removeHeroPhoto: (vehicleId) => {
        if (typeof native.removeHeroPhoto !== 'function') {
          return Promise.reject(new Error('Rebuild the iOS development client to manage hero photos.'));
        }
        return native.removeHeroPhoto(vehicleId);
      },
      getManualOdometerReadings: (vehicleId) => {
        if (typeof native.getManualOdometerReadings !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to load odometer history.'));
        return native.getManualOdometerReadings(vehicleId);
      },
      appendManualOdometerReading: (input) => {
        if (typeof native.appendManualOdometerReading !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage odometer readings.'));
        return native.appendManualOdometerReading(input.vehicleId, input.milliMiles, input.effectiveAt);
      },
      getMaintenanceRecords: (vehicleId) => {
        if (typeof native.getMaintenanceRecords !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to load maintenance history.'));
        return native.getMaintenanceRecords(vehicleId);
      },
      createMaintenanceRecord: (input) => {
        if (typeof native.createMaintenanceRecord !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage maintenance history.'));
        return native.createMaintenanceRecord(input.vehicleId, input.serviceName, input.completedOn, input.milliMiles, input.note);
      },
      completeMaintenanceSchedule: (input) => {
        if (typeof native.completeMaintenanceSchedule !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to complete maintenance schedules.'));
        return native.completeMaintenanceSchedule(input.scheduleId, input.completedOn, input.milliMiles, input.note);
      },
      updateMaintenanceRecord: (input) => {
        if (typeof native.updateMaintenanceRecord !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage maintenance history.'));
        return native.updateMaintenanceRecord(input.id, input.vehicleId, input.serviceName, input.completedOn, input.milliMiles, input.note);
      },
      deleteMaintenanceRecord: (recordId) => {
        if (typeof native.deleteMaintenanceRecord !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage maintenance history.'));
        return native.deleteMaintenanceRecord(recordId);
      },
      getMaintenanceSchedules: (vehicleId) => {
        if (typeof native.getMaintenanceSchedules !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage maintenance schedules.'));
        return native.getMaintenanceSchedules(vehicleId);
      },
      createMaintenanceSchedule: (input) => {
        if (typeof native.createMaintenanceSchedule !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage maintenance schedules.'));
        return native.createMaintenanceSchedule(input.vehicleId, input.serviceName, input.sourceTemplateKey, input.sourceTemplateVersion, input.mileageIntervalMilliMiles, input.dayInterval, input.baselineDate, input.baselineMilliMiles);
      },
      updateMaintenanceSchedule: (input) => {
        if (typeof native.updateMaintenanceSchedule !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage maintenance schedules.'));
        return native.updateMaintenanceSchedule(input.id, input.serviceName, input.mileageIntervalMilliMiles, input.dayInterval, input.initialBaselineDate, input.initialBaselineMilliMiles);
      },
      deleteMaintenanceSchedule: (scheduleId) => {
        if (typeof native.deleteMaintenanceSchedule !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage maintenance schedules.'));
        return native.deleteMaintenanceSchedule(scheduleId);
      },
    },
    tracking: {
      getSnapshot: () => native.getTrackingSnapshot(),
      getSetup: (vehicleId) => {
        if (typeof native.getTrackingSetup !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to manage automatic tracking setup.'));
        return native.getTrackingSetup(vehicleId);
      },
      start: (vehicleId, source) => native.startTracking(vehicleId, source),
      stop: () => native.stopTracking(),
      getTrips: (vehicleId) => {
        if (typeof native.getTrips !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to review trips.'));
        return native.getTrips(vehicleId);
      },
      getRevisions: (tripId) => {
        if (typeof native.getTripRevisions !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to inspect trip revisions.'));
        return native.getTripRevisions(tripId);
      },
      review: (input) => {
        if (typeof native.reviewTrip !== 'function') return Promise.reject(new Error('Rebuild the iOS development client to review trips.'));
        return native.reviewTrip(input.tripId, input.action, input.effectiveMilliMiles, input.vehicleId);
      },
    },
  };
}
import { calculateEstimatedOdometer } from '../../../src/features/odometer/reconciliation';
