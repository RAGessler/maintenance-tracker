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
    getArchivedVehicles: async () => [],
    updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    archiveVehicle: async () => {},
    restoreVehicle: async () => {},
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
  assert.deepEqual(Object.keys(store.product).sort(), ['acceptDisclosure', 'appendManualOdometerReading', 'archiveVehicle', 'completeMaintenanceSchedule', 'createMaintenanceRecord', 'createMaintenanceSchedule', 'createVehicle', 'deleteAllData', 'deleteMaintenanceRecord', 'deleteMaintenanceSchedule', 'getArchivedVehicles', 'getBootstrap', 'getMaintenanceRecords', 'getMaintenanceSchedules', 'getManualOdometerReadings', 'getRecoveryState', 'getVehicles', 'removeHeroPhoto', 'replaceHeroPhoto', 'restoreVehicle', 'updateMaintenanceRecord', 'updateMaintenanceSchedule', 'updateVehicle']);
});

test('product-store exposes first-run state and garage vehicles without exposing persistence details', async () => {
  const native: NativeMaintenanceStore = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    getRecoveryState: async () => ({ state: 'ready' }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [{ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic', currentOdometerMilliMiles: '42125000', scheduleCount: 0, trackingReadiness: 'manual_only' }],
    getArchivedVehicles: async () => [],
    updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    archiveVehicle: async () => {},
    restoreVehicle: async () => {},
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
    { id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic', currentOdometerMilliMiles: '42125000', scheduleCount: 0, trackingReadiness: 'manual_only' },
  ]);
  assert.deepEqual(Object.keys(store.product).sort(), ['acceptDisclosure', 'appendManualOdometerReading', 'archiveVehicle', 'completeMaintenanceSchedule', 'createMaintenanceRecord', 'createMaintenanceSchedule', 'createVehicle', 'deleteAllData', 'deleteMaintenanceRecord', 'deleteMaintenanceSchedule', 'getArchivedVehicles', 'getBootstrap', 'getMaintenanceRecords', 'getMaintenanceSchedules', 'getManualOdometerReadings', 'getRecoveryState', 'getVehicles', 'removeHeroPhoto', 'replaceHeroPhoto', 'restoreVehicle', 'updateMaintenanceRecord', 'updateMaintenanceSchedule', 'updateVehicle']);
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
    getArchivedVehicles: async () => [],
    updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    archiveVehicle: async () => {},
    restoreVehicle: async () => {},
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
  assert.deepEqual(Object.keys(store.tracking).sort(), ['getRevisions', 'getSnapshot', 'getTrips', 'review', 'start', 'stop']);
});

test('trip-tracking exposes reviewed manual trips without persistence internals', async () => {
  const calls: unknown[][] = [];
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 2 }),
    getRecoveryState: async () => ({ state: 'ready' as const }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 2 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 2 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [], getArchivedVehicles: async () => [],
    updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    archiveVehicle: async () => {}, restoreVehicle: async () => {},
    getTrackingSnapshot: async () => ({ state: 'idle' as const }),
    startTracking: async () => ({ state: 'tracking' as const }), stopTracking: async () => ({ state: 'idle' as const }),
    getTrips: async (...args: unknown[]) => { calls.push(['list', ...args]); return []; },
    reviewTrip: async (...args: unknown[]) => { calls.push(['review', ...args]); return { id: '9', vehicleId: '7', disposition: 'confirmed', effectiveMilliMiles: '1234' }; },
  } as unknown as NativeMaintenanceStore;

  const tracking = createMaintenanceStore(native).tracking;
  await tracking.getTrips('7');
  await tracking.review({ tripId: '9', action: 'confirm' });

  assert.deepEqual(calls, [
    ['list', '7'], ['review', '9', 'confirm', undefined, undefined],
  ]);
});

