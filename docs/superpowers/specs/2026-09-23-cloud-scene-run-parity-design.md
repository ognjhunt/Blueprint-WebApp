# Cloud scene-run parity: design

Date: 2026-09-23. Status: approved by the founder (host access "read + deploy",
agent sign-in through the service account, host install gated on a second
confirmation).

## Revision after security review (2026-09-23)

The review found that `stage-replay` (operate scope) and canary deploys
(deploy scope) both ran unreviewed pushed code as root on the host. Both were
removed before install:

- The door deploys and self-upgrades only commits already on `origin/main`,
  with no `mode` field. A `deploy` token can therefore ship merged code and
  nothing else.
- A failed stage is replayed inside the cloud session against inputs pulled
  through the door (runbook step 6), where the VM has no provider credentials.
- The root runner has no capabilities. Everything root writes under the spool
  is root-owned, and only `pending/` is writable, through a `blueprint-door`
  group that only the door unit has.

Where the sections below mention `stage-replay`, canary mode or
`CAP_DAC_OVERRIDE`, this revision supersedes them. The Pipeline repo's
`docs/OPERATOR_DOOR.md` describes the installed design.

## Goal

A Claude Code cloud session (claude.ai/code, Anthropic-hosted VM) can start and
drive a website scene end to end with the same practical access a session on
the founder's Mac has: both repositories with working toolchains, the source
video, the website (account-free upload and the signed-in robot-team step),
the Firestore authority, host observation, isolated stage replays, and host
deploys.

Non-goals: provider keys in the cloud VM (they stay on the host), a shell or
root on the host from the cloud, and replacing the Mac or Codex lanes.

## What the audit and probes established

- Cloud sessions run as root on Ubuntu 24.04 and clone each selected repository
  to `/home/user/<repo>` as a shallow checkout. The existing "Blueprint"
  environment has no setup script. Egress goes through an HTTPS proxy that
  terminates TLS, so SSH to `174.138.76.111` has no path.
- A cloud environment can hold an API credential for a host. The proxy adds it
  as `Authorization: Bearer <value>` after the request leaves the VM, so the VM
  never sees it. Scoping is per host, not per path.
- 11,749 SSH commands from Sep 10 to 23 show what a run actually needs from the
  host: reading run-state JSON and logs, listing directories, `systemctl show`
  and `journalctl` on about seven controller units, the deploy cycle, starting
  controller oneshots, pausing and resuming timers around deploys, downloading
  receipts and artifacts, and isolated stage replays. Shell-level debugging
  (py-spy, /proc, env sourcing, jumping into GPU pods) was rare and is out of
  scope.
- Secrets on the host are not confined to `/etc/blueprint/provider-secrets`.
  Env files and backups under `/etc/blueprint` (216 entries) are readable by the
  `blueprint` service account, and `/var/lib/blueprint/pipeline-control-plane`
  holds `.env` files, a GCP service-account key and forwarded-token JSON.
- Recent deploys run the target commit's `deploy_control_plane_commit.py` with
  `--iteration --canary --preserve-configured-controls-state`. The last flag keeps
  the owner's configured-controls pause; the repo's wrapper scripts do not pass
  it, so the operator door must not call them.
- The live `/etc/caddy/Caddyfile` names the host literally and differs from the
  repository copy, so the door installer patches the live file in place.

## Architecture

### 1. Operator door (BlueprintCapturePipeline, runs on the host)

A standalone, stdlib-only Python service, independent of pipeline releases so a
broken release cannot lock cloud sessions out.

- **Listener:** `127.0.0.1:8767`, published by Caddy at
  `/api/live-pipeline/operator/*`. Caddy terminates TLS; the door never listens
  publicly.
- **Auth:** `Authorization: Bearer <token>`. The host stores only SHA-256 hashes
  in `/etc/blueprint-operator-door/tokens.json` with a name and scopes per token
  (`read`, `operate`, `deploy`). Comparison is constant-time. Every request,
  allowed or refused, is appended to an audit log.
- **Process:** `blueprint-operator-door.service`, `User=blueprint` (the pipeline
  writes state with `UMask=0077`, so only that account can read it), plus the
  `systemd-journal` group for journal reads. Strict sandbox: read-only
  filesystem except its own state directory, loopback-only networking, no
  capabilities, and `InaccessiblePaths=` for known secret locations.
- **Secret handling, three layers:** (1) systemd hides the known secret
  directories and files; (2) the file API refuses names that look like secrets
  (`*.env`, `*secret*`, `*token*`, `*credential*`, `*service-account*`, key and
  certificate extensions); (3) every served byte range, archive member and
  journal line passes a content scanner for private keys and credential-shaped
  values. Refused files are reported by name, never by content.
- **Read API (`read` scope):** `whoami`, `status` (deployed commit and blockers
  from loopback `/version`, active release, deploys in flight, paid-launch lock
  holders from `/proc/locks`, spend-guard summary, failed and running
  controller units, timers, disk, load), `fs/list`, `fs/read` (byte ranges),
  `fs/archive` (tar.gz, size-capped), `journal`, `units`, and request status.
