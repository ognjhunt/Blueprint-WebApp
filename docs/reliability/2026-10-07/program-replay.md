# Reliability program replay

The supplemental returning-owner replacement-upload case uses the existing private-link runner:

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true ./node_modules/.bin/playwright test --config playwright.site-reliability.config.ts
```

Run in a disposable checkout containing reviewed `b18234b4` or its released descendant, with existing Chromium and `ffmpeg`; port42874 must be free. The runner starts its own isolated Vite server and blocks external traffic. Retained exact4d baseline fails the new visible-picker case; candidate passes that case and three existing neighbors. APIs are intercepted and the MP4 contains generated pixels. This adds one separately recorded UI regression, no original catalog or real-backend/provider coverage. Retained baseline/candidate receipts live under `output/reliability-program/replacement-upload/`. The default Playwright suite excludes these private-link cases; required CI invokes their explicit config in a separate step. Original c29 CI failed `ffmpeg ENOENT`; b182 moves the unchanged existing generator setup before that step, without weakening assertions.

Run from a disposable checkout containing the integrated program files and its existing installed dependencies. The author branch alone does not contain the joined runner. Record `git rev-parse HEAD`, dirty source hashes, frozen catalog versions, and each result receipt; a replay is a new run, not a replacement for a retained failed run. This guide describes setup and commands, not a claim that a new run passed.

| Runner | Frozen semantic cases / layer | Limits |
| --- | --- | --- |
| Intake component/helper inventory | 90: 30 intake, 30 return, 30 scope/authority; offline | Additional regressions and assertions do not increase the 90-case denominator. No backend access proof. |
| Queue inventory | 150; fake database/provider fault replay | No real provider or production storage. |
| Transport/status inventory | 60; fake transport/storage/status fault replay | No real upload-provider transport. |
| Worker journeys | 20; real handlers with serialized fake database/object store, fake provider and mail sink | Five restore cases reload serialized state; they are not OS process restarts or Firestore emulator runs. Keep separate from the 300 offline cases. |
| Intercepted browser runner | Twelve UI traces (eight original plus four cross-tab) | APIs are intercepted. Orderly browser shutdown plus imported storage state does not establish abrupt crash durability or chunk resume. |
| Joined browser runner | 22 normal UI traces (21 original plus one explicitly frozen supplemental); real Express handlers, loopback Firestore emulator, fake object store/provider/local mail | UI020 uses orderly native browser return; UI021 uses SIGKILL then the queued email-link route and fresh worker processes. Supplemental UI022 uses literal SIGKILL before a held upload-write acknowledgement, then the ordinary form and the same native profile; it checks automatic identity recovery and one byte-identical fixture upload. Root final reviewed8b/mergedd898 full22 passes; baseline and repeated attempts remain separate receipts. |
| Deployed presentation smoke | Production GET/presentation/local draft only | No intake submission, upload, login, worker, provider, assessment or email delivery proof. |

The joined runner exercises coverage processing and persisted customer status. It does **not** exercise the final site assessment or establish video perception, citation entailment, robot suitability, human reference quality, or live provider behavior. Its video is a two-second generated test pattern. Fake provider output explicitly says the work area was not observed. Latency belongs to the local emulator/fake layer; simulated provider usage cannot be reported as production cost.

## Existing runtime and clean environment

For an already-authorized private assessment packet, replay admission without a provider call:

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true node --import ./node_modules/tsx/dist/loader.mjs scripts/reliability/validate-retained-assessment.ts --packet /absolute/authorized/private/packet.json --duration ACTUAL_VIDEO_SECONDS --baseline-sha 1b8d810ec117b93fe52fd323be052ddafa7070db --candidate-runtime-sha EXACT_40_CHAR_RUNTIME_SOURCE_SHA --output output/reliability-program/retained-assessment-admission.json
```

The optional candidate runtime SHA must match the actual validator bytes. Checkout SHA, runtime hash, baseline function hash and packet hash remain separate. The script preserves the raw packet and emits sanitized admission outcomes only. A rejected candidate packet is a recorded failure or guard catch, never rewritten into a passing provider evaluation. It proves neither semantic truth nor video perception. Keep private packets and outputs out of public CI.

