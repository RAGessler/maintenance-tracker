import { requireNativeModule } from 'expo-modules-core';

import type { IosTripTriggerModule } from './src/IosTripTrigger.types';

export default requireNativeModule<IosTripTriggerModule>('IosTripTrigger');
