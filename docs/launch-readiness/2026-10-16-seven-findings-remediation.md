# Seven findings: implementation and evidence boundaries

Owner request: fix the seven annotated review findings, merge and deploy.
Journey: L2 private capture, L5 execution, L6 recommendation, L7 booking, and
retention operations. This records engineering behavior, not a qualified pilot
or counsel approval. Release identity and deployment readbacks are separate
evidence; a local passing check does not establish production behavior.

## 1. Recorded evidence versus absence

Read-only production Firestore projections on October 16 found 83 team records,
no recorded supply agreements, and 37 historical private evaluation records
(14 completed, 23 blocked). None was a scored beta team evaluation. The 54
inbound requests had no recommendation or booking references. These are
observations of those complete owner-system queries, not proof of all offline
engagements or all historical Pipeline work. A seed file is not an operational
ledger. Missing qualification or measurement no longer produces a "no team
passed" notice: unknown eligibility and a measured failure are different states.

## 2. Access and spending

Deployed Firestore rules were read back and matched the vulnerable source:
sign-in alone permitted `capture_jobs` reads. That collection was empty at the
observation; the rule vulnerability is confirmed, existing address disclosure
is not. The shared Capture/WebApp repair scopes private jobs and their state to
trusted operators or server-recorded assignments/ownership. Android queries
assignments and clears private cached targets on authentication/access changes;
current iOS uses signed capture links. The Cloud Functions `api` router is absent
from the complete deployed inventory of `blueprint-8c1ca` and must not be created
there merely to publish this repair. Android's default backend instead names
`blueprint-prod-f0f19`. That project's live feed accepted an anonymous request and
an invalid bearer in a read-only probe with empty candidates; both returned zero
jobs. This confirms missing authentication, not private-data disclosure. The
current deployment identity has no deployment permissions in that project; its
source repair must not be represented as deployed until that backend is updated
or the owner retires it.

The onboarding checkout handler refuses free-beta payment creation before
constructing Stripe. G1 campaign routes require freshly verified execution
authority. Creating a checkout session is distinct from completing a charge;
production Stripe configuration was not inspected.

## 3. Reservation and execution clocks

The queued reservation remains bounded by its recorded approval expiry and
reservation TTL (default six hours). Claiming a run records a separate immutable
execution deadline (default 48 hours). These internal bounds are not a runtime
estimate or a new spending authorization.

The current claimed worker can POST the signed
`/api/internal/pipeline/agent-runs/:runId/heartbeat` with `pipeline_run_id` and
the bound `execution_admission_digest`. A first heartbeat opts the run into
a liveness deadline (default 15 minutes); workers renew every minute. Neither
renewal nor a retry extends the hard deadline. Legacy workers without heartbeat
support remain bounded by the hard deadline during rollout. Invalid deadlines,
cancelled claims and different owners fail closed. First completed outcomes and
first result acceptance check live authority transactionally; accepted receipts
retain idempotent replay. A rejected late result is retained separately as
diagnostic evidence and cannot promote a team or create a recommendation.

Server settings: `BLUEPRINT_AGENT_EXECUTION_TTL_MS` (one minute to seven days),
`BLUEPRINT_AGENT_HEARTBEAT_TTL_MS` (one minute to one hour). Existing reservation
configuration remains separate. Verify actual deployed values and lifecycle
receipts before asserting a production timeout or wall-time estimate.

## 4. Attempts, interruption and denominators

Pipeline performs static authority and no-spend checks before consuming a bearer
lease, persists the one release securely for bounded same-claim preparation
recovery, and never redistributes it. Credential release rechecks the live run,
checkpoint and revocation in the lease transaction. An ambiguous release still
requires a new authorized run; a response loss is not permission to release twice.

The partial settlement extension carries `execution_status: blocked` and
`execution_progress`: known attempted, scored, successful, failed and void
episode counts plus `measurement_complete`. `episodes_run` is the scored count.
Unknown progress never proves that no episode ran. A blocked partial run stays
blocked, retains its counts, and does not create recommendation evidence. The
existing sponsored-run customer charge remains zero. Infrastructure voids and
policy failures are classified by cause; a voided episode is not itself proof
that an entire run was lost. Pipeline retains interruption and teardown receipts.
If cancellation or expiry closed the run first, a signed blocked-progress receipt
is retained separately and acknowledged idempotently after rechecking the exact
team, worker and admission binding. It cannot reopen the run, alter settlement,
promote capabilities or create a recommendation.

## 5. Statistical policy and required measurements

The existing protocol remains 200 prescribed cells, at least 190 scored, at most
ten void. Recommendation requires every cell exactly once with internally
consistent counts. The pass rule remains the observed success ratio against the
job's frozen target. A required cycle-time target needs a finite positive
measurement meeting that target. Missing measurement is ineligible, not a pass.

171/190 is 90%; the two-sided 95% Wilson lower endpoint is about 84.91%.
The interval is displayed as context without silently changing the pass rule.
It does not prove real-world performance, independence of correlated episodes,
or reliability outside the tested conditions. Workspace pass calculations use
exact counts: 179/200 is 89.5%, even if a historical stored rate was rounded to 90%.

## 6. Development evidence and a qualified recommendation

Development scope or a diagnostic claim ceiling vetoes recommendation even with
high scores. A qualifying result needs signed, exact capture/scene bindings and
registration/fidelity receipt digests under a bounded simulation claim ceiling.
Legacy snapshots cannot bypass these checks; booking revalidates the current
run, result digest and frozen criteria transactionally.

The website Pipeline currently has no qualified site-task registration/fidelity
receipt producer. Its registration explicitly does not prove measured physical
scale or physical registration; appearance registration alone does not establish
task collision or physics fidelity. Existing approvals therefore correctly stay
development-only. The new optional qualification contract does not manufacture
the missing evidence. A diagnostic can demonstrate engine operation; an owner
decision alone cannot turn it into a qualified site recommendation. A first
qualified recommendation remains dependent on real measured scene evidence and
an invited team's executed policy, with accessible canonical receipts.

## 7. Retention and truthful copy

The announced privacy update has a future effective date; earlier terms still
apply. The repair preserves collection-time terms and the earlier 180-day
after-close promise, removes unconditional seven-year floors from new website
capture manifests, and prevents later account acceptance being treated as
retroactive authority. Public claims describe a simplified simulation informed
by footage and approved beta evaluations as free. Claims scanning now covers
routes, agents, retrieval, components, API specifications and public samples.

The [counsel packet](2026-10-16-retention-and-recording-counsel-review.md) records
the remaining original-policy inventory, notice, hold, backup and deletion
questions. No notice was sent, recording deleted, approval fabricated or
historical legal compliance represented as resolved.

## Release and verification

Merge the coordinated Capture rules first, then WebApp. Deploy only the existing
Firestore rules release and compare its exact source SHA256. Do not create the
absent Capture `api` in `blueprint-8c1ca`; separately resolve deployment access or
retirement for the live `blueprint-prod-f0f19` backend. WebApp and its worker use the existing exact-SHA
CI-gated `deploy.yml`; deploy those APIs before the Pipeline runner adopts the
heartbeat/progress contract. Pipeline deployment must wait for any active paid
launch to finish; preserve holds and do not restart over running work.

GitHub Actions run 38953429649 did not execute any Capture CI steps because
account payments failed or the Actions spending limit was reached. No check was
marked successful and no billing setting was changed. Local checks and actual
deployment readbacks must be reported separately from that external CI blocker.
