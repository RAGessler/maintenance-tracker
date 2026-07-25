import assert from 'node:assert/strict';
import test from 'node:test';

import { createMaintenanceStore, type NativeMaintenanceStore } from './MaintenanceStore';

test('product-store creates a vehicle without exposing storage internals', async () => {
  const calls: unknown[][] = [];
  const native: NativeMaintenanceStore = {
    getBootstrap: async () => ({ disclosureAccepted: false, schemaVersion: 1 }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, schemaVersion: 1 }),
    createVehicle: async (...args) => {
      calls.push(args);
      return { id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' };
    },
    getTrackingSnapshot: async () => ({ state: 'idle' }),
    startTracking: async () => ({ state: 'tracking' }),
    stopTracking: async () => ({ state: 'idle' }),
  };

  const store = createMaintenanceStore(native);
  const vehicle = await store.product.createVehicle({
    nickname: 'Daily',
    year: 2020,
    make: 'Honda',
    model: 'Civic',
    initialOdometerMilliMiles: '42125000',
  });

  assert.deepEqual(vehicle, { id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' });
  assert.deepEqual(calls, [['Daily', 2020, 'Honda', 'Civic', '42125000']]);
  assert.deepEqual(Object.keys(store.product).sort(), ['acceptDisclosure', 'createVehicle', 'getBootstrap']);
});

test('trip-tracking forwards only typed foundation commands', async () => {
  const calls: unknown[][] = [];
  const native: NativeMaintenanceStore = {
    getBootstrap: async () => ({ disclosureAccepted: true, schemaVersion: 1 }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getTrackingSnapshot: async () => ({ state: 'recovering' }),
    startTracking: async (...args) => {
      calls.push(args);
      return { state: 'tracking' };
    },
    stopTracking: async () => {
      calls.push([]);
      return { state: 'idle' };
    },
  };

  const store = createMaintenanceStore(native);

  assert.deepEqual(await store.tracking.getSnapshot(), { state: 'recovering' });
  assert.deepEqual(await store.tracking.start('7', 'automatic'), { state: 'tracking' });
  assert.deepEqual(await store.tracking.stop(), { state: 'idle' });
  assert.deepEqual(calls, [['7', 'automatic'], []]);
  assert.deepEqual(Object.keys(store.tracking).sort(), ['getSnapshot', 'start', 'stop']);
});