test('trip-tracking exposes an ordered audit trail without storage internals', async () => {
  const calls: unknown[][] = [];
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 2 }),
    getRecoveryState: async () => ({ state: 'ready' as const }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 2 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 2 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [], getArchivedVehicles: async () => [],
    updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    archiveVehicle: async () => {}, restoreVehicle: async () => {},
    getTrackingSnapshot: async () => ({ state: 'idle' as const }), startTracking: async () => ({ state: 'tracking' as const }), stopTracking: async () => ({ state: 'idle' as const }),
    getTripRevisions: async (...args: unknown[]) => { calls.push(args); return [{ revisionNumber: 1, occurredAt: '4', actor: 'system', action: 'finalized', vehicleId: '7', disposition: 'review_required' }]; },
  } as unknown as NativeMaintenanceStore;

  const revisions = await createMaintenanceStore(native).tracking.getRevisions('9');

  assert.deepEqual(calls, [['9']]);
  assert.deepEqual(revisions, [{ revisionNumber: 1, occurredAt: '4', actor: 'system', action: 'finalized', vehicleId: '7', disposition: 'review_required' }]);
});

test('product-store exposes recovery and reset without exposing the failed store', async () => {
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [],
    getArchivedVehicles: async () => [],
    updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    archiveVehicle: async () => {},
    restoreVehicle: async () => {},
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

test('product-store forwards hero-photo replacement and removal without exposing file storage', async () => {
  const calls: unknown[][] = [];
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    getRecoveryState: async () => ({ state: 'ready' as const }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [],
    getArchivedVehicles: async () => [],
    updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    archiveVehicle: async () => {},
    restoreVehicle: async () => {},
    replaceHeroPhoto: async (...args: unknown[]) => { calls.push(args); },
    removeHeroPhoto: async (...args: unknown[]) => { calls.push(args); },
    getTrackingSnapshot: async () => ({ state: 'idle' as const }),
    startTracking: async () => ({ state: 'tracking' as const }),
    stopTracking: async () => ({ state: 'idle' as const }),
  } as unknown as NativeMaintenanceStore;

  const product = createMaintenanceStore(native).product;
  await product.replaceHeroPhoto({ vehicleId: '7', sourceUri: 'file:///temporary/photo.jpg' });
  await product.removeHeroPhoto('7');

  assert.deepEqual(calls, [['7', 'file:///temporary/photo.jpg'], ['7']]);
});

test('product-store forwards maintenance CRUD with civil dates and integer mileage', async () => {
  const calls: unknown[][] = [];
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    getRecoveryState: async () => ({ state: 'ready' as const }),
    acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }),
    deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    getVehicles: async () => [], getArchivedVehicles: async () => [],
    updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }),
    archiveVehicle: async () => {}, restoreVehicle: async () => {},
    replaceHeroPhoto: async () => {}, removeHeroPhoto: async () => {},
    getMaintenanceRecords: async (...args: unknown[]) => { calls.push(['list', ...args]); return []; },
    createMaintenanceRecord: async (...args: unknown[]) => { calls.push(['create', ...args]); return { id: '9', vehicleId: '7', serviceName: 'Oil', completedOn: '2026-07-25', milliMiles: '42125500' }; },
    updateMaintenanceRecord: async (...args: unknown[]) => { calls.push(['update', ...args]); return { id: '9', vehicleId: '7', serviceName: 'Oil', completedOn: '2026-07-25', milliMiles: '42125500' }; },
    deleteMaintenanceRecord: async (...args: unknown[]) => { calls.push(['delete', ...args]); },
    getTrackingSnapshot: async () => ({ state: 'idle' as const }), startTracking: async () => ({ state: 'tracking' as const }), stopTracking: async () => ({ state: 'idle' as const }),
  };
  const product = createMaintenanceStore(native).product;
  await product.getMaintenanceRecords('7');
  await product.createMaintenanceRecord({ vehicleId: '7', serviceName: 'Oil', completedOn: '2026-07-25', milliMiles: '42125500', note: 'Synthetic' });
  await product.updateMaintenanceRecord({ id: '9', vehicleId: '7', serviceName: 'Oil', completedOn: '2026-07-25', milliMiles: '42125500' });
  await product.deleteMaintenanceRecord('9');
  assert.deepEqual(calls, [
    ['list', '7'], ['create', '7', 'Oil', '2026-07-25', '42125500', 'Synthetic'],
    ['update', '9', '7', 'Oil', '2026-07-25', '42125500', undefined], ['delete', '9'],
  ]);
});

