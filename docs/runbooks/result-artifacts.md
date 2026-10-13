# Result artifacts: diagnosing "Result artifact registry is unavailable"

The result page streams videos and downloads through the web service. For a
v4 publication, `POST /api/task-evaluation-results/:recordId/artifacts/:artifactId/ticket`
first probes the Pipeline per-run artifact registry with a signed one-byte
Range read (`server/utils/taskEvaluationResultArtifactProxy.ts`). Any failure
other than a 404 returns 503 `Result artifact registry is unavailable`.

The web service never reads registry or offload records directly. Offloaded
evidence is served by the Pipeline registry endpoint like any other artifact.
If the registry and offload records exist but the 503 persists, the web service
cannot reach or authenticate to that endpoint, or the endpoint's response fails
the integrity check.

## What the 503 now says

The 503 body carries a `code` and, for configuration gaps, `missingConfig`
naming the variables to set. The proxy logs the same code with `runId` and
`artifactId` under the message `Result artifact registry is unavailable`.
Neither the body nor the log contains a URL, token or record data.

| `code` | Meaning | Fix |
| --- | --- | --- |
| `artifact_registry_endpoint_not_configured` | No registry endpoint resolves | Set one of the variables listed below |
| `artifact_registry_template_invalid` | `TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE` lacks `{run_id}` or `{artifact_id}` | Correct the template or unset it |
| `artifact_registry_signing_token_not_configured` | No signing token | Set `ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN` |
| `artifact_registry_credentials_rejected` (`originStatus` 401/403) | Pipeline refused the signature | Make the WebApp token match Pipeline's `blueprint-webapp` client secret |
| `artifact_registry_origin_error` (`originStatus`) | Pipeline answered non-2xx (other than 404) | Check the Pipeline registry service logs for that status |
| `artifact_registry_redirect_refused` | Pipeline answered with a redirect | Redirects are refused so credentials cannot leave the Pipeline host. Pipeline must serve the bytes |
| `artifact_registry_unreachable` / `artifact_registry_timeout` | Network failure or no headers within 15 s | Check the host, DNS and egress from the web service to Pipeline |
| `artifact_registry_empty_response` | 2xx without a body | Pipeline registry bug |
| `artifact_registry_digest_header_missing` | No `x-blueprint-artifact-sha256` header | Pipeline must send the sealed digest header |
| `artifact_registry_digest_mismatch` | Served digest differs from the publication | The stored object is not the published artifact. Do not bypass this |
| `artifact_registry_range_or_size_mismatch` | Range or size disagrees with the publication | Same as above |

`code: result_download_ticket_secret_not_configured` (missing
`TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET`) is a separate 503 returned
after a successful probe.

## Endpoint resolution (web service)

In precedence order:

1. `TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE`, which must contain `{run_id}` and `{artifact_id}`
2. `TASK_EVALUATION_RUN_EXECUTE_URL`, only when it ends in `/execute`
3. The canonical launch URL: `TASK_EVALUATION_LAUNCH_URL`, or, as launches
   resolve it, `ROBOT_EVAL_JOB_REQUEST_FORWARD_URL` ending in
   `/api/live-pipeline/job-requests`. This becomes
   `/api/live-pipeline/task-evaluation-runs/{run_id}/artifacts/{artifact_id}`.

Until 2026-10-13 step 3 ignored `ROBOT_EVAL_JOB_REQUEST_FORWARD_URL`. A deployment
that launched runs through the job-request URL, which is the documented
production default, resolved no artifact endpoint, so every ticket probe
returned this 503. That is the most likely code-side cause of the observed 503.
It is fixed in code. If the 503 continues after deploy, its `code` names the
remaining live cause.

## Readiness

`buildLaunchReadinessSnapshot()` (`/health/ready`) carries a `resultArtifacts`
launch check. When the endpoint, signing token or ticket secret is missing,
it appears under `warnings` with the exact variable names. The check is
deliberately not a blocker, so it cannot fail the deploy health gate. It checks
configuration only. Reachability and integrity are checked on each request.

## Checking a live service

1. Read `/health/ready` and look for a `resultArtifacts:` warning.
2. Request a ticket for a known v4 result artifact as its owner and read
   `code`, `missingConfig` and `originStatus` from the 503 body.
3. Search the web service logs for `Result artifact registry is unavailable`
   and the same `code`.

None of these steps bypass authorization or change any record.
