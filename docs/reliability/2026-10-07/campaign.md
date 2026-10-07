# Site-first reliability closeout

Campaign starts **2026-10-07 20:43:33 UTC**. Initial checkpoint target 22:43 UTC;
site-first checkpoint 2026-10-08 02:43 UTC; bounded closeout 2026-10-09 20:43 UTC.
ADP-010 partner day-7 intake continuity is the immediate business outcome: an
invited operator can describe a real job, optionally retain evidence, return,
receive an honest next step, and continue discovery without a reconstruction,
simulation or robot-availability prerequisite.

## Baseline and custody

| Component | Exact source baseline | Observed deployment |
|---|---|---|
| WebApp | `efd2e685819328c4c3060cec7d105142612adf63` | `/version.json` matches; Render Web `dep-db3ae8142hec7393loug` live, worker `dep-db3ae8flk1mc739ve9i0` live at the same SHA |
| CapturePipeline | `89938271a5c92fc0473b01326733199e0b456444` | Active host release link matches baseline at21:30 UTC; listener/timer inactive under an existing preserved freeze; loaded listener revision not proven |
| Capture | `492978395d52f12cab6b7c72f2a99302cacefefc` | Installed mobile version not accessible here |
| Contracts dependency | `7708a4e4c5dedeeb39cc73d3f6869304de295b81` | Source-only pinned dependency |

All initial checkout statuses were clean; work uses separate branches/worktrees.
The coordinator owns integration and serialized release. Independent Astra owners
cover browser, backend, queues/resources, judgment, cross-repository handoff, and
adversarial review. Model reviews are not human or physical validation.

