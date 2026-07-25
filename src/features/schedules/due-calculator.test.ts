import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateDue, type ScheduleRule } from './due-calculator';

const oilChange: ScheduleRule = {
  id: 'oil',
  serviceName: 'Oil change',
  mileageIntervalMilliMiles: '5000000',
  dayInterval: 365,
  baselineDate: '2024-02-29',
  baselineMilliMiles: '42000000',
};

test('calculates current, due soon, and overdue mileage states at exact boundaries', () => {
  const cases = [
    ['current', '46000000', '2024-03-01', 'current', '1000000'],
    ['due soon', '46500000', '2024-03-01', 'due_soon', '500000'],
    ['due', '47000000', '2024-03-01', 'due', '0'],
    ['overdue', '47500000', '2024-03-01', 'due', '-500000'],
  ] as const;

  for (const [name, odometer, today, state, remaining] of cases) {
    const due = calculateDue({ ...oilChange, dayInterval: undefined }, odometer, today);
    assert.equal(due.state, state, name);
    assert.equal(due.mileage?.remainingMilliMiles, remaining, name);
  }
});

test('calculates leap-date time thresholds and the final thirty days', () => {
  const rule = { ...oilChange, mileageIntervalMilliMiles: undefined };

  assert.deepEqual(calculateDue(rule, '42000000', '2025-01-29').time, {
    dueOn: '2025-02-28', remainingDays: 30, state: 'due_soon',
  });
  assert.deepEqual(calculateDue(rule, '42000000', '2025-03-01').time, {
    dueOn: '2025-02-28', remainingDays: -1, state: 'due',
  });
});

test('uses the first reached condition for a combined schedule explanation', () => {
  const due = calculateDue(oilChange, '47000000', '2024-03-01');

  assert.equal(due.state, 'due');
  assert.equal(due.controllingCondition, 'mileage');
  assert.equal(due.mileage?.dueAtMilliMiles, '47000000');
  assert.equal(due.time?.dueOn, '2025-02-28');
});

test('identifies the condition furthest through its interval for combined schedules', () => {
  assert.equal(calculateDue(oilChange, '42100000', '2025-03-01').controllingCondition, 'time');
  assert.equal(calculateDue({ ...oilChange, dayInterval: 3650 }, '46500000', '2024-03-01').controllingCondition, 'mileage');
  assert.equal(calculateDue({ ...oilChange, mileageIntervalMilliMiles: '5000000', dayInterval: 365 }, '47000000', '2025-02-28').controllingCondition, 'both');
});
