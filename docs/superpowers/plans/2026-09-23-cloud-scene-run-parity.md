# Cloud Scene-Run Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Claude Code cloud session start and drive a website scene end to end with near-local access: toolchains, source media, website sign-in, Firestore authority, host observation, isolated replays and host deploys.

**Architecture:** A stdlib-only "operator door" on the control-plane host exposes a token-authenticated HTTPS API behind Caddy (read endpoints served by an unprivileged sandboxed process, privileged actions spooled to a root oneshot). The WebApp repository carries the cloud-environment setup, bootstrap, doctor, media and sign-in tooling plus the runbook. Spec: `docs/superpowers/specs/2026-09-23-cloud-scene-run-parity-design.md`.

**Tech Stack:** Python 3.10+ stdlib (host door, client), systemd 255, Caddy 2.11, bash, TypeScript via tsx, firebase-admin 13, Playwright 1.57, pytest, vitest.

**Worktrees:**
- Pipeline: `/Users/nijelhunt_1/.claude-worktrees/cloud-parity/BlueprintCapturePipeline` (branch `claude/cloud-operator-door`)
- WebApp: `/Users/nijelhunt_1/.claude-worktrees/cloud-parity/Blueprint-WebApp` (branch `claude/cloud-scene-runs`)

**Pipeline test command (from the Pipeline worktree):**
`PYTHONPATH=src /Users/nijelhunt_1/workspace/BlueprintCapturePipeline/.venv/bin/python -m pytest -p no:cacheprovider -q tests/test_operator_door*.py`

**Repo rules that bind this plan:**
- Pipeline text under `deploy/ docs/ scripts/ tests/` must not contain `/Users/<name>/` or `/home/<name>/` literals (source governance). Derive cloud paths at runtime.
- Every `deploy/systemd/*.service` must satisfy `tests/test_deploy_systemd_contract.py` (special-case new shapes deliberately) and `systemd-analyze security --threshold=40`.
- Every `/var/lib/blueprint*` or `/opt/blueprint*` path named by a `deploy/systemd/blueprint-*` unit must be classified in `src/blueprint_pipeline/control_plane_storage_roots.py`.
- The Caddy edge test pins what the edge may proxy; extend it for the door route rather than weakening it.

---

## File structure

### Pipeline (`BlueprintCapturePipeline`)

| Path | Responsibility |
|---|---|
| `deploy/operator-door/operator_door/__init__.py` | Version constant and schema names |
| `deploy/operator-door/operator_door/config.py` | `DoorConfig` dataclass: listen address, roots, hidden paths, unit allowlists, spool/state paths, limits; `load_config(path)` merges `/etc/blueprint-operator-door/door.json` over defaults |
| `deploy/operator-door/operator_door/auth.py` | `TokenStore` (load hashed tokens, constant-time verify, scopes); `hash_token()` |
| `deploy/operator-door/operator_door/secrets_guard.py` | `refused_name(path)`, `scan_bytes(data)`, `redact_lines(text)` |
| `deploy/operator-door/operator_door/fsview.py` | Path confinement and reads: `resolve_allowed()`, `list_dir()`, `read_range()`, `stream_archive()` |
| `deploy/operator-door/operator_door/hostinfo.py` | Injectable command runner; `systemctl show`/`list-units`/`list-timers` parsing, `journal()`, `/proc/locks` holders, loopback `/version`, disk and load |
| `deploy/operator-door/operator_door/status.py` | `build_status(config, host)` assembles the status document |
| `deploy/operator-door/operator_door/requests.py` | Request schemas (`deploy`, `unit`, `stage-replay`, `door-upgrade`), `validate_request()`, spool `enqueue()`/`load_request()`/`request_state()` |
| `deploy/operator-door/operator_door/server.py` | HTTP handler: routing, auth, scopes, JSON errors, streaming, audit log |
| `deploy/operator-door/operator_door/runner.py` | Root spool processor: revalidate, build and run `systemd-run`/`systemctl` argv, write results |
| `deploy/operator-door/operator_door/__main__.py` | `serve`, `run-spool`, `self-test`, `token add|list|revoke` |
| `deploy/operator-door/door-deploy.sh` | Transient-unit deploy flow (fetch, main ancestry, wait-idle, target-commit deploy script, result) |
| `deploy/operator-door/door-replay.sh` | Transient-unit isolated stage replay from a candidate commit |
| `deploy/operator-door/door-upgrade.sh` | Transient-unit door reinstall from a main commit with rollback |
| `deploy/operator-door/install.sh` | Root installer: code, units, dirs, Caddy route, health check |
| `deploy/systemd/blueprint-operator-door.service` | Sandboxed read service (`User=blueprint`) |
| `deploy/systemd/blueprint-operator-door-runner.service` | Root oneshot spool processor |
| `deploy/systemd/blueprint-operator-door-runner.path` | `PathExistsGlob` trigger |
| `deploy/caddy/Caddyfile` | Add the operator route |
| `scripts/operator_door.py` | Client CLI (stdlib) |
| `tests/test_operator_door_*.py` | Hermetic tests per module |
| `tests/test_deploy_systemd_contract.py`, `tests/test_deploy_control_plane_edge_contract.py`, `src/blueprint_pipeline/control_plane_storage_roots.py` | Deliberate contract extensions |
| `docs/OPERATOR_DOOR.md` | Host-side doc: model, API, install, tokens, revocation |