Use the repository's installed Node dependencies, cached Playwright Chromium, installed `ffmpeg`, Java and cached Firestore emulator jar. Do not download browsers, install infrastructure, provision credentials, or substitute a shared customer project. Observed local paths were `/opt/homebrew/opt/openjdk@22/bin/java` and `$HOME/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar`; overrides below must name already installed local files. The joined runner uses `chromium.executablePath()` and requires that cached binary; it does not honor an arbitrary browser executable override.

All commands use `env -i`. Only the runtime `PATH`, existing `HOME` (for cached tools), and `TMPDIR` are inherited, plus the explicit fixture flags shown. No provider, Firebase service account, notification, KMS, budget or production environment values are allowed. The harness sets its own fake Firebase frontend values, deterministic local encryption fixture, empty KMS key name, disabled automation, fake model and recipient-validating mail sink. Vite loads no dotenv files. The worker child receives the same clean runtime plus test-only emulator and receipt flags. Never add production credentials to make a replay pass.

## Offline and fake-worker replay

These commands do not start an emulator or dispatch paid calls or email. Keep the four result layers separate. The first command includes neighboring regression checks; its test assertion count is not the semantic-case count.

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true node node_modules/vitest/vitest.mjs run client/tests/components/SiteCaptureStart.test.tsx client/tests/components/SiteCaptureStart.recovery.test.tsx client/tests/lib/siteCaptureDraft.reliability.test.ts --maxWorkers=1 --minWorkers=1
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_QUEUE_OUTPUT=output/reliability-program/queue/replay node node_modules/vitest/vitest.mjs run server/tests/reliability-program-queue.test.ts --maxWorkers=1
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_TRANSPORT_STATUS_OUTPUT=output/reliability-program/transport-status/replay node node_modules/vitest/vitest.mjs run server/tests/reliability-program-transport-status.test.ts --maxWorkers=1
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_QUEUE_OUTPUT=output/reliability-program/queue/replay-worker node node_modules/vitest/vitest.mjs run server/tests/reliability-program-worker-journeys.test.ts --maxWorkers=1
```

Save terminal receipts under ignored `output/reliability-program/` with restrictive permissions. Queue/transport runners emit their own catalogs and result files in the specified folders. Intake definitions and original receipts remain in `program-intake.json` and `program-intake-results.json`. Changing meaningful conditions requires an explicit catalog correction; repeated attempts do not become new cases.

## Eight original intercepted UI traces

Port 42879 must be free; the dedicated Vite config uses strict port binding and refuses an existing server. The test generates its own synthetic transport fixture with existing `ffmpeg` and records traces/results under the chosen ignored output folder. `--grep-invert` preserves the original eight-case replay after the supplemental cross-tab slice; omit that filter to run all twelve. See `program-intake-cross-tab.json` for the four new cases and repeat command.

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_INTAKE_OUTPUT=output/reliability-program/intake/browser-replay node node_modules/@playwright/test/cli.js test --config playwright.reliability-intake.config.ts --grep-invert UI-CROSS-TAB
```

## Joined 22 UI traces with an owned emulator

The harness clears **all documents** in `demo-blueprint-reliability` before each case. Never attach it to someone else's emulator. The following subshell refuses occupied ports 8085 and 42878, starts only its own loopback demo emulator, verifies that its recorded Java PID owns port 8085 before running any clearing test, and stops only that PID on exit. While the coordinator's emulator is running, this command must fail at the port check. Do not kill processes by name or port, or remove another run's files to free a port.

