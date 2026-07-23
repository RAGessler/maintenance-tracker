# Codex Handoff: Greenfield iOS BLE Mileage-Tracking Spike

## Mission

Create a new standalone Expo/React Native technical spike that proves whether an iPhone can automatically identify a vehicle using a vehicle-owned BLE beacon, begin recording a drive, continue collecting location in the background, and finalize the trip when the beacon disappears.

This is deliberately greenfield. Do not reuse the current app architecture beyond placing the spike on this branch.

## Product constraint

The user owns iOS devices, so iOS reliability is the deciding requirement.

Do not build the trigger around observing an arbitrary car stereo's Bluetooth Classic audio connection or display name. Instead, use a BLE beacon/tag placed in the vehicle. The beacon should advertise a stable app-controlled service UUID and vehicle identifier.

A cheap USB-powered BLE beacon or ESP32 is an acceptable eventual hardware target. During development, another BLE-capable device may simulate the beacon.

## Project setup

Create a new app directory at:

```text
spikes/ios-ble-mileage/
```

Initialize it as a fresh Expo TypeScript project using Expo Router.

Requirements:

- Expo development build, not Expo Go
- Physical iPhone testing required
- iOS deployment target compatible with current supported Expo SDK
- EAS development profile or local Xcode development build instructions
- Native iOS configuration allowed and expected
- Keep this spike isolated from the existing application

Recommended commands, adjusted for current Expo tooling:

```bash
npx create-expo-app@latest spikes/ios-ble-mileage --template
cd spikes/ios-ble-mileage
npx expo install expo-dev-client expo-location expo-task-manager expo-sqlite expo-file-system expo-sharing
npx expo prebuild --platform ios
```

Choose a BLE library only after confirming it can expose the Core Bluetooth behavior required below. If no React Native library exposes state restoration correctly, implement a small Swift native module and Expo config plugin.

## Core hypothesis

The spike succeeds only if it demonstrates a practical automatic workflow under ordinary iOS background conditions:

```text
Known vehicle beacon appears
        ↓
Resolve beacon identifier to vehicle
        ↓
Create candidate trip
        ↓
Confirm actual movement
        ↓
Begin background location collection
        ↓
Accumulate filtered distance
        ↓
Beacon disappears
        ↓
Wait through reconnect grace period
        ↓
Resume same trip or finalize it
```

Do not begin a real trip merely because the user walks near the parked vehicle.

## Required state machine

Implement and persist this state machine or a close equivalent:

```ts
type TrackingState =
  | 'idle'
  | 'beacon-detected'
  | 'awaiting-movement'
  | 'active'
  | 'reconnect-grace-period'
  | 'finalizing'
  | 'completed'
  | 'failed';
```

State must survive normal process termination and relaunch where iOS permits restoration.

## BLE implementation requirements

Use Core Bluetooth central behavior.

Required:

- Add `bluetooth-central` to `UIBackgroundModes`
- Give `CBCentralManager` a stable restoration identifier
- Implement central-manager state preservation/restoration
- Scan for one specific service UUID
- Avoid unconstrained general scanning
- Persist known peripheral identifiers and their associated vehicle IDs
- Record discovery, connection, disconnection, restoration, and manager-state events
- Expose diagnostic events to JavaScript
- Document exactly what still works after backgrounding, suspension, OS termination, and user force-quit

Use stable UUIDs in a configuration file rather than scattering literals.

Suggested test service UUID:

```text
6E400001-B5A3-F393-E0A9-E50E24DCCA9E
```

It may be replaced, but document the final choice.

## Location implementation requirements

Use Expo Location/Task Manager where sufficient, with native additions where necessary.

Required:

- Add `location` to `UIBackgroundModes`
- Request When In Use followed by Always authorization
- Show precise/reduced accuracy status
- Start high-accuracy location updates only after movement confirmation
- Persist each raw sample locally
- Store accepted/rejected status and rejection reason
- Continue tracking with the screen locked and app backgrounded
- Stop high-frequency location after trip finalization

Movement confirmation should use a practical rule, for example:

- two or more acceptable samples,
- speed greater than approximately 3 m/s, or
- displacement greater than approximately 100 meters within a short window.

Make thresholds configurable.

## Distance filtering

Implement a simple, inspectable distance pipeline.

Reject samples when one or more conditions apply:

