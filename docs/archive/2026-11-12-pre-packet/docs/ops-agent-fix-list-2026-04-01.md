# Ops Agent Fix List

This fix list turns the April 1, 2026 Paperclip failure audit into four concrete workstreams.

## 1. Paperclip Stability / Embedded Postgres Restarts

### Goal

Stop `process_lost` heartbeat failures caused by Paperclip restarts and local DB lock/startup races.

### Observed Failures

- `63` failed heartbeats with `Process lost -- server may have restarted`
- `5` additional failed heartbeats with lost child PIDs
- launchd maintenance loop parsing empty JSON and probing the wrong local API port
- embedded Postgres startup errors in server stderr:
  - empty `postmaster.pid`
  - failed embedded Postgres startup on `54329`
  - null socket write crash after startup failure

### Immediate Fixes

1. Move the shared Paperclip instance off embedded Postgres.
   - Add a real `DATABASE_URL` to the Paperclip env file used by launchd.
   - Rationale: the current shared instance is no longer a good fit for embedded Postgres.
   - Control point: `/Users/nijelhunt_1/workspace/paperclip/server/src/index.ts`

2. Normalize Paperclip local API defaults across all Blueprint scripts.
   - Keep one canonical port for this shared instance.
   - Today bootstrap uses `3100`, but reconcile/verify/smoke use `3101`.
   - Control points:
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh`
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh`
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/verify-blueprint-paperclip.sh`
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/smoke-blueprint-paperclip-automation.sh`

3. Make maintenance scripts tolerate empty or unavailable API responses.
   - Replace direct `JSON.parse(text)` on curl output with:
     - a non-empty-body check
     - a retry/backoff path
     - a clearer health-check failure message
   - Primary control point:
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh`

### Root-Cause Fixes In Paperclip

1. Harden empty/stale `postmaster.pid` handling.
   - Current logic removes any existing pid file before startup.
   - Add a wait/recheck path before deleting the lock file when the file exists but startup may still be in progress.
   - Control point:
     - `/Users/nijelhunt_1/workspace/paperclip/server/src/index.ts`

2. Add a startup regression test for the empty-`postmaster.pid` case.
   - The failure signature is already known from logs.
   - Add coverage in the Paperclip server/db startup tests.

3. Investigate the `socket.write` null crash after DB startup failure.
   - Treat this as a shutdown/cleanup bug after embedded Postgres startup fails.
   - Control point:
     - `/Users/nijelhunt_1/workspace/paperclip/server/src/index.ts`

### Verification

1. Restart the launchd service once the env and port fixes are in place.
2. Confirm `/api/health` stays stable for 30+ minutes.
3. Confirm zero new `process_lost` heartbeats over one heartbeat window.
4. Confirm maintenance stderr no longer shows empty-JSON parse loops.

## 2. Routine Idempotency On Capture/Pipeline Autonomy Loops

### Goal

Stop the autonomy loops from generating failed routine runs when a live routine-execution issue already exists.

### Observed Failures

- `355` failed routine runs
- all failures were:
  - `duplicate key value violates unique constraint "issues_open_routine_execution_uq"`
- affected routines:
  - `Capture Codex / Capture Autonomy Loop` (`182`)
  - `Pipeline Codex / Pipeline Autonomy Loop` (`173`)

### Immediate Fixes

1. Reduce trigger storming while the code fix is being prepared.
   - Review the cadence and wake sources for:
     - `Capture Autonomy Loop`
     - `Pipeline Autonomy Loop`
   - If they are being re-fired faster than an execution issue can settle, throttle them temporarily.

2. Verify the routines are not unintentionally set to `always_enqueue`.
   - The unique-constraint fallback only coalesces if the routine is not `always_enqueue`.

### Code Fixes

1. Keep the existing unique-constraint catch, but make the post-conflict recovery deterministic.
   - Today the code re-queries `findLiveExecutionIssue()` after the insert conflict.
   - If the conflicting row is not visible yet, the code rethrows and records a failed routine run.
   - Control point:
     - `/Users/nijelhunt_1/workspace/paperclip/server/src/services/routines.ts`

2. Add a retry/read-after-conflict path before rethrowing.
   - Suggested behavior:
     - catch `issues_open_routine_execution_uq`
     - retry `findLiveExecutionIssue()` a few times with short backoff
     - if found, finalize the run as `coalesced`
     - only fail if the issue is still missing after retries

3. Consider a stronger lock around issue creation.
   - Best long-term fix:
     - take a transaction-scoped advisory lock keyed on `routine.id`
     - then do `findLiveExecutionIssue()` plus issue creation inside the lock
   - That removes the race instead of just handling it better after the fact.

4. Extend the concurrency tests.
   - Add tests that hammer the same routine from parallel triggers and assert:
     - one `issue_created`
     - the rest `coalesced`
     - zero `failed`
   - Existing test area:
     - `/Users/nijelhunt_1/workspace/paperclip/server/src/__tests__/routines-service.test.ts`

### Verification

1. Re-run the two autonomy loops under parallel trigger load.
2. Confirm routine status shifts from `failed` to `coalesced`.
3. Confirm the `issues_open_routine_execution_uq` failures drop to zero.

## 3. Connector Auth Cleanup For GitHub And Google Calendar

### Goal

Restore the external connectors that agents depend on for repo/CI context and booking workflows.

### Observed Gaps

- GitHub runtime connector showed `failed`
- Google Calendar runtime connector showed `needs-auth`
- Firebase/Firestore was connected
- No last-24-hour failures were caused by missing Firestore access

### GitHub Cleanup

1. Re-auth the GitHub connector used by Claude-facing agent runtimes.
   - This is the runtime connector problem surfaced in the run transcripts.
   - This is not fixed by repo code alone.

2. Confirm the Blueprint automation plugin still has its server-owned GitHub secrets.
   - Env keys:
     - `BLUEPRINT_PAPERCLIP_GITHUB_TOKEN`
     - `BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET`
     - `BLUEPRINT_PAPERCLIP_GITHUB_OWNER`
   - Control points:
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-paperclip.env.example`
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/configure-blueprint-paperclip-plugin.sh`

3. Re-run plugin configuration and webhook setup.
   - Commands/scripts:
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/configure-blueprint-paperclip-plugin.sh`
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/setup-github-webhooks.sh`

### Google Calendar Cleanup

1. Re-auth the `claude.ai Google Calendar` connector.
   - This directly affects `field-ops-agent`.
   - The current failure is connector auth, not a missing repo env var.

2. Run one targeted Field Ops heartbeat after re-auth.
   - Verify a booking/reschedule path that requires Calendar access.

### Verification

1. GitHub connector status becomes healthy in run transcripts.
2. Google Calendar no longer shows `needs-auth`.
3. `field-ops-agent` can complete a calendar-backed task.
4. GitHub-dependent agents can retrieve repo/CI state without connector errors.

## 4. Fallback Model Routing Cleanup For Claude-Facing Agents

### Goal

Stop Claude-facing agents from inheriting incompatible model IDs when they fall back to Hermes/OpenCode/Codex.

### Observed Failures And Degradations

- failed heartbeat:
  - `OpenCode requires adapterConfig.model in provider/model format` (`Intake Agent`)
- succeeded but degraded:
  - unsupported model sent to Codex fallback:
    - `Intake Agent` (`9`)
    - `Capture Claude` (`1`)
    - `Pipeline Claude` (`1`)
    - `WebApp Claude` (`1`)
- succeeded but degraded:
  - Codex usage limit reached:
    - `blueprint-chief-of-staff` (`92`)
    - `Ops Lead` (`1`)
    - `WebApp Codex` (`1`)

### Root Cause To Check First

The reconcile script appears to generate good fallback adapter configs, but Paperclip runtime merging can still carry the original execution profile/model into the chosen fallback adapter.

Likely interaction:

- fallback configs are authored in:
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh`
- runtime merge logic lives in:
  - `/Users/nijelhunt_1/workspace/paperclip/server/src/services/adapter-fallback.ts`

