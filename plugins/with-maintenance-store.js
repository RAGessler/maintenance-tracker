const { withInfoPlist } = require('@expo/config-plugins');

const locationUsage =
  'Maintenance Tracker uses your location during an active trip to estimate mileage.';

function withMaintenanceStoreInfoPlist(infoPlist) {
  const modes = Array.isArray(infoPlist.UIBackgroundModes) ? infoPlist.UIBackgroundModes : [];
  return {
    ...infoPlist,
    UIBackgroundModes: [...new Set([...modes, 'location'])],
    NSLocationWhenInUseUsageDescription: infoPlist.NSLocationWhenInUseUsageDescription ?? locationUsage,
    NSLocationAlwaysAndWhenInUseUsageDescription:
      infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription ?? locationUsage,
  };
}

function withMaintenanceStore(config) {
  return withInfoPlist(config, (nextConfig) => {
    nextConfig.modResults = withMaintenanceStoreInfoPlist(nextConfig.modResults);
    return nextConfig;
  });
}

module.exports = withMaintenanceStore;
module.exports.withMaintenanceStoreInfoPlist = withMaintenanceStoreInfoPlist;
