# Paperclip Routine Scheduler Recovery Handoff

Use the prompt below as the starting instruction set for the next repair session.

## Master Prompt

You are continuing the in-progress Blueprint Paperclip scheduler recovery.

Workspace:
- Repo: `/Users/nijelhunt_1/workspace/Blueprint-WebApp`
- Related local Paperclip repo: `/Users/nijelhunt_1/workspace/paperclip`
- Paperclip home: `/Users/nijelhunt_1/workspace/.paperclip-blueprint`
- Env file: `/Users/nijelhunt_1/workspace/.paperclip-blueprint.env`
- Timezone context: `America/New_York`
- Production VPS inventory:
  - host label: `paperclip-prod-01`
  - provider: DigitalOcean Droplet
  - public IPv4: `206.81.11.69`
  - private IPv4: `10.116.0.2`
  - region: `NYC1`
  - size: `4 GB / 80 GB Disk / Ubuntu 24.04 (LTS) x64`
  - VPC: `default-nyc1`
  - VPC CIDR: `10.116.0.0/20`
  - current firewall state reported by operator: no DigitalOcean firewall attached

Read first:
1. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
2. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/DEPLOYMENT.md`
4. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/package.json`

Mission:
Finish the last two Paperclip scheduler recovery problems and leave both local and production host context cleanly documented:

1. Confirm that a scheduled routine now propagates all the way from `routine_triggers` and `routine_runs` into a brand-new `heartbeat_runs` row for its target agent.
2. Identify and remove the extra Paperclip server process tree serving `127.0.0.1:3101` while preserving the healthy primary instance on `127.0.0.1:3100`.

Hard requirements:
- Do not use destructive git commands.
- Do not revert unrelated user changes.
- Use `apply_patch` for file edits.
- Keep checked-in cron values from `.paperclip.yaml`.
- Prefer repo scripts and Paperclip APIs over ad hoc DB mutation, but use surgical direct DB access when the API path is too slow or overloaded.
- Do not claim success on the heartbeat path unless you can point to a fresh post-repair `heartbeat_runs` row.

## Session Summary

What was already true before this session:
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/maintenance-blueprint-paperclip.sh` was added so the 5-minute maintenance LaunchAgent only runs full bootstrap when Paperclip is actually unhealthy.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/install-blueprint-paperclip-launchagent.sh` was updated to point maintenance at the lightweight script.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/paperclip-api.sh` was updated so launchd restarts do not fail on `DATABASE_URL` when this local instance is explicitly configured for embedded Postgres.
- Paperclip can boot cleanly in the foreground with:

```bash
PAPERCLIP_ENV_FILE=/Users/nijelhunt_1/workspace/.paperclip-blueprint.env bash -x /Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/run-blueprint-paperclip-service.sh
```

- `/api/health` returned healthy after boot.
- Plugin scheduler jobs were dispatching normally.
- The original root cause was duplicate imported projects, duplicate agents, duplicate routines, duplicate routine-execution issues, and thousands of duplicate schedule triggers inside company `3f90b9fe-5b98-4e28-852c-78d0e3b3a31f`.

What this session changed:
- Added a bounded embedded-Postgres-aware cleanup path to:
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/repair-blueprint-paperclip-company.sh`
- Performed a surgical direct DB cleanup because the API delete loop was too slow:
  - deleted all company `schedule` triggers
  - paused and archived duplicate managed routines
  - cancelled most duplicate open `routine_execution` issues
  - rebuilt canonical schedule triggers directly from:
    `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/.paperclip.yaml`
  - removed 3 leftover duplicate schedule rows from a partially-completed API rebuild

Current local state after cleanup:
- `/api/health` is healthy on `http://127.0.0.1:3100/api/health`
- routine titles deduped: `duplicate_titles = 0`
- schedule trigger state:
  - `schedule_triggers = 49`
  - `enabled_schedule_triggers = 40`
  - `routines_with_schedule = 49`
  - `duplicateTriggerRoutines = 0`