```bash
(
  set -euo pipefail
  umask 077
  replay_node="$(command -v node)"
  replay_java="${RELIABILITY_JAVA:-/opt/homebrew/opt/openjdk@22/bin/java}"
  replay_jar="${RELIABILITY_FIRESTORE_JAR:-$HOME/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar}"
  test -x "$replay_java" && test -r "$replay_jar"
  test -f node_modules/vitest/vitest.mjs
  test -f node_modules/vite/bin/vite.js
  command -v ffmpeg >/dev/null
  command -v lsof >/dev/null
  "$replay_node" -e 'const fs=require("node:fs"); const {chromium}=require("@playwright/test"); if(!fs.existsSync(chromium.executablePath())) throw Error("Existing cached Chromium required; do not install during replay")'
  "$replay_node" <<'NODE'
const net = require("node:net");
(async () => {
  for (const port of [8085, 42878]) {
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    }).catch(() => { throw Error(`Port ${port} occupied or unavailable; preserve its owner and stop replay`); });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
NODE
  replay_run="$(date -u +%Y%m%dT%H%M%SZ)-$$"
  replay_dir="output/reliability-program/emulator-replay/$replay_run"
  mkdir -p "$replay_dir" output/reliability-program
  # Keep an existing program synthetic fixture; never replace it with customer footage.
  if [ ! -e output/reliability-program/journeys-fixture.mp4 ]; then
    ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc=size=320x240:rate=30 -t 2 -c:v libx264 -pix_fmt yuv420p -y output/reliability-program/journeys-fixture.mp4
  fi
  replay_emulator_pid=""
  trap 'if [ -n "$replay_emulator_pid" ]; then kill "$replay_emulator_pid" 2>/dev/null || true; wait "$replay_emulator_pid" 2>/dev/null || true; fi' EXIT
  env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" "$replay_java" -jar "$replay_jar" --host 127.0.0.1 --port 8085 --project_id demo-blueprint-reliability --single_project_mode true --single_project_mode_error true --rules firestore.rules --export-on-exit "$replay_dir/export" >"$replay_dir/emulator.log" 2>&1 &
  replay_emulator_pid=$!
  printf '%s\n' "$replay_emulator_pid" >"$replay_dir/emulator.pid"
  replay_ready=0
  for replay_poll in $(seq 1 40); do
    kill -0 "$replay_emulator_pid" 2>/dev/null || break
    if lsof -nP -a -p "$replay_emulator_pid" -iTCP:8085 -sTCP:LISTEN >/dev/null; then
      replay_ready=1
      break
    fi
    sleep 0.5
  done
  test "$replay_ready" = 1 || { printf '%s\n' 'Own emulator did not bind; inspect its log; do not attach another process'; exit 1; }
  env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_FIRESTORE_EMULATOR=1 FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 "$replay_node" node_modules/vitest/vitest.mjs run --config vitest.reliability-program.config.ts
)
```

For selected high-risk repeats, append `-t 'UI-006|UI-019|UI-020|UI-021|UI-022'` to the Vitest command and keep each run. Five selected cases attempted three times remain five distinct cases; the other 17 are unattempted in those selected runs. UI022 is one supplemental semantic condition, never three independent journeys.

The runner retains timestamped `output/reliability-program/journeys/runs/<run-id>/catalog.json` and `results.json`, screenshots and case evidence, plus latest aliases. Catalogs hash source files and the fixture; retain the exact fixture and receipts privately for replay. UI021 automatically launches the fresh worker using `RELIABILITY_WORKER_ONLY=1`; do not run that worker independently without the case's matching persisted records. The harness owns and closes its Express, Vite and Chromium processes. If interrupted before cleanup, identify only this run's recorded processes and children; never stop shared services. Logs, demo exports and browser profiles remain private ignored artifacts, not public CI uploads. This documentation change did not launch an emulator or execute the joined suite.

## Deployed GET-only presentation check

Use a verified deployment receipt's exact 40-character merged/deployed SHA. The placeholder below intentionally fails validation until replaced. `baseline` retains observed failures without requiring candidate behavior; `candidate` exits nonzero on a missing presentation gate or identity mismatch. Keep baseline and candidate folders separate.

```bash
replay_expected_sha='REPLACE_WITH_VERIFIED_40_CHARACTER_DEPLOYED_SHA'
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" node node_modules/tsx/dist/cli.mjs scripts/reliability/verify-deployed.ts --expected-sha "$replay_expected_sha" --mode candidate --output output/reliability-program/deployed-candidate
```

The script probes public version/health/readiness, edits synthetic draft fields locally, reloads and captures bounded evidence. It aborts all non-GET/HEAD and external requests, never clicks submit, and clears its own local draft and browser context. A matching SHA or retained draft is presentation evidence only. See `program-deployed-smoke.md` for the retained production baseline ; the coordinator owns independent review, current run receipts, deployment and readiness decisions.

