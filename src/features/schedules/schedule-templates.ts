export type ScheduleTemplate = Readonly<{
  key: string;
  version: number;
  serviceName: string;
  mileageIntervalMilliMiles?: string;
  dayInterval?: number;
}>;

export const scheduleTemplates: readonly ScheduleTemplate[] = [
  { key: 'engine-oil', version: 1, serviceName: 'Engine oil and filter', mileageIntervalMilliMiles: '5000000', dayInterval: 365 },
  { key: 'tire-rotation', version: 1, serviceName: 'Tire rotation', mileageIntervalMilliMiles: '6000000' },
  { key: 'annual-inspection', version: 1, serviceName: 'Annual inspection', dayInterval: 365 },
];
