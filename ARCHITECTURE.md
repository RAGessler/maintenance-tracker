# iOS Trip Trigger Architecture

This document records the proven iOS CarPlay/Bluetooth trip-trigger design for a future production
implementation. It describes the architecture, not a promise that iOS offers a general Bluetooth
connection API.

## Proven scope

- A CarPlay Shortcuts automation can start a trip while the app is backgrounded and the phone is
  locked.
- Native Core Location can promote the candidate to active tracking and persist evidence.
- A CarPlay disconnect can complete the trip; route loss supplies a reconnect-grace fallback.
- CarPlay route fingerprints can distinguish the physically tested Car A and Car B heuristically.
- A selected-device Bluetooth connect and disconnect automation is available for the physical test
  iPhone's `GTA Car Kit`. Its physical route/lifecycle validation remains pending access to Car C.

## Boundaries

| Layer | Responsibility | Production treatment |
| --- | --- | --- |
| Shortcuts/App Intents | User-created connect/disconnect automation invokes `StartTripIntent` or `EndTripIntent` | Keep. It is the supported trigger boundary. |
| `TripCoordinator` | Owns trip state, permissions, Core Location, route observation, and deadline restoration | Keep as a native service behind a small React Native bridge. |
| `EventStore` | SQLite audit trail, runtime state, samples, and summaries | Replace or migrate into the app's durable trip repository. Retain native single-writer ownership. |
| React Native UI | Setup, status, summaries, diagnostics, and evidence export | Keep as a presentation layer only; it must not own active-trip decisions. |
| Route fingerprints | Maps observed route UIDs to a display label | Treat as optional, user-managed configuration with confidence/provenance. Do not ship the spike's hardcoded labels. |

## Lifecycle

1. The user installs a signed development or production build, grants Precise Always Location, and
   creates Shortcuts automations that run immediately.
2. `StartTripIntent` calls `TripCoordinator.startTrip(source:)` without requiring the JavaScript UI.
3. A SQLite trip row and persisted runtime deadlines are created. The current route is captured and
   native location updates begin.
4. The state moves from `start-candidate` to `awaiting-movement`.
5. An accepted location promotes the trip to `active` at at least `3 m/s` or `100 m` displacement.
6. `EndTripIntent` completes the trip. If the route disappears before an end intent arrives, native
   route observation moves the trip to `reconnect-grace-period` for three minutes. A matching route
   restores the prior state; expiry completes the trip on the next execution opportunity.
7. Accepted GPS samples are retained locally and converted to an estimated distance for summaries.

## Data ownership

`EventStore` uses `Library/LocalDatabase/car-stereo-spike.db` and is the only database writer.
It contains:

- `trips`: trigger source, lifecycle state, timestamps, and recognized vehicle label.
- `location_samples`: raw fixes, acceptance outcome, accuracy, and speed.
- `tracking_events`: App Intent, route, permission, sample, and state-transition evidence.
- `tracking_runtime_state`: active trip and deadline restoration values.

The export is diagnostic evidence. It deliberately excludes raw coordinates, so a production data
model must separately define user-visible trip retention, deletion, backup, and privacy policy.

## Distance calculation

Trip summaries order accepted fixes by timestamp and add sequential `CLLocation` distances. Segments
shorter than the reported horizontal accuracy, with a 5 m floor, are ignored to reduce stationary
jitter. Reject stale fixes, accuracy worse than 50 m, and speeds above 55 m/s before calculation.

The observed Car A comparison was `0.94 mi` on the phone versus `0.9 mi` on an odometer rounded to
tenths. This is preliminary validation only. Production must continue comparing trips against a
known distance and expose accuracy/quality metadata rather than presenting GPS distance as exact.

## Production requirements

- Keep App Intent handlers and active-trip state native so operation does not depend on Metro or a
  mounted React Native view.
- Preserve idempotent App Intent event IDs and native single-writer persistence.
- Persist deadlines, but model them as best effort: iOS can suspend the process and defer deadline
  execution until a later callback or restoration opportunity.
- Require Always Location before tracking; explain the background location indicator and provide
  clear stop/delete controls.
- Provide setup guidance for both selected-device Bluetooth and CarPlay connect/disconnect
  automations. Availability can differ by device and iOS version, so verify it in-app during setup.
- Use audio route changes only as corroborating evidence and fallback end handling. They are not a
  system-wide device connection API and must never start a trip by themselves.
- Move vehicle labels from `VehicleFingerprint.swift` into explicit user configuration. Preserve
  raw observed route data and mark heuristic matches as unverified until repeatable across reboots
  and multiple drives.
- Validate locked/background behavior on supported iOS versions and document that a user force-quit
  can prevent background location restoration.

## Remaining validation

- Execute the locked-screen Bluetooth-only Car C flow using `GTA Car Kit`: connect/start, movement
  activation, disconnect/end, reconnect grace fallback, and distance comparison.
- Repeat Car A and Car B identification after an iPhone and head-unit reboot.
- Validate Car B's locked-screen run through movement activation and completion.