- invalid timestamp or coordinates
- sample is older than the previous accepted sample
- horizontal accuracy exceeds configurable threshold, initially 50 meters
- implied speed is physically implausible, initially over 55 m/s
- movement is below a configurable jitter threshold relative to accuracy

For accepted samples:

- calculate segment distance using Haversine or Core Location distance
- maintain total distance in meters
- preserve both raw and accepted samples for later analysis

Do not over-engineer map matching in this spike.

## Reconnect handling

When the beacon disappears during an active trip:

1. enter `reconnect-grace-period`
2. continue location collection
3. wait a configurable three minutes
4. if the same beacon returns, continue the same trip
5. otherwise finalize the trip

Persist the grace-period deadline.

## Minimum screens

Use an Expo Router group such as `app/(spike)/`.

### Setup

- Explain why a development build and physical iPhone are required
- Request Bluetooth and location permissions
- Register or select a detected beacon
- Associate beacon with a mock vehicle
- Display required background-mode configuration status

### Diagnostics

Show:

- Bluetooth manager state
- current app lifecycle state
- known peripheral identifier
- beacon last-seen timestamp
- location authorization status
- precise/reduced accuracy status
- current tracking state
- last location and age
- horizontal accuracy
- speed
- raw event log

Provide buttons to copy/share diagnostic output.

### Active Trip

Show:

- associated vehicle
- start time
- elapsed time
- calculated distance
- current speed
- current location accuracy
- beacon present/missing status
- grace-period countdown when applicable
- emergency manual stop

### Trip Result

Show:

- start/end times
- calculated distance
- raw sample count
- accepted sample count
- rejected sample counts grouped by reason
- field for actual odometer distance
- absolute error
- percentage error
- JSON export/share action

Visual polish is secondary to reliability and observability.

## Local storage

Use SQLite.

Suggested tables:

```text
vehicles
beacons
trips
location_samples
tracking_events
tracking_runtime_state
```

Every tracking event should contain:

- timestamp
- source (`ble`, `location`, `lifecycle`, `state-machine`, `user`)
- event name
- relevant JSON payload

## Test matrix

Run and record each case on a physical iPhone:

1. app foregrounded when beacon appears
2. app backgrounded when beacon appears
3. screen locked before beacon appears
4. app suspended for several minutes
5. normal OS process termination followed by beacon event
6. manual force-quit followed by beacon event
7. brief beacon loss shorter than grace period
8. beacon loss longer than grace period
9. walking near parked vehicle without driving
10. 10–20 mile real drive with odometer comparison
11. phone enters Low Power Mode
12. Bluetooth toggled off and back on
13. location permission downgraded
14. reduced-accuracy location enabled

Record expected and actual behavior in `RESULTS.md`.

## Success criteria

The spike is successful only if:

- a known beacon can identify the correct vehicle,
- movement confirmation prevents obvious false trips,
- background location survives a normal drive with the screen locked,
- reconnect grace prevents accidental trip splitting,
- distance error is at or below 5% on at least three representative drives,
- the behavior after force-quit is explicitly documented,
- battery impact is measured and documented,
- all limitations are visible rather than hidden.

## Required deliverables

Create:

```text
spikes/ios-ble-mileage/
  README.md
  RESULTS.md
  TEST_PLAN.md
  app/
  modules/ or ios/ native implementation as needed
```

`README.md` must include:

- setup prerequisites
- development-build instructions
- Apple signing requirements
- how to configure or simulate the beacon
- how to run the app on a physical iPhone
- known iOS limitations

`RESULTS.md` must contain a table for each test case with:

- device and iOS version
- app state
- test steps
- observed result
- logs or export filename
- pass/fail
- notes

## Guardrails

- Do not modify or refactor the existing maintenance tracker app.
- Do not claim support for arbitrary vehicle stereo Bluetooth connections.
- Do not treat Expo Go or simulator tests as proof.
- Do not hide unsupported background behavior behind timers or mocked events.
- Prefer explicit native Swift code over a misleading JavaScript-only approximation.
- Commit in small, reviewable increments.

## First implementation milestone

Stop after completing all of the following:

1. greenfield Expo development-build project boots on a physical iPhone
2. required iOS background modes and permission descriptions are configured
3. diagnostics screen displays lifecycle, Bluetooth manager, and location authorization state
4. Core Bluetooth scans for the configured service UUID
5. discovery/restoration events are persisted and visible
6. README explains exact build and test steps

At that point, report what is proven, what remains unproven, and any blocker requiring hardware or Apple signing configuration.