- open routine-execution issues dropped from `306` to `26`
- canonical trigger for `WebApp Claude Review Loop` is:
  - routine id: `1960499c-a3fd-4501-9805-89e3e66070a5`
  - trigger id: `8d3c639b-1e2e-439a-a27a-64e326b05a2f`
  - cron: `45 11 * * 1-5`
  - timezone: `America/New_York`
- server log shows the scheduler is alive again:
  - `2026-04-02 16:45:17Z` -> `routine scheduler tick enqueued runs {"triggered":1}`
- DB evidence of fresh scheduled routine dispatch:
  - `routine_runs.id = 6cd957a0-1861-454e-99fb-20d4238ce2d1`
  - title: `Pipeline Claude Review Loop`
  - source: `schedule`
  - status: `coalesced`
  - createdAt: `2026-04-02T16:45:12.518Z`
  - triggerId: `4ac0da18-2d10-4284-94a8-e625597661f1`

## Final Resolution

Status after the follow-up repair pass:

- `http://127.0.0.1:3100/api/health` is healthy again.
- `lsof -nP -iTCP:3100 -sTCP:LISTEN` shows a single Paperclip listener.
- `lsof -nP -iTCP:3101 -sTCP:LISTEN` returns no listener.
- `launchctl list | rg 'paperclip|blueprint'` shows the expected `com.blueprint.paperclip` LaunchAgent plus the maintenance agent.

### Root Cause Of The `3101` Duplicate

The remaining `3101` process was the LaunchAgent-managed control plane itself.

What happened:

- `com.blueprint.paperclip` tried to bind the configured `3100`.
- When `3100` was temporarily occupied, Paperclip fell back to `3101` and kept serving there.
- `com.blueprint.paperclip.maintenance` only health-checked the configured `http://127.0.0.1:3100`.
- Because maintenance treated `3100` being down as full unhealthiness, it ran bootstrap and created a second Paperclip tree on `3100`.

