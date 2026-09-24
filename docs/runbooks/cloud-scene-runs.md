# Running a website scene from a Claude Code cloud session

A cloud session (claude.ai/code, Anthropic-hosted VM) can drive a website
scene end to end: both repositories with working toolchains, the source video,
the website in headless Chromium (account-free upload and the signed-in robot
team step), the Firestore authority, host observation, stage replays against
pulled inputs, and deploys of merged commits. What it cannot do is SSH: all cloud egress goes through an
HTTPS proxy, so everything on the control-plane host goes through the
**operator door** (BlueprintCapturePipeline `docs/OPERATOR_DOOR.md`).

Design: `docs/superpowers/specs/2026-09-23-cloud-scene-run-parity-design.md`.

## One-time setup

### 1. The operator door on the host

Installed from the Pipeline repo's `deploy/operator-door/install.sh` and given
a token whose hash lives on the host and whose plaintext lives only in
`~/.blueprint-secrets/operator_door_token` on the Mac and in the cloud
environment's API credential. See `docs/OPERATOR_DOOR.md` in the Pipeline repo
for install, token issue, revocation and upgrade.

### 2. The cloud environment

This takes two passes, because the **API credentials** section appears only when
you edit an environment that already exists. The new-environment dialog never
shows it. All copy commands run on the Mac.

**Pass 1: create it.** In claude.ai/code, click the cloud icon above the message
box and choose **Add cloud environment**.

- **Name:** `Blueprint scene runs` (the kickoff link below selects it by name).
- **Network access:** **Full** is simplest. For a tighter list, choose **Custom**,
  check "Also include default list of common package managers", and add these
  domains:

  ```
  tryblueprint.io
  *.tryblueprint.io
  blueprint-webapp.onrender.com
  *.googleapis.com
  blueprint-8c1ca.firebaseapp.com
  download.pytorch.org
  download-r2.pytorch.org
  cdn.playwright.dev
  playwright.download.prss.microsoft.com
  playwright.azureedge.net
  objects.githubusercontent.com
  release-assets.githubusercontent.com
  ```

  `*.googleapis.com` covers Firestore, Storage, Identity Toolkit and token
  exchange. The GitHub asset hosts serve the Python 3.12 build that uv installs
  (the image ships 3.11). The door host needs no entry, because API-credential
  hosts bypass the list.
- **Environment variables:** copy both lines, then paste them into the box:

  ```bash
  python3 -c 'import json,sys; print("FIREBASE_SERVICE_ACCOUNT_JSON=\x27" + json.dumps(json.load(open(sys.argv[1]))) + "\x27\nBLUEPRINT_CLOUD_OPS_EMAIL=ohstnhunt@gmail.com", end="")' <service-account key file> | pbcopy
  ```

  The key goes in single quotes on one line, so the `\n` escapes in its private
  key survive. Use a key Google still accepts; the doctor's Firestore check
  fails on a revoked one. The dialog warns that anyone using the environment
  can read these values. The key has to go here anyway: it signs its own
  logins, and API credentials only carry header tokens. Personal environments
  are private to your account, but commands in the session can read the key,
  so revoke it in the Firebase console if it ever leaks.
  `BLUEPRINT_CLOUD_OPS_EMAIL` is the allowlist for the sign-in helper
  (comma-separated). `VITE_FIREBASE_API_KEY` is optional; without it the helper
  reads the public key from the live site.
- **Setup script:**

  ```bash
  #!/bin/bash
  setup=$(ls /home/*/Blueprint-WebApp/scripts/cloud/setup-environment.sh 2>/dev/null | head -n 1)
  [ -n "$setup" ] && bash "$setup"
  exit 0
  ```

  It runs once as root, before Claude starts, and is cached for about a week,
  so later sessions skip it. It never fails the session start. Within a
  270-second budget it installs:
  - ffmpeg, the MuJoCo GL libraries, `gh` and `certutil`;
  - uv 0.10.7, with the Pipeline virtualenv outside the clone;
  - CPU torch 2.10.0;
  - the WebApp node modules and Playwright Chromium.

  `bootstrap.sh` finishes whatever it doesn't. A session with both repositories
  runs no repository hooks, so the procedure below runs `bootstrap.sh` itself.
