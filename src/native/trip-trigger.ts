import type {
  NativeStatus,
  TripSummary,
  TrackingEvent,
  TriggerSource,
} from '../../modules/ios-trip-trigger/src/IosTripTrigger.types';

export type { NativeStatus, TrackingEvent, TripSummary, TriggerSource };

const unsupportedStatus: NativeStatus = {
  state: 'idle',
  locationAuthorization: 'unsupported',
  currentRoute: [],
  configuredRouteName: null,
  currentVehicleName: null,
  selectedRouteName: null,
  selectedVehicleName: null,
  tripId: null,
  graceDeadline: null,
  databaseUri: '',
};

export const tripTrigger = {
  isSupported: false,
  async configureCurrentRoute() {
    return unsupportedStatus;
  },
  async deleteAllData() {
    return unsupportedStatus;
  },
  async endTrip(_source: TriggerSource) {
    return unsupportedStatus;
  },
  async getEvents(_limit: number) {
    return [] as TrackingEvent[];
  },
  async getStatus() {
    return unsupportedStatus;
  },
  async getTripSummaries(_limit: number) {
    return [] as TripSummary[];
  },
  async requestLocationPermissions() {
    return unsupportedStatus;
  },
  async startTrip(_source: TriggerSource) {
    return unsupportedStatus;
  },
};
