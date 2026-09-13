# Minimal signed-in workspaces

Owner-directed scope, September 13, 2026: extend the shipped minimal public/auth design through both sides of Blueprint. This is the explicit scope change for the customer workspace; it does not change the shared ADP scientific program or any paid-resource authorization. The observed blocker was the old single-record operator overview, disconnected policy-reference page, and inconsistent onboarding/private-page design. Completion is a working, role-scoped workflow with browser evidence, not a mock dashboard.

## Design references

Twelve built-in Codex imagegen references cover site overview, robot overview, site task/results, capture management, openings, opening detail/evaluation request, robot setup, account settings, history, task request, evaluation result, and onboarding. Prompts and provenance are in `provenance.json`, `page-prompts.json`, and `onboarding-prompt.json`. OpenAI's September 8 release and Sunburst model page were checked. The built-in tool exposes neither a selector nor a returned model identity; exact Sunburst provenance is therefore unverified.

Implementation uses DM Sans, ivory `#f6f5ef`, forest green `#203d2e`, ink `#22251e`, and hairline `#d7dcd0`, with a 240px desktop rail, responsive drawer, plain tables, short forms, and details disclosures. Existing generated packing artwork is reused only as a labeled illustration. A generated preview is never presented as a site's capture or run video. Real evidence remains on the existing authenticated evidence routes.

| Journey | Maintained route | Reference |
| --- | --- | --- |
| Account entry | `/onboarding` | onboarding.png |
| Site overview | `/app` (site account) | site-overview.png |
| Current site tasks | `/app/tasks` | site-overview.png list pattern |
| Request task/site/capture | `/app/tasks/new` | request-task.png |
| Task, targets, team results, pilot decision | `/app/tasks/:taskId` | task-results.png |
| Capture window, change/cancel requests, messaging | task Capture tab | capture-management.png |
| Robot overview | `/app` (robot-team account) | robot-overview.png |
| Browse openings | `/app/opportunities` | openings.png |
| Opening and setup-backed evaluation request | `/app/opportunities/:opportunityId` | opening-detail.png |
| Own evaluation and evidence | `/app/evaluations/:evaluationId` | evaluation-result.png |
| History | `/app/history` | history.png |
| Account settings | `/settings` | account-settings.png |
| Embodiments, policies, checkpoints/containers/endpoints | `/settings?tab=robots` | robot-settings.png |
| Existing capture, testbed, run/progress/result, access, connection pages | existing `/app/*` routes | shared shell, forms and evidence disclosures |

Private request-review links also use the light shell, with decorative fake facility imagery removed. Non-buyer capture/operations accounts retain their basic account settings without being granted a customer role.

The existing full scientific request form remains at `/app/advanced/runs/new`. Ordinary `/app/runs/new` sends a site to task intake and a robot team to openings. The main navigation has exactly four destinations per role.

## Data and action boundaries

- New tasks and evaluation requests use the existing inbound intake handler and `inboundRequests` workflow. Identity metadata comes from authenticated server context, never a posted owner ID. New tasks remain private or awaiting anonymized review until the existing opportunity, capture, rights, and qualification gates pass.
- Site ownership is UID-scoped. The older linked-intake fallback additionally requires a verified email matching the encrypted original contact; merely changing a linked ID does not grant access.
- Robot teams see only their own runs and applications. Sites receive a whitelist of anonymous team aliases and result metrics, without team names, emails, policy IDs, checkpoints, endpoints, or private artifact URLs.
- Evaluation submissions retain a snapshot of the selected setup and task targets. Changed targets are not applied retrospectively. Scores require a completed run, one unambiguous policy aggregate, and positive sample count. Missing values remain missing; efficiency is never reinterpreted as seconds.
- Saved robot setups are encrypted, scoped to the existing user account, and never executed or downloaded by the settings API. Credentials and signed/query-token URLs are rejected; secret material belongs in the approved credential integration.
- Capture visits come from existing `capture_jobs`. Provisional assignments requiring confirmation do not become confirmed countdowns. Edits/cancellations are pending coordination requests recorded in the existing task/notes workflow; the UI does not claim the calendar changed. Capturer messages use the existing policy-controlled communication service and distinguish sent from queued.
- Pilot selection requires recorded results meeting current targets. Selection records the site's decision and coordination request; it does not claim an invitation was delivered, a pilot accepted, or deployment completed. Subsequent pilot/deployment states are explicitly site-reported, preserve notes, and do not upgrade scientific evidence.
- The task list is currently account-scoped, matching the existing buyer-run ownership model. This change does not introduce multi-user organization membership or a new authorization system.

## Validation

`npm run test:workspace:browser` uses explicit development-only fake auth and intercepted local fixtures to exercise both roles, desktop/mobile views, request submission, setup storage, pilot selection, visit changes, empty/error states and keyboard navigation. It never creates live accounts, sends live messages, or launches providers. This suite is included in the CI E2E job.

Focused route tests cover cross-account reads/writes, role escalation, setup confidentiality, rights rechecks, immutable criteria, honest missing scores, provisional visits and pilot transitions. Existing intake, capture, result and communication tests protect reused contracts. Production build/typecheck and the asset audit are separate checks. The required graphify refresh was attempted; `graphifyy` is unavailable in the configured interpreter, so no refreshed graph is claimed.


## Existing-account setup recovery

Accounts without a valid `buyerType` receive the typed `workspace_setup_required` response. Overview and other workspace pages show the setup form directly, and Settings uses the same flow. The sidebar remains neutral until a site or robot-team workspace is configured. A retry is not offered as a solution to missing configuration.

Authenticated `GET/POST /api/workspace/setup` reads and updates only the caller's customer profile. The user explicitly chooses a workspace type and confirms their name/organization. Current Terms/Privacy acceptance is recorded server-side if missing. Operations/capture roles, claims, approvals and saved records are preserved; this does not grant evidence access, supplier qualification or spend authority. Successful setup reloads the saved profile and proceeds to site-task or robot-policy setup. Existing customers can change the workspace type through Settings.

Regression coverage includes legacy operations/capture accounts without a customer type, both setup destinations after reload, retained privileges/data, forbidden privilege/identity fields, failed-save recovery and mobile layout.