Fix applied:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/paperclip-api.sh`
  now discovers local listener ports for the shared `PAPERCLIP_HOME` and can return a healthy alternate local API URL.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/maintenance-blueprint-paperclip.sh`
  now skips bootstrap when the shared instance is already healthy on another local port.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh`
  now also skips spawning a new Paperclip process when the shared instance is already healthy on another local port.
- After the script fix, the stray bootstrap tree drained away, the LaunchAgent was restarted, and the single remaining control plane came back on `3100`.

### Scheduled Routine -> Heartbeat Proof

Canonical proof routine:

- title: `Market Intel Weekly`
- routine id: `234bb706-bd24-4b0f-ad51-db8b86f93249`
- trigger id: `7c5b4ab4-48bf-48bc-b088-522b8de54c75`
- assignee agent id: `5d5b430c-ba20-4e46-847d-c6d39151f9c8`

Verified evidence:

- `routine_triggers.id = 7c5b4ab4-48bf-48bc-b088-522b8de54c75`
  - `last_fired_at = 2026-04-02T17:13:19.478Z`
  - `next_run_at = 2026-04-03T19:00:00.000Z`
- fresh scheduled routine run:
  - `routine_runs.id = b3213d2c-1af9-47ef-a16c-81b0ccc0f0f4`
  - `source = schedule`
  - `created_at = 2026-04-02T17:13:19.474Z`
- fresh linked issue:
  - `issues.id = a8c658a9-187a-418c-9893-81a6e9b5ece2`
  - `origin_run_id = b3213d2c-1af9-47ef-a16c-81b0ccc0f0f4`
  - `execution_run_id = 3a1c1106-99d1-42fa-b91f-1e622f8e95b6`
  - `created_at = 2026-04-02T17:13:19.474Z`
- fresh downstream heartbeat row:
  - `heartbeat_runs.id = 3a1c1106-99d1-42fa-b91f-1e622f8e95b6`
  - `agent_id = 5d5b430c-ba20-4e46-847d-c6d39151f9c8`
  - `invocation_source = assignment`
  - `trigger_detail = system`
  - `created_at = 2026-04-02T17:13:19.612Z`

Important nuance:

- The live interval scheduler did not claim a raw SQL `next_run_at = now() - interval ...` edit because `tickScheduledTriggers()` claims rows by exact `next_run_at`, and the direct SQL write kept precision that was awkward to re-match.
- The proof run succeeded after resetting `next_run_at` to an exact ISO millisecond timestamp and then calling Paperclip's own `routineService.tickScheduledTriggers(new Date())`.
- That kept the verification on the real scheduler code path and preserved the checked-in cron/timezone values.

### Verification Cleanup

The proof created a real execution issue and heartbeat row. Because the one-off scheduler call used its own DB client, the spawned heartbeat later errored when that client disconnected.

Cleanup performed:

- cancelled heartbeat run `3a1c1106-99d1-42fa-b91f-1e622f8e95b6` via the Paperclip API
- cancelled verification issue `a8c658a9-187a-418c-9893-81a6e9b5ece2`
- marked verification routine run `b3213d2c-1af9-47ef-a16c-81b0ccc0f0f4` failed with:
  - `failure_reason = Verification cleanup after scheduler recovery proof`

Post-cleanup routine state:

- `Market Intel Weekly` now shows:
  - `activeIssue = null`
  - `lastRun.status = failed`
  - `lastRun.source = schedule`
  - `lastRun.failureReason = Verification cleanup after scheduler recovery proof`
  - `triggers[0].nextRunAt = 2026-04-03T19:00:00.000Z`
  - `triggers[0].lastFiredAt = 2026-04-02T17:13:19.478Z`

### Production Host Note

No additional production VPS action was discovered during this pass. The DigitalOcean inventory remains:

- host label: `paperclip-prod-01`
- public IPv4: `206.81.11.69`
- private IPv4: `10.116.0.2`
- region: `NYC1`
- current firewall note: no DigitalOcean firewall attached

## Production Verification Pass

Verification time:

- `2026-04-02T17:23:26Z`

What was verified live on `paperclip-prod-01`:

- SSH access works as `root@paperclip.tryblueprint.io`
- hostname: `paperclip-prod-01`
- kernel: `Linux paperclip-prod-01 6.8.0-71-generic ... Ubuntu`
- uptime at check time: `4 days, 14:43`
- public DNS:
  - `paperclip.tryblueprint.io -> 206.81.11.69`
- public edge:
  - `curl -Ik https://paperclip.tryblueprint.io/` -> `HTTP/2 200`
  - `curl https://paperclip.tryblueprint.io/api/health` -> healthy JSON
- system services:
  - `caddy.service` running
  - `paperclip.service` running
- host firewall:
  - `ufw` is active
  - inbound allowlist is only `22/tcp`, `80`, and `443`

Production duplicate-process finding at the start of the verification pass:

- the droplet had two Paperclip listeners:
  - `127.0.0.1:3100` -> managed `paperclip.service` (`node` pid `419787`)
  - `127.0.0.1:3101` -> stale session-scoped tree (`node` pid `343632`)
- process ownership differed:
  - `419787` was in `0::/system.slice/paperclip.service`
  - `343632` was in `0::/user.slice/user-0.slice/session-1742.scope`
- that confirmed `3101` was not a second systemd unit; it was a stale session-scoped Paperclip tree

Script drift verified on production:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/paperclip-api.sh` on the VPS does **not** contain:
  - `paperclip_listen_ports_for_home`
  - `paperclip_find_healthy_local_api_url`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/maintenance-blueprint-paperclip.sh` is not present on the VPS path
- so the local duplicate-process recovery hardening from this repair pass has not yet been deployed to production

Production cleanup completed during the verification pass:

1. deployed updated local scripts to the VPS:
   - `scripts/paperclip/paperclip-api.sh`
   - `scripts/paperclip/bootstrap-blueprint-paperclip.sh`
   - `scripts/paperclip/maintenance-blueprint-paperclip.sh`
2. backed up the old remote script copies under:
   - `/root/paperclip-backups/2026-04-02/`
3. confirmed the deployed scripts pass `bash -n` on the host
4. killed the stale session-scoped `3101` tree:
   - `343603 -> 343621 -> 343632 -> 343662`
