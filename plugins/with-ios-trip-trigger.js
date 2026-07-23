const fs = require('node:fs');
const path = require('node:path');

const { IOSConfig } = require('expo/config-plugins');

const intentSource = fs.readFileSync(path.join(__dirname, 'ios', 'TripAppIntents.swift'), 'utf8');

module.exports = function withIosTripTrigger(config) {
  return IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: 'TripAppIntents.swift',
    contents: intentSource,
    overwrite: true,
  });
};
