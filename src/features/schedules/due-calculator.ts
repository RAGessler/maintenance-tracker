export type ScheduleRule = Readonly<{
  id: string;
  serviceName: string;
  mileageIntervalMilliMiles?: string;
  dayInterval?: number;
  baselineDate: string;
  baselineMilliMiles: string;
}>;

type DueState = 'current' | 'due_soon' | 'due';
type Condition = 'mileage' | 'time' | 'both';

export type DueCalculation = Readonly<{
  state: DueState;
  controllingCondition: Condition;
  mileage?: Readonly<{ dueAtMilliMiles: string; remainingMilliMiles: string; state: DueState }>;
  time?: Readonly<{ dueOn: string; remainingDays: number; state: DueState }>;
}>;

export function calculateDue(rule: ScheduleRule, currentOdometerMilliMiles: string, today: string): DueCalculation {
  const mileage = rule.mileageIntervalMilliMiles === undefined ? undefined : calculateMileage(
    BigInt(rule.baselineMilliMiles), BigInt(rule.mileageIntervalMilliMiles), BigInt(currentOdometerMilliMiles),
  );
  const time = rule.dayInterval === undefined ? undefined : calculateTime(rule.baselineDate, rule.dayInterval, today);
  if (!mileage && !time) throw new Error('A schedule needs a mileage or time interval.');

  const state = [mileage?.state, time?.state].includes('due') ? 'due' : [mileage?.state, time?.state].includes('due_soon') ? 'due_soon' : 'current';
  const controllingCondition: Condition = mileage && time ? determineControllingCondition(rule, currentOdometerMilliMiles, today) : mileage ? 'mileage' : 'time';
  return { state, controllingCondition, mileage, time };
}

function determineControllingCondition(rule: ScheduleRule, currentOdometerMilliMiles: string, today: string): Condition {
  const mileageInterval = BigInt(rule.mileageIntervalMilliMiles!);
  const mileageElapsed = BigInt(currentOdometerMilliMiles) - BigInt(rule.baselineMilliMiles);
  const timeElapsed = BigInt(daysBetween(rule.baselineDate, today));
  const timeInterval = BigInt(rule.dayInterval!);
  const comparison = mileageElapsed * timeInterval - timeElapsed * mileageInterval;
  return comparison === 0n ? 'both' : comparison > 0n ? 'mileage' : 'time';
}

function calculateMileage(baseline: bigint, interval: bigint, current: bigint) {
  const dueAt = baseline + interval;
  const remaining = dueAt - current;
  return {
    dueAtMilliMiles: dueAt.toString(),
    remainingMilliMiles: remaining.toString(),
    state: remaining <= 0n ? 'due' as const : remaining <= interval / 10n ? 'due_soon' as const : 'current' as const,
  };
}

function calculateTime(baselineDate: string, interval: number, today: string) {
  const dueOn = addDays(baselineDate, interval);
  const remainingDays = -daysBetween(dueOn, today);
  return {
    dueOn,
    remainingDays,
    state: remainingDays <= 0 ? 'due' as const : remainingDays <= 30 ? 'due_soon' as const : 'current' as const,
  };
}

function daysBetween(from: string, to: string) { return Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 86_400_000); }

function addDays(date: string, days: number) {
  const value = utcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function utcDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