- Click **Add environment**.

**Pass 2: add the door token as an API credential.** Open the environment
selector again, hover over **Blueprint scene runs** and click its gear icon. In
the **Update cloud environment** dialog, under **API credentials**, choose
**Add credential**, keep the credential type **Bearer**, and fill in:

- **Name:** `operator-door`
- **Allowed websites:** `paperclip.tryblueprint.io`
- **Custom headers:** Name `Authorization`, Prefix `Bearer`, Value pasted from:

  ```bash
  tr -d '\n' < ~/.blueprint-secrets/operator_door_token | pbcopy
  ```

Click **Connect**. It saves at once and the value can't be viewed again. The
agent proxy attaches the token to requests for that host after they leave the
VM, so the token never enters the session.

## Kick off a run

Open this link (it prefills both repositories, the environment and the prompt;
set the permission mode to Auto if your plan offers it):

```
https://claude.ai/code?repositories=ognjhunt/Blueprint-WebApp,ognjhunt/BlueprintCapturePipeline&environment=Blueprint%20scene%20runs&prompt=Run%20a%20new%20website%20scene%20end%20to%20end%20by%20following%20Blueprint-WebApp/docs/runbooks/cloud-scene-runs.md.%20Source%20video%3A%20%3CURL%3E%20sha256%20%3CHEX%3E.%20Task%3A%20%3CONE%20SENTENCE%3E.%20Start%20with%20bootstrap%20and%20doctor,%20and%20tell%20me%20about%20any%20FAIL%20before%20going%20further.
```

Then replace the placeholders. The prompt, unencoded:

> Run a new website scene end to end by following
> Blueprint-WebApp/docs/runbooks/cloud-scene-runs.md. Source video: `<gs:// or
> https:// URL>` sha256 `<hex>`. Task: `<one sentence>`. Start with bootstrap and
> doctor, and tell me about any FAIL before going further.

No URL for the video? Say so in the prompt: the session creates the website
intake and sends you the tokenized `/capture-upload/` link to open on your
phone, which is the product's own upload path.

## The procedure inside the session

Every command below runs from the session's working directory, the parent of
both clones.

### 0. Readiness

```bash
bash Blueprint-WebApp/scripts/cloud/bootstrap.sh
. ~/.blueprint-cloud/env.sh
bash Blueprint-WebApp/scripts/cloud/doctor.sh
door() { python3 "$BLUEPRINT_PIPELINE_ROOT/scripts/operator_door.py" "$@"; }
```

Doctor must show no FAIL. It checks the toolchains, the Pipeline imports,
ffmpeg, that headless Chromium loads a real `https://tryblueprint.io` page
(proof the browser trusts the egress proxy), the site and host, the door token
and its scopes, the service account and a Firestore read, the ops allowlist and
`gh`. Each FAIL line names its fix.

### 1. Host baseline

`door status` gives the deployed commit, its blockers, deploys in flight from
any lane, which paid-launch locks are actually held, the spend guard, failed
units and the door's own queue. Another lane's deploy or paid launch in flight
is a reason to wait, not to race.

### 2. Source video

```bash
cd Blueprint-WebApp
npx tsx scripts/cloud/fetch-media.ts <gs://bucket/object | https://url> --sha256 <hex>
```

It streams into `.playwright-mcp/` (gitignored), verifies the digest, deletes
the file on a mismatch and prints an ffprobe summary (duration, codec, size,
rotation). Preserve the original bytes; the digest is what every provider
binding will carry.

### 3. Steps 1–2: intake and upload

Use the public website like a customer, in headless Chromium (Playwright from
the WebApp's `node_modules`, or the Playwright plugin if enabled on your
claude.ai account). The upload needs no account. Record the capture, request
and scene ids from the confirmation, and the tokenized status link.

### 3a. A capture held at the privacy screen

The upload screens the footage before anything is derived from it. A hold
shows on the capture page as "Nothing is being processed from it yet".
`inboundRequests/<requestId>.capture_privacy_screen` says why:

