# Agent guide

This file is the shared entry point for every coding agent working in this repository.
Agent-specific files may add interface instructions, but they must not redefine product scope,
architecture decisions, or issue status.

## Before starting work

1. Read `README.md` and `docs/architecture.md`.
2. Read the complete assigned GitHub issue, including its latest comments.
3. Read every ADR linked by the issue or relevant to the affected subsystem.
4. Inspect the current branch and working tree before editing. Preserve changes made by the user
   or another agent.
5. Confirm that the issue is not already being implemented in another branch or checkout.

Do not treat plans or transcripts under `.claude/`, `.codex/`, `.opencode/`, or another tool's
private state as project truth. Move durable scope and decisions into GitHub or the repository
locations described below.

## Sources of truth

- GitHub Project: priority, milestone, and workflow status.
- GitHub issue: feature or spike scope, acceptance criteria, dependencies, and progress.
- Pull request: proposed implementation and its verification evidence.
- `docs/architecture.md`: a concise description of the system that exists now and approved
  architectural boundaries.
- `docs/adr/`: durable technical decisions that future implementations must follow.
- Code, migrations, tests, and Expo configuration: actual implemented behavior.

If these disagree, stop and surface the conflict on the issue. Do not silently choose one copy or
rewrite scope during implementation.

## Expo SDK 57

Expo has changed. Read the exact versioned documentation at
https://docs.expo.dev/versions/v57.0.0/ before writing application or native integration code.
Do not substitute unversioned Expo documentation.

The generated `ios/` and `android/` directories are not source of truth. Express native
configuration through Expo configuration and config plugins where practical.

## Work boundaries

- Use one issue per implementation branch unless the issue explicitly groups inseparable work.
- Do not edit a dirty checkout owned by another active workflow. Use a separate worktree or wait.
- Keep changes within the assigned issue. Open or propose a follow-up issue for newly discovered
  work.
- Do not implement production automatic-tracking behavior until the platform spikes and the
  cross-platform tracking contract approve that behavior.
- Never commit secrets, precise location traces, private document URLs, VINs, auth tokens, or
  production user data.

## Spike completion

A spike is complete only when its GitHub issue contains a final disposition with:

- question investigated;
- environment, devices, and builds tested;
- what worked and what failed;
- evidence and reproduction notes;
- platform, policy, and lifecycle limitations;
- disposition: **adopt**, **adapt**, or **reject**;
- follow-up issues or decisions.

Keep the detailed investigation in the closed issue. Add an ADR only when the result creates a
durable constraint on future code. Do not merge spike-only diagnostics into production merely to
preserve the experiment.

## Plans, decisions, and documentation

- MVP and feature plans live in GitHub issues and the GitHub Project.
- Visual design is canonical in the linked design tool. The feature issue must also state behavior,
  states, accessibility requirements, and edge cases that an image cannot express.
- Record a durable technical decision with an ADR using `docs/adr/README.md`.
- Update `docs/architecture.md` only for approved current-state changes, not speculative designs.
- Update setup or operational instructions in `README.md` when an implementation changes them.

## Pull requests

- Link the issue with a closing keyword when the PR fully completes it.
- Explain scope, user-visible behavior, and risks.
- Include the exact verification commands and physical-device evidence when required.
- Call out migrations, permissions, native rebuild requirements, data retention, and rollback or
  forward-fix considerations.
- Do not claim success from Expo Go for Bluetooth, App Intents, broadcast receiver, background
  execution, or background location behavior.

## Baseline verification

Use the checks relevant to the change. The baseline repository commands are:

```bash
npm run typecheck
npm run lint
```

Native and background behavior requires the development build and the physical-device evidence
specified by its issue.