test('product-store appends and lists auditable manual odometer readings', async () => {
  const calls: unknown[][] = [];
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 2 }), getRecoveryState: async () => ({ state: 'ready' as const }), acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 2 }), deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 2 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }), getVehicles: async () => [], getArchivedVehicles: async () => [], updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }), archiveVehicle: async () => {}, restoreVehicle: async () => {},
    getManualOdometerReadings: async (...args: unknown[]) => { calls.push(['list', ...args]); return [{ id: '4', vehicleId: '7', milliMiles: '42125001', effectiveAt: '1753459200000' }]; },
    appendManualOdometerReading: async (...args: unknown[]) => { calls.push(['append', ...args]); return { id: '4', vehicleId: '7', milliMiles: '42125001', effectiveAt: '1753459200000' }; },
    getTrackingSnapshot: async () => ({ state: 'idle' as const }), startTracking: async () => ({ state: 'tracking' as const }), stopTracking: async () => ({ state: 'idle' as const }),
  } as NativeMaintenanceStore;
  const product = createMaintenanceStore(native).product;

  await product.getManualOdometerReadings('7');
  await product.appendManualOdometerReading({ vehicleId: '7', milliMiles: '42125001', effectiveAt: '1753459200000' });

  assert.deepEqual(calls, [
    ['list', '7'], ['append', '7', '42125001', '1753459200000'],
  ]);
});

test('product-store derives garage mileage from auditable odometer facts', async () => {
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 2 }), getRecoveryState: async () => ({ state: 'ready' as const }), acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 2 }), deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 2 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }), getArchivedVehicles: async () => [], updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }), archiveVehicle: async () => {}, restoreVehicle: async () => {},
    getVehicles: async () => [{ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic', currentOdometerMilliMiles: '0', scheduleCount: 0, trackingReadiness: 'manual_only' as const }],
    getOdometerFacts: async () => ({ readings: [{ id: '2', vehicleId: '7', milliMiles: '42125001', effectiveAt: '100' }], trips: [{ endedAt: '101', effectiveMilliMiles: '999' }] }),
    getTrackingSnapshot: async () => ({ state: 'idle' as const }), startTracking: async () => ({ state: 'tracking' as const }), stopTracking: async () => ({ state: 'idle' as const }),
  } as NativeMaintenanceStore;

  assert.equal((await createMaintenanceStore(native).product.getVehicles())[0].currentOdometerMilliMiles, '42126000');
});

test('product-store completes a schedule through the typed record boundary', async () => {
  const calls: unknown[][] = [];
  const native = {
    getBootstrap: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }), getRecoveryState: async () => ({ state: 'ready' as const }), acceptDisclosure: async () => ({ disclosureAccepted: true, disclosureVersion: 1, schemaVersion: 1 }), deleteAllData: async () => ({ disclosureAccepted: false, disclosureVersion: 0, schemaVersion: 1 }),
    createVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }), getVehicles: async () => [], getArchivedVehicles: async () => [], updateVehicle: async () => ({ id: '7', nickname: 'Daily', year: 2020, make: 'Honda', model: 'Civic' }), archiveVehicle: async () => {}, restoreVehicle: async () => {},
    completeMaintenanceSchedule: async (...args: unknown[]) => { calls.push(args); return { id: '9', vehicleId: '7', scheduleId: '3', serviceName: 'Oil', completedOn: '2026-07-25', milliMiles: '42125500' }; },
    getTrackingSnapshot: async () => ({ state: 'idle' as const }), startTracking: async () => ({ state: 'tracking' as const }), stopTracking: async () => ({ state: 'idle' as const }),
  } as NativeMaintenanceStore;

  const record = await createMaintenanceStore(native).product.completeMaintenanceSchedule({ scheduleId: '3', completedOn: '2026-07-25', milliMiles: '42125500' });
  assert.equal(record.scheduleId, '3');
  assert.deepEqual(calls, [['3', '2026-07-25', '42125500', undefined]]);
});