Existing shared release owner: `01a1119c-3d06-7099-9fde-19dac4ac90ef`.
Existing site-flow owner: `01a112a0-4f25-705a-9d18-c5cf8b6b90ca`.
No supported cross-thread Codex messaging tool is exposed. Portable coordination
was requested in [PR919 comment](https://github.com/ognjhunt/Blueprint-WebApp/pull/919#issuecomment-6046553377).
The Deploy workflow `314852802` is `disabled_manually`. The existing continuous
release procedure and actual owner holds apply; no competing deployment is
permitted. GitHub branch-protection REST access returns 403; required PR checks
remain inspectable through `gh pr checks --required`. That denial is not a waiver.

Historical work refreshed: PR909, 911, 912, 914, 916 are merged in the Web baseline.
Web PR917 index diagnosis and PR918 direct-model migration remain independent work.
PR919 founder recovery UI merged at `d0bd8e15a207e6d7bee9a02bd266f5c8217f9352`
and the existing owner released it: static version and Render Web/worker readbacks
at 21:17 UTC agree on that SHA (Web `dep-db3b9e7avr4c73acti3g`, worker
`dep-db3b9e142hec7396a6ag`). These are prior-owner changes, not campaign repairs. Pipeline PR2643 contact qualification and PR2644
model migration are open. PR917's head moved during this campaign; prior-head CI
is not final-head proof. Index manifest presence does not establish a live READY
index, and no paid qualification is to be repeated.

## Source-grounded journey

| Transition | Source and persistent authority | Side effects and proof boundary |
|---|---|---|
| Discover and describe | `client/src/app/routes.tsx`, `SiteCaptureStart`; anonymous `/contact/site-operator`, signed-in workspace start | Job text and optional location/evidence; user intent remains reported truth |
| Accept intake | `server/routes/inbound-request.ts`, `/api/inbound-request`; signed-in `/api/workspace/capture-start` | Durable encrypted `inboundRequests`, request/retry identity and brief review intent; follow-up email is a separate effect |
| Continue on private link | `/capture-upload/:token`, `SelfCaptureUpload`, signed owner/film tokens | Token scope controls authority; a film link cannot confirm owner attestations |
| Retain optional footage | `self-capture-uploads.ts`, upload/session identity, exact object generation/hash and saved receipt | Storage retention is separate from processing completion, consent, assessment and qualification |
| Review/confirm job | `site-task-brief.ts`, `siteTaskBrief.ts`, `siteTaskBriefReading.ts`; `siteTaskBriefs` | Model proposals require inspectable support and explicit operator confirmation; unconfirmed upload does not authorize downstream spend |
| Return/status | `CaptureLiveStatus`, `/api/site-task-brief/:token/status`, modern upload `/:token/status` | Read-only projection; unavailable storage is unknown, not proof of absence |
| Attach verified account | `ClaimSite`, `site-claim.ts`, workspace claim transaction | Current token and matching verified email; clear old form/consents on token or account boundary |
| Assess/recommend | Pipeline authoritative evidence; Web summary/projection, admin recommendation, exact recommendation-bound booking | Pending, failed, unavailable, abstained and physically proven remain distinct; booking is not payment or secured robot proof |
| Continue conversation | `captureOutbox.ts`, communications saved-output and founder draft routes | Durable intent, provider submission and acknowledgement are separate; unknown send outcome must not authorize automatic retry; founder controls outreach |

Every end-to-end claim requires the screen, durable record and expected effects
at the same identity/revision. Fixture browser success proves the UI consumer,
not Firebase authorization or an external provider.

## Unsafe read assumptions discovered

Do not use GET as a blanket read-only classification:

- `GET /api/site-task-brief/:token/items` can seed/save item inventory.
- Legacy `GET /api/self-capture/uploads/:token` enables opportunistic processing
  retry; the modern `/:token/status` variant does not.
- `/health/ready` can call readiness-transition alerts. The baseline used the
  static `/version.json` after inspecting its generation/serving path.

No live customer/task route, production upload, provider inference, Gmail draft,
email, charge, consent change or fault injection was performed by this campaign.

## Failure registry and invariant coverage

| ID | Severity / failure | Repair and verification |
| --- | --- | --- |
| SITE-01 | High: prior private-link data/consent persists | PR921, `90cd39c96`: keyed claim state; failing-before UI and Chromium regression; independent review; original source head315bdd passed all eight checks; final artifact-ignore-only head requires fresh CI |
| SITE-02 | High: role/account change retains protected content | PR921: current-render authorization; three new failing-before regressions now pass |
| SITE-03 | High: retained footage reported absent or active when held | PR923, `592ea5a3b`: generation-bound shared receipt reader, truthful retained/held/unknown projection; 24 status cases plus independent review; all eight exact-head CI checks pass |
| SITE-04 | High: database outage hangs claim summary | PR923: move read inside error boundary; explicit 503 and three claim tests |
| SITE-05 | High: concurrent notification sends / unknown replay | PR922, `62e9d1521`: fenced claim/dispatch/receipt; real Resend SDK transport shape; 640 unique seeded schedules and hand-written faults; independent review; browser CI pending |
| SITE-06 | High: unsupported footage promoted into job facts | PR920, `be1e22b21`: require usable timestamp-supported observations, derive cycle evidence from complete nonoverlapping intervals; eight failing-before regressions; independent review; browser CI pending |
| SITE-07 | High: accepted intake loses first return-link intent | PR925, `13ea31026`: create intake and return-link intent in one SDK batch; crash/lost-ack tests and actual installed SDK serialization |
| SITE-08 | High: recommendation/booking commits without notification, or old recipient notified | PR925, `13ea31026`: transactional producer intent and current-authority dispatch guard; legacy sent/unknown rows reused; reviewer-found legacy duplicate fixed; lost booking acknowledgement leaves one booking/intent and same retry preserves it |
| PIPE-01 | High: required-stage failure reported complete | Pipeline PR2645, source `dee58dde` / documentation head `4e464e44`: 13 new regressions failed before; independently reviewed; impacted tests and sentinel gate pass |
| SITE-09 | High: delayed item initialization or owner mutation loses accepted edits/photos | PR926, `72b021e89`: create-only initialization plus transaction retry against current inventory; eight failing-before cases; independently32 passing tests |
| SITE-10 | High: capture status dependency initialization escapes Express4 response handling | PR927, `a004c0cc2`: private-data-safe503 and no-store; two failing-before callbacks; independently141 passing tests |
| LIMIT-01 | Medium: unsubmitted browser draft and retry identity lost on reload | Observed source limitation; no accepted-data-loss assertion made. No new private-data browser persistence policy invented |
| LIMIT-02 | Medium: ancillary listing notice remains best effort | Existing publication survives notice failure; no automatic repair claim; outside initial receipt/recommendation/booking repair |

All repairs above remain **unmerged and undeployed** at this checkpoint. No known
failure is counted as fixed in production. Integration typecheck found four nullable DB references inside transaction
callbacks. Stable local database bindings fixed them; final PR925 typecheck and
40 focused assertions pass, with independent approval of exact `1eeb77cd8`.
CI pending is not a pass. Items and status exception repairs are now independently
reviewed in PR926/927. PR925 also fixes three reproduced mixed-version producer
races by reserving the legacy key when free;47 independent final-scope tests pass
on `13ea31026`. This does not make an old unfenced sender safe during rollout.

The final combined offline gate passed **363 assertions across24 required suites**
at `9b195b680922d931f9c3b7257ce62df9f818e97a`, with zero unexpected egress and clean
tracked source. [The exact summary](./verification-summary.json) retains hashes and
counts. TypeScript and the required Graphify refresh also pass. The runner
itself passed 16 synthetic validator controls, including empty/missing/failed suites,
malformed reports, skips, wrong counts and simulated unexpected egress. These are
validator tests, not 16 additional customer scenarios. All18 changed production
files match [independently reviewed lane blobs](./independent-review.md);
later patches received scoped independent review before their updated PR heads.

Additional bounded execution: five isolated Chromium journeys (three new and two
existing invited-beta viewport cases); 216 distinct adjacent workflow assertions
with 254 deliberately deselected; 640 unique seeded outbox schedules; and 512
measured resource-soak repeats across eight scenario kinds after 64 warm-up cases.
Overlapping suites and repeated executions are not added into a single inflated
total. The source-level sixteen-invariant matrix is [invariant-coverage.md](./invariant-coverage.md).

### Reproduce and evidence index

After dependencies are installed, from the repository root:

```bash
node --test scripts/reliability/verify-site.test.mjs
node scripts/reliability/verify-site.mjs
npm run test:site-reliability:browser
```

The route runner and this environment's Node child-test harness need loopback/IPC
binding permission. One validator invocation under the default socket-denied
execution sandbox failed at the harness level; with explicit local binding support,
all16 controls pass. That rejected execution is not counted as a successful run. Its explicit test-only preload
blocks the instrumented Node TCP/TLS/DNS and UDP-send paths, and it strips inherited provider configuration;
it is process instrumentation, not a universal kernel sandbox. Browser fixtures
block other origins and use fake API/auth ports. Resource tests use Docker network
`none` and a separately checked 512 MiB cgroup. Production fault injection is not
wired into an application entry point.

The gate emits `work/site-reliability/verification-*/summary.json`, `vitest.json`
and `runner.log`; a failed or missing required suite, skipped assertion, unexpected
egress or bad negative control fails the command. `summary.json` binds exact source
SHA, tracked dirty state, runner/guard/test hashes and assertion count. Ordinary PR
CI executes both validator controls and the selected fast gate; the optional soak
is deliberately separate. Each lane packet below records its minimal reproduction,
source identity, exact command and limitations:

- [UI and browser](./site-ux.md), [status/storage/claim](./backend-contracts.md).
- [Outbox](./queues-recovery.md), [atomic intake](./atomic-intake-receipt.md),
  [shared dispatch](./atomic-outbox-shared.md), [recommendation](./pilot-notification.md),
  [booking](./booking-notification.md).
- [Judgment/reference provenance](./judgment-knowledge.md) and
  [reference records](./judgment-reference-set.json).
- [Resource protocol and retained measurements](./recovery-resource-soak.md).
- Pipeline repository: `docs/reliability/2026-10-07/crossrepo-handoff/README.md`
  and `verification.json` in PR2645; its `release-custody.md` and sanitized JSON
  projections bind the observed host release/freeze and promotion limitations.

Independent review artifacts are retained under coordinator scratch
`work/adversarial-review/`; exact source manifests and executable regressions are
versioned. No customer data, private links, provider credentials or real mailbox
fixtures are included in this packet. Reference videos are existing simulation
assets with source hashes; no private Library clip was copied.

## External proof and reference limits

The provided dishwasher Library identifier, name, byte count and digest remain
user-provided provenance only. No Library materialization tool is exposed and
`/workspace/library-files` is empty. Do not claim to have watched it or describe
it as a demonstrated dish-loading cycle. No new production upload/inference is
authorized. Recorded simulation files can test evidence handling but cannot stand
in for real-site labels, qualified human review, or physical performance.

The executor has a 16 GiB cgroup, unlike the constrained production worker.
A separate chosen 512 MiB Docker constraint passed the predefined short-run
resource criteria, peaking at 153.1 MiB with stable 20 FDs and no OOM events.
Positive retained heap/RSS slopes remain documented. This seconds-long fake-provider
run is not a sustained plateau or deployed normal-worker/native-provider profile;
actual deployment-class comparability remains unproven.

## Release and go/no-go

Current invited-beta closeout verdict: **HOLD for reliability completion**.
This is not a ban on founder-led customer discovery; it means the campaign has
not yet satisfied its implementation, independent review, exact-head CI, shared
release and runtime-readback gates. No campaign repair is currently deployed.

A mixed-version rollout must preserve legacy outbox rows and classify unresolved
sends conservatively. Do not roll back to an unfenced sender while new delivery
intents are active. Retain source/receipt schemas and use additive compatibility;
no destructive schema rollback. Release only through the existing held procedure
with actual current lease/owner proof, final green main SHA, Web/worker version
readbacks and narrowly authorized runtime checks.

## Checkpoint release queue and remaining work

At21:34 UTC, the integration source is locally tested and versioned; all repairs
remain unreleased. PR921/922/925 received review follow-ups, so their earlier green
or pending runs cannot substitute for the new final heads. PR923 remains unchanged
and green. PR920 remains atbe1e22b21. PR926/927 are separate small repairs on current
main; PipelinePR2645 adds docs-only deployed-source evidence without changing its
reviewed application patch. Do not merge the entire integration branch as a giant
replacement for these individual reviews.

Release order: review current owner/holds, merge green independent small fixes,
merge922 before its dependent925, then integrate the packet/gate after its referenced
suites exist on main. Rebase/check any overlapping site-task-brief or upload route
diffs and rerun impacted checks on exact final main before release. Cut over Web and
worker using the existing proof-bound coordinator. Pipeline is a separate host
release boundary; its existing listener freeze must remain unless the accountable
owner separately authorizes activation. An iteration deployment is not production
promotion or proof that the listener ran.

The active independent PR924 assessment path bypasses PR920's cycle projection.
Offline schema/source review reproduced an operator target accepted as a measured
claim. The finding and minimal input were sent to that PR's owner in
[the coordination comment](https://github.com/ognjhunt/Blueprint-WebApp/pull/924#issuecomment-6047144239).
It has no direct file overlap; it must not be described as covered by PR920 merely
because both merge. This campaign did not edit that owner's active implementation.

Unperformed external proof: real invited-account login/email return, live storage
upload/consent/job execution, live provider acceptance/reconciliation, actual normal
worker/provider memory profile, native Capture/device journey, measured robotics,
and the inaccessible dishwasher reference. Existing safe metadata reads do not
close those gaps. Complete the current bounded fixes before expanding into further
hypothetical cases.


### Live browser boundary

At approximately21:40 UTC, fresh anonymous Chromium contexts attempted only the
source-inspected public homepage and site-intake document at desktop/mobile widths.
The browser allowed only same-origin static documents/assets, blocked all API,
non-GET and external-origin requests, and submitted no form. All four navigation
attempts failed with `net::ERR_CERT_AUTHORITY_INVALID` through the environment's
configured proxy before page inspection. No certificate warning was bypassed,
no trust store was changed, and no screenshot/successful visual journey is claimed.
This is a browser/environment access failure, not a backend HTTP response or proof
that the public site's own certificate is defective. Static version curl readback
remains a separate successful metadata observation.

Fresh release custody/proof references are kept private. The existing owner is
being asked privately for the current handoff; historical release evidence and
a settled old lease do not clear the next release. Published Pipeline metadata
is limited to source revision and frozen/running state, without internal receipt
locators, runtime invocation identifiers or authority/proof references.


### One-hour checkpoint (21:45 UTC)

Current exact-head CI is green for Web921/922/923/925/927 and Pipeline2645's
impacted-test/sentinel gate. Web920 and926 browser checks remain pending. Web920's
first browser job was cancelled after approximately40 minutes in installation
without starting tests, then only that job was rerun on the unchanged source.
The cancelled attempt is not passing evidence, and the retry must complete.
No test or required check was disabled to unblock it.

[The public release queue snapshot](./release-queue.json) binds PR heads and observed
checks; newer attempts supersede it. The review/packet branch is a portable
integration artifact, not a request to merge a giant replacement PR. The owner
confirmed that a fresh custody handoff is being obtained privately. No campaign
merge, deployment, listener activation, production task mutation or provider
canary has occurred. Ready source and successful fixtures do not close those gates.

The assessment-classification finding also remains reproducible at independent
PR924 head81b45e13: its validator blob is unchanged by the prompt-wrapper update,
and the original synthetic operator-target-as-measured case still passes. That
candidate must retain its own unresolved risk; it is not included in this campaign's
approved18-file production scope.
