# Archived queue replay source

This nonrelease branch publishes four approved source files and their SHA256 inventory. It includes no private fixture catalog, capture IDs, bearer links, raw traces, receipts or customer media. It has not been rerun, merged or deployed. Its base is WebApp `eda83741bd06026f9ad4e9e8fa16417bdc1d432c`.

The controller and worker are the exact archived bytes used for the final 20 intake/outbox boundary traces. Those traces support actual Express intake, durable Firestore emulator state, separate worker processes, synthetic Resend HTTP responses and real process interruption/recovery. They completed 20 expected boundary outcomes, with **zero complete upload-to-customer-assessment journeys**. These are repeated execution of the same 20 semantic cases, not additional unique journeys.

The trace records prove worker revision `c34ce0be7595c7835a4825a1a980c030b3f9dcf5` and controller revision `261bf38c01e1898712a2e06c75d0ecf321f68556`. The post-run launch record declares the backend main worktree at c34 with unchanged before/after hashes, but no backend PID/environment/SHA attestation or timestamped original snapshots survived. **The final loaded backend revision is independently unproven.** An earlier copied snapshot at backend2e5/worker9a18 belongs to a prior run, not the final run.

The published E bootstrap SHA256 `49425a2e6091f75dfa3313fd0cfebce718511489c5d66f3185eb4b1c4d5599fc` differs from the final declared main bootstrap `8d59d8c7c15e61c98f063789d03c77e9782d799f6adcb236f4086751deacd927` in Vite cache/HMR isolation. This is an archived replay harness, **not a byte-identical reconstruction of the final backend**. The archived bootstrap uses a shared Vite cache/default HMR listener: run it alone, without other UI launchers.

## Setup

Use a disposable machine with this branch checked out at `/workspace/reliability-b`, Node supporting `--import tsx`, and its locked dependencies installed using `npm ci`. Use already-authorized local Firebase Firestore and Storage emulators at `127.0.0.1:8080` and `127.0.0.1:9199`, serving only disposable demo infrastructure. This publication does not provision them or require credentials. Any separate emulator CLI must use its own private TMPDIR to avoid shared Storage blob-directory interference.

Reserve `demo-blueprint-reliability-b` exclusively for this replay and leave port4182 free. There must be no other worker, customer record or owner using that namespace: the controller closes previous synthetic B notification intents during replay. Preserve any existing `/workspace/reliability-program/B/emulator` directory in a separately named private archive before execution. The controller then writes private results under that fixed path. Do not publish that directory.

The exact historical source has fixed path guards; it is reusable with this documented layout, not arbitrary-checkout portable. The repository's actual server/client/shared code and locked dependencies are required, including firebase-admin, tsx, Express, Vite and its React/theme plugins. No private fixtures are needed. Source files supply clearly synthetic demo encryption/review constants and local sink credentials, never production credentials.

## Replay

From `/workspace/reliability-b`, with an ordinary Node executable on the supplied PATH:

```sh
env -i PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/bin:/usr/bin:/bin NODE_ENV=test FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 RELIABILITY_BACKEND_ROOT=/workspace/reliability-b RELIABILITY_WORKER_ROOT=/workspace/reliability-b node scripts/qa/reliability-queue-emulator.mjs
```

Adjust only PATH to the installed Node location if needed. The above runs this branch's archived bootstrap and production source, not the historical c34 checkout. To evaluate a separate `/workspace/reliability-main` checkout, set both root variables to that path after recording its revision and source hashes; the worker explicitly permits that path. An exact historical shell argv/environment receipt was not retained; the documented invocation is reconstructed from declared configuration and reviewed source.

The controller starts and stops its own backend child. Model providers and real email are disabled; worker calls to Resend are intercepted by static SDK HTTP responses, and other fetch traffic is restricted to loopback with redirects rejected. This is application-level isolation, not kernel or production IAM proof. Inspect actual trace statuses and child exit receipts, not merely a process success code. Replays do not establish live provider performance, customer delivery, video perception, production storage compare-and-swap or complete assessment publication. Local/CI compute cost remains unknown; simulated provider cost is not a paid receipt.

Source hashes and dependencies are listed in `queue-replay-source-manifest.json`. No replay was performed for this publication.
