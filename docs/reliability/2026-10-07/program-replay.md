# Reliability program replay

Run from a disposable checkout containing the integrated program files and its existing installed dependencies. The author branch alone does not contain the joined runner. Record `git rev-parse HEAD`, dirty source hashes, frozen catalog versions, and each result receipt; a replay is a new run, not a replacement for a retained failed run. This guide describes setup and commands, not a claim that a new run passed.

| Runner | Frozen semantic cases / layer | Limits |
| --- | --- | --- |
| Existing coordinator intake/helper checks | Coordinator original90 plus separately frozen additions; offline | Use coordinator catalogs; this supplement does not import the independent peer intake catalog or historical results. |
| Queue inventory | 150; fake database/provider fault replay | No real provider or production storage. |
| Transport/status inventory | 60; fake transport/storage/status fault replay | No real upload-provider transport. |
| Worker journeys | 20; real handlers with serialized fake database/object store, fake provider and mail sink | Five restore cases reload serialized state; they are not OS process restarts or Firestore emulator runs. Keep separate from the 300 offline cases. |
| Coordinator intercepted browser checks | Existing dedicated intake runner; intercepted APIs | Keep its retained conditions separate from this supplement's21UI definitions. |
| Joined browser runner | 21 normal UI traces; real Express handlers, loopback Firestore emulator, fake object store/provider/local mail | UI020 uses orderly native browser return; UI021 uses SIGKILL then the queued email-link route and fresh worker processes. Automatic local draft recovery after SIGKILL was not established. |
| Deployed presentation smoke | Production GET/presentation/local draft only | No intake submission, upload, login, worker, provider, assessment or email delivery proof. |

These are supplemental definitions from peer source `b70f5539f402f5ec4edabd1e18bf290dd4540447`, imported separately. They do not add150/60/20/21 to coordinator coverage: semantic overlap and executed source versions require review. Importing a runner is not fresh execution.

The joined runner exercises coverage processing and persisted customer status. It does **not** exercise the final site assessment or establish video perception, citation entailment, robot suitability, human reference quality, or live provider behavior. Its video is a two-second generated test pattern. Fake provider output explicitly says the work area was not observed. Latency belongs to the local emulator/fake layer; simulated provider usage cannot be reported as production cost.

## Existing runtime and clean environment

Use the repository's installed Node dependencies, cached Playwright Chromium, installed `ffmpeg`, Java and cached Firestore emulator jar. Do not download browsers, install infrastructure, provision credentials, or substitute a shared customer project. Observed local paths were `/opt/homebrew/opt/openjdk@22/bin/java` and `$HOME/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar`; overrides below must name already installed local files. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for an already installed absolute executable (for example `/usr/bin/chromium`), or omit it to use the existing Playwright cache. Missing executables fail before launch. Set `RELIABILITY_JAVA` and `RELIABILITY_FIRESTORE_JAR` to already installed files; default Java comes from PATH. Do not install a runtime during replay.

All commands use `env -i`. Only the runtime `PATH`, existing `HOME` (for cached tools), and `TMPDIR` are inherited, plus the explicit fixture flags shown. No provider, Firebase service account, notification, KMS, budget or production environment values are allowed. The harness sets its own fake Firebase frontend values, deterministic local encryption fixture, empty KMS key name, disabled automation, fake model and recipient-validating mail sink. Vite uses an existing-empty no-env directory and refuses dotenv files there; each API port has a separate cache, filesystem watching is disabled and HMR is explicitly bound to the same42878frontend port, preventing an implicit24678socket. The worker child receives the same clean runtime plus test-only emulator and receipt flags. Never add production credentials to make a replay pass.

## Offline and fake-worker replay