### WebApp (`Blueprint-WebApp`)

| Path | Responsibility |
|---|---|
| `scripts/cloud/lib.sh` | Shared shell helpers: locate sibling repos, logging, `CLOUD_STATE_DIR` |
| `scripts/cloud/setup-environment.sh` | Root setup script for the claude.ai environment (time-boxed, never fails) |
| `scripts/cloud/bootstrap.sh` | Idempotent in-session completion; writes `~/.blueprint-cloud/env.sh` |
| `scripts/cloud/doctor.sh` | Readiness report with fixes; nonzero exit on required failures |
| `scripts/cloud/fetch-media.ts` | `gs://` or `https://` download with SHA-256 verification |
| `scripts/cloud/ops-session.ts` | Ops-account ID token file and Playwright storage state |
| `scripts/cloud/ops-session-lib.ts` | Pure helpers (email allowlist, storage-state builder) for tests |
| `scripts/cloud/media-lib.ts` | Pure helpers (gs URL parsing, digest compare) for tests |
| `client/tests/scripts/cloud-ops-session.test.ts`, `client/tests/scripts/cloud-media.test.ts` | vitest for pure helpers |
| `.claude/settings.json` | SessionStart hook: bootstrap when `CLAUDE_CODE_REMOTE=true` |
| `docs/runbooks/cloud-scene-runs.md` | Environment values, kickoff link, procedure, constraints |
| `CLAUDE.md` | Short "Cloud sessions" pointer |

---

## Part A: Pipeline operator door

### Task A1: Package skeleton, config and version

**Files:** Create `deploy/operator-door/operator_door/{__init__,config}.py`; Test `tests/test_operator_door_config.py`

- [ ] Write tests: defaults load without a file; a JSON override replaces only named keys; unknown keys raise `DoorConfigError("door_config_unknown_key:<k>")`; roots and hidden paths must be absolute.
- [ ] Run and see them fail (module missing).
- [ ] Implement `DoorConfig` (frozen dataclass) with defaults:
  - `listen_host="127.0.0.1"`, `listen_port=8767`
  - `state_root="/var/lib/blueprint-operator-door"`, `spool_root=state_root+"/requests"`, `audit_path=state_root+"/audit/audit.jsonl"`
  - `token_file="/etc/blueprint-operator-door/tokens.json"`
  - `read_roots=("/var/lib/blueprint","/opt/blueprint","/workspace","/mnt/blueprint-work","/etc/blueprint","/var/lib/blueprint-operator-door")`
  - `hidden_paths=("/etc/blueprint/provider-secrets","/etc/blueprint/credentials","/etc/blueprint/secrets","/etc/blueprint/agent-execution-admissions","/var/lib/blueprint/spend-authority","/var/lib/blueprint/spend-authority-home","/var/lib/blueprint/pipeline-control-plane/agent-execution-rollout","/var/lib/blueprint/pipeline-control-plane/episode-interpreter-service-account.json","/etc/blueprint-operator-door")`
  - `intake_version_url="http://127.0.0.1:8765/api/live-pipeline/version"`
  - `control_plane_state="/var/lib/blueprint/pipeline-control-plane"`, `active_release_link="/opt/blueprint/task-evaluation-control-plane"`
  - `unit_prefix="blueprint-"`, `controller_units` (scene-progression, configured-controls-progression, launch-activation, launch-dispatcher, pubsub-handoff-listener, pipeline-intake, policy-canary-dispatcher, gpu-spend-guard services and their timers/paths as listed in `deploy/systemd`)
  - limits: `max_read_bytes=16 MiB`, `max_archive_bytes=512 MiB`, `max_list_entries=2000`, `max_journal_lines=2000`, `max_request_body=64 KiB`
  - deploy: `source_clone="/opt/blueprint/control-plane-config-tools/operator-door-source"`, `upstream_url="https://github.com/ognjhunt/BlueprintCapturePipeline.git"`, `venv_python="/opt/blueprint/BlueprintCapturePipeline/.venv/bin/python"`, `idle_wait_units=("blueprint-task-evaluation-scene-progression.service","blueprint-task-evaluation-configured-controls-progression.service")`, `idle_wait_seconds=1800`
