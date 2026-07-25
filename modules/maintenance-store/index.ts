// Re-export the native module. On web, it will be resolved to MaintenanceStoreModule.web.ts
// and on native platforms to MaintenanceStoreModule.ts
export { default } from './src/MaintenanceStoreModule';
export { maintenanceStore } from './src/MaintenanceStoreModule';
export * from './src/MaintenanceStore.types';
export type { Bootstrap, CreateMaintenanceRecordInput, CreateMaintenanceScheduleInput, CreateVehicleInput, GarageVehicle, MaintenanceRecord, MaintenanceSchedule, MaintenanceStore, RecoveryState, TrackingSnapshot, UpdateMaintenanceRecordInput, UpdateMaintenanceScheduleInput, UpdateVehicleInput, Vehicle } from './src/MaintenanceStore';
