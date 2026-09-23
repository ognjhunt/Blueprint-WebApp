# Workspace simplification, round 2 (2026-09-22)

Follow-up to the results-page simplification in
[`robot-eval-report-ux-2026-09-04.md`](robot-eval-report-ux-2026-09-04.md) §5.
The owner's site audit named five pages that still read like an ops console and
a set of smaller problems. Each page now uses the plain workspace styles
(`ws-*`), states each boundary once in plain words, and keeps raw identifiers,
digests, and machine codes in closed drawers.

## The five pages

| Page | Before | Now |
| --- | --- | --- |
| Captures (`/app/captures`) | ~600 words before any click: two full forms (~33 fields), several warning banners, the "not physical success / not safety approval" boundary in about six sections, raw codes such as `thesis_not_supported` | A list first: each capture with one plain status ("Review the proposed tasks", "Recapture needed") and one action. The upload form sits behind one button (shown directly when there are no captures): type, scene ID, file, rights, consent, privacy; camera and task details and capture tips are closed drawers. Opening a capture shows only that capture: capture check → proposed tasks → 3D scene → testbed → evaluation → result, with the real-world/safety boundary stated once at the top. The expert "evaluation on a completed scene" form is a closed drawer, its advanced knobs nested in another. |
| Run progress (`/app/evaluation-runs/:id`) | Policy tests repeated the unqualified/simulation warning 4–5 times and showed ten raw stage names and ids | Four steps (Queued, Preparing, Running, Results), one plain phase ("Starting a simulator"), a progress bar, and one line about email. The result summary states the simulation boundary once; ids and the raw stage are in "Run details". |
| Run record (`/app/runs/:id`, also inside an evaluation's drawer) | ~11 panels; "physical evidence still needed" said five ways; a "Back to runs" button inside the evaluation drawer | The decision, the questions it answered, and the next step; one physical-test line; "Evidence and files" and "Limits of this result" drawers. The embedded record carries no page navigation. |
| Runs (`/app/runs`) | Ops-console copy ("Pipeline-owned results", "Authorization through aggregation"), metric tiles, a request button that only redirected | Results, requests, and purchased access as plain rows (status and action stay visible on a phone). An honest empty state points to Openings (robot teams) or Tasks (site operators). |
| Tasks (`/app/packs`) and its setup pages | Titled "Testbeds" although "Back to tasks" lands here; the same image fine print on every card; the setup page spoke in "preregistered nested subset" terms | Titled "Tasks"; each card has one status and one next step; the image caveat is one line for the page. Evaluation setup is one page: fixed robot and policies, a depth choice, the estimate, start. The policy-test setup is one form with plain approvals; confirmed success rules are one click away (a proposal opens them). |

## Smaller fixes

- **Pricing** states "Entries × tasks × $99" once, under the worked examples.
- **Task detail** states the pilot boundary once (Results tab) and lists the
  budget once (Overview).
- **Retired pages redirect** after sign-in: `/app/entitlements` and `/app/data`
  → `/app/runs` (purchased access lives there), `/app/policies` → `/settings`,
  `/app/packs/:id` → `/app/packs`. Query strings are forwarded.
- **Request buttons** that only redirected are gone from Runs and Tasks; the
  Policies page is now a redirect.
- **Shared states** show the request's own error message ("Reload the page to
  try again") and a neutral empty state with no Stripe or pricing copy.
- **Other results** (not head-to-head policy tests) use the same plain layout:
  one visibility-and-simulation line, a counts list, one comparison table with
  variation/failure/evidence detail in a drawer, one closed drawer per episode,
  downloads, and a run-details drawer holding delivery stages and the exact
  record.

## Policy-test access — confirmed as intended

The setup page was labelled "Internal policy canary", but access is scoped to
the offering's team, not to Blueprint staff. That scope is deliberate:
`server/tests/admin-task-evaluation-launches.test.ts` submits policy tests as a
non-ops team member through `configured-scene-offerings`, notification rules
limit a team member to their own email, and `internal_policy_canary` names the
diagnostic run kind (unqualified results, no ranking), which the Pipeline also
uses for owner-requested runs. Access is unchanged; the page no longer calls
itself internal.

## Where each boundary lives now

| Boundary | Now |
| --- | --- |
| Uploading is not acceptance | One line under the upload form |
| What a file type can and can't show | The hint under "Capture type" |
| Review and simulation are not real-world success or safety approval | One line at the top of an opened capture; one line on results and run progress |
| Approving a proposed task is intent, not success | One line under "Proposed tasks" |
| Approving methods doesn't approve paid compute, outside providers, or a robot | One line in the evaluation step |
| Results apply only inside the testbed; no policy ranking | One line in the capture's result section |
| Policy-test results are unqualified until scene checks pass | One line on the Tasks card and one on the policy-test setup |
| Preview images are renders, not photos | One line under the Tasks list |
| Raw ids, digests, schemas, runtime images | Closed "details" drawers on each page |
