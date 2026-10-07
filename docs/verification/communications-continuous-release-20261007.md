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
already bound Firebase and GitHub credentials. No credentials are copied into
the worker. Before starting, the parent supplies one authentic fresh native
proof packet using the existing incident operator; the actual process inventory
cannot be reconstructed or restamped from an earlier packet.

For a private four-file directory containing `canonical.json`, `provider.json`,
`process-proof.json`, and `authority.json`:

```sh
node scripts/communications-release-sequence-20261007.mjs release \
  /tmp/actual-fresh-native-release-proof EXACT_GREEN_MAIN_SHA \
  /tmp/new-continuous-release-output
```

Alternatively, give a generation-pinned company-storage manifest:

```sh
node scripts/communications-release-sequence-20261007.mjs release \
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
operator requires absence or literal false and never writes that variable.
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
