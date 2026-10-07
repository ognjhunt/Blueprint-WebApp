# Continuous Web and worker release custody

The lap259 recovery is already complete. This operator releases only its audited
incident fence, then acquires the normal Pipeline `research_release` lease using
the existing packaged `Store` and `LeaseChannel`. The latter renews every
20 seconds with a 180-second TTL. The deployment runs outside that queue, on the
cloud controller, so replacing the Render worker does not kill the lease owner.

This supersedes the expiring cross-thread release handoff. It does not repeat
recovery, reconcile unresolved billing, perform the separately scoped stopped
Oct6 session cleanup, activate research or communications, or send outreach.

## One execution command

Run from this reviewed Web checkout on the existing cloud controller with its
already bound Firebase and GitHub credentials. On the saved cloud's Node 24,
use `node --use-env-proxy` so the public version read uses its existing proxy.
No credentials are copied into
the worker. Before starting, the parent supplies one authentic fresh native
proof packet using the existing incident operator; the actual process inventory
cannot be reconstructed or restamped from an earlier packet.

The parent can prepare that one packet in the existing native worker shell:

```sh
node communications-release-native-proof-20261007.mjs \
  /tmp/ACTUAL_EXISTING_ABF348_CODE_DIRECTORY \
  FRESH_PLATFORM_GS_URI ACTUAL_PLATFORM_GENERATION ACTUAL_PLATFORM_SHA256 \
  /tmp/new-native-release-proof-output
```

Copy this published script into the native shell and verify its source SHA first.
It verifies the nine previously reviewed `abf348c30` helper hashes, downloads the
generation-pinned fresh platform packet, reads the original recovery archive,
collects the actual native process inventory and assembles fresh proof using
existing helpers. It preserves the immutable audited authority and rotates only
per-proof hashes. Canonical/provider bytes remain exact historical evidence;
they are not re-collected or labeled current. It writes no database records,
replays no recovery and calls no inference provider. Its final JSON contains the
manifest URI, generation and hash for the single cloud execution below.

For a private four-file directory containing `canonical.json`, `provider.json`,
`process-proof.json`, and `authority.json`:

```sh
node --use-env-proxy scripts/communications-release-sequence-20261007.mjs release \
  /tmp/actual-fresh-native-release-proof EXACT_GREEN_MAIN_SHA \
  /tmp/new-continuous-release-output
```

Alternatively, give a generation-pinned company-storage manifest:

```sh
node --use-env-proxy scripts/communications-release-sequence-20261007.mjs release \
  gs://blueprint-8c1ca.appspot.com/operations/communications/incident-20261006/ACTUAL_OBJECT \
  EXACT_GREEN_MAIN_SHA /tmp/new-continuous-release-output \
  ACTUAL_MANIFEST_GENERATION ACTUAL_MANIFEST_SHA256
```

The manifest has schema `blueprint.outreach-release-proof-files.v1` and exactly
four `files` rows. Each row contains the original file `name`, generation-pinned
`uri`, decimal-string `generation`, exact byte count `bytes`, and `sha256`.
Every child is read at that generation and checked against metadata, byte count
and hash. Private files, exact native observations, and approval references stay
in company storage; none belong in public commits.

There are no parent relay steps after initial proof admission. The command
checks exact green main, the disabled deployment workflow, no active competing
main CI/deployment, and automatic deployment admission absent/literal false.
The normal CI workflow observes its own `vars` context after the existing five
checks. With no checkout, secret or API request, it classifies this one key as
`absent`, `literal_false`, or `blocked`. Only the first two execute a dynamically
named confirmation step. A blocked value leaves ordinary CI green and supplies
no usable release confirmation. No other variable values are retained.

The controller reads the actual job and steps through its existing authorized
Actions API binding. It checks exact main/push/CI identity, source SHA, current
attempt, complete job inventory, unique successful producer/confirmation steps,
and bounded step timestamps. Missing, skipped, stale or ambiguous observations
reject before any lease mutation. This supported workflow-context observation
does not call the denied Variables API or treat HTTP403 as absence. The
authenticated metadata receipt is archived privately before fence release.

GitHub supplies a workflow context before execution; a successful confirmation
does not prove when configuration was resolved or lock future changes. Parent's
actual configuration-writer hold must start before that CI run is created and
span the release. Record it using the existing owner-direction/proof flow:
include `github-configuration-writers` in `frozenWriters`, and retain
`writerFreezeEvidence.githubConfiguration` with the actual integer
`heldSinceMs` and nonempty `evidenceRef`. Keep existing freeze evidence fields.
The native preparer already preserves these proof fields; it creates no hold
evidence or new authority. Missing or late hold evidence rejects admission.
For an old confirmation, the existing Actions operator can rerun only this
read-only observation job; it must preserve the hold covering the original run's
context admission. The controller never refreshes or dispatches it automatically.

