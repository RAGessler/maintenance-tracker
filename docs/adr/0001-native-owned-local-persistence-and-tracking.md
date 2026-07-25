# ADR-0001: Native-owned local persistence and tracking

- Status: Accepted
- Date: 2026-07-24
- Decision owners: @RAGessler
- Related issues: #55, #56, #61, #65, #66

## Context

The private iOS beta has no account or backend, but vehicle-bound App Intents and background tracking
must operate while React Native is not running. The diagnostic spike proved that native lifecycle
ownership is feasible, while also exposing the risks of hardcoded vehicle data, diagnostic-only
persistence, duplicated state machines, and a broad bridge that leaks native internals.

## Decision

Use one versioned, native-owned SQLite store in the private app container as the canonical persistence
authority. One local Expo native package and CNG config plugin expose two typed React Native
interfaces: a product-store interface for durable records, photos, export, and deletion; and a
trip-tracking interface for setup, commands, snapshots, and status events. App Intents invoke the
native tracking module directly without requiring React Native.

Swift owns migrations, transactional lifecycle and privacy invariants, temporary precise-location
cleanup, diagnostics retention, and the background-critical tracking state machine. Internal adapters
isolate App Intents, Core Location, audio-route evidence, clocks, and persisted deadlines. React Native
and pure TypeScript own presentation, foreground workflows, and deterministic estimated-odometer and
maintenance-due calculations over persisted source facts and audit history. Derived odometer and due
projections are not canonical persisted state.

Hero photos are metadata-stripped, size-limited app-owned files referenced by the store rather than
database blobs. The database and files needed for locked background operation use the strongest iOS
Data Protection class compatible with that operation; photos and generated exports use stronger
complete protection where locked access is unnecessary. The TestFlight export is a versioned portable
archive. A transactionally consistent, sanitized SQLite snapshot is available only in development
builds and never includes temporary precise-location points.

The React Native interfaces do not expose SQL, database paths, temporary coordinates, raw route
identifiers, or generic diagnostic payloads. The beta adds no backend, account layer, custom
encryption, or speculative Android tracking abstraction.

## Consequences

Background commands, foreground edits, export, and deletion share one migration and transaction
authority, avoiding reconciliation between native and JavaScript stores. This requires more native
persistence code and native repository/migration tests than a JavaScript-owned database. Pure product
calculations remain fast to test in TypeScript, while the lifecycle-critical Swift engine must be
tested through its location, route, clock, deadline, and persistence seams.

The production implementation may adapt the spike's native lifecycle ownership, App Intent packaging,
and route/location evidence adapters. It must replace the spike's hardcoded vehicles, diagnostic
schema, indefinite raw-point retention, polling UI, duplicated TypeScript state machine, and broad
diagnostic bridge rather than merge them wholesale.

## Alternatives considered

- A SQLite file written independently by Swift and `expo-sqlite` was rejected because write,
  migration, file-protection, and lifecycle ownership would be split across runtimes.
- Separate native tracking and JavaScript product stores were rejected because vehicle identity,
  deletion, export, and trip completion would require synchronization and recovery protocols.
- A native-first implementation of every product rule was rejected because foreground calculations
  and workflows do not need native lifecycle ownership and are cheaper to test in TypeScript.
- Exporting the live SQLite database in TestFlight was rejected because it exposes internal schema,
  can include temporary precise-location state, and implies unsupported restore semantics.
