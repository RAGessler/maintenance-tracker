import { registerWebModule, NativeModule } from 'expo';

// MaintenanceStoreModule is not available on the web platform.
class MaintenanceStoreModule extends NativeModule<{}> {}

export default registerWebModule(MaintenanceStoreModule, 'MaintenanceStoreModule');