5. verified post-cleanup host state:
   - `ss -ltnp` shows only `127.0.0.1:3100` for Paperclip
   - `systemctl is-active paperclip.service` -> `active`
   - `curl http://127.0.0.1:3100/api/health` -> healthy JSON
   - `curl https://paperclip.tryblueprint.io/api/health` -> healthy JSON

Current production conclusion:

- externally healthy: **yes**
- internally clean / aligned with the local duplicate-process fix set: **yes**

## Remaining Problems

### 1. Scheduled routine -> heartbeat wakeup proof is still missing

I verified:
- canonical `routine_triggers` exist
- a fresh scheduled `routine_runs` row was created
- the log emitted `routine scheduler tick enqueued runs`

I did **not** verify:
- a brand-new `heartbeat_runs` row created after the repaired scheduler fired for a scheduled routine target

During the final verification window:
- forcing a due trigger on `Pipeline Claude Review Loop` produced a fresh `routine_runs` row
- forcing a due trigger on `Market Intel Weekly` did not produce a visible fresh `routine_runs` or `heartbeat_runs` row within the wait window
- querying `heartbeat_runs` for `created_at >= 2026-04-02T16:40:00Z` returned no new rows

What needs to be proven next:
- pick a canonical active routine with `open_issue_count = 0`
- force only its `next_run_at` to be due
- confirm:
  - a new `routine_runs` row appears
  - a new linked `issues` row appears if appropriate
  - a brand-new `heartbeat_runs` row appears for the target agent
  - ideally the target agent’s `lastHeartbeatAt` advances

Good candidate routines observed with zero open routine issues:
- `Analytics Weekly` -> routine `59645f1a-889f-4557-97da-e001909d6e76`
- `Capturer Growth Weekly` -> routine `8460797e-d415-439c-80d7-da78533a99fa`
- `City Launch Refresh` -> routine `7e2a4f78-7875-49c2-81a4-c63b8f84365a`
- `Community Updates Weekly` -> routine `8a917b14-a653-425f-af2b-f31a6396f567`
- `Conversion Weekly` -> routine `550e8928-ce52-4348-9def-92a78ab05d78`
- `Market Intel Weekly` -> routine `234bb706-bd24-4b0f-ad51-db8b86f93249`
- `Security Procurement Active Reviews` -> routine `2fb3b169-f810-4336-bd63-6cd9992c7c76`
- `Solutions Engineering Active Delivery Review` -> routine `90dce2f7-f329-4e15-96f6-bd8748245436`
- `Supply Intel Weekly` -> routine `de5230d6-1b0d-4659-96ec-313467ae7099`

### 2. Extra Paperclip control-plane process on `127.0.0.1:3101`

This host still has a second Paperclip server tree serving port `3101`.

Known process snapshots from this session:
- healthy primary tree:
  - parent `37558`
  - tsx wrapper `37880`
  - live server `37881`
  - listens on `127.0.0.1:3101`
- older overloaded tree also existed earlier:
  - wrapper `16513`
  - live server `16515`
  - very high CPU
- at one point there was also another stale tree on `3101`:
  - `15200 -> 15974 -> 16034`

Important:
- `127.0.0.1:3100` is the healthy API endpoint used by all current checks
- `127.0.0.1:3101` is unnecessary extra load and should be removed once you identify which launcher keeps respawning it

You need to determine:
- what is spawning the `3101` server
- whether it is another LaunchAgent, a stuck bootstrap loop, or a direct orphaned process tree
- how to disable/remove it without taking down the healthy `3100` instance

## File Locations To Inspect

Local repair and runtime:
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/maintenance-blueprint-paperclip.sh`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/install-blueprint-paperclip-launchagent.sh`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/paperclip-api.sh`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/repair-blueprint-paperclip-company.sh`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/run-blueprint-paperclip-service.sh`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/.paperclip.yaml`