- [ ] Run tests to pass; `ruff check deploy/operator-door tests/test_operator_door_config.py`.
- [ ] Commit `Add operator door config`.

### Task A2: Token store

**Files:** Create `operator_door/auth.py`; Test `tests/test_operator_door_auth.py`

- [ ] Tests: `hash_token("x")` is `sha256:` + hex; a store file `{"schema":"blueprint_operator_door_tokens.v1","tokens":[{"name":"cloud","sha256":"<hex>","scopes":["read","deploy"]}]}` verifies the right bearer and returns `TokenIdentity(name, scopes)`; wrong token, missing header, non-Bearer scheme, empty token, token under 32 chars all return `None`; unknown scope in file raises; file mode wider than 0640 raises `token_file_mode_too_open`; `add_token()` refuses duplicate names and writes atomically with mode 0640; `revoke_token()` removes by name.
- [ ] Implement with `hmac.compare_digest` over every stored hash (no early exit), reload when the file mtime changes.
- [ ] Commit `Add operator door token store`.

### Task A3: Secret guard

**Files:** Create `operator_door/secrets_guard.py`; Test `tests/test_operator_door_secrets.py`

- [ ] Tests (each a parametrized case):
  - `refused_name` true for: `pipeline-control-plane.env`, `x.env.bak-1`, `release.env`, `vast_ssh_id_ed25519`, `id_rsa.pub`? (false: public keys allowed? refuse all `id_*`), `episode-interpreter-service-account.json`, `srv-X-CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN.json`, `client_secret.json`, `cert.pem`, `tls.key`, `creds.p12`, `.netrc`, `.git-credentials`, `known_hosts` (false), `progression.json` (false), `token_budget.json` (true: contains "token"; accepted over-refusal).
  - `scan_bytes` finds: PEM private key block, `"private_key": "-----BEGIN`, `"client_secret": "..."`, `"refresh_token": "..."`, `sk-` + 40 chars, `AKIA` + 16, `AIza` + 35, `ghp_`/`github_pat_`, `xoxb-`, `bpk_` + 40 hex, `Authorization: Bearer abc...` (20+), env lines `OPENAI_API_KEY=...`, `FOO_SECRET=...`, `BAR_TOKEN=...`, `PASSWORD=...`; does not flag `"token_count": 12`, `sha256:<64 hex>`, git SHAs, `"api_key_file": "/etc/..."` (path values).
  - `redact_lines` replaces only matching lines with `<redacted: credential-shaped content>`.
- [ ] Implement with compiled regexes; scan a bytes object up to its full length (callers pass bounded chunks) and return the first reason code or `None`.
- [ ] Commit `Add operator door secret guard`.

### Task A4: File view with confinement

**Files:** Create `operator_door/fsview.py`; Test `tests/test_operator_door_fs.py`

- [ ] Tests use a temp dir as the only read root with a hidden subpath:
  - relative path, `..` traversal, NUL byte, path outside roots, hidden path and anything under it, and a symlink inside a root pointing outside (or at a hidden path) all raise `FsRefused` with codes `path_not_absolute`, `path_outside_roots`, `path_hidden`, `path_symlink_escape`.
  - `list_dir` returns sorted entries `{name,type,size,mtime,refused}` capped at `max_list_entries` with `truncated: true`; secret names are listed with `refused: "secret_name"` and no size.
  - `read_range` returns bytes for offset/length within `max_read_bytes`; refuses secret names (`secret_name_refused`) and secret content (`secret_content_refused:<reason>`); refuses directories and non-regular files; opens with `O_NOFOLLOW`.
  - `stream_archive` yields a valid tar.gz of a directory; skips secret names, secret content, symlinks and special files, and appends a `.operator-door-manifest.json` member listing skipped paths and reasons; stops with `archive_limit_exceeded` in the manifest when the byte cap is reached.
