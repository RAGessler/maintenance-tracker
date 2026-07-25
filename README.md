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
