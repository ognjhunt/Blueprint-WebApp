# Paperclip Org Harness Hardening

Date: 2026-04-10

Scope: Shared Blueprint org-harness fixes for delegation integrity, execution recovery, company separation, model fallback safety, and CI escalation.

## Fix List

### 1. Company Context Separation

- Pin the Blueprint automation harness to an explicit Paperclip company id when multiple Blueprint companies share one instance.
- Include company identity in automation-generated Slack activity so mixed-company alerts are visible at the operator layer.

Acceptance:

- The automation plugin can be pinned with `BLUEPRINT_PAPERCLIP_COMPANY_ID`.
- If no company id is pinned and the company name is ambiguous, automation fails closed instead of attaching to the wrong org.
- Slack activity includes explicit company context.

### 2. Execution-Lock Cleanup

- Clear stale, terminal, missing, or foreign execution locks before creating another unblock child or re-dispatching an issue.
- Treat stale issue execution locks as a shared recovery path, not an agent-local blocker.

Acceptance:

- Blocked issues do not accumulate recursive unblock children just because an old execution lock was left behind.
- Managed issue refresh and execution dispatch clear dead locks before assuming work is still running.

### 3. Invalid Hermes Model Guardrails

- Sanitize invalid or deprecated Hermes free-model ids out of the shared ladder.
- Repair live agent topology when Hermes adapters drift onto invalid or disallowed model ids.

Acceptance:

- Deprecated ids such as `stepfun/step-3.5-flash:free`, `openrouter/free`, and `nvidia/nemotron-3-super:free` are not reused as live Hermes fallback targets.
- Invalid current Hermes models are replaced with the first valid ladder model across the org harness.

### 4. Run / Issue Binding Integrity

- Prefer the bound `taskId` when attributing heartbeat runs to issues.
- Do not attribute a run to an issue via activity logs when the run is explicitly bound to a different issue.

Acceptance:

- Issue run history reflects the run's real bound task first.
- Cross-issue activity during a run does not make run attribution ambiguous.

### 5. CI Escalation Behavior

- CI watch issues must not stop at passive monitoring when failure is still active.
- Generic `Unblock ...` CI follow-ups owned by a watch lane must escalate into concrete implementation work.

Acceptance:

- CI failure issue text requires a fast green-check first, then diagnosis and engineering unblock work if still failing.
- A blocked generic CI unblock issue can escalate into `Implement unblock path ...` instead of terminating in monitor-only status.
