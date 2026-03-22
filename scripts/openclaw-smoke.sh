#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${OPENCLAW_BASE_URL:-}" ]]; then
  echo "OPENCLAW_BASE_URL is not set" >&2
  exit 1
fi

AGENT_PATH="${OPENCLAW_AGENT_PATH:-/agent}"
WAIT_PATH="${OPENCLAW_AGENT_WAIT_PATH:-/agent/wait}"
MODEL="${OPENCLAW_OPERATOR_THREAD_MODEL:-${OPENCLAW_DEFAULT_MODEL:-openai/gpt-5.4}}"
WAIT_TIMEOUT_MS="${OPENCLAW_WAIT_TIMEOUT_MS:-60000}"
TMP_DIR="$(mktemp -d)"
REQUEST_JSON="$TMP_DIR/request.json"
INITIAL_JSON="$TMP_DIR/initial.json"
FINAL_JSON="$TMP_DIR/final.json"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

REQUEST_ID="openclaw-smoke-$(date +%s)"
SESSION_KEY="smoke:$(date +%s)"

python - <<'PY' > "$REQUEST_JSON"
import json, os
payload = {
    "request_id": os.environ["REQUEST_ID"],
    "session_key": os.environ["SESSION_KEY"],
    "task_type": "operator_thread",
    "mode": "sync",
    "inputs": {
        "message": "Return the exact operator-thread JSON shape for a smoke test."
    },
    "startup_context": None,
    "policy": {
        "risk_level": "low",
        "requires_approval": False,
        "allowed_domains": [],
        "allowed_tools": ["api"],
        "allowed_skill_ids": [],
        "forbidden_actions": [],
        "artifact_retention_policy": {
            "retain_logs": True,
            "retain_artifacts": True,
            "retention_days": 1
        }
    },
    "artifacts_config": {
        "artifact_targets": ["json_result", "text_summary", "skill_log"],
        "include_logs": True,
        "include_screenshots": False
    },
    "wait_timeout_ms": int(os.environ["WAIT_TIMEOUT_MS"]),
    "model": os.environ["MODEL"],
    "prompt": """You are a connectivity smoke test for Blueprint.

Return JSON only with this exact shape:
{
  "reply": "OpenClaw connectivity smoke test passed.",
  "summary": "Smoke test completed successfully.",
  "suggested_actions": ["Continue integration"],
  "requires_human_review": false
}"""
}
print(json.dumps(payload))
PY

AUTH_HEADER=()
if [[ -n "${OPENCLAW_AUTH_TOKEN:-}" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${OPENCLAW_AUTH_TOKEN}")
fi

echo "Submitting OpenClaw smoke test to ${OPENCLAW_BASE_URL}${AGENT_PATH}"
curl -fsS \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -X POST \
  --data @"$REQUEST_JSON" \
  "${OPENCLAW_BASE_URL%/}${AGENT_PATH}" \
  > "$INITIAL_JSON"

echo "Initial response:"
cat "$INITIAL_JSON"
echo

RUN_ID="$(python - <<'PY'
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as fh:
    data = json.load(fh)
if not data.get("accepted"):
    raise SystemExit("OpenClaw did not accept the smoke test request")
print(data.get("openclaw_run_id") or "")
PY "$INITIAL_JSON")"

STATUS="$(python - <<'PY'
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as fh:
    data = json.load(fh)
print(data.get("status") or "")
PY "$INITIAL_JSON")"

if [[ -n "$RUN_ID" && "$STATUS" != "completed" && "$STATUS" != "failed" ]]; then
  echo "Waiting for OpenClaw run ${RUN_ID}"
  python - <<'PY' > "$TMP_DIR/wait-request.json"
import json, os
print(json.dumps({
    "openclaw_run_id": os.environ["RUN_ID"],
    "wait_timeout_ms": int(os.environ["WAIT_TIMEOUT_MS"]),
}))
PY
  curl -fsS \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -X POST \
    --data @"$TMP_DIR/wait-request.json" \
    "${OPENCLAW_BASE_URL%/}${WAIT_PATH}" \
    > "$FINAL_JSON"
else
  cp "$INITIAL_JSON" "$FINAL_JSON"
fi

echo "Final response:"
cat "$FINAL_JSON"
echo

python - <<'PY'
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as fh:
    data = json.load(fh)
if data.get("status") != "completed":
    raise SystemExit(f"Smoke test failed with status={data.get('status')} error={data.get('error')}")
result = data.get("result")
if not isinstance(result, dict):
    raise SystemExit("Smoke test did not return an object result")
required = {"reply", "summary", "suggested_actions", "requires_human_review"}
missing = required.difference(result.keys())
if missing:
    raise SystemExit(f"Smoke test result is missing keys: {sorted(missing)}")
print("OpenClaw smoke test passed.")
PY "$FINAL_JSON"
