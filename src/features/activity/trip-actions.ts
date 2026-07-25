import type { Trip } from '../../../modules/maintenance-store';

export function availableTripActions(disposition: Trip['disposition']): ('confirm' | 'correct' | 'reassign' | 'reject')[] {
  if (disposition === 'review_required') return ['confirm', 'correct', 'reassign', 'reject'];
  if (disposition === 'confirmed') return ['correct', 'reassign', 'reject'];
  return [];
}
