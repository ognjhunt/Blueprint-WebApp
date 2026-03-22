# OpenClaw Deployment Contract

Blueprint is now wired to treat OpenClaw as the sole agent execution backend. The Blueprint backend remains the business control plane; OpenClaw is the execution sidecar.

## Required environment

Set these on the Blueprint backend:

```bash
OPENCLAW_BASE_URL=https://your-openclaw.internal
OPENCLAW_AUTH_TOKEN=replace_me                     # optional if your service is auth-gated
OPENCLAW_TIMEOUT_MS=20000
OPENCLAW_WAIT_TIMEOUT_MS=60000
OPENCLAW_AGENT_PATH=/agent
OPENCLAW_AGENT_WAIT_PATH=/agent/wait
OPENCLAW_AGENT_CANCEL_PATH_TEMPLATE=/agent/{run_id}/cancel
OPENCLAW_AGENT_ARTIFACTS_PATH_TEMPLATE=/agent/{run_id}/artifacts

OPENCLAW_DEFAULT_MODEL=openai/gpt-5.4
OPENCLAW_WAITLIST_AUTOMATION_MODEL=openai/gpt-5.4
OPENCLAW_INBOUND_QUALIFICATION_MODEL=openai/gpt-5.4
OPENCLAW_POST_SIGNUP_MODEL=openai/gpt-5.4
OPENCLAW_OPERATOR_THREAD_MODEL=openai/gpt-5.4
OPENCLAW_SUPPORT_TRIAGE_MODEL=openai/gpt-5.4
OPENCLAW_PAYOUT_EXCEPTION_MODEL=openai/gpt-5.4
OPENCLAW_PREVIEW_DIAGNOSIS_MODEL=openai/gpt-5.4
OPENCLAW_EXTERNAL_HARNESS_MODEL=openai/gpt-5.4
```

## Required HTTP contract

Blueprint expects these sidecar endpoints:

- `POST /agent`
- `POST /agent/wait`

Blueprint also supports these optional-but-expected endpoints:

- `POST /agent/{run_id}/cancel`
- `GET /agent/{run_id}/artifacts`

The request body sent to `/agent` is shaped like:

```json
{
  "request_id": "uuid",
  "session_key": "string",
  "task_type": "operator_thread",
  "mode": "sync",
  "inputs": {},
  "startup_context": {},
  "policy": {
    "risk_level": "low",
    "requires_approval": false,
    "allowed_domains": [],
    "allowed_tools": [],
    "allowed_skill_ids": [],
    "forbidden_actions": [],
    "artifact_retention_policy": {
      "retain_logs": true,
      "retain_artifacts": true,
      "retention_days": 30
    }
  },
  "artifacts_config": {
    "artifact_targets": [],
    "include_logs": true,
    "include_screenshots": false
  },
  "wait_timeout_ms": 60000,
  "model": "openai/gpt-5.4",
  "prompt": "task prompt"
}
```

The response Blueprint expects from `/agent` and `/agent/wait` is:

```json
{
  "accepted": true,
  "openclaw_session_id": "string or null",
  "openclaw_run_id": "string or null",
  "status": "running",
  "estimated_mode": "sync",
  "result": {},
  "raw_output_text": "optional string",
  "artifacts": {},
  "logs": [],
  "error": null
}
```

## Structured task output requirements

For these Blueprint tasks, `result` must match Blueprint’s strict expected schema:

- `waitlist_triage`
- `inbound_qualification`
- `post_signup_scheduling`
- `support_triage`
- `payout_exception_triage`
- `preview_diagnosis`
- `operator_thread`

If OpenClaw returns different field names, Blueprint will reject the result during schema parsing.

## OpenClaw-side deployment requirements

The OpenClaw deployment should have:

- Browser/computer-use workers for browser tasks
- PDF/document workers for extraction tasks
- Any Blueprint-specific skills/plugins you intend to invoke
- Models configured to satisfy the task-specific env routing above

## Blueprint-side connectivity checks

Admin-only endpoints:

- `GET /api/admin/agent/openclaw/connectivity`
- `POST /api/admin/agent/openclaw/smoke-test`

The smoke-test route performs a real `operator_thread` call through the configured OpenClaw deployment and validates the returned JSON shape.

## Direct smoke test

Run the direct curl smoke test from the repo root:

```bash
bash scripts/openclaw-smoke.sh
```

It uses the current `OPENCLAW_*` environment variables, submits a minimal `operator_thread` request to OpenClaw, optionally waits for completion, and validates the returned result shape.