- [ ] Implement using `os.path.realpath` checks against roots and hidden paths after resolution, `os.open(..., O_RDONLY|O_NOFOLLOW)`, `os.fstat` regular-file check, `tarfile.open(mode="w|gz", fileobj=<writer>)`.
- [ ] Commit `Add operator door file view`.

### Task A5: Host info and status

**Files:** Create `operator_door/hostinfo.py`, `operator_door/status.py`; Test `tests/test_operator_door_status.py`

- [ ] Tests with a fake `CommandRunner` returning canned `systemctl` output and a temp tree for `/proc/locks`, receipts, spend guard and the release link:
  - `unit_properties(["a.service"])` parses `systemctl show -p Id,ActiveState,SubState,Result,ExecMainStatus,ActiveEnterTimestamp,InactiveEnterTimestamp,UnitFileState` blocks and never requests `Environment`.
  - `list_units(pattern, states)` parses `--plain --no-legend` rows.
  - `journal(unit, lines, since)` refuses units not matching `^blueprint-[A-Za-z0-9@_.:-]+\.(service|timer|path)$`, caps lines, passes `--no-pager -o short-iso`, and runs the output through `redact_lines`.
  - `lock_holders(paths)` maps each lock file's inode to holder PIDs by parsing `/proc/locks` (`FLOCK ADVISORY WRITE <pid> <maj>:<min>:<inode>`).
  - `build_status` returns keys: `door`, `deployed` (from the version URL via an injected fetcher; errors become `{"error": ...}`), `active_release`, `deploys` (active `blueprint-*deploy*` units, last 5 receipts by mtime with `status`/`source_commit`), `paid_launch_locks`, `spend_guard` (whitelisted keys from `gpu_spend_guard/latest.json`), `failed_units`, `controller_units`, `timers`, `disk`, `load`, `door_requests` (pending/processing counts).
- [ ] Implement; keep every external call behind `CommandRunner.run(argv, timeout)` so tests never touch the host.
- [ ] Commit `Add operator door status`.

### Task A6: Request schema and spool

**Files:** Create `operator_door/requests.py`; Test `tests/test_operator_door_requests.py`

- [ ] Tests:
  - `deploy`: `commit` 40 lowercase hex; `mode` in `{"main","canary"}` (default `main`); `wait_for_idle` bool (default true); extra keys refused; scope `deploy`.
  - `unit`: `unit` matches the unit regex and the prefix; `action` in `{"start","reset-failed","stop","restart"}`; `stop`/`restart` only for `.timer`/`.path`; scope `operate`.
  - `stage-replay`: `child` matches `^sam31-[a-f0-9]{8,64}$` or `parent` matches `^[A-Za-z0-9._-]{4,160}$` (exactly one); `commit` 40 hex; scope `operate`.
  - `door-upgrade`: `commit` 40 hex; scope `deploy`.
  - `enqueue` writes `pending/<id>.json` atomically (tmp + rename) with mode 0644, id `YYYYmmddTHHMMSSZ-<kind>-<8 hex>`, records `requested_by` token name and `requested_at`; `request_state(id)` reports `pending|processing|completed|unknown` and merges `results/<id>.json` when present; ids are validated before any path join.
- [ ] Implement.
- [ ] Commit `Add operator door request spool`.

### Task A7: HTTP server

**Files:** Create `operator_door/server.py`, `operator_door/__main__.py`; Test `tests/test_operator_door_server.py`

