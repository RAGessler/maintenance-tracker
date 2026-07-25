import assert from 'node:assert/strict';
import test from 'node:test';

import { createMaintenanceStore, type NativeMaintenanceStore } from './MaintenanceStore';

test('product-store creates a vehicle without exposing storage internals', async () => {
  const calls: unknown[][] = [];
  const native: NativeMaintenanceStore = {
    getBootstrap: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    getRecoveryState: async () => ({ state: 'ready' }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    createVehicle: async (...args) => {
      calls.push(args);
      return { id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' };
    },
    getVehicles: async () => [],
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
  assert.deepEqual(Object.keys(store.product).sort(), ['acceptDisclosure', 'createVehicle', 'deleteAllData', 'getBootstrap', 'getRecoveryState', 'getVehicles']);
});

test('product-store exposes first-run state and garage vehicles without exposing persistence details', async () => {
  const native: NativeMaintenanceStore = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    getRecoveryState: async () => ({ state: 'ready' }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [{ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic', currentOdometerMilliMiles: '42125000' }],
    getTrackingSnapshot: async () => ({ state: 'idle' }),
    startTracking: async () => ({ state: 'tracking' }),
    stopTracking: async () => ({ state: 'idle' }),
  };

  const store = createMaintenanceStore(native);

  assert.deepEqual(await store.product.getBootstrap(), {
    disclosureAccepted: true,
    disclosureVersion: 1,
    schemaVersion: 1,
  });
  assert.deepEqual(await store.product.getVehicles(), [
    { id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic', currentOdometerMilliMiles: '42125000' },
  ]);
  assert.deepEqual(Object.keys(store.product).sort(), ['acceptDisclosure', 'createVehicle', 'deleteAllData', 'getBootstrap', 'getRecoveryState', 'getVehicles']);
});

test('product-store reports when an installed development client lacks the garage bridge', async () => {
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    getRecoveryState: async () => ({ state: 'ready' }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getTrackingSnapshot: async () => ({ state: 'idle' as const }),
    startTracking: async () => ({ state: 'tracking' as const }),
    stopTracking: async () => ({ state: 'idle' as const }),
  } as unknown as NativeMaintenanceStore;

  await assert.rejects(
    () => createMaintenanceStore(native).product.getVehicles(),
    /Rebuild the iOS development client/,
  );
});

test('trip-tracking forwards only typed foundation commands', async () => {
  const calls: unknown[][] = [];
  const native: NativeMaintenanceStore = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    getRecoveryState: async () => ({ state: 'ready' }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [],
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

test('product-store exposes recovery and reset without exposing the failed store', async () => {
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [],
    getTrackingSnapshot: async () => ({ state: 'idle' as const }),
    startTracking: async () => ({ state: 'tracking' as const }),
    stopTracking: async () => ({ state: 'idle' as const }),
    getRecoveryState: async () => ({ state: 'recovery_required' as const, reason: 'unsupported_schema' as const }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
  } as NativeMaintenanceStore;
  const product = createMaintenanceStore(native).product;

  assert.deepEqual(await product.getRecoveryState(), {
    state: 'recovery_required',
    reason: 'unsupported_schema',
  });
  assert.deepEqual(await product.deleteAllData(), {
    disclosureAccepted: false,
    disclosureVersion: 0,
    schemaVersion: 1,
  });
});
