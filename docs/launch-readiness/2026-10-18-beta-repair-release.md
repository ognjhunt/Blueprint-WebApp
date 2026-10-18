# Beta qualified-evaluation repair release

Owner instruction: “Go ahead and fix the launch blockers and code issues across both repos, starting with the qualified evaluation path. Keep the existing safety gates, and clearly identify what still needs a real site, robot team, or my approval.” This work repairs beta evaluation request, admission, results, recommendation and booking follow-through. It does not broaden the frozen product lanes.

Accountable engineering owner: the agent implementing this repair, through release readback and the inspectable supported journey. Human blocker ID: `BP-BETA-QUALIFIED-RELEASE-20261018`. Current state: source implementation and local verification; production release and real customer acceptance remain separate gates.

## Repairs and acceptance boundaries

| Audit item | Implemented result | Remaining proof |
| --- | --- | --- |
| B1: qualified evaluation path | Pipeline consumes retained independent measurements, frozen criteria, authorized review and original source/model bytes; recomputes registration and fidelity checks; publishes a complete immutable receipt through the existing HMAC route. WebApp admits only the matching current receipt, freezes it with the run and requires matching signed result evidence before recommendation. Pipeline rechecks before credential release and at closeout. | A real site, declared robot model, independent measurements/review and a real run. Synthetic receipts and CPU rehearsals do not qualify a site. |
| B3: permission to run a policy | New requests require explicit permission. The durable grant binds the owner, request, site opportunity and exact saved setup. Admission, claim and heartbeat enforce current authority and site access. | The actual robot team must grant permission for its submitted setup; old requests without a bound grant need a new authorized request. |
| R1: blocked-run messages | Site/team notifications and recovery distinguish observed partial work, measured zero and unknown progress. | Observe the actual authorized delivery in the first real run. No test email was sent. |
| R2: booking follow-through | Booking atomically joins the selected recommended result into workspace pilot state; the existing explicit site actions record start, completion and deployment decisions. | Real site booking and site-reported physical outcomes. Booking alone never claims physical work started. |
| R3: operator instructions | Runbooks and admin form use the measured receipt path and the current 200 prescribed cells / at least 190 scored / at most 10 void rules, including required cycle time. | Operator uses the exact approved records and current runtime. |
| R4: two missing indexes | Read-only inventory and exact create-only commands are retained in the scoped plan. | Explicit approval, creation of only missing exact definitions, READY states and successful read-only query retries. |

The default provider DROID assets remain diagnostic because this boundary does not retain proof of their exact model bytes. The qualified path accepts a declared supported robot model. Application embodiment breadth and approved illustrations remain unchanged.

## Existing human and operational gates

| Owner | Required input or action | Exact completion evidence |
| --- | --- | --- |
| Site | One real, consented capture; confirmed recurring task, success/cycle targets and rights; any capture correction requested by the evidence review. | Current intake, source envelope/files, approved testbed/task, consent and access records, plus exact portable artifacts. |
| Robot team | Approved access and required supply agreements; supported authenticated policy endpoint; declared model and interface; explicit permission for the saved setup. | Current team eligibility, agreements, checkpoint and bound grant. No arbitrary team count is imposed. |
| Authorized reviewers/operators | Independent source/simulator measurements against frozen criteria and authorized review; storage access verification. | Complete checked receipt, reviewer/producer authority, source hashes/URIs and recoverable original files. |
| Nijel / release authority | Approve the reviewed WebApp and Pipeline releases, and the two-index create-only plan. | Exact merged/released commits, successful existing CI/deploy gates, live version/readiness/source readback, READY index definitions and query HTTP200. |
| Nijel / existing execution authority | Explicitly release the existing founder dispatch hold for the selected eligible run, within existing spending authority; confirm funding/cap and storage/capacity coverage. | Recorded narrow release authority, retained strict controls, eligible current run and provider budget gates. No hold, budget or schedule was changed in this work. |
| Existing data-handling owners | Complete the existing cohort/counsel/retention/restore prerequisites for the selected cohort. | Existing approval/retention packet and retained restore/deletion-process evidence. This change does not approve legal terms, extend retention or authorize deletion. |
| Engineering owner | Execute and inspect the real evaluation and delivery once authorized and eligible. | First-shard gate, all 200 prescribed cells, independent scored outcomes, required cycle-time/media, cost/time/footprint and operator-intervention receipts, provider-zero teardown and actual delivery/booking inspection. |

The measured receipt is not an execution or spending authorization. Code deployment does not release the founder hold. A passing simulation does not establish physical performance or ADP qualified evidence.

## Release sequence and recovery

1. Review and merge the paired pull requests through their existing required checks. WebApp’s CI-gated exact-SHA deployment installs the accepting route before any receipt publication. Pipeline’s existing exact-commit operator deployment installs the producer and verifier. Do not deploy an arbitrary moving branch head.
2. Verify deployed WebApp version, health/readiness and Pipeline active-release/source identity. Preserve provider-zero and founder-hold readbacks. No test receipt needs to be published to production to verify route installation.
3. Apply only the separately approved [two-index plan](2026-10-18-scoped-index-repair.md), rechecking live inventory first. Retain the two READY definitions and corresponding successful read-only queries.
4. Follow the [qualified evaluation runbook](../runbooks/qualified-site-evaluation.md) for the eligible real records. Preserve the existing diagnostic path for unqualified captures. Admit only the exact approved receipt/setup/run, then observe the customer result and normal delivery.
5. On release failure, retain exact errors and use the existing deployment rollback mechanism to the recorded prior healthy release. Do not compensate by relaxing evidence validation, accepting a replacement scene/model, bypassing a hold or deleting receipts.

Reply correlation remains `BP-BETA-QUALIFIED-RELEASE-20261018` in this chat and release record. On an authorized reply, the same accountable owner resumes the corresponding step and records exact release/run evidence. No outbound escalation was sent.

## Verification and portable artifacts

The companion [validation record](evidence/2026-10-18-beta-repairs/validation.json) records exact local commands, results and log hashes. Full source and tests live in the company GitHub repositories. The prior [read-only audit](2026-10-18-beta-launch-audit.md) and its JSON/PNG evidence remain unchanged, with their observed release/time boundaries. The index-plan JSON retains the exact source hash and command argument arrays.

Receipt schema: `blueprint.site_task_simulation_qualification.v1`; canonical digests use RFC8785, while source artifact digests hash raw bytes. Production records belong in Blueprint’s existing Firestore collection `siteTaskQualifications` and frozen `evaluationRuns` admission/result records. Source files belong in existing approved company object storage with exact URI/hash/size/provenance; export records as JSON and retain original capture and model bytes. Check actual access before claiming recoverability. Git clone plus retained standard-format artifacts is the recovery route; vendor session IDs are not canonical IDs.

During tests, a concurrent mock-import race accidentally created one synthetic qualification document in production. The publisher now requires explicit database injection and tests run with a scrubbed environment. After the user's exact deletion approval, the matching document was conditionally removed and its subsequent GET returned404. The [cleanup receipt](evidence/2026-10-18-beta-repairs/cleanup.json) and [synthetic backup](evidence/2026-10-18-beta-repairs/synthetic-qualification-backup.json) are retained. No other live mutation was performed for these repairs.