- `eligibility: "pending"`, `outcome: "review_unavailable"`: we could not get
  an answer. Opening the capture link (`GET /api/self-capture/uploads/<token>`)
  retries. A review that outlives the 45-second wait is picked up by the next
  retry without spending an attempt. `agentRuns` with
  `metadata.capture_id == <captureId>` shows each review and its error.
- `eligibility: "rejected"`: the reviewer saw identifiable people. That needs
  a person, never a retry.

When the attempts went on a defect we have since fixed, give the capture a
fresh budget on the record (at most three times per capture). Preview, then
apply:

```bash
node --import tsx scripts/rescreen-held-capture.ts <request-id> <capture-id> <your-email> "<what was fixed>"
node --import tsx scripts/rescreen-held-capture.ts <request-id> <capture-id> <your-email> "<what was fixed>" --apply
```

### 4. Find the scene on the host and raise the preparation cap

```bash
door ls /var/lib/blueprint/pubsub-handoffs/blueprint-8c1ca.appspot.com/scenes --sort mtime
door cat /var/lib/blueprint/pubsub-handoffs/blueprint-8c1ca.appspot.com/scenes/<scene>/captures/<capture>/pipeline/website_scene_sponsorship.json
```

The sponsorship names the request id and authority digest (the same authority
lives in Firestore `inboundRequests/<requestId>`). A scene that needs concept
recovery or several edited views exhausts the default 16 preparation attempts
long before the $5 cap, so amend the attempt limit up front. It is one-shot and
capped at 32; preview, then apply:

```bash
node --import tsx scripts/amend-website-preparation-limit.ts <request-id> <authority-digest> <owner-uid> 32 "<reason>"
node --import tsx scripts/amend-website-preparation-limit.ts <request-id> <authority-digest> <owner-uid> 32 "<reason>" --apply
```

No `--env-file` in a cloud session: the credentials come from
`FIREBASE_SERVICE_ACCOUNT_JSON`, and Firestore goes over REST through the proxy
(`BLUEPRINT_FIRESTORE_PREFER_REST=1`, set by bootstrap).

### 5. Watch steps 3–12

```bash
door cat /var/lib/blueprint/pipeline-control-plane/task-evaluation-scene-intents/<intent>/progression.json
door cat /var/lib/blueprint/pipeline-control-plane/task-evaluation-scene-intents/<intent>/validation-progress.json
door ls  /var/lib/blueprint/pipeline-control-plane/task-evaluation-launch-runs --sort mtime --match '*<sha8>*'
door journal blueprint-task-evaluation-scene-progression.service -n 200 --since -1h
door journal blueprint-pubsub-handoff-listener.service -n 200
door ls  /workspace/task_evaluation_scene_configuration_provider_bundle/runtime_output/stages
door pull /var/lib/blueprint/pipeline-control-plane/task-evaluation-launch-runs/<launch> ./evidence/<launch>
```

Anything the door refuses comes back with its rule (`secret_name_refused`,
`path_outside_roots`, ...); archives list skipped files in their manifest.

### 6. A stage fails: replay, fix, deploy

1. Replay the failed child in the session against your branch's code. Nothing
   unreviewed runs on the host, and the VM has no provider credentials, so a
   replay can never reach a paid call. The session runs as root, so mirror the
   host paths and the job's absolute references resolve unchanged:

   ```bash
   q=/var/lib/blueprint/pipeline-control-plane/sam31-preparation-executions
   door ls $q/failed --match 'sam31-<digest>*'        # or completed/, processing/
   door pull $q/failed/sam31-<digest>.json $q/failed/sam31-<digest>.json
   door pull $q/results/sam31-<digest>.json $q/results/sam31-<digest>.json
   door cat $q/failed/sam31-<digest>.json              # names plan_ref.path and the inputs
   door pull <plan directory under task-evaluation-inputs/prepared-references> <same path>
   cd BlueprintCapturePipeline
   python -m blueprint_pipeline.task_evaluation_stage_replay --child sam31-<digest>
   ```

   A missing input comes back as a blocker naming its path; pull that path and
   rerun. Never pass `--allow-paid`.
