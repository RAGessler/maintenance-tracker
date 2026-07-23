# Maintenance Tracker

Expo development-build spike for iOS CarPlay and Bluetooth-stereo trip triggers.

## Baseline

- Expo SDK 57
- React Native 0.86
- TypeScript with strict checking
- Expo Router
- Continuous Native Generation
- `expo-dev-client` for custom native modules and configuration

The generated `ios/` and `android/` directories are intentionally ignored. Each spike should express
native configuration through Expo config plugins where practical and regenerate native projects when
the native dependency graph changes.

## Setup

Expo SDK 57 requires Node.js 22.13 or newer.

```bash
npm install
npm run typecheck
```

Start the Metro server for an installed development build:

```bash
npm start
```

Create or refresh a local development build:

```bash
npm run ios
npm run android
```

The first native run generates the platform project and compiles the development client. Rebuild
after adding a native dependency, changing a config plugin, or changing native app configuration.

For UI-only work that does not depend on custom native code, Expo Go remains available:

```bash
npm run start:go
```

Expo Go is not a valid test environment for the Bluetooth, App Intents, broadcast receiver,
background execution, or background location behavior covered by the active spikes.

## Spike workflow

Keep the repository root as the application under test. Do not nest additional Expo projects.

1. Branch from the clean baseline.
2. Implement one platform spike on that branch.
3. Record evidence, limitations, and disposition in its GitHub issue.
4. Merge reusable platform-neutral infrastructure only after the spike proves it is useful.

Active work:

- [iOS car-stereo trip triggers](https://github.com/RAGessler/maintenance-tracker/issues/2)
- [Android car-stereo Bluetooth trip triggers](https://github.com/RAGessler/maintenance-tracker/issues/3)

## iOS car-stereo spike

This branch exposes two App Shortcuts:

- **Start Trip**, with a CarPlay or Bluetooth stereo trigger parameter
- **End Trip**

The actions call a native Swift coordinator without opening the React Native UI. The coordinator
records App Intent, Core Location, state transition, and `AVAudioSession` route-change evidence in
`Library/LocalDatabase/car-stereo-spike.db`. The app's Diagnostics tab displays and exports the
latest events.

### Physical iPhone setup

1. Connect the iPhone and run `npm run ios -- --device`, or open
   `ios/MaintenanceTracker.xcworkspace` and select the signed app target in Xcode. Do not open the
   `.xcodeproj` directly because it omits CocoaPods dependency targets.
2. Open the app and tap **Enable location**. The spike requires Always Location before an intent can
   start candidate tracking.
3. Connect the stereo and tap **Set current car route** so Bluetooth starts cannot bind to another
   accessory such as AirPods.
4. In Shortcuts, create a CarPlay **Connects** personal automation that runs **Start Trip** with the
   CarPlay parameter.
5. Create a CarPlay **Disconnects** automation that runs **End Trip**.
6. Create Bluetooth **Connects** and **Disconnects** automations for the selected stereo. Run
   **Start Trip** with the Bluetooth stereo parameter on connect and **End Trip** on disconnect.
7. Configure each automation to run immediately without asking.

On the physical test iPhone, Shortcuts exposes selected-device Bluetooth connect and disconnect
triggers. The captured audio-route loss and three-minute reconnect grace remain a native fallback
when the disconnect automation is delayed or missed; route changes are not a system-wide Bluetooth
connection API.

### Native development

The generated `ios/` directory remains disposable. Rebuild after changing Swift, the config plugin,
or native configuration:

```bash
npx expo prebuild --platform ios --clean
npm run ios -- --device
```

Xcode 26.3 currently needs the tracked `patch-package` fix for an ambiguous `abs` call in
`expo-modules-jsi@57.0.4`. It is applied automatically by `npm install` and should be removed once an
Expo SDK 57 patch release includes the fix.

See `ARCHITECTURE.md` for a production implementation handoff, `TEST_PLAN.md` for the physical test
matrix, and `RESULTS.md` for proven and pending findings.

## Useful commands

```bash
npm start
npm run start:go
npm run ios
npm run android
npm run web
npm run typecheck
npm run lint
```

Use the exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) when adding
Expo APIs or native configuration.
