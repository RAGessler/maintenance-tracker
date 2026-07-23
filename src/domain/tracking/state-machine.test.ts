import { describe, expect, it } from 'vitest';

import { movementIsConfirmed, reduceTrackingState } from './state-machine';

describe('reduceTrackingState', () => {
  it('moves a candidate through movement confirmation', () => {
    let state = reduceTrackingState('idle', { type: 'START_REQUESTED' });
    state = reduceTrackingState(state, { type: 'LOCATION_READY' });
    state = reduceTrackingState(state, { type: 'MOVEMENT_CONFIRMED' });
    expect(state).toBe('active');
  });

  it('keeps the trip active after a route reconnects during grace', () => {
    let state = reduceTrackingState('active', { type: 'ROUTE_LOST' });
    state = reduceTrackingState(state, { type: 'ROUTE_RECONNECTED' });
    expect(state).toBe('active');
  });

  it('completes a trip when reconnect grace expires', () => {
    expect(reduceTrackingState('reconnect-grace-period', { type: 'GRACE_EXPIRED' })).toBe(
      'completed',
    );
  });

  it('ignores duplicate start requests while tracking', () => {
    expect(reduceTrackingState('active', { type: 'START_REQUESTED' })).toBe('active');
  });
});

describe('movementIsConfirmed', () => {
  it('accepts vehicle speed or sufficient displacement', () => {
    expect(movementIsConfirmed(3, 0)).toBe(true);
    expect(movementIsConfirmed(0, 100)).toBe(true);
    expect(movementIsConfirmed(1, 30)).toBe(false);
  });
});
