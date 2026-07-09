# Shared robot-eval contract pinning & fail-closed gate (R029)

Status: implemented 2026-07-09. Owner: blueprint-cto / launch gate.

## What this protects

`robot_eval_job_request.v1` (and its inbox contract `robot_eval_job_request_inbox.v1`)
is a **cross-repo** contract owned by `BlueprintContracts`. Both Blueprint-WebApp
(queue-and-forward surface) and BlueprintCapturePipeline (scheduler/executor) must
validate against the **same** shared module, never against an independent hardcoded
copy. R029 (P1) flagged that the parity gate could silently run on a per-repo fallback
copy when the shared module was absent, so drift could ship undetected.

## The pin (single source of truth)

Both repos pin the same `BlueprintContracts` revision. Keep these in lockstep:

| Repo | Pin location | Current value |
| --- | --- | --- |
| Blueprint-WebApp | `.github/workflows/ci.yml` -> `CONTRACTS_REF` | `7708a4e4c5dedeeb39cc73d3f6869304de295b81` |
| BlueprintCapturePipeline | `pyproject.toml` -> `blueprint-contracts @ git+...@<sha>` | `7708a4e4c5dedeeb39cc73d3f6869304de295b81` |

When bumping the contract, update **both** pins in the same coordinated change.

## The fail-closed gate

Both verify scripts honor the same environment flag:

```
BLUEPRINT_REQUIRE_SHARED_ROBOT_EVAL_CONTRACT=true
```

- **Truthy** (`1`/`true`/`yes`/`on`): if the shared `BlueprintContracts` module cannot
  be loaded, the gate **fails closed** (non-zero exit, distinct blocker) instead of
  degrading to a copy.
  - WebApp (`scripts/pipeline/verify-robot-eval-job-request-contract.ts`): emits
    blocker `shared_contract_required_but_unavailable` and `shared_contract_required: true`.
  - Pipeline (`src/blueprint_pipeline/robot_eval_job_request_contract.py`): raises at
    import; `require_shared_robot_eval_job_request_contract()` raises if the source is
    the local fallback rather than `blueprint_contracts`.
- **Unset** (local/dev default): behavior is unchanged and backward compatible. The
  WebApp gate still exits non-zero on a hard load failure (generic
  `shared_contract_load_failed`); the Pipeline adapter still imports and, only if the
  shared module is genuinely missing, degrades to its fallback constants so local dev
  keeps running.

## Where the flag is set

- **WebApp CI**: `.github/workflows/ci.yml`, "Verify shared robot-eval job request
  contract" step sets `BLUEPRINT_REQUIRE_SHARED_ROBOT_EVAL_CONTRACT: "true"` after
  checking out `BlueprintContracts` at `CONTRACTS_REF` and passes it via
  `--contracts-module BlueprintContracts/js/robot-eval-job-request.mjs`.
- **Pipeline CI** (`ci.yml`, `full-test-lane.yml`, `sim-only-local-gate.yml`): checks
  out and installs `BlueprintContracts` at the pinned ref, then runs
  `scripts/verify_robot_eval_job_request_contract.py`, which **forces** the flag to
  `true` internally so the gate is always strict in CI.

## Launch requirement (remaining config step)

The **launch/release gate must export `BLUEPRINT_REQUIRE_SHARED_ROBOT_EVAL_CONTRACT=true`**
in every environment that runs either verify script (or any pipeline entrypoint that
depends on the shared contract). CI is already wired above; this note documents that
the same flag must be present in the launch gate's environment so a stale or missing
pin can never fall back to a per-repo copy at release time.
