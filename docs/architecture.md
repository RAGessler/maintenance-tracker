# Architecture and product boundaries

This page describes the current system and approved boundaries. It is intentionally concise.
Implementation plans and workflow status belong in GitHub issues and the GitHub Project. Durable
technical decisions belong in [`docs/adr/`](adr/).

## Product

Maintenance Tracker is planned as a private, multi-vehicle mobile application for recording vehicle
activity and documents, estimating mileage from reviewed trips, and calculating maintenance due by
mileage or time.

Automatic mileage is an estimate. A manual dashboard reading is the authoritative confirmation and
creates an auditable reconciliation; it must not silently rewrite historical trips.

## Current implementation

The repository is an Expo SDK 57 development-build baseline with:

- React Native 0.86 and strict TypeScript;
- Expo Router;
- Continuous Native Generation;
- `expo-dev-client` for native integrations;
- generated, uncommitted iOS and Android projects.

The active implementation work is platform feasibility testing for vehicle trip triggers. The
production account, garage, records, schedules, and tracking systems described by the MVP plan are
not implemented yet.

## Approved tracking boundaries

- The supported trigger hardware is the user's existing CarPlay or Bluetooth stereo. A separate BLE
  beacon or tag is not an acceptable product requirement.
- A trigger creates a candidate; movement confirmation is required before accumulating distance.
- Connection loss creates an end candidate rather than immediately finalizing a trip.
- A reconnect inside the approved grace period resumes the same logical trip.
- Manual trip start/stop and manual odometer entry are required fallbacks.
- iOS must not claim passive, system-wide observation of arbitrary Bluetooth audio-device
  connections. The active spike evaluates user-created Shortcuts/App Intents plus audio-route
  evidence.
- Android must use a stable selected-device identifier where the platform permits it. A Bluetooth
  display name alone is not a database key.
- Production tracking behavior must not exceed the contract proven by the platform spikes and
  approved by the cross-platform tracking decision.

## Planned production shape

The MVP plan proposes:

- Supabase Postgres, Auth, and private Storage;
- Row Level Security for every user-owned table and private storage policy;
- four primary tabs: Garage, Activity, Due, and Settings;
- a shared trip state machine with platform-specific trigger adapters;
- reviewed trips feeding an estimated odometer;
- a deterministic schedule engine using mileage, time, or whichever comes first;
- no indefinite retention or user-facing playback of raw GPS traces.

These are planning constraints, not a claim that the corresponding systems already exist.

## Decision and evidence flow

1. A spike issue captures the investigation and complete evidence.
2. Its final comment records **adopt**, **adapt**, or **reject**.
3. A cross-platform or feature issue approves product scope.
4. An ADR records any durable technical constraint.
5. Implementation, tests, migrations, and configuration become the executable source of truth.

When a plan conflicts with spike evidence or an accepted ADR, stop and resolve the conflict in the
relevant GitHub issue before implementation.
