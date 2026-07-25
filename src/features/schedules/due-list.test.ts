import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDueList } from './due-list';

test('groups schedules across vehicles by state and urgency', () => {
  const groups = buildDueList([
    { vehicleId: '1', vehicleName: 'Daily', schedule: { id: 'current', serviceName: 'Air filter', mileageIntervalMilliMiles: '10000000', baselineDate: '2026-01-01', baselineMilliMiles: '0' }, currentOdometerMilliMiles: '1000000' },
    { vehicleId: '2', vehicleName: 'Weekend', schedule: { id: 'soon', serviceName: 'Oil change', mileageIntervalMilliMiles: '5000000', baselineDate: '2026-01-01', baselineMilliMiles: '0' }, currentOdometerMilliMiles: '4600000' },
    { vehicleId: '1', vehicleName: 'Daily', schedule: { id: 'overdue', serviceName: 'Tires', dayInterval: 30, baselineDate: '2026-01-01', baselineMilliMiles: '0' }, currentOdometerMilliMiles: '0' },
  ], '2026-02-01');

  assert.deepEqual(groups.map((group) => [group.state, group.items.map((item) => item.schedule.id)]), [
    ['due', ['overdue']],
    ['due_soon', ['soon']],
    ['current', ['current']],
  ]);
});

test('orders equal-state schedules by the condition closest to due', () => {
  const groups = buildDueList([
    { vehicleId: '1', vehicleName: 'Daily', schedule: { id: 'later', serviceName: 'Oil', dayInterval: 365, baselineDate: '2026-01-01', baselineMilliMiles: '0' }, currentOdometerMilliMiles: '0' },
    { vehicleId: '2', vehicleName: 'Weekend', schedule: { id: 'first', serviceName: 'Brakes', dayInterval: 365, baselineDate: '2026-02-01', baselineMilliMiles: '0' }, currentOdometerMilliMiles: '0' },
  ], '2026-03-01');

  assert.deepEqual(groups[0]?.items.map((item) => item.schedule.id), ['later', 'first']);
});

test('orders mileage schedules without losing integer precision', () => {
  const groups = buildDueList([
    { vehicleId: '1', vehicleName: 'Daily', schedule: { id: 'later', serviceName: 'Oil', mileageIntervalMilliMiles: '10000000000000003', baselineDate: '2026-01-01', baselineMilliMiles: '0' }, currentOdometerMilliMiles: '10000000000000000' },
    { vehicleId: '2', vehicleName: 'Weekend', schedule: { id: 'first', serviceName: 'Brakes', mileageIntervalMilliMiles: '10000000000000002', baselineDate: '2026-01-01', baselineMilliMiles: '0' }, currentOdometerMilliMiles: '10000000000000000' },
  ], '2026-01-02');

  assert.deepEqual(groups[0]?.items.map((item) => item.schedule.id), ['first', 'later']);
});
