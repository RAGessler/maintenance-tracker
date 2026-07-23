import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { tripTrigger } from '@/native/trip-trigger';

export async function exportEvidence() {
  const [status, events] = await Promise.all([
    tripTrigger.getStatus(),
    tripTrigger.getEvents(1_000),
  ]);
  const file = new File(Paths.cache, `car-stereo-evidence-${Date.now()}.json`);
  file.create({ overwrite: true });
  const { databaseUri: _databaseUri, currentRoute, ...safeStatus } = status;
  file.write(JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    status: {
      ...safeStatus,
      currentRoute: currentRoute.map(({ uid: _uid, ...route }) => route),
    },
    events,
    truncated: events.length === 1_000,
  }, null, 2));
  try {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Export car-stereo spike evidence',
      mimeType: 'application/json',
    });
  } finally {
    file.delete();
  }
}