These commands do not start an emulator or dispatch paid calls or email. Keep the four result layers separate. The first command includes neighboring regression checks; its test assertion count is not the semantic-case count.

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true node node_modules/vitest/vitest.mjs run client/tests/components/SiteCaptureStart.test.tsx client/tests/lib/siteCaptureDraft.test.ts client/tests/lib/selfCaptureVideo.test.ts --maxWorkers=1 --minWorkers=1
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_QUEUE_OUTPUT=output/reliability-program/queue/replay node node_modules/vitest/vitest.mjs run server/tests/reliability-program-queue.test.ts --maxWorkers=1
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_TRANSPORT_STATUS_OUTPUT=output/reliability-program/transport-status/replay node node_modules/vitest/vitest.mjs run server/tests/reliability-program-transport-status.test.ts --maxWorkers=1
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_QUEUE_OUTPUT=output/reliability-program/queue/replay-worker node node_modules/vitest/vitest.mjs run server/tests/reliability-program-worker-journeys.test.ts --maxWorkers=1
```

Save terminal receipts under ignored `output/reliability-program/` with restrictive permissions. Queue/transport runners emit their own catalogs and result files in the specified folders. Coordinator intake definitions and original receipts remain in its private owner catalogs, not this supplemental import. Changing meaningful conditions requires an explicit catalog correction; repeated attempts do not become new cases.

## Existing coordinator intercepted UI checks

Run the repository's current `playwright.intake.config.ts` explicitly in its separately owned lane. This supplemental import does not include the peer eight-case intercepted runner. Its historical results are not copied or credited here.

## Joined 21 UI traces with an owned emulator

The harness clears **all documents** in `demo-blueprint-reliability` before each case. Never attach it to someone else's emulator. The following subshell refuses occupied ports 8085 and 42878, starts only its own loopback demo emulator, verifies that its recorded Java PID owns port 8085 before running any clearing test, and stops only that PID on exit. While the coordinator's emulator is running, this command must fail at the port check. Do not kill processes by name or port, or remove another run's files to free a port.

```bash
(
  set -euo pipefail
  umask 077
  replay_node="$(command -v node)"
  replay_java="${RELIABILITY_JAVA:-$(command -v java)}"
  replay_jar="${RELIABILITY_FIRESTORE_JAR:-$HOME/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar}"
  test -x "$replay_java" && test -r "$replay_jar"
  test -f node_modules/vitest/vitest.mjs
  test -f node_modules/vite/bin/vite.js
  command -v ffmpeg >/dev/null
  command -v lsof >/dev/null
  "$replay_node" -e 'const fs=require("node:fs"); const path=require("node:path"); const {chromium}=require("@playwright/test"); const bin=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath(); if(!path.isAbsolute(bin)||!fs.existsSync(bin)) throw Error("Existing absolute Chromium required; do not install during replay")'
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
  replay_tmp="$(mktemp -d "$replay_dir/tmp.XXXXXX")"
  replay_tmp="$(cd "$replay_tmp" && pwd)"
  # Keep an existing program synthetic fixture; never replace it with customer footage.
  if [ ! -e output/reliability-program/journeys-fixture.mp4 ]; then
    ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc=size=320x240:rate=30 -t 2 -c:v libx264 -pix_fmt yuv420p -y output/reliability-program/journeys-fixture.mp4
  fi
  replay_emulator_pid=""
  trap 'if [ -n "$replay_emulator_pid" ]; then kill "$replay_emulator_pid" 2>/dev/null || true; wait "$replay_emulator_pid" 2>/dev/null || true; fi' EXIT
  env -i PATH="$PATH" HOME="$HOME" TMPDIR="$replay_tmp" "$replay_java" -jar "$replay_jar" --host 127.0.0.1 --port 8085 --project_id demo-blueprint-reliability --single_project_mode true --single_project_mode_error true --rules firestore.rules --export-on-exit "$replay_dir/export" >"$replay_dir/emulator.log" 2>&1 &
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
  env -i PATH="$PATH" HOME="$HOME" TMPDIR="$replay_tmp" NODE_ENV=test BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=true RELIABILITY_FIRESTORE_EMULATOR=1 FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 PLAYWRIGHT_CHROMIUM_EXECUTABLE="${PLAYWRIGHT_CHROMIUM_EXECUTABLE:-}" "$replay_node" node_modules/vitest/vitest.mjs run --config vitest.reliability-program.config.ts
)
```

The runner retains timestamped `output/reliability-program/journeys/runs/<run-id>/catalog.json` and `results.json`, screenshots and case evidence, plus latest aliases. Catalogs hash source files and the fixture; retain the exact fixture and receipts privately for replay. UI021 automatically launches the fresh worker using `RELIABILITY_WORKER_ONLY=1`; do not run that worker independently without the case's matching persisted records. Every Firebase CLI emulator lane must also own a distinct TMPDIR: shared global emulator temporary storage let another shutdown delete active blobs in this program. This Firestore-jar recipe retains its private runtime directory; never reuse another lane's TMPDIR. The harness owns and closes its Express, Vite and Chromium processes. If interrupted before cleanup, identify only this run's recorded processes and children; never stop shared services. Logs, demo exports and browser profiles remain private ignored artifacts, not public CI uploads. This documentation change did not launch an emulator or execute the joined suite.

## Fixture correction and results

On2026-10-08 the supplement's initial queue fixture ran against integrated coordinator guards:170scoped tests produced101passes/69queue failures. Missing current inbound capture authority cancelled provider-fault fixtures before their intended boundary. The correction explicitly seeds an owned, granted current recording-consent source in beforeEach; it does not mock or weaken the dispatcher authority guard or any expectation. The original150semantic definitions/hashes are unchanged. Keep initial failed and corrected receipts in separate private run folders. Twenty worker definitions already passed initially; they restore serialized fake state, not Firestore durability or OS restarts. Accounting checks are another separate layer. No joined browser execution was performed for this import.

Fresh exports contain code SHA and source hashes; source dirty state must be declared. Record the final merged source before peer browser execution. Preserve actual errors/failed cases rather than rerunning until green. Provider dispatch is scripted/disabled with a local notification sink; no paid cost or live delivery is authorized. Test model costUSD0 from setup is distinct from missing canonical telemetry and from CI/compute. No human audit dependency is imposed; reference labels remain provisional and video perception is unmeasured.

Production verification belongs to the coordinator's existing narrowly scoped release checks. These supplement files do not include the peer deployed-smoke script and cannot prove production intake, provider, assessment, notification or fulljourney completion.
