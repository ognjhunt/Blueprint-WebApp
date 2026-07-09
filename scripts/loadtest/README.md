# Intake load / soak harness (R043)

Runnable scaffold for audit finding **R043 (P1)**: _"No load/soak test, capacity
model, or cost-per-capture model exists in any repo."_ This is the load-test half.
The capacity + cost model it validates lives at
[`BlueprintCapturePipeline/docs/CAPACITY_AND_COST_MODEL_2026-07-08.md`](../../../BlueprintCapturePipeline/docs/CAPACITY_AND_COST_MODEL_2026-07-08.md).

The script is [`intake-loadtest.k6.js`](./intake-loadtest.k6.js). It exercises the
WebApp intake path:

- `POST /api/robot-eval/job-requests/` — the authenticated eval-job intake
  (`server/routes/robot-eval-job-requests.ts`), Firebase `Authorization: Bearer`.
- `GET /api/robot-eval/job-requests/:jobId/status` — buyer status read (optional poll).
- `GET /health` — unauthenticated readiness probe (always safe).

> **The remaining human/infra step is to actually RUN this at target concurrency
> against a staging URL.** No load test has been executed — this repo only ships the
> harness. Running it and recording the numbers is what closes R043.

## Safety model (why it will not hammer prod by accident)

The harness defaults to **dry mode** and refuses to write unless you opt in twice:

| Setting | Default | Effect |
|---------|---------|--------|
| `MODE` | `dry` | `dry` = read-only (health GET) + build payload in memory, **no POST**. `submit` = POST intake. |
| `ALLOW_INTAKE_WRITES` | `0` | Must be `1` **and** `MODE=submit` before any POST happens. |
| `ALLOW_PROD` | `0` | Against a non-local `https://` host, writes are refused unless this is `1`. Hosts with `localhost` / `127.0.0.1` / `staging` / `.local` count as non-prod. |

So a bare `k6 run intake-loadtest.k6.js` — or any run without `MODE=submit
ALLOW_INTAKE_WRITES=1` — cannot create intake records or trigger pipeline forwarding.
The guard is a safety net, not a substitute for pointing `BASE_URL` at staging.

## Prerequisites

Install k6 (<https://grafana.com/docs/k6/latest/set-up/install-k6/>), e.g.:

```bash
brew install k6            # macOS
# or: sudo apt-get install k6 (after adding the k6 apt repo)
```

You do **not** run this with `node`. `node --check scripts/loadtest/intake-loadtest.k6.js`
only confirms the file has no syntax errors — the `k6/*` imports and `__ENV` globals
are resolved by the k6 runtime, not Node.

## Configuration (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `BASE_URL` | `http://localhost:5000` | Target host. **Point at staging.** |
| `AUTH_TOKEN` | _(empty)_ | Firebase ID token for `Authorization: Bearer`. In non-prod, a value matching `BLUEPRINT_LOCAL_WEBAPP_ROUTE_PROOF_AUTH_TOKEN` also authenticates (see `verifyFirebaseToken.ts`). |
| `INTAKE_PATH` | `/api/robot-eval/job-requests/` | Intake POST path. |
| `STATUS_PATH_TEMPLATE` | `/api/robot-eval/job-requests/__JOB_ID__/status` | Status GET path; `__JOB_ID__` is substituted. |
| `HEALTH_PATH` | `/health` | Read-only readiness probe. |
| `MODE` | `dry` | `dry` or `submit`. |
| `ALLOW_INTAKE_WRITES` | `0` | Second opt-in required for POSTs. |
| `ALLOW_PROD` | `0` | Allow writes to a prod-looking https host. |
| `POLL_STATUS` | `0` | If `1`, GET the status endpoint after each accepted submit. |
| `VUS` / `TARGET_VUS` | `10` | Virtual users to ramp to. |
| `DURATION` | `1m` | Hold time at target (non-soak). |
| `RAMP_UP` / `RAMP_DOWN` | `30s` | Ramp durations. |
| `SOAK` | `0` | If `1`, run a long flat hold instead of a short load ramp. |
| `SOAK_VUS` | `5` | VUs held during soak. |
| `SOAK_DURATION` | `1h` | Soak hold time. |
| `THINK_TIME_S` | `1` | Per-iteration sleep. |
| `P95_MS` | `800` | p95 latency threshold (ms) — run fails if exceeded. |
| `ERROR_RATE_MAX` | `0.01` | Max error rate (1%) — run fails if exceeded. |

## Running it

**1. Dry smoke (safe anywhere, read-only):**

```bash
k6 run scripts/loadtest/intake-loadtest.k6.js
# hits /health only, builds payloads in memory, never POSTs.
```

**2. Load ramp against staging (real intake writes):**

```bash
BASE_URL="https://staging.blueprint.example" \
AUTH_TOKEN="<firebase-id-token>" \
MODE=submit ALLOW_INTAKE_WRITES=1 \
POLL_STATUS=1 \
TARGET_VUS=20 RAMP_UP=1m DURATION=5m RAMP_DOWN=1m \
k6 run scripts/loadtest/intake-loadtest.k6.js
```

Ramping to ~16–20 concurrent is the point of interest: the capacity model projects a
peak of ~13 concurrent uploads and ~16 concurrent pipeline jobs, **above the current
~10 concurrency ceiling** — this run is what confirms or refutes that.

**3. Soak (sustained hold to surface leaks / drift):**

```bash
BASE_URL="https://staging.blueprint.example" \
AUTH_TOKEN="<firebase-id-token>" \
MODE=submit ALLOW_INTAKE_WRITES=1 \
SOAK=1 SOAK_VUS=8 SOAK_DURATION=2h \
k6 run scripts/loadtest/intake-loadtest.k6.js
```

Export machine-readable results for the run record:

```bash
... k6 run --summary-export=loadtest-summary.json \
           --out json=loadtest-raw.json \
           scripts/loadtest/intake-loadtest.k6.js
```

## Reading the results

At the end of the run k6 prints a summary. Focus on:

- **`http_req_duration` / `intake_latency_ms{endpoint:intake}` — p(95)**: must stay under
  `P95_MS`. A `✓` next to the threshold line means it passed; `✗` means it failed and k6
  exits non-zero.
- **`http_req_failed` and `intake_error_rate`**: must stay under `ERROR_RATE_MAX`. A rising
  error rate as VUs climb is the throughput ceiling you are hunting.
- **`intake_submitted` / `intake_errors`**: raw counts of POSTs attempted vs. failed
  (submit mode only).
- **`vus` / `iterations`**: confirm you actually reached target concurrency.

Cross-check against the model: if the observed peak sustainable concurrency is below
~16, the beta does not fit the current envelope and the concurrency cap / pipeline
worker pool must be raised before launch. Feed the observed intake latency, error
onset, and sustainable concurrency back into
`CAPACITY_AND_COST_MODEL_2026-07-08.md` §2 (assumptions) and re-derive §4.

## What is still NOT done (R043 closure)

1. Executing this harness against a real staging environment at target concurrency
   (nothing here has been run).
2. Recording observed p95 / error onset / max sustainable concurrency.
3. Replacing the model's assumption cells with those measured values.

Until then, treat both this harness and the cost model as scaffolding, not proof.
