import assert from 'node:assert/strict';
import test from 'node:test';
import type { TrackingSetup } from '../../../modules/maintenance-store/src/MaintenanceStore';
import { setupChecklist, setupStatusTitle } from './setup-checklist';

const permissionOnly: TrackingSetup = {
  vehicleId: '7', state: 'incomplete', locationReady: true, shortcutsReady: false,
  automationsReady: false, checklistConfirmed: false, routeReady: false, testReady: false, testState: 'idle',
};

test('location permission alone displays five outstanding requirements, not zero', () => {
  assert.equal(setupStatusTitle(permissionOnly), 'Not ready — 5 items left');
  assert.deepEqual(setupChecklist(permissionOnly).filter((row) => !row.complete).map((row) => row.title), [
    'Vehicle-bound Shortcuts', 'Personal Automations', 'In-app setup test', 'Route binding', 'I confirmed the checklist',
  ]);
});

test('revoked location remains a visible blocker after the other setup steps passed', () => {
  assert.equal(setupStatusTitle({ ...permissionOnly, shortcutsReady: true, automationsReady: true,
    checklistConfirmed: true, routeReady: true, testReady: true, locationReady: false }), 'Not ready — 1 item left');
});

test('an inconsistent snapshot requests refresh instead of claiming zero items remain', () => {
  assert.equal(setupStatusTitle({ ...permissionOnly, shortcutsReady: true, automationsReady: true,
    checklistConfirmed: true, routeReady: true, testReady: true }), 'Not ready — refresh setup');
});
