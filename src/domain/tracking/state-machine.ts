export type TrackingState =
  | 'idle'
  | 'start-candidate'
  | 'awaiting-movement'
  | 'active'
  | 'reconnect-grace-period'
  | 'completed'
  | 'failed';

export type TrackingAction =
  | { type: 'START_REQUESTED' }
  | { type: 'LOCATION_READY' }
  | { type: 'MOVEMENT_CONFIRMED' }
  | { type: 'ROUTE_LOST' }
  | { type: 'ROUTE_RECONNECTED' }
  | { type: 'GRACE_EXPIRED' }
  | { type: 'END_REQUESTED' }
  | { type: 'FAILED' }
  | { type: 'RESET' };

export function reduceTrackingState(state: TrackingState, action: TrackingAction): TrackingState {
  switch (action.type) {
    case 'START_REQUESTED':
      return state === 'idle' || state === 'completed' || state === 'failed'
        ? 'start-candidate'
        : state;
    case 'LOCATION_READY':
      return state === 'start-candidate' ? 'awaiting-movement' : state;
    case 'MOVEMENT_CONFIRMED':
      return state === 'awaiting-movement' ? 'active' : state;
    case 'ROUTE_LOST':
      return state === 'active' ? 'reconnect-grace-period' : state;
    case 'ROUTE_RECONNECTED':
      return state === 'reconnect-grace-period' ? 'active' : state;
    case 'GRACE_EXPIRED':
    case 'END_REQUESTED':
      return state === 'idle' ? state : 'completed';
    case 'FAILED':
      return 'failed';
    case 'RESET':
      return 'idle';
  }
}

export function movementIsConfirmed(
  speedMetersPerSecond: number,
  displacementMeters: number,
): boolean {
  return speedMetersPerSecond >= 3 || displacementMeters >= 100;
}