Add `--verify-clear` only for a deployment that includes the reviewed durable-clear acknowledgment repair. This explicitly versions the presentation receipt to v2 and requires the actual Clear control's completed acknowledgment, matching local/IndexedDB empty draft with a fresh retry identity, and an empty return that retains that identity without consent. Scoped WebLocks drain this isolated context's preceding autosaves before comparing stores. All network restrictions remain; clearing affects only the newly created anonymous browser's synthetic recovery data. It provides no backend job or deletion evidence. Use a fresh private output folder for every deployment; the historical default v1 smoke remains available unchanged.

## Explicit stale-source follow-up (PR941)

The candidate is `e048c74e7eeaf44996ce17a0e24b48d8d985104d`, based exactly on merged/deployed d898. It rejects known published claims citing a knowledge record explicitly marked boolean `current:false`; history/unknown/estimate sources remain retained and dates alone do not exclude evidence. The unchanged30 SDK case inputs/semantic hashes now have an explicit V9 admission expectation correction for the one stale case; two other semantic false claims remain partial. This does not change the120 provisional judgment catalog or its unscored truth labels.

```bash
mkdir -p output/reliability-program/stale-spec-replay
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_C_V2_OUTPUT=output/reliability-program/stale-spec-replay RELIABILITY_C_V2_RUN=results node node_modules/vitest/vitest.mjs run server/tests/site-assessment-semantic-sdk.test.ts server/tests/site-assessment-evidence-admission.test.ts server/tests/site-assessment-integration.test.ts server/tests/site-assessment.test.ts server/tests/site-assessment-evidence-mutations.test.ts --maxWorkers=1 --minWorkers=1
```

Actual SDK Runner/tool loop uses scripted model/video callbacks and no storage or customer publication. No provider key is needed. `program-semantic-diagnosis.json` records exact sources, before/after results and the limited guard boundary. The same seven controls on prior d898 source produce the minimized baseline6/7 result; candidate7/7. Restore only this isolated worktree's file bytes after a baseline source overlay; never mutate a shared checkout or another owner's fixture.

For Pipeline PR2648, the preserved `output/reliability-program/pipeline-owner-target/manifest.json` contains exact baseline/candidate revisions, fourteen checked source/log hashes, setup and existing pytest/Ruff replay commands. The independent reviewer additionally transports the staged unknown and explicit targets through the real rigid/articulated CPU consumers. Those disposable synthetic checks permit geometry and refuse unconfirmed performance authority; no paid provider or completed customer result is exercised. Required production promotion must run against the new exact merged SHA.

Selected SDK diagnostics can be replayed with the existing `site-assessment-semantic-sdk.test.ts` runner and `-t 'V2-corrected-knowledge-current-spec|V2-conflicting-owner-spec-video|V5-admitted-field-wrong-claim'`, using the sanitized offline environment above. Set `RELIABILITY_C_V2_OUTPUT` to a new private output directory and `RELIABILITY_C_V2_RUN` to a distinct attempt name; each command attempts three of thirty cases and leaves twenty-seven unattempted. A passing harness preserves two known semantic failures, explicitly recorded as partial/admitted in the receipt.

The existing120 typed variants also replay through the actual SDK using `server/tests/site-assessment-mutations-sdk.test.ts`. Use the sanitized offline environment and `RELIABILITY_C_SDK_OUTPUT` pointing to a fresh private directory, as documented in `program-semantic-sdk.md`. Requires the PR942 recursive guard; no provider keys, video bytes or emulator. The120-test result contains264 fixed scripted attempts,72 original structural passes and48 provisional unscored semantic states. The additional12 stale-source admission assertions do not create12 new truth samples. Original baseline and candidate receipts are preserved separately.

### Installed Pipeline compiler smoke

The identical source for the10:50:43UTC installed-a56 compiler smoke is `scripts/reliability/pipeline-installed-compiler-smoke.py`, SHA256 `50933962d699dbcbf31d4f36d53bd4b012a99d15ee68d3e3250831180cf10f54`. It reuses synthetic geometry and normal unknown/explicit owner targets; fixture rights/budget values are inert test data, not provider spending authority. Its inspected-path guards block provider/storage SDK imports, socket/subprocess use and audited writes outside its owned temporary directory; they are not a general sandbox for arbitrary native code. The tested path contains no materializer, native publication, customer record or provider dispatch. Verify an isolated Pipeline checkout is exacta56 and use its existing interpreter with NumPy, trimesh and Pillow. This local replay does not repeat a production deployment.

