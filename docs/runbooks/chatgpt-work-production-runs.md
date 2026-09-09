# ChatGPT Work production-run connection

ADP-009D; day-14 two-candidate execution receipts and day-28 complete replay.
The missing seam is authenticated cloud access to the existing Website launch
and controller evidence APIs. This adapter reuses Firebase operator authority,
Firestore, the Website launch records, signed forwarding, and the canonical
Pipeline paid allocator. It adds no provider credentials or execution backend.

## Deploy and connect

1. Merge only after typecheck, the focused Work OAuth/HTTP/operation tests,
   existing launch/progress regressions, the consent browser test and hosted CI.
   Use the existing CI-gated Render deployment, and verify `/version.json`.
2. Set `BLUEPRINT_WORK_ENABLED=true` on the Website service. Optional
   `BLUEPRINT_WORK_PUBLIC_ORIGIN` is an exact HTTPS origin; production defaults
   to `https://tryblueprint.io`. The worker needs no new configuration. Do not
   put a Vast or OpenAI credential in ChatGPT environment variables.
3. Read `/api/blueprint-work/health` and
   `/.well-known/oauth-protected-resource/api/blueprint-work/mcp`. Unauthenticated
   POSTs to `/api/blueprint-work/mcp` must return 401 with resource metadata.
4. In ChatGPT, enable developer mode when permitted for the account. Keep CSP
   enforcement enabled. Add a private remote MCP connection at
   `https://tryblueprint.io/api/blueprint-work/mcp`; select OAuth and dynamic
   client registration. No client secret or subscription key is needed.
5. Sign in on the existing Blueprint login page. The consent page shows exactly
   the requested read, prepare, launch and release permissions. Only current
   Firebase Admin-managed `admin`/`ops` identities can approve or use the app.
   Browser profile fields, launch-lab tokens and local fake auth are not accepted.
6. Open a new **cloud Work** task with the app. Call `list_launch_profiles`,
   `list_runs`, `get_run_status` and `get_supervision_status`. Retrieve the same
   launch from another task to prove the connection is independent of a laptop.
7. Before a paid canary, inspect live controller identity, chain preflight,
   active ownership, supervision, spend/TTL and teardown. A successful OAuth
   connection or Website preflight does not prove those conditions. Launch only
   with a named immutable profile and explicit budget/expiry authorization.

## Tools and evidence boundaries

- `preflight_run` validates existing launch input and saves its exact request,
  actor, profile/request digests and timestamp for five minutes. It does not
  enqueue a GPU request. `submit_run` accepts only that preflight ID plus explicit
  execution confirmation, revalidates it, and uses the existing transactional
  Website submission. Retries retain the same launch ID and request bytes.
- `prepare_run`, `get_preparation_status`, `activate_prepared_run` and
  `get_activation_status` expose existing preparation and activation handlers.
  Activation can lead to spending and requires the launch permission.
- `list_runs` and `get_run_status` return durable Website observations. Stale
  progress is not a healthy GPU heartbeat; report its timestamp.
- `get_run_logs` provides paginated signed lifecycle events retained after this
  release. It does not provide arbitrary host files or raw GPU stdout. Older
  runs are not retroactively backfilled. Native policy-run events are retained
  under their original policy-run records rather than copied into launch data.
- `get_run_artifacts` reads the existing verified Website result publication;
  it accepts the Website result record ID. Media and full receipts remain on
  the result page and use the established integrity-checked download paths.
- `request_resource_release` is the existing **terminal-only** operation: it
  can clean up one already stopped Vast resource with an exact launch/instance/
  label binding. It cannot stop an active GPU, reset a queue, retry an evaluation
  or bypass the canonical allocator. General active-run cancellation is not
  exposed by this version.
- Tool responses are bounded, redacted presentation projections, not original
  digest-verifiable receipts. No arbitrary URL, shell, SSH, environment variable
  or secret-reading tool is exposed.

## Authentication and storage

The MCP SDK supplies OAuth HTTP handlers and stateless Streamable HTTP transport.
The authorization provider wraps existing Firebase sign-in; it does not collect
passwords or forward OpenAI account credentials. Authorization codes use S256
PKCE, expire after two minutes, and are atomically consumed. OAuth clients are
restricted to the documented ChatGPT callback URLs; the server never fetches
user-supplied client metadata URLs. The exact MCP resource is checked on code
and refresh exchanges. Access tokens expire after 15 minutes; refresh tokens
rotate, cannot increase scope, and replay revokes the connection. Grants expire
after 30 days. Current Firebase operator claims, disabled status and login
revocation are checked on every access-token verification and refresh.

`blueprintWorkOAuth` is server-only under the existing Firestore default-deny
rules. Bearer tokens, refresh tokens, code/flow handles are stored as SHA-256
lookup keys, not plaintext. Grant identities and request/audit digests are
retained privately. Audit records store actor, client, tool, argument digest and
response status, never raw tool inputs or credentials. Pending audit records
without a completion are ambiguous: reconcile the launch, do not auto-retry.
OAuth route logs omit query values and consent handles.

Disconnect through ChatGPT's OAuth revocation flow, remove the user's
server-managed operator role, revoke their Firebase login sessions, or set
`BLUEPRINT_WORK_ENABLED=false` to disable the whole connection. Disabling Work
does not terminate runs; the controller must continue supervising them.

## Verification

```sh
npm run check
npx vitest run server/tests/blueprint-work-*.test.ts server/tests/admin-task-evaluation-launches.test.ts server/tests/task-evaluation-launch-progress.test.ts
VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1 BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER=1 PLAYWRIGHT_PORT=4189 npx playwright test e2e/blueprint-work-connect.spec.ts --reporter=line
```

The first two commands protect auth, scope, immutable submission and existing
launch-state behavior. The browser test uses mocked API responses and protects
explicit consent, CSRF and expired-request recovery without external access.
The HTTP tests use the real MCP SDK client and transport over loopback, including
dynamic registration, Firebase-consent boundary, PKCE and token exchange.

Completion requires a cloud-originated, explicitly authorized canary with
durable receipts, readable outputs, billing reconciliation and provider-confirmed
teardown. Code/tests, deployment, account linking and scientific proof are
separate states.

Official references: [Work MCP connections](https://learn.chatgpt.com/docs/extend/mcp),
[MCP authentication](https://developers.openai.com/plugins/build/auth).
