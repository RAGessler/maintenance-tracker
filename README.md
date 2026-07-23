# Maintenance Tracker

Clean Expo development-build baseline for isolated vehicle trip-trigger spikes.

## Planning and project truth

GitHub is the project system of record:

- [MVP parent and feature hierarchy](https://github.com/RAGessler/maintenance-tracker/issues/5)
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
3. Record evidence, limitations, and an **adopt**, **adapt**, or **reject** disposition in its
   GitHub issue.
4. Merge reusable platform-neutral infrastructure only after the spike proves it is useful.

The full spike closeout requirements are defined in [AGENTS.md](AGENTS.md#spike-completion).

Active work:

- [iOS car-stereo trip triggers](https://github.com/RAGessler/maintenance-tracker/issues/2)
- [Android car-stereo Bluetooth trip triggers](https://github.com/RAGessler/maintenance-tracker/issues/3)

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
