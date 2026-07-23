import IosTripTrigger from '../../modules/ios-trip-trigger';

export type {
  NativeStatus,
  TripSummary,
  TrackingEvent,
  TriggerSource,
} from '../../modules/ios-trip-trigger/src/IosTripTrigger.types';

export const tripTrigger = {
  isSupported: true,
  configureCurrentRoute: IosTripTrigger.configureCurrentRoute,
  deleteAllData: IosTripTrigger.deleteAllData,
  endTrip: IosTripTrigger.endTrip,
  getEvents: IosTripTrigger.getEvents,
  getStatus: IosTripTrigger.getStatus,
  getTripSummaries: IosTripTrigger.getTripSummaries,
  requestLocationPermissions: IosTripTrigger.requestLocationPermissions,
  startTrip: IosTripTrigger.startTrip,
};
