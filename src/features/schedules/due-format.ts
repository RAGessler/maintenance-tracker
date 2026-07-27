import { type Tone } from '@/components/torque-ui';
import { formatMilliMiles } from '@/utils/local-values';
import { type DueCalculation, type ScheduleRule } from './due-calculator';

/**
 * Presentation vocabulary shared by the Due tab and the vehicle dashboard so a
 * schedule reads identically wherever it appears.
 */
type DueState = DueCalculation['state'];

/** Sort key placing the most urgent schedules first. */
export const dueStateRank: Record<DueState, number> = { due: 0, due_soon: 1, current: 2 };

/** Severity tone for dots, pills, and status text. */
export const dueTone: Record<DueState, Tone> = { due: 'danger', due_soon: 'warning', current: 'neutral' };

/** Human status such as { prefix: 'DUE', detail: '320 mi past' }. */
export function statusLine(due: DueCalculation): Readonly<{ prefix: string; detail: string }> {
  const prefix = due.state === 'due' ? 'DUE' : due.state === 'due_soon' ? 'DUE SOON' : 'CURRENT';
  const mileageDetail = due.mileage ? mileageDetailText(due.mileage) : undefined;
  const timeDetail = due.time ? timeDetailText(due.time) : undefined;
  if (due.state === 'current') {
    const at = due.controllingCondition === 'time' ? (due.time ? `due ${formatMonth(due.time.dueOn)}` : '') : due.mileage ? `due at ${formatMilliMiles(due.mileage.dueAtMilliMiles, true)} mi` : '';
    return { prefix, detail: at };
  }
  const detail = due.controllingCondition === 'time' ? timeDetail : due.controllingCondition === 'mileage' ? mileageDetail : mileageDetail ?? timeDetail;
  return { prefix, detail: detail ?? '' };
}

function mileageDetailText(mileage: NonNullable<DueCalculation['mileage']>) {
  const remaining = BigInt(mileage.remainingMilliMiles);
  if (remaining > 0n) return `${formatMilliMiles(remaining.toString(), true)} mi left`;
  if (remaining === 0n) return 'due now';
  return `${formatMilliMiles((-remaining).toString(), true)} mi past`;
}

function timeDetailText(time: NonNullable<DueCalculation['time']>) {
  const days = time.remainingDays;
  if (days > 0) return `${describeDays(days)} left`;
  if (days === 0) return 'due today';
  return `${describeDays(-days)} past`;
}

function describeDays(days: number) {
  if (days >= 60) return `${Math.round(days / 30)} months`;
  if (days >= 14) return `${Math.round(days / 7)} weeks`;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** Fraction of the maintenance interval that has elapsed, for the progress meter. */
export function intervalFraction(due: DueCalculation, schedule: Pick<ScheduleRule, 'mileageIntervalMilliMiles' | 'dayInterval'>): number {
  const fromMileage = due.mileage && schedule.mileageIntervalMilliMiles ? 1 - Number(BigInt(due.mileage.remainingMilliMiles)) / Number(BigInt(schedule.mileageIntervalMilliMiles)) : undefined;
  const fromTime = due.time && schedule.dayInterval ? 1 - due.time.remainingDays / schedule.dayInterval : undefined;
  const values = [fromMileage, fromTime].filter((value): value is number => value !== undefined);
  return values.length === 0 ? 0 : Math.max(...values);
}

function formatMonth(dueOn: string) {
  const [year, month] = dueOn.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
