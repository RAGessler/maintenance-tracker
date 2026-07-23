require 'json'

Pod::Spec.new do |s|
  s.name           = 'IosTripTrigger'
  s.version        = '1.0.0'
  s.summary        = 'Native iOS trip trigger feasibility module'
  s.description    = 'App Intents, audio route diagnostics, location tracking, and SQLite evidence for the iOS spike.'
  s.license        = { :type => 'MIT' }
  s.author         = 'RAGessler'
  s.homepage       = 'https://github.com/RAGessler/maintenance-tracker'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreLocation', 'AVFAudio', 'AppIntents'
  s.libraries = 'sqlite3'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
