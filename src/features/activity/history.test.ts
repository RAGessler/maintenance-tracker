import assert from 'node:assert/strict';
import test from 'node:test';

import { buildActivityHistory } from './history';

test('orders mixed activity facts deterministically at equal timestamps', () => {
  const history = buildActivityHistory({
    trips: [{ id: 'trip-2', vehicleId: '2', startedAt: '0', endedAt: '100', disposition: 'review_required' }, { id: 'trip-1', vehicleId: '1', startedAt: '0', endedAt: '100', disposition: 'confirmed', effectiveMilliMiles: '2500' }],
    records: [{ id: 'record-1', vehicleId: '1', serviceName: 'Oil change', completedOn: '1970-01-01', milliMiles: '1000' }],
    readings: [{ id: 'reading-1', vehicleId: '2', effectiveAt: '100', milliMiles: '2000' }],
  });

  assert.deepEqual(history.map((fact) => `${fact.kind}:${fact.id}`), ['trip:trip-2', 'trip:trip-1', 'reading:reading-1', 'record:record-1']);
});

test('filters a vehicle without changing fact order', () => {
  const history = buildActivityHistory({
    trips: [{ id: 'trip-1', vehicleId: '1', startedAt: '0', endedAt: '200', disposition: 'confirmed', effectiveMilliMiles: '2500' }],
    records: [{ id: 'record-1', vehicleId: '2', serviceName: 'Oil change', completedOn: '1970-01-01', milliMiles: '1000' }],
    readings: [{ id: 'reading-1', vehicleId: '1', effectiveAt: '100', milliMiles: '2000' }],
  }, '1');

  assert.deepEqual(history.map((fact) => `${fact.kind}:${fact.id}`), ['trip:trip-1', 'reading:reading-1']);
});