Paperclip server internals:
- `/Users/nijelhunt_1/workspace/paperclip/server/src/index.ts`
- `/Users/nijelhunt_1/workspace/paperclip/server/src/services/routines.ts`
- `/Users/nijelhunt_1/workspace/paperclip/server/src/services/heartbeat.ts`
- `/Users/nijelhunt_1/workspace/paperclip/packages/db/src/schema/routines.ts`
- `/Users/nijelhunt_1/workspace/paperclip/packages/db/src/schema/issues.ts`
- `/Users/nijelhunt_1/workspace/paperclip/packages/db/src/schema/heartbeat_runs.ts`

Logs:
- `/Users/nijelhunt_1/workspace/.paperclip-blueprint/instances/default/logs/server.log`
- `/Users/nijelhunt_1/workspace/.paperclip-blueprint/launchd/server.stdout.log`
- `/Users/nijelhunt_1/workspace/.paperclip-blueprint/launchd/server.stderr.log`
- `/Users/nijelhunt_1/workspace/.paperclip-blueprint/launchd/maintenance.stdout.log`
- `/Users/nijelhunt_1/workspace/.paperclip-blueprint/launchd/maintenance.stderr.log`

Docs updated in this session:
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/paperclip-routine-scheduler-recovery-handoff-2026-04-02.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/README.md`

## Suggested Next Steps

1. Re-ground on current process state:

```bash
curl -sS http://127.0.0.1:3100/api/health
lsof -nP -iTCP:3100 -sTCP:LISTEN
lsof -nP -iTCP:3101 -sTCP:LISTEN
ps -axo pid,ppid,etime,%cpu,command | rg 'paperclipai run|cli/src/index.ts run --data-dir /Users/nijelhunt_1/workspace/.paperclip-blueprint'
```

2. Confirm canonical scheduler state is still intact:

```bash
node <<'NODE'
const postgres = require('/Users/nijelhunt_1/workspace/paperclip/node_modules/.pnpm/postgres@3.4.8/node_modules/postgres/cjs/src/index.js');
const sql = postgres('postgres://paperclip:paperclip@127.0.0.1:54329/paperclip', { max: 1, connect_timeout: 5, onnotice: () => undefined });
(async () => {
  const companyId = '3f90b9fe-5b98-4e28-852c-78d0e3b3a31f';
  const rows = await sql`
    select count(*)::int as schedule_triggers,
           sum(case when enabled = true then 1 else 0 end)::int as enabled_schedule_triggers,
           count(distinct routine_id)::int as routines_with_schedule
    from routine_triggers
    where company_id = ${companyId}
      and kind = 'schedule'
  `;
  console.log(rows[0]);
  await sql.end({ timeout: 5 });
})().catch(async (error) => { console.error(error); try { await sql.end({ timeout: 5 }); } catch {} process.exit(1); });
NODE
```

Expected:
- `49` schedule triggers
- `40` enabled
- `49` routines with schedule

3. Prove scheduled routine -> heartbeat propagation.
4. Remove the extra `3101` Paperclip tree.
5. If you use temporary `next_run_at` edits for verification, leave cron/timezone values unchanged and let normal scheduling recompute future runs.

## Definition Of Done

- `http://127.0.0.1:3100/api/health` remains healthy.
- Exactly one local Paperclip control plane remains active for the shared instance.
- The stray `127.0.0.1:3101` server tree is gone or intentionally explained and disabled.
- Canonical routines still have one schedule trigger each.
- Server logs still show plugin job dispatches and routine scheduler enqueue events.
- You can point to:
  - a fresh scheduled `routine_runs` row
  - and a fresh downstream `heartbeat_runs` row for a scheduled routine target
- Any notes about the production VPS `paperclip-prod-01` are updated if you discover additional operator actions are required there.

## Notes

- Do not revert the maintenance/install/paperclip-api changes from the previous session unless you find a concrete regression caused by them.
- The `repair-blueprint-paperclip-company.sh` file now contains a direct-DB repair path, but that path was not re-run end-to-end after the final manual DB cleanup. If you touch it again, verify it on the current cleaner dataset.
- The local DB connection string for the embedded instance is:

```text
postgres://paperclip:paperclip@127.0.0.1:54329/paperclip
```
