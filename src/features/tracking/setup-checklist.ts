import type { TrackingSetup } from '../../../modules/maintenance-store/src/MaintenanceStore';

export function setupChecklist(setup: TrackingSetup) {
  return [
    { key: 'location', title: 'Precise Always Location', complete: setup.locationReady },
    { key: 'shortcuts', title: 'Vehicle-bound Shortcuts', complete: setup.shortcutsReady },
    { key: 'automations', title: 'Personal Automations', complete: setup.automationsReady },
    { key: 'test', title: 'In-app setup test', complete: setup.testReady },
    { key: 'route', title: 'Route binding', complete: setup.routeReady },
    { key: 'confirmation', title: 'I confirmed the checklist', complete: setup.checklistConfirmed },
  ] as const;
}

export function setupStatusTitle(setup: TrackingSetup) {
  if (setup.state === 'ready') return 'Automatic tracking ready';
  const remaining = setupChecklist(setup).filter((item) => !item.complete).length;
  return remaining > 0 ? `Not ready — ${remaining} item${remaining === 1 ? '' : 's'} left` : 'Not ready — refresh setup';
}

export const setupFailureCopy: Readonly<Record<string, string>> = {
  wrong_vehicle: 'The Shortcut proposed a different vehicle. Repair its saved vehicle choice and test again. No trip was created.',
  permission_required: 'Location permission changed. Restore Precise Always Location and run the test again.',
  route_mismatch: 'The observed route did not match this vehicle. Repair the connection or route binding and test again. No trip was created.',
  end_before_start: 'Run this vehicle’s Start Trip Shortcut, then its End Trip Shortcut. No trip was created.',
  test_expired: 'The test expired or the clock changed. Run it again. No trip was created.',
  trip_active: 'Stop the active trip before running a setup test.',
};