```bash
env -i PATH="$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/path/to/isolated/BlueprintCapturePipeline/src BLUEPRINT_WEBSITE_OBJECT_SPEC_AGENT=0 /path/to/isolated/BlueprintCapturePipeline/.venv/bin/python scripts/reliability/pipeline-installed-compiler-smoke.py
```

The installed execution independently checked active Git identity before and after; its private result hash and exact compiler source digest are indexed in program-release.json. The stage3 continuation refuses absent same-source completed authoring evidence and retains its incomplete trace in program-prerequisites.json; it adds no full journey credit.

### Preparation receipt fence (PR2650)

On isolated Pipeline candidate3a2897bb or its exact merged descendant0a17f52, use the existing Python3.12 interpreter/dependencies:

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src:. /path/to/existing/Pipeline/.venv/bin/python -m pytest tests/test_website_preparation_status.py tests/test_live_pipeline_import_isolation.py -q
```

The retained36status checks and5cold-import controls are separate suites, with no provider or production database calls. Both minimized older-ACK cases fail on actual91-source bytes with generated birth/lease fixtures and fake owner/context/callback transports. The candidate preserves a genuinely newer acknowledgment and rejects a ledger advance after postflight. Evidence is indexed by exact source/log/receipt hashes in program-release.json; the canonical test source is in company Git. Fresh exact merged-SHA promotion and canonical deployment are separate requirements. No exactly-once callback or live customer outcome is implied.


## Retained SDK browser/accounting replay

The existing supplemental runner is preserved in company Git at `2af4b4da4b65466b9035d75975a26e569243833a`, paths `server/tests/reliability-program-assessment.browser.ts` and `vitest.reliability-program.config.ts`. Its final runner SHA is `20fc741f186661d782738d76501227250949e82251149d392e10b18786ec1d48`. That publication adds no new cases. The retained nine passing attempts executed runtime `b426d099`, not the newer publication or PR974 runtime. Three cases repeat three times: normal completion, literal Chromium termination during upload, and fresh worker recovery after private completion but before queue acknowledgement. Earlier nine attempts (six pass/three fail) remain retained with the explicit browser-driver cleanup corrections.

Use a disposable checkout, the existing cached runtime setup and exclusively owned emulator/ports described above. To replay the retained source combination, start from `b426d0991c1cf34e5acbdaf62ce7c97be0d225dc` and copy the two published runner/config paths from `2af4b4da` with `git show` into that disposable checkout only. Restore the retained authorized synthetic pattern to `output/reliability-program/sdk-browser-pattern.mp4`; its bytes and hash are in the private receipt's retained-final-readback, not a customer video. With your owned emulator already listening, invoke:

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_FIRESTORE_EMULATOR=1 FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 RELIABILITY_ASSESSMENT_ONLY=1 node node_modules/vitest/vitest.mjs run --config vitest.reliability-program.config.ts --maxWorkers=1 --minWorkers=1
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_FIRESTORE_EMULATOR=1 FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 RELIABILITY_ASSESSMENT_RESTART_ONLY=1 node node_modules/vitest/vitest.mjs run --config vitest.reliability-program.config.ts --maxWorkers=1 --minWorkers=1
```

Do not connect an external diagnostic CDP client during execution. The worker case uses an explicit test-only dispatcher hold, manual ticks and an after-private-commit pause. Actual SDK/private writer/native Firestore records and owner bindings are exercised; objects, provider responses and notification delivery are local fakes. This proves neither live video accuracy, live provider pricing nor production automatic scheduling. Raw bearer traces stay private; no full emulator export/import is claimed. Receipt `cf2e771faa214eb66b4279995a0f8b26168b884314e2ed863ee3bac1c36cac42` indexes 154 retained artifacts and the exact frozen source pins.


## Retained189 public smoke and actual customer recovery

Company Git branch `codex/reliability-advisory-longrun-20261008` retains exact observer source68dac0ef3a76247cdee9fdfd229bf4597f2f7556 (script SHA25cccefcced8f05a3f3805cd73873f4a70191958c16c1b2da0e97d3ae67b31ff). Its one actual run is **presentation_failed**, with21other checks/all9Clear controls passed. Do not overwrite the retained failed result, silently remove the historical seven-day-copy assertion, or rerun to hide failure. Public GET/localdraft evidence is separate from the actual customer/provider recovery.

