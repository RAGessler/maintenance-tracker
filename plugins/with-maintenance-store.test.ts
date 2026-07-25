import assert from 'node:assert/strict';
import test from 'node:test';

const { withMaintenanceStoreInfoPlist } = require('./with-maintenance-store');

test('configures the iOS location capability required by native tracking', () => {
  const infoPlist = withMaintenanceStoreInfoPlist({ UIBackgroundModes: ['audio'] });

  assert.deepEqual(infoPlist.UIBackgroundModes, ['audio', 'location']);
  assert.equal(
    infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription,
    'Maintenance Tracker uses your location during an active trip to estimate mileage.',
  );
});