- [ ] Tests start `ThreadingHTTPServer` on port 0 with a temp config and fake host runner, then call with `urllib`:
  - `GET /api/live-pipeline/operator/v1/healthz` needs no token and returns only `{"ok": true, "version": …}`.
  - no/invalid token → 401 `{"error":"unauthorized"}` and an audit line with `outcome: "denied"`.
  - `GET /api/live-pipeline/operator/v1/whoami` → name and scopes.
  - read endpoints need `read`; `POST /v1/requests` needs the kind's scope (403 `scope_missing:<scope>`).
  - `fs/list`, `fs/read` (with `offset`/`length`), `fs/archive` (content-type `application/gzip`), `journal`, `units`, `status`, `requests`, `requests/<id>` round-trip; refusals map to 403 with the refusal code; unknown route 404; body over 64 KiB 413; invalid JSON 400.
  - every response carries `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
  - `self-test` subcommand exits 0 against the temp config.
- [ ] Implement with `http.server.BaseHTTPRequestHandler`, path prefix `/api/live-pipeline/operator/v1`, audit log as JSON lines (time, token name, method, path, query without values for `path`… keep the queried `path` value since it is not secret, status, bytes).
- [ ] Commit `Add operator door HTTP server`.

### Task A8: Root runner

**Files:** Create `operator_door/runner.py`; Test `tests/test_operator_door_runner.py`

- [ ] Tests with a fake runner capturing argv and a temp spool:
  - processes `pending/*.json` oldest first; moves to `processing/`, writes `results/<id>.json`, moves to `completed/`.
  - rejects symlinks, non-regular files, files over 64 KiB, invalid JSON and any request failing `validate_request` (result `status: "refused"`).
  - Spool lifecycle: the runner moves `pending/<id>.json` to `processing/<id>.json`, validates, moves it to `completed/<id>.json`, then acts and writes `results/<id>.json` (`status`: `launched`, `done`, `failed` or `refused`). Transient scripts write their own outcome to `results/<id>.outcome.json` and their log to `results/<id>.log`, so no two writers share a file.
  - Transient scripts never parse the spool: the runner passes validated parameters as `--setenv=DOOR_REQUEST_ID=… DOOR_RESULTS_DIR=… DOOR_COMMIT=… DOOR_MODE=… DOOR_WAIT_FOR_IDLE=… DOOR_CHILD=… DOOR_PARENT=…` plus the config values the script needs (`DOOR_SOURCE_CLONE`, `DOOR_UPSTREAM_URL`, `DOOR_VENV_PYTHON`, `DOOR_IDLE_UNITS`, `DOOR_IDLE_WAIT_SECONDS`, `DOOR_INSTALL_ROOT`). Scripts re-check formats defensively.
  - `deploy`: refuses `deploy_in_progress:<unit>` when any `blueprint-*deploy*` unit is active or activating; otherwise argv starts `systemd-run --unit=blueprint-operator-door-deploy-<sha12>-<rid8> --collect --service-type=exec --property=TimeoutStartSec=3h --setenv=PYTHONDONTWRITEBYTECODE=1` followed by the `--setenv=DOOR_*` pairs and ends `/bin/bash <install_root>/door-deploy.sh`; result `status: "launched"` with the unit name.
  - `unit`: argv `systemctl --no-block <action> <unit>`; result `done` or `failed` with exit code and stderr tail.
  - `stage-replay`: unit `blueprint-operator-door-replay-<rid8>`, `TimeoutStartSec=1h`, script `door-replay.sh`.
  - `door-upgrade`: unit `blueprint-operator-door-upgrade-<sha12>`, script `door-upgrade.sh`.
- [ ] Implement.
- [ ] Commit `Add operator door root runner`.

### Task A9: Transient scripts and installer

**Files:** Create `deploy/operator-door/{door-deploy.sh,door-replay.sh,door-upgrade.sh,install.sh}`; Test `tests/test_operator_door_scripts.py`

- [ ] Tests (static, no execution): scripts start with `set -euo pipefail`; `door-deploy.sh` passes `--iteration`, `--preserve-configured-controls-state`, uses `--canary` only in canary mode, checks `merge-base --is-ancestor` for main mode, never calls `deploy_control_plane_iteration.sh` or `_canary.sh`, and writes a result JSON; `door-replay.sh` passes `--isolate` and never `--allow-paid`; `install.sh` never writes `tokens.json` if it exists, validates Caddy before reload, and backs up the Caddyfile; `bash -n` succeeds for every script.
- [ ] Implement the deploy flow: validate id; read request; `flock` a door deploy lock; ensure source clone (clone with `--reference /opt/blueprint/BlueprintCapturePipeline --dissociate` when absent, set origin to `upstream_url`); `git fetch --prune origin`; main-mode ancestry; optional idle wait on `idle_wait_units`; `git worktree add --detach <tmp tool dir> <sha>`; run `<venv_python> <tool>/scripts/deploy_control_plane_commit.py --source-repo <source_clone> --source-commit <sha> --release-root /opt/blueprint/task-evaluation-control-plane-releases --state-root /var/lib/blueprint/pipeline-control-plane --active-link /opt/blueprint/task-evaluation-control-plane --iteration [--canary] --preserve-configured-controls-state --receipt-out /var/lib/blueprint/pipeline-control-plane/deploy-receipts/<mode>_<sha12>_door.json`, tee output to `results/<id>.log`; write `results/<id>.json` with exit code, receipt path, finished time; remove the tool worktree.
- [ ] Implement replay: tool worktree at the candidate commit; `PYTHONPATH=<tool>/src <venv_python> -m blueprint_pipeline.task_evaluation_stage_replay --child|--parent <id> --isolate --json-out results/<id>.replay.json`.
- [ ] Implement upgrade: clone at commit into a temp dir, require main ancestry, run its `install.sh --upgrade`, which keeps `/opt/blueprint/operator-door.previous` and rolls back if the health check fails.
- [ ] Implement install: create `blueprint` group membership of `systemd-journal` only for the door unit (via `SupplementaryGroups=`, not usermod); install code to `/opt/blueprint/operator-door` (root:root 0755); state dirs `/var/lib/blueprint-operator-door/{requests/{pending,processing,completed,results},audit}` owned `blueprint:blueprint` 0750 with `requests` setgid; `/etc/blueprint-operator-door` root:blueprint 0750; units into `/etc/systemd/system`; patch the live Caddyfile by inserting the operator `handle` block before the first `handle /api/live-pipeline/*` when absent; `caddy validate --adapter caddyfile --config <candidate>`; `systemctl reload caddy`; enable and start `blueprint-operator-door.service` and `blueprint-operator-door-runner.path`; health check `curl -fsS http://127.0.0.1:8767/api/live-pipeline/operator/v1/healthz`.
- [ ] Commit `Add operator door host scripts`.

### Task A10: Units, Caddy and contract tests

**Files:** Create the three unit files; Modify `deploy/caddy/Caddyfile`, `tests/test_deploy_systemd_contract.py`, `tests/test_deploy_control_plane_edge_contract.py`, `src/blueprint_pipeline/control_plane_storage_roots.py`; Test `tests/test_operator_door_units.py`

- [ ] Door unit: `User=blueprint`, `Group=blueprint`, `SupplementaryGroups=systemd-journal`, `UMask=0077`, `NoNewPrivileges=true`, `PrivateTmp=true`, `PrivateDevices=true`, `ProtectSystem=strict`, `ProtectHome=true`, `ProtectKernelTunables=true`, `ProtectKernelModules=true`, `ProtectKernelLogs=true`, `ProtectControlGroups=true`, `ProtectClock=true`, `ProtectHostname=true`, `ProtectProc=invisible`, `RestrictSUIDSGID=true`, `RestrictNamespaces=true`, `RestrictRealtime=true`, `LockPersonality=true`, `MemoryDenyWriteExecute=true`, `CapabilityBoundingSet=`, `AmbientCapabilities=`, `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6`, `IPAddressDeny=any`, `IPAddressAllow=localhost`, `SystemCallFilter=@system-service`, `SystemCallArchitectures=native`, `ReadWritePaths=/var/lib/blueprint-operator-door`, `InaccessiblePaths=` with a leading `-` for each hidden path, `TasksMax=64`, `MemoryMax=1G`, `CPUQuota=100%`, `CPUWeight=20`, `IOWeight=20`, `Nice=10`, `ExecStart=/usr/bin/python3 -m operator_door serve`, `Environment=PYTHONPATH=/opt/blueprint/operator-door`, `Environment=PYTHONDONTWRITEBYTECODE=1`, `Restart=on-failure`.
- [ ] Runner unit: `Type=oneshot`, `User=root`, `CapabilityBoundingSet=CAP_DAC_OVERRIDE`, `AmbientCapabilities=CAP_DAC_OVERRIDE`, `NoNewPrivileges=true`, `ProtectSystem=strict`, `ProtectHome=true`, `PrivateTmp=true`, `PrivateDevices=true`, `PrivateNetwork=true`, `RestrictAddressFamilies=AF_UNIX`, `ReadWritePaths=/var/lib/blueprint-operator-door/requests`, kernel/cgroup protections, `SystemCallFilter=@system-service`, `TasksMax=32`, `MemoryMax=256M`, `ExecStart=/usr/bin/python3 -m operator_door run-spool`.
- [ ] Path unit: `PathExistsGlob=/var/lib/blueprint-operator-door/requests/pending/*.json`, `Unit=blueprint-operator-door-runner.service`, `WantedBy=paths.target`.
- [ ] Caddyfile: add `handle /api/live-pipeline/operator/* { reverse_proxy 127.0.0.1:8767 }` above the intake handle.
- [ ] Edge test: allow exactly two upstreams, the intake for `/api/live-pipeline/*` and the door for `/api/live-pipeline/operator/*`, both loopback.
- [ ] Systemd contract: special-case both units with explicit assertions (the door's `User=blueprint` sandbox with `IPAddressAllow=localhost` and hidden paths; the runner's root shape mirroring the other root housekeeping units).
- [ ] Storage roots: classify `/var/lib/blueprint-operator-door` (container), `.../requests` (work), `.../audit` (evidence_hot), `/opt/blueprint/operator-door` (release), `/opt/blueprint/control-plane-config-tools/operator-door-source` (release).
- [ ] Run the three contract tests plus `tests/test_control_plane_storage_roots.py`.
- [ ] Commit `Add operator door units and edge route`.

### Task A11: Client CLI

**Files:** Create `scripts/operator_door.py`; Test `tests/test_operator_door_client.py`

- [ ] Tests against the in-process server from A7: `status --json`, `ls`, `cat --max-bytes`, `pull` of a file and of a directory (extracts the archive and prints the skipped-file manifest), `journal`, `units`, `deploy <sha> --mode main` returns the request id, `request <id>`, `unit start <unit>`, `replay --child <id> --commit <sha>`; token from `BLUEPRINT_OPERATOR_DOOR_TOKEN` or `--token-file`; with neither, no Authorization header is sent; `--wait` polls `requests/<id>` until `completed` and a terminal result.
- [ ] Implement with `urllib.request` (honours `HTTPS_PROXY` and the system CA store).
- [ ] Commit `Add operator door client`.

### Task A12: Docs and PR

- [ ] Write `docs/OPERATOR_DOOR.md`: purpose, threat model, endpoints, scopes, secret layers, install, token issue (hash-only transfer), revocation, upgrade, rollback, and removal.
- [ ] Run all `tests/test_operator_door*.py`, the edited contract tests, `ruff check` on changed files, `bash -n` on scripts, and `python -m blueprint_pipeline.impacted_test_selection`.
- [ ] Push `claude/cloud-operator-door` and open the PR with the ADP framing (blocker: cloud sessions cannot observe or deploy; smallest reversible change: standalone door plus one Caddy route).

## Part B: WebApp cloud tooling

### Task B1: Shared shell library

**Files:** Create `scripts/cloud/lib.sh`

- [ ] `cloud_repo_root` (git toplevel of this script), `cloud_workspace` (its parent), `cloud_pipeline_root` (sibling `BlueprintCapturePipeline` or `$BLUEPRINT_PIPELINE_ROOT`), `CLOUD_STATE_DIR=${BLUEPRINT_CLOUD_STATE_DIR:-/opt/blueprint-cloud}`, `log`, `warn`, `have`.
- [ ] Commit.

### Task B2: Environment setup script

**Files:** Create `scripts/cloud/setup-environment.sh`

- [ ] Behaviour: root only; `deadline=$((SECONDS+270))`; each step logs start/end to `/var/log/blueprint-cloud-setup.log` and is skipped when the deadline passed; never exits nonzero. Steps: apt install `ffmpeg libgl1 libegl1 libosmesa6 libglfw3 jq`; install uv 0.10.7 with `python3 -m pip install --break-system-packages uv==0.10.7` when `uv --version` differs; Pipeline venv at `$CLOUD_STATE_DIR/pipeline-venv` via `UV_PROJECT_ENVIRONMENT=... uv sync --frozen --extra dev` in the Pipeline repo, then CPU torch 2.10.0 from `https://download.pytorch.org/whl/cpu`; `npm ci --no-audit --no-fund` in the WebApp; `npx playwright install --with-deps chromium`. Run the Pipeline and WebApp installs in parallel and wait.
- [ ] `bash -n` and `shellcheck` if available.
- [ ] Commit.

### Task B3: Bootstrap

**Files:** Create `scripts/cloud/bootstrap.sh`

- [ ] Idempotent: rerun any missing piece from B2 (same functions), deepen the Pipeline clone with `git fetch --filter=blob:none --unshallow origin` when shallow and `--full-history` is passed, fetch `origin main` in both repos, write `~/.blueprint-cloud/env.sh` exporting `BLUEPRINT_PIPELINE_ROOT`, `BLUEPRINT_PIPELINE_PYTHON`, `UV_PROJECT_ENVIRONMENT`, `PLAYWRIGHT_BROWSERS_PATH` when set, and `BLUEPRINT_OPERATOR_DOOR_URL`; print a one-line summary; exit 0 unless `--strict`.
- [ ] Commit.

### Task B4: Doctor

**Files:** Create `scripts/cloud/doctor.sh`

- [ ] Checks with PASS/FAIL/WARN and a fix line each: both repos present; `node` ≥ 20, `npm`; `python3`; `uv` exactly 0.10.7; Pipeline venv imports `pxr mujoco trimesh PIL numpy cv2 blueprint_pipeline`; `ffmpeg`/`ffprobe`; Playwright Chromium launches headless; network to `tryblueprint.io/version.json`, `paperclip.tryblueprint.io/api/live-pipeline/version`; door `whoami` returns scopes (FAIL if 401: credential missing); `FIREBASE_SERVICE_ACCOUNT_JSON` parses with project `blueprint-8c1ca` (never print it); Firestore read of one known collection via a tiny tsx one-liner; `gh auth status`. Exit 1 on any FAIL.
- [ ] Commit.

### Task B5: Media fetcher

**Files:** Create `scripts/cloud/media-lib.ts`, `scripts/cloud/fetch-media.ts`; Test `client/tests/scripts/cloud-media.test.ts`

- [ ] Tests: `parseGsUrl("gs://b/p/x.MOV")` → `{bucket:"b", object:"p/x.MOV"}`; invalid URLs throw; `normalizeSha256` accepts bare hex or `sha256:` prefix and rejects others; `digestMatches`.
- [ ] CLI: `tsx scripts/cloud/fetch-media.ts <gs://…|https://…> --sha256 <hex> [--out <dir>]` streams to `<out>/<basename>.partial`, hashes while streaming, renames on match, deletes on mismatch and exits 1, prints size and `ffprobe` duration/streams JSON. Default out dir `.playwright-mcp/` (gitignored).
- [ ] Commit.

### Task B6: Ops session

**Files:** Create `scripts/cloud/ops-session-lib.ts`, `scripts/cloud/ops-session.ts`; Test `client/tests/scripts/cloud-ops-session.test.ts`

- [ ] Tests: `assertAllowedEmail` passes only exact matches of the comma-separated `BLUEPRINT_CLOUD_OPS_EMAIL` list; `buildStorageState({origin, apiKey, user})` returns Playwright storage state with the `firebaseLocalStorageDb`/`firebaseLocalStorage` IndexedDB record keyed `firebase:authUser:<apiKey>:[DEFAULT]` and the same value in localStorage, containing `uid`, `email`, `apiKey`, `appName:"[DEFAULT]"`, `stsTokenManager {refreshToken, accessToken, expirationTime}`; no token appears in thrown error messages.
- [ ] CLI: resolve the web API key from `VITE_FIREBASE_API_KEY` or by fetching `https://tryblueprint.io` and its first module script and matching `AIza[0-9A-Za-z_-]{35}`; `authAdmin.getUserByEmail`; `createCustomToken(uid)`; POST `identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=…` with `returnSecureToken: true`; write `~/.blueprint-cloud/ops-id-token` (0600) and `~/.blueprint-cloud/ops-storage-state.json` (0600); print only paths, uid and expiry.
- [ ] Commit.

### Task B7: Hook, runbook and CLAUDE.md

**Files:** Modify `.claude/settings.json`; Create `docs/runbooks/cloud-scene-runs.md`; Modify `CLAUDE.md`

- [ ] SessionStart hook: `[ "$CLAUDE_CODE_REMOTE" = "true" ] && bash scripts/cloud/bootstrap.sh --quiet || true`.
- [ ] Runbook sections: what a cloud session can and cannot do; environment values to paste (network list, env var names, API credential, setup script line); kickoff link; the scene procedure (steps 1-14 generalized from the drawer prompt and handoff) with the door commands at each step; ledger and amendment rules; deploy rules; security rules; troubleshooting table from `doctor.sh` output.
- [ ] `CLAUDE.md`: a five-line "Cloud sessions" section linking the runbook.
- [ ] Run `npx vitest run client/tests/scripts/cloud-*.test.ts` and `npm run check`.
- [ ] Push `claude/cloud-scene-runs` and open the PR.

## Part C: Host install and verification (after merge, with founder confirmation)

- [ ] Generate the token on the Mac into `~/.blueprint-secrets/operator_door_token` (umask 077, never printed); compute its hash.
- [ ] Confirm with the founder, check no deploy or paid launch is active, then install from the merged main commit over SSH and add the token hash with scopes `read,operate,deploy`.
- [ ] Verify from the Mac: `scripts/operator_door.py status` with the token file.
- [ ] Founder creates the environment and API credential (exact values from the runbook).
- [ ] Run a one-off routine in the new environment that runs `bootstrap.sh` then `doctor.sh`; every check must pass.
