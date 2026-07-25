import assert from 'node:assert/strict';
import test from 'node:test';

import { availableTripActions } from './trip-actions';

test('does not offer confirmation again for a confirmed trip', () => {
  assert.deepEqual(availableTripActions('confirmed'), ['correct', 'reassign', 'reject']);
});

test('limits rejected and failed trips to audit inspection', () => {
  assert.deepEqual(availableTripActions('rejected'), []);
  assert.deepEqual(availableTripActions('failed'), []);
});
