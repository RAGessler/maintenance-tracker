# Maintenance Tracker

Expo SDK 57 development-build foundation for the private iOS Maintenance Tracker beta.

## Planning and project truth

GitHub is the project system of record:

- [MVP parent and feature hierarchy](https://github.com/RAGessler/maintenance-tracker/issues/69)
- [Maintenance Tracker — MVP Project](https://github.com/users/RAGessler/projects/8)
- [Current architecture and approved boundaries](docs/architecture.md)
- [Architecture decision records](docs/adr/)

Workflow status and priority belong in the GitHub Project. Feature scope, acceptance criteria,
dependencies, and spike findings belong in GitHub issues. Only durable architectural decisions and
current implementation documentation belong in this repository.

All coding agents must start with [AGENTS.md](AGENTS.md). Agent-specific scratch plans are not a
source of project truth.

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

### Physical iPhone builds

Connect the iPhone by USB, unlock it, trust the Mac when prompted, and enable Developer Mode in
Settings > Privacy & Security. Sign in to your Apple Account in Xcode > Settings > Accounts.
The owner's development team is configured with `expo.ios.appleTeamId` in `app.json`, so signing
configuration survives native-project regeneration. Another developer must select their own team.
Building with Xcode 27 for iOS 27 also requires UIKit scene support. SDK 57 scene support is enabled
through `expo-build-properties` in `app.json`; keep the compatible Expo patch dependencies installed.

Run a physical-device development client with Metro:

```bash
npm run ios:device -- "RAG iPhone"
```

Install a standalone Release build with bundled JavaScript, without requiring a running Metro
development server:

```bash
npm run ios:standalone -- "RAG iPhone"
```

Replace `RAG iPhone` with the connected device's name or UDID. Run either command without the
name to select a device interactively. `npm run ios` uses the default simulator instead.

If Xcode reports that no development provisioning profile exists, open
`ios/MaintenanceTracker.xcworkspace`, select the app target's Signing & Capabilities tab, enable
Automatically manage signing, select your team, and build once for the connected phone. Alternatively,
allow Xcode to create or renew the profile from the terminal, replacing the destination placeholder
with your phone's UDID from `xcrun devicectl list devices`:

```bash
xcodebuild -workspace ios/MaintenanceTracker.xcworkspace \
  -scheme MaintenanceTracker -configuration Release \
  -destination "id=<your-iPhone-UDID>" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  CODE_SIGN_STYLE=Automatic build
npm run ios:standalone -- "RAG iPhone"
```

After changing native configuration, regenerate the iOS project before rebuilding:

```bash
npx expo prebuild --clean --platform ios --no-install
npm run ios:standalone -- "RAG iPhone"
```

A Release configuration is independent of Metro; it does not mean the build has passed the beta
release gates. Verify launch from the Home Screen with Metro stopped and the Mac disconnected.
Automatic tracking remains off until the complete approved vehicle setup is available and ready.

Free Xcode Personal Team signing permits local device testing, but its provisioning profiles expire
after seven days, requiring a rebuild and reinstall. Paid Apple Developer Program membership is
required for TestFlight and ad hoc distribution. If the phone requests developer trust, follow its
prompt in Settings > General > VPN & Device Management, then reopen the app.

### Automatic tracking setup

Open a vehicle's dashboard and choose **Automatic tracking** (also available from Edit). The
checklist includes location permission, vehicle-bound Shortcuts, Personal Automations, the native
setup test, route binding, and your explicit confirmation. Granting location alone does not enable
automatic tracking.

1. Choose **Bluetooth audio**, **Wireless CarPlay**, or **Wired CarPlay**. The app supplies
   connection-specific instructions. Wired CarPlay has one automatic vehicle assignment per iPhone;
   reassignment requires confirmation and a new test.
2. In Apple Shortcuts, create normal Start Trip and End Trip Shortcuts using the app's actions. Set a
   fixed vehicle in both actions, then confirm them in the app. After upgrading from the initial phone
   build, reselect Vehicle in older saved actions once; installation-scoped identifiers prevent an old
   choice from silently pointing at another profile after a data reset.
3. Configure both Personal Automations with **Run Immediately**, then confirm them in the app:
   - Bluetooth audio: select the exact device for Connects → Start and Disconnects → End.
   - Wireless CarPlay: select the exact Bluetooth device for Connects → Start; use CarPlay
     Disconnects → End. Do not end the trip on the initial Bluetooth transport handoff.
   - Wired CarPlay: CarPlay Connects → Start and Disconnects → End for the single assigned vehicle.
4. Connect to the car, select its stereo as the audio output, and play audio. Choose **Route binding**
   to observe and bind the actual route. The app does not scan or identify vehicles from Bluetooth
   names. A CarPlay binding is a normalized corroboration heuristic, not guaranteed hardware identity.
5. Confirm the checklist, then choose **Run setup test**. While the car stays connected, run the saved
   Start Trip and End Trip Shortcuts and return to the app. Both actions must deliver for the selected
   vehicle with matching route evidence. The ten-minute, native-owned test creates no trip, GPS
   session, or odometer change and can be cancelled.

The simulator can verify the checklist and failure states, but cannot supply a real car audio route.
Normal trip confirmation still requires movement, matching route evidence, and a normal end.
Background/locked delivery is best effort; force-quit and exact timing are not promised.

This build migrates the local store forward from schema v2 to v3, retaining existing records and
adding setup evidence and installation-scoped Shortcut identities. Older builds cannot read v3.
Rebuild the native app after these changes; refreshing JavaScript alone is insufficient.

For UI-only work that does not depend on custom native code, Expo Go remains available:

```bash
npm run start:go
```

Expo Go is not a valid test environment for the Bluetooth, App Intents, broadcast receiver,
background execution, or background location behavior covered by the active spikes.

## MVP workflow

Keep the repository root as the application under test. Do not nest additional Expo projects.

1. Start with an unblocked implementation issue in the [MVP hierarchy](https://github.com/RAGessler/maintenance-tracker/issues/69).
2. Use one branch per issue and preserve unrelated working-tree changes.
3. Implement and verify the issue's acceptance criteria, including native and physical-device evidence where required.
4. Record the verification evidence on the issue and close it only when its definition of done is met.

Spike closeout requirements remain defined in [AGENTS.md](AGENTS.md#spike-completion). Completed
spikes and decisions constrain the MVP; they are not the active implementation workflow.

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
