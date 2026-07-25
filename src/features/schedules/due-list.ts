import { calculateDue, type DueCalculation, type ScheduleRule } from './due-calculator';

export type DueListInput = Readonly<{
  vehicleId: string;
  vehicleName: string;
  schedule: ScheduleRule;
  currentOdometerMilliMiles: string;
}>;

export type DueListItem = DueListInput & Readonly<{ due: DueCalculation }>;
export type DueListGroup = Readonly<{ state: DueCalculation['state']; items: DueListItem[] }>;

const states: DueCalculation['state'][] = ['due', 'due_soon', 'current'];

export function buildDueList(inputs: DueListInput[], today: string): DueListGroup[] {
  const items = inputs.map((input) => ({ ...input, due: calculateDue(input.schedule, input.currentOdometerMilliMiles, today) }));
  return states.map((state) => ({
    state,
    items: items.filter((item) => item.due.state === state).sort(compareUrgency),
  })).filter((group) => group.items.length > 0);
}

function compareUrgency(left: DueListItem, right: DueListItem) {
  const leftUrgency = urgency(left);
  const rightUrgency = urgency(right);
  const difference = leftUrgency.remaining * rightUrgency.interval - rightUrgency.remaining * leftUrgency.interval;
  if (difference !== 0n) return difference < 0n ? -1 : 1;
  return left.vehicleName.localeCompare(right.vehicleName) || left.schedule.serviceName.localeCompare(right.schedule.serviceName);
}

function urgency(item: DueListItem) {
  const { due, schedule } = item;
  if (due.controllingCondition === 'time') return { remaining: BigInt(due.time!.remainingDays), interval: BigInt(schedule.dayInterval!) };
  if (due.controllingCondition === 'mileage') return { remaining: BigInt(due.mileage!.remainingMilliMiles), interval: BigInt(schedule.mileageIntervalMilliMiles!) };
  return { remaining: BigInt(due.time!.remainingDays), interval: BigInt(schedule.dayInterval!) };
}