### Fixes

1. Make fallback selection adapter-specific at runtime.
   - In `buildExecutionConfigForAdapter()`, ensure the selected fallback adapter does not inherit the primary adapter's model unless it is explicitly valid for that adapter.
   - Control point:
     - `/Users/nijelhunt_1/workspace/paperclip/server/src/services/adapter-fallback.ts`

2. Populate `executionPolicy.perAdapterConfig` explicitly for fallback adapters.
   - For Claude-based agents, define adapter-specific models for:
     - `codex_local`
     - `hermes_local`
     - `opencode_local`
   - That keeps runtime merge deterministic.
   - Control points:
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh`
     - `/Users/nijelhunt_1/workspace/paperclip/server/src/services/adapter-fallback.ts`

3. Keep OpenCode models in `provider/model` format everywhere.
   - Current expected form is already documented and enforced.
   - Control points:
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-paperclip.env.example`
     - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/quota-fallback.ts`

4. Revisit fallback order for Claude-facing operational agents.
   - If Codex quota is frequently exhausted, do not route Claude-facing agents through a Codex fallback that is already rate-limited.
   - Suggested order for affected lanes:
     - `claude_local -> hermes_local -> opencode_local`
   - This is especially relevant for `blueprint-chief-of-staff` and `Intake Agent`.

5. Add regression tests for cross-adapter model inheritance.
   - Cases to cover:
     - `claude_local` agent falling back to `codex_local`
     - `claude_local` agent falling back to `hermes_local`
     - `claude_local` agent falling back to `opencode_local`
   - Assert the final config uses a model valid for the selected adapter.

### Verification

1. Reconcile the company after changing fallback config generation.
2. Trigger one heartbeat each for:
   - `Intake Agent`
   - `Capture Claude`
   - `Pipeline Claude`
   - `WebApp Claude`
3. Confirm no run transcript sends `claude-sonnet-4-6` to `openai-codex`.
4. Confirm no fallback run errors on `provider/model` validation.
