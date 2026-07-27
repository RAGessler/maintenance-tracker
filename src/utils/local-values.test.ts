import assert from 'node:assert/strict';
import test from 'node:test';

import { civilToday, formatMilliMiles, isCivilDate, isMileage, mileageToMilliMiles } from './local-values';

test('formats a local civil date without converting through UTC', () => {
  assert.equal(civilToday(new Date(2026, 0, 2, 23, 30)), '2026-01-02');
});

test('rejects impossible civil dates', () => {
  assert.equal(isCivilDate('2026-02-28'), true);
  assert.equal(isCivilDate('2026-02-30'), false);
  assert.equal(isCivilDate('2026-99-99'), false);
});

test('round trips mileage with up to three decimal places', () => {
  assert.equal(isMileage('12.345'), true);
  assert.equal(isMileage('12.3456'), false);
  assert.equal(mileageToMilliMiles('12.3'), '12300');
  assert.equal(formatMilliMiles('12300'), '12.3');
  assert.equal(formatMilliMiles('12345678', true), '12,345.678');
});