2. Fix on a branch, open a PR, merge when CI is green.
3. Deploy the merged commit: `door deploy <sha on main> --wait`. The door only
   deploys commits on `origin/main`. It waits for the progression oneshots to
   go idle, refuses while another deploy runs, and the deploy tool refuses
   while a paid launch holds a Vast lock. It keeps the configured-controls
   pause.
4. Confirm: `door status` shows `deployed.source_commit` equal to the sha,
   `commit_proven: true` and no blockers. Deploys quiesce timers; if the handoff
   listener did not come back, `door unit start
   blueprint-pubsub-handoff-listener.timer`.
5. To run a controller step now: `door unit start
   blueprint-task-evaluation-scene-progression.service`.

### 7. Step 13: the robot team picks its saved setup

```bash
npx tsx scripts/cloud/ops-session.ts
```

It mints a session for the allowlisted ops account from the service account
(no password) and writes `~/.blueprint-cloud/ops-storage-state.json` and
`~/.blueprint-cloud/ops-id-token`, both 0600, printing only paths, uid and
expiry. Open the task page in a context created with
`browser.newContext({ storageState: <that file> })`, choose the saved setup and
start the evaluation. For API calls, send `Authorization: Bearer <id token>` and
`x-blueprint-native-client: blueprint-capture`.

### 8. Step 14 and the evidence matrix

Results, replay media and status must appear on the same website task page.
Confirm provider teardown and provider-zero in the run's closeout receipts and
`door status`. Keep the scene's 14-step evidence matrix in a WebApp doc on the
session's branch and PR, which the Mac lanes can read; do not claim a step
without its artifact.

## Rules that still bind

- The controller owns stage transitions. Never hand-write stage receipts, edit
  signed manifests, patch records to fake completion, or run modelling the
  controller cannot reproduce.
- Never replay a paid stage against a live scene's ledger; its binding digests
  collide with the real run's one-dispatch grants. Replays run in the session,
  without `--allow-paid`.
- The preparation amendment is one-shot. Measure which limit is exhausted,
  usually attempts rather than dollars, before asking.
- Controls stay paused; door deploys preserve that.
- No deploy over a paid run. Other lanes' deploys show up in `door status` as
  `blueprint-*-deploy-*` units.
- Never print environment values or credentials, and never paste keys into the
  session; the door already hides host secrets.
- Merging a WebApp PR is not a deploy: confirm CI on main, the `deploy.yml` run
  conclusion and `/version.json`.

## What still needs the Mac

- Installing or repairing the door itself when it is down (SSH).
- Editing `/etc/blueprint` configs or env files, rotating provider keys,
  process-level debugging (py-spy, gdb) and SSH into GPU pods.
- The Codex coordination log, which lives on the Mac. Cloud sessions report in
  their PRs instead.
- Anything else: run `claude remote-control --spawn worktree` inside tmux (with
  `caffeinate -s`) on the Mac and drive that full-access session from the web or
  your phone.

## Troubleshooting

| Doctor says | Do |
|---|---|
| `operator door` FAIL, 401/403 | The API credential is missing, mistyped or scoped to another host; re-add it for `paperclip.tryblueprint.io` |
| `operator door` WARN, missing scopes | Reissue the token with `read,operate,deploy` |
| `site reachable` / `host reachable` FAIL, `host_not_allowed` | Add the host to the environment's network access |
| `chromium launch` FAIL mentioning CERT | Rerun `bootstrap.sh`; its browser-trust step imports the proxy CA into `~/.pki/nssdb` |
| `firestore read` FAIL | Check `FIREBASE_SERVICE_ACCOUNT_JSON` (one line, single-quoted) and that `BLUEPRINT_FIRESTORE_PREFER_REST=1` is exported (`. ~/.blueprint-cloud/env.sh`) |
| `uv`, `pipeline imports`, `torch`, `ffmpeg` FAIL | `bash Blueprint-WebApp/scripts/cloud/bootstrap.sh` (as root for system packages); step logs are under `/opt/blueprint-cloud/logs` |
| `gh` WARN | Use Claude's GitHub tools for pull requests |
