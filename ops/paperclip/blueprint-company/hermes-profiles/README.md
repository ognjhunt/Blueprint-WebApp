# Hermes Profile Routing Export

This directory is the repo-owned preflight/export surface for Hermes Kanban profile-description routing.

Current local gate on 2026-05-18:

- `hermes --version` reports `Hermes Agent v0.6.0 (2026.3.30)` and `5698 commits behind`.
- `hermes kanban --help` is unavailable.
- `hermes profile describe --help` is unavailable.
- `hermes profile create --help` only exposes clone flags, so live profile-description mutation is blocked.

Until Hermes exposes supported Kanban/profile-description commands locally, these files are an export packet only. They must not be treated as live-synced Hermes state.

## Files

- `profiles.yaml`: Hermes routing descriptions derived from `.paperclip.yaml` capabilities plus the agent kit files under `agents/*/{AGENTS.md,Soul.md,Tools.md,Heartbeat.md}`.
- `kanban-bridge.yaml`: deterministic contract for translating Hermes triage parents and child tasks into Paperclip issues/runs without replacing Paperclip as the execution record.
- `orchestrator-task-template.md`: short runbook for the Hermes orchestrator/default-assignee lane.
- `upgrade-packet-2026-05-18.md`: exact local preflight result and blocked upgrade packet.

## Sync Rule

Bootstrap/reconcile scripts may consume this directory only after a local Hermes/Paperclip surface exists for profile descriptions. The supported implementation should read `profiles.yaml`, keep the `.paperclip.yaml` `capabilities` field as Paperclip metadata, and write only the Hermes routing `description` into the Hermes profile-description field.

Do not screen-scrape Hermes, mutate profile files outside a supported command/API, or route every agent through Codex as a workaround.
