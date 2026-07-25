import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateEstimatedOdometer } from './reconciliation';

test('uses the latest reading by effective instant and ID, then only confirmed trips ending afterward', () => {
  const estimated = calculateEstimatedOdometer({
    readings: [
      { id: '4', effectiveAt: '200', milliMiles: '41000000' },
      { id: '5', effectiveAt: '200', milliMiles: '42000000' },
      { id: '3', effectiveAt: '100', milliMiles: '40000000' },
    ],
    trips: [
      { endedAt: '199', effectiveMilliMiles: '999999' },
      { endedAt: '200', effectiveMilliMiles: '888888' },
      { endedAt: '201', effectiveMilliMiles: '1234' },
    ],
  });

  assert.equal(estimated, '42001234');
});

test('retains thousandth-mile precision without rounding', () => {
  assert.equal(calculateEstimatedOdometer({
    readings: [{ id: '1', effectiveAt: '1', milliMiles: '42125001' }],
    trips: [{ endedAt: '2', effectiveMilliMiles: '999' }],
  }), '42126000');
});
