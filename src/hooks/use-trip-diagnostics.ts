import { useEffect, useState } from 'react';

import {
  tripTrigger,
  type NativeStatus,
  type TripSummary,
  type TrackingEvent,
  type TriggerSource,
} from '@/native/trip-trigger';

export function useTripDiagnostics() {
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [tripSummaries, setTripSummaries] = useState<TripSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const [nextStatus, nextEvents, nextTripSummaries] = await Promise.all([
        tripTrigger.getStatus(),
        tripTrigger.getEvents(100),
        tripTrigger.getTripSummaries(20),
      ]);
      setStatus(nextStatus);
      setEvents(nextEvents);
      setTripSummaries(nextTripSummaries);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialRefresh = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 2_000);
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, []);

  async function run(action: () => Promise<NativeStatus>) {
    setLoading(true);
    try {
      setStatus(await action());
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLoading(false);
    }
  }

  return {
    configureCurrentRoute: () => run(() => tripTrigger.configureCurrentRoute()),
    deleteAllData: () => run(() => tripTrigger.deleteAllData()),
    endTrip: (source: TriggerSource) => run(() => tripTrigger.endTrip(source)),
    error,
    events,
    isSupported: tripTrigger.isSupported,
    loading,
    refresh,
    requestPermissions: () => run(() => tripTrigger.requestLocationPermissions()),
    startTrip: (source: TriggerSource) => run(() => tripTrigger.startTrip(source)),
    status,
    tripSummaries,
  };
}
