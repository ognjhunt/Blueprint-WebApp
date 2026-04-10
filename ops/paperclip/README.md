# Blueprint Paperclip Integration

This directory contains the local Paperclip package and bootstrap scripts used to run Blueprint's autonomous control plane across:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline`
- `/Users/nijelhunt_1/workspace/BlueprintCapture`

The current baseline includes a Hermes-backed `blueprint-chief-of-staff` loop that wakes on issue/routine/failure signals and mirrors major task/delegation movement into Slack when webhook targets are configured.

Main entrypoints:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company`: portable Paperclip company package
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation`: Blueprint-specific Paperclip plugin package
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-automation.config.json`: default plugin config template
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`: setup, architecture, webhook wiring, and operator runbook
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh`: start Paperclip and import the Blueprint company
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/ensure-codex-gstack.sh`: install gstack for Codex and link it into the three Blueprint repos
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/ensure-blueprint-paperclip-public-url.sh`: keep a healthy public Paperclip URL via `cloudflared` when the env file only points at localhost
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/configure-blueprint-paperclip-plugin.sh`: install/build/configure the Blueprint plugin and its secret refs
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/repair-blueprint-paperclip-company.sh`: clean duplicate agents, projects, and stale work left behind by older re-imports
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh`: reconcile the surviving canonical agents and routines back onto the intended Codex/Claude/Hermes host configuration
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/setup-github-webhooks.sh`: wire GitHub repo hooks to the active public Paperclip URL and validate with ping deliveries
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/agents/README.md`: canonical employee-kit contract for all Blueprint agents
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/validate-agent-kits.sh`: repo-side validator for the mandatory four-file agent kit
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/verify-blueprint-paperclip.sh`: run environment checks against the imported local adapters
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/sweep-agent-run-failures.ts`: cluster recent failed or stalled heartbeat runs into shared failure families so fixes can land once for many agents
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/smoke-blueprint-paperclip-automation.sh`: end-to-end smoke for issue creation, dedupe, blocker follow-up, and resolution
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/install-blueprint-paperclip-launchagent.sh`: install macOS LaunchAgents for the long-lived server and a slower maintenance sweep

Runtime state is intentionally kept outside the git repo at:

- `/Users/nijelhunt_1/workspace/.paperclip-blueprint`
- optional shared env file: `/Users/nijelhunt_1/workspace/.paperclip-blueprint.env`

## Local Recovery Notes

Shared-instance process ownership on macOS should be:

- `com.blueprint.paperclip` owns the single long-lived local control plane
- `com.blueprint.paperclip.maintenance` only performs destructive bootstrap after a sustained unhealthy window, not on a single transient health miss

Important scheduler/process recovery detail from the April 2, 2026 repair:

- Paperclip can temporarily fall back from configured port `3100` to `3101` when `3100` is occupied during startup.
- If maintenance only checks the configured `3100`, it can incorrectly bootstrap a second Paperclip tree while the LaunchAgent-managed instance is still healthy on `3101`.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/paperclip-api.sh` now detects healthy local listeners for the shared `PAPERCLIP_HOME`.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/maintenance-blueprint-paperclip.sh` and `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh` now skip spawning a new server when the shared instance is already healthy on an alternate local port.

If you see `3101` again:

- check `launchctl list | rg 'paperclip|blueprint'`
- check `lsof -nP -iTCP:3100 -sTCP:LISTEN`
- check `lsof -nP -iTCP:3101 -sTCP:LISTEN`
- run `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/maintenance-blueprint-paperclip.sh`
  to confirm it now reports the alternate healthy local URL instead of bootstrapping a duplicate
- only restart `com.blueprint.paperclip` after `3100` is actually free

Paperclip source is cloned at:

- `/Users/nijelhunt_1/workspace/paperclip`

Production VPS inventory:

- host label: `paperclip-prod-01`
- provider: DigitalOcean Droplet
- public IPv4: `206.81.11.69`
- private IPv4: `10.116.0.2`
- region: `NYC1`
- size: `4 GB / 80 GB Disk / Ubuntu 24.04 (LTS) x64`
- VPC: `default-nyc1`
- VPC CIDR: `10.116.0.0/20`
- current operator note: no DigitalOcean firewall attached

Current verified production state as of `2026-04-02T17:23:26Z`:

- `paperclip.tryblueprint.io` resolves to `206.81.11.69`
- public HTTPS and `/api/health` are healthy
- `caddy.service` and `paperclip.service` are running on the droplet
- host-level `ufw` is active and only exposes `22`, `80`, and `443`

Production cleanup completed on `2026-04-02`:

- deployed updated copies of:
  - [paperclip-api.sh](/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/paperclip-api.sh)
  - [bootstrap-blueprint-paperclip.sh](/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh)
  - [maintenance-blueprint-paperclip.sh](/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/maintenance-blueprint-paperclip.sh)
- removed the stale session-scoped Paperclip tree that had been serving `127.0.0.1:3101`
- verified post-cleanup host state:
  - `paperclip.service` remains active
  - `127.0.0.1:3100` remains healthy
  - `127.0.0.1:3101` no longer listens
  - public `https://paperclip.tryblueprint.io/api/health` remains healthy

Current production state:

- externally healthy
- internally clean
- aligned with the local duplicate-process recovery fix set

Hermes-backed Blueprint agents are expected to use Codex OAuth only on this host. Install and configure Hermes locally before running reconcile or verify:

- `hermes model` → choose the Codex provider
- pin auxiliary/compression paths to Codex in `~/.hermes/config.yaml` if you want strict no-OpenRouter behavior

Run-family triage workflow:

- use `npm run paperclip:sweep:run-failures -- --markdown` to inspect the latest clustered failure families across agents
- use `npm run paperclip:sweep:run-failures -- --json` when another script or dashboard should consume the grouped output
- prefer fixing the top shared signatures first instead of investigating single runs one by one