It retains the proof, invokes the existing `fenceLease(..., 'release-fence', ...)`,
retains acquisition intent, and checks the exact released predecessor inside
every normal acquire transaction retry. A successor is never overwritten even
when its lease has expired. Existing actor holds must span the short transition.

With its canonical lease held, it enables the existing deployment workflow only
for one exact-SHA dispatch. A unique durable token identifies that run even if
the dispatch acknowledgement is lost. It restores/readbacks the disabled
workflow, polls the token's run while retaining automatic lease renewal, and
verifies the existing exact Web/worker deployment, health and readiness gates,
required OFF-mode readback, and live public version. Only then does it release
its own owner/generation and verify expiry zero.

## Controls and unknown outcomes

The optional normal deployment input `release_hold=true` verifies the fixed
services actually being deployed before and after deployment. It requires
literal false research/communications flags, absent or false Web ops admission,
bootstrap disabled on both services, the worker's existing forward-only mode,
absent/empty `NODE_OPTIONS`, the supported start commands, main branch and Render
auto-deploy off. No config is repaired or inferred by the operator.

Automatic post-CI deployment additionally requires the explicit repository
variable `BLUEPRINT_AUTOMATIC_DEPLOY_ENABLED=true`. Its default is off; this
operator requires observed context absence or literal false and never writes
that variable. The held deployment guard also checks its own context before and
after deployment. Those are context observations, not fresh configuration GETs;
continuity depends on the explicitly evidenced configuration-writer hold.
This machine gate prevents unrelated CI from deploying during the brief workflow
enable window. The parent continues to hold other authenticated deploy writers.

Acquisition and dispatch intent are retained and hash-verified in the existing
private operations bucket before their effects. Unknown acknowledgements never
cause acquisition or deployment retries. Lease calls await the existing bounded
canonical SDK transactions and drain the queue before timer cleanup, avoiding a
late acquisition starting a heartbeat after a premature timeout.

Deployment discovery is bounded to 90 seconds and execution to 60 minutes.
Failure stops further admission, reconciles only the unique dispatch token,
requests cancellation of that GitHub run where applicable, retains the uncertain
identity and leaves OFF controls intact. GitHub cancellation does not prove a
Render deploy stopped. Unverified deployment never causes normal lease release;
its eventual expiry is not successor authority. Recovery remains observe-only
until its exact owner, generation, workflow and Render deployments are read back.

## Validation

The focused tests consume the actual hash-verified packaged `Store` and
`LeaseChannel`, and execute the real inline workflow hold reader with offline
responses. They cover renewal beyond the old incident TTL, intervening expired
successors, unfinished laps, ambiguous/delayed acquire acknowledgements, lost
renewal, missing verification, retained byte bindings, changed flags/bootstrap,
preloads, mismatched service variables and unsupported deployment recipes.

Live execution needs a fresh native packet; old successful recovery proof stays
historical evidence and is never relabeled as current runtime proof. The original
Oct6 cleanup and 7 a.m. research admission require their separate existing
authority, retained IDs/evidence, mailbox dedupe and budget gates.

## Prospective release after the skipped deployment

The failed guarded deployment performed no Render POST. Its exact normal lease
was separately settled to expiry zero, preserving its generation and the original
incident audit. The original `release` command remains bound to that audit and
must not be replayed against a successor. A separately requested prospective
release uses `release-settled` with generation-pinned settlement evidence:

```sh
node --use-env-proxy scripts/communications-release-sequence-20261007.mjs release-settled \
  FRESH_NATIVE_MANIFEST_URI EXACT_GREEN_MAIN_SHA /tmp/new-prospective-release \
  MANIFEST_GENERATION MANIFEST_SHA256 \
  SETTLEMENT_URI SETTLEMENT_GENERATION SETTLEMENT_SHA256
```

This verifies the exact current settled owner/generation/expiry zero and the
unchanged audit and completed lap, then uses the same packaged canonical acquire
and heartbeat. It does not replay recovery or decrement a generation. Changed
predecessors, audit or lap evidence reject before acquisition.

The explicit prospective dispatch adds `repair_bootstrap=true`. In the existing
held deployment job, the three OFF checks must pass before any settings write.
Only an authenticated404 for `BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP` on each of
the two fixed services permits one single-key PUT with `{ "value": "true" }`.
A configured nontrue value is refused. The writer preserves unrelated variables,
retains intent/status evidence, and requires a fresh literaltrue GET. There are
no update retries; unknown acknowledgements remain observe-only.

These two settings prevent local env overrides during startup. They change no
credential, permission, identity or access, and activate no outreach loop. The
supported single-key API is documented at
https://api-docs.render.com/reference/update-env-var. This API save path avoids
the MCP merge tool's additional automatic deploy call; the same existing job
performs the one exact-SHA deployment only after protective GET readbacks pass.
The controller's normal heartbeat owns both configuration repair and deployment.
The after-deploy guard is read-only and verifies both services still held OFF.