- **Privileged requests:** the door writes a validated JSON request into a spool.
  A root oneshot, `blueprint-operator-door-runner.service`, triggered by a
  `.path` unit (the same pattern as the policy-canary dispatcher), revalidates
  and executes it:
  - `deploy` (`deploy` scope): commit must be pushed; `main` mode requires an
    ancestor of `origin/main`, `canary` mode allows any pushed ref. The runner
    starts a transient unit that fetches into one persistent door source clone,
    optionally waits for the progression oneshots to go idle, runs the target
    commit's `deploy_control_plane_commit.py --iteration [--canary]
    --preserve-configured-controls-state`, and records exit status, receipt and
    log. Refused while another deploy unit is active.
  - `unit` (`operate` scope): `start` or `reset-failed` a `blueprint-*`
    service, timer or path; `stop` or `restart` only timers and paths (pausing
    triggers never kills a running job).
  - `stage-replay` (`operate` scope): `task_evaluation_stage_replay --child
    <id> --isolate` from a pushed candidate commit, never `--allow-paid`.
  - `door-upgrade` (`deploy` scope): reinstall the door from a main commit, keep
    the previous version for rollback, verify health, roll back on failure.
- **Client:** `scripts/operator_door.py` (stdlib), usable from cloud and Mac:
  `status`, `ls`, `cat`, `pull`, `journal`, `units`, `deploy --wait`, `unit`,
  `replay`, `request`, `whoami`. It sends no Authorization header when the
  proxy injects the credential.
- **Install:** `deploy/operator-door/install.sh` (root, idempotent): installs
  code to `/opt/blueprint/operator-door`, units, state directories, and the
  Caddy route; validates and reloads Caddy; health-checks; never overwrites
  tokens. Token issue: the Mac generates the token into
  `~/.blueprint-secrets/operator_door_token` without printing it, and only its
  hash goes to the host.

### 2. Cloud environment "Blueprint scene runs" (claude.ai, created by the founder)

- Network: Custom, with the default package-manager list, plus `tryblueprint.io`,
  `*.tryblueprint.io`, Firebase/Google identity hosts, the Playwright browser
  CDN and `download.pytorch.org`.
- Environment variables: `FIREBASE_SERVICE_ACCOUNT_JSON`,
  `BLUEPRINT_CLOUD_OPS_EMAIL`, and the public `VITE_FIREBASE_*` web config.
- API credential: the operator door token for `paperclip.tryblueprint.io`.
- Setup script: one line that runs the WebApp's
  `scripts/cloud/setup-environment.sh`.

### 3. Repository tooling (Blueprint-WebApp)

- `scripts/cloud/setup-environment.sh`: root, cached, time-boxed, never fails
  the session. Installs ffmpeg, MuJoCo GL libraries, uv 0.10.7, the Pipeline
  virtualenv (outside the clone), CPU torch, WebApp node modules and Playwright
  Chromium.
- `scripts/cloud/bootstrap.sh`: idempotent in-session completion of the above
  and git history deepening; writes an env file for later shells.
- `scripts/cloud/doctor.sh`: checks every dependency (tools, repos, network,
  door access and scopes, Firestore access, Chromium launch) and prints what is
  missing with the fix.
- `scripts/cloud/fetch-media.ts`: fetch a source video from `gs://` (service
  account) or `https://`, verify SHA-256 and print an ffprobe summary.
- `scripts/cloud/ops-session.ts`: mint a session for the allowlisted ops
  account from the service account; write a 0600 ID-token file for API calls
  and a Playwright storage state (IndexedDB and localStorage) for the browser.
  Never prints tokens.
- `docs/runbooks/cloud-scene-runs.md`: environment values, the kickoff link,
  the generalized 14-step scene procedure, and the constraints the lanes
  learned. `CLAUDE.md` points cloud agents at it; a SessionStart hook runs
  bootstrap in single-repo cloud sessions.

## Data flow of a cloud-driven run

1. The founder opens the saved link; the session starts with both repositories
   in the "Blueprint scene runs" environment and runs `bootstrap.sh` and
   `doctor.sh`.
2. The agent fetches the video (`fetch-media.ts`) or creates the intake and
   hands the founder the tokenized upload link.
3. Upload and task intake go through the website with headless Chromium.
4. The agent reads the sponsorship and ledger (door `fs/read`, or Firestore),
   amends the preparation limit with the existing script, and watches stages
   through `status`, `fs` and `journal`.
5. Fixes go through PRs; the Pipeline fix is deployed with `operator_door.py
   deploy --wait`; failed stages are replayed with `replay`.
6. Step 13 runs in the browser with the ops session from `ops-session.ts`.
7. Results are verified on the website task page.

## Error handling

- The door returns structured JSON errors with stable codes; refusals name the
  rule (`scope_missing`, `path_outside_roots`, `secret_name_refused`,
  `secret_content_refused`, `deploy_in_progress`, `commit_not_on_main`, and so
  on).
- The runner never trusts the spool: it revalidates every field, opens files
  with `O_NOFOLLOW`, caps sizes, and records a result for every request,
  including refusals.
- Setup never fails a session start; `doctor.sh` is where failures surface.

## Testing

- Pipeline: hermetic pytest for auth, scopes, path confinement (traversal,
  symlink escape, secret names, secret content), status assembly with fake
  command runners, spool validation, runner command construction for each
  request kind, and unit hardening properties. The systemd contract, Caddy edge
  and storage-root tests are extended deliberately for the new units and route.
- WebApp: vitest for the pure helpers (SHA-256 verification, storage-state
  construction, email allowlist) and shellcheck-clean scripts.
- End to end: after the host install, a cloud routine in the new environment
  runs `doctor.sh` and must report every check green, and reads door `status`.

## Security posture

- The cloud VM never holds a host credential: the door token is injected by the
  proxy. The Firebase service account is an environment variable in a dedicated
  environment, which is the same authority the Mac lanes already use.
- The door cannot read provider secrets, env files or keys, cannot run arbitrary
  commands, and can only trigger the fixed deploy, unit and replay operations
  after revalidation by root. A leaked token is revoked by deleting its hash.
