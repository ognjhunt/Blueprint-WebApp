# Hermes Kanban Upgrade Packet

Date: 2026-05-18

Working directory: `/Users/nijelhunt_1/workspace/Blueprint-WebApp`

## Local Feature State

Preflight commands showed:

```text
Hermes Agent v0.6.0 (2026.3.30)
Project: /Users/nijelhunt_1/.hermes/hermes-agent
Python: 3.11.14
OpenAI SDK: 2.30.0
Update available: 5698 commits behind - run 'hermes update'
```

`hermes kanban --help` is not available:

```text
hermes: error: argument command: invalid choice: 'kanban'
```

`hermes profile describe --help` is not available:

```text
hermes profile: error: argument profile_action: invalid choice: 'describe'
```

`hermes profile create --help` only supports profile creation/clone flags:

```text
usage: hermes profile create [-h] [--clone] [--clone-all]
                             [--clone-from SOURCE] [--no-alias]
                             profile_name
```

## Blocked Step

Live Hermes Kanban/profile-description mutation is blocked because the local Hermes install does not expose the Kanban command or a profile-description write/read surface.

## Human-Gated Upgrade

Run this only when the operator explicitly wants to upgrade Hermes on this host:

```bash
hermes update
```

After the upgrade, rerun:

```bash
hermes --version
hermes profile --help
hermes profile create --help
hermes profile describe --help || true
hermes kanban --help || true
bash scripts/paperclip/validate-agent-kits.sh
```

Only if Hermes exposes supported profile-description and Kanban surfaces should a follow-up patch wire bootstrap/reconcile sync from:

```text
ops/paperclip/blueprint-company/hermes-profiles/profiles.yaml
ops/paperclip/blueprint-company/hermes-profiles/kanban-bridge.yaml
```

## Repo-Safe Work Completed Before Upgrade

- Profile routing descriptions are exported in `profiles.yaml`.
- The parent/child trace contract is exported in `kanban-bridge.yaml`.
- Orchestrator decomposition policy is exported in `orchestrator-task-template.md`.

These artifacts are not live-synced Hermes state.

## First Next Action

Upgrade Hermes with `hermes update`, rerun the preflight commands above, then implement a supported sync path only if the upgraded CLI/API exposes profile-description storage and Kanban task graph operations.