With that source, existing Node22.21.1/dependencies/cached Chromium, use a fresh output folder:

```bash
env -i PATH="/Users/nijelhunt_1/.nvm/versions/node/v22.21.1/bin:/opt/homebrew/bin:/usr/bin:/bin" HOME="/Users/nijelhunt_1" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=1 node node_modules/tsx/dist/cli.mjs scripts/reliability/verify-deployed.ts --expected-sha 189fc91d9520e0965efd4bedfdd6fb6ebcd50ca9 --mode candidate --verify-clear --output output/reliability-program/deployed-fresh-replay
```

Expected189 is historical: a later deployment must fail this identity check. Review the actual containing release/contract before deliberately selecting a new expected SHA; no production rollback is required to inspect the retained evidence. The runner blocks nonGET/external traffic, submits no intake and uses no credentials/provider/email.

Eleven preserved smoke files and their hashes are at private `/Users/nijelhunt_1/Documents/Codex/2026-10-08/blueprint-reliability/public-smoke-189-68dac0ef/preservation-index.json` (SHAc09c9f4a028afbdfa952924bebad39439861ddb89dcd68606d98847ec0e9620a),0700/0600. This preserves originals outside the removable author worktree. Actual customer recovery has its separate private final `normal-assessment-combined189-terminal-20261008.json` export SHAeecb9eb0b7de8c16194e487b80cab8d6a328adfb3a289381b90ac2faf14ba19f in the existing dishwasher reconciliation folder; linked observable/readback/UI/retirement/runtime/notices receipts support inspection without another model call. Neither command nor artifact is an accuracy certificate.

## Current retention correction

The 2026-10-09 preservation audit retained the frozen catalogs, source pins, original author result records and accepted189 live receipts outside worktrees. The exact final8b integrated300 JSON and original21/final22 coordinator browser result hashes were not located in nine checked output roots. Historical execution summaries are retained in company Git, but they cannot recreate missing raw traces. Use a fresh owned output directory/run ID for any replay, preserve its actual source and result hashes, and keep it separate from the original count and failures. The compact private audit and copied-file index are in `/Users/nijelhunt_1/Documents/Codex/2026-10-08/blueprint-reliability/evidence-preservation/`; see the current trace-index record for its hash and limits.

## Current 300-case v2 replay

The one scored current v2 execution passed 300 distinct cases, 30 in each of ten families, with 376 underlying assertions. The 13 explicitly versioned intake definitions replace obsolete observers; the other 287 case definitions and hashes remain unchanged. The prior 287-pass/13-blocked run and development fixture failure are retained. They are not additional independent cases.

The retained private pinned replay helper requires checkout `6e0dfb6e1229bde89568087576b6cce69da0cce6`, the existing Node 22.21.1 dependencies, unchanged test hash, original source pins, and the reviewed private catalog hash. The helper binds its checkout to `/Users/nijelhunt_1/.codex/worktrees/reliability-customer-assessment-basics-20261008/Blueprint-WebApp`; preserve its owner and verify that exact checkout has the required HEAD. A different disposable checkout requires an explicitly recorded helper path correction, not an unrecorded substitution. Invoke:

```bash
python3 /Users/nijelhunt_1/Documents/Codex/2026-10-08/blueprint-reliability/current-offline-replay/intake-current.v2/replay_current300_pinned6e.py
```

Helper SHA256: `b097b1129484267e8568ff645ea2d7cbf9a2c674c031f010921efe7b582a0be8`; catalog SHA256: `52c53b3a70d40b16091d834d200562354be7a03913c963a51d970e9d04642032`. It checks the exact source before running one existing Vitest child in a clean environment with local bootstrap disabled, then maps actual results to semantic case IDs. It writes new private outputs and never overwrites the scored receipt. No credentials, emulator, browser, model dispatch or external notification are used. Preparation and review of this portable helper are not another executed run. Retained scored result SHA256: `bb2d6bb159ca7e92f4f3e3a04161e97a014cdf4cdaebd8839fdda7dba7ce8acf`; independent mapping review SHA256: `5afb811f181eb3d85fa10b49f674026b1ab4926d5b5d0866e15822b11cf7ecb3`. Access to the authorized private catalog and unexpired retained artifacts is required; do not publish those raw files in CI.
