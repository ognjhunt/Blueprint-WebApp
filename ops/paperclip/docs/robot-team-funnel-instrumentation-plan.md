# Robot-Team Buyer Funnel — Event Instrumentation Plan

> Generated for BLU-145. Source playbook: `ops/paperclip/playbooks/robot-team-demand-playbook.md`
> Baseline analytics lib: `client/src/lib/analytics.ts` (PostHog + GA4, consent-aware)

---

## 1. Current State

### What exists
- PostHog initialized with `autocapture: true`, `capture_pageview: true`, `capture_pageleave: true`
- GA4 loaded when `VITE_GA_MEASUREMENT_ID` is configured
- Consent flow via `CookieConsent` component
- `analyticsEvents` helper object (in `client/src/lib/analytics.ts`) with:
  - e-commerce events (begin_checkout, checkout_complete, purchase)
  - pilot-exchange events (filter, brief form, policy form, data license)
  - contact form events (submit, error)
  - waitlist signup
  - login/signup attempt

### What is missing
- **Zero events** for any of the robot-team buyer funnel stages: proof -> listing -> request -> hosted-session setup -> workspace -> export
- No funnel-specific event grouping or naming convention that isolates robot-team journeys from e-commerce
- No properties that capture site_id, listing_id, robot_type, or task_type — the contextual fields needed for cross-stage attribution
- No tracking on the Contact page when `hostedMode=true` (the hosted-evaluation request path)

---

## 2. Event Taxonomy

### Naming convention
- Use kebab-case event names with stage prefixes: `{stage}__{action}`
- PostHog: send as plain event names (`proof__view`, `listing__open`)
- GA4: same names map automatically (GA4 prefers snake_case but accepts kebab)

### Stage definitions (mirrors the playbook Buyer Funnel table)

| Stage | Identifier | What counts as entry | What counts as completion |
| --- | --- | --- | --- |
| Proof | `proof` | User lands on `/proof` | Click to a listing page or `/contact?mode=hosted` |
| Listing | `listing` | User views `/world-models` or a specific listing at `/world-models/:id` | User clicks "Request hosted evaluation" or views hosted-session setup |
| Request | `request` | User opens the hosted-evaluation contact form (`Contact` in `hostedMode=true`) | Form submitted successfully |
| Scoping | `scoping` | *Server-side only — Paperclip issue generated* | Human review completed |
| Hosted launch | `hosted_launch` | User opens hosted-session setup flow for a specific site | Session is launched |
| Evaluation | `evaluation` | User enters workspace/exports view for a hosted session | User inspects at least one output |
| Export | `export` | User triggers a download or export of results | Download completes |

### Funnel-stage property
Every funnel event must include a `funnel_stage` property with one of:
`proof`, `listing`, `request`, `scoping`, `hosted_launch`, `evaluation`, `export`

This enables one PostHog insight with funnel_stage as a dimension, without needing to join across event tables.

---

## 3. Event Catalog

### STAGE: proof — `/proof`, home page proof section

| Event name | Trigger location | Key properties | Purpose |
| --- | --- | --- | --- |
| `proof__page_view` | `Proof.tsx` mount | `funnel_stage`, `page`, `source` (UTM/referral if available) | Confirms the user entered the proof stage |
| `proof__reel_play` | User clicks play on the proof reel video | `funnel_stage`, `reel_id` | Measures engagement with the public demo recording |
| `proof__sample_view` | User clicks into "sample deliverables" from proof | `funnel_stage`, `sample_type` | Tracks interest in deliverable examples |
| `proof__cta_proof_to_listing` | Click on "View demo listing" / public proof CTA that navigates to `/world-models` | `funnel_stage`, `cta_label` | Conversion to listing stage |

### STAGE: listing — `/world-models`, `/world-models/:id` (SiteWorlds, SiteWorldDetail)

| Event name | Trigger location | Key properties | Purpose |
| --- | --- | --- | --- |
| `listing__page_view` | `SiteWorlds.tsx` mount | `funnel_stage`, `page`, `filter_active` | Entry to listing stage |
| `listing__detail_view` | `SiteWorldDetail.tsx` mount for a specific site | `funnel_stage`, `site_id`, `listing_id` | User drilled into a specific site listing |
| `listing__filter_apply` | User applies a filter/search on the catalog | `funnel_stage`, `filter_type`, `filter_value` | Understanding how buyers search |
| `listing__cta_to_request` | Click on "Request hosted evaluation" or hosted-mode contact link | `funnel_stage`, `site_id`, `cta_label` | Conversion to request stage |
| `listing__cta_to_package` | Click on "Buy site package" or package-path CTA | `funnel_stage`, `site_id` | Distinguishes package buyers from hosted evaluators |
| `listing__proof_reel_view` | User plays the proof reel embedded on a listing detail page | `funnel_stage`, `site_id` | Proof engagement at the listing level |

### STAGE: request — `/contact?mode=hosted` (Contact page in hostedMode)

| Event name | Trigger location | Key properties | Purpose |
| --- | --- | --- | --- |
| `request__page_view` | `Contact.tsx` mount with `hostedMode=true` | `funnel_stage`, `page`, `site_id` (if from listing), `source` | Entry to request stage |
| `request__form_start` | User focuses first required input or begins typing | `funnel_stage`, `site_id` | Signals intent to request |
| `request__form_submit` | Form submitted successfully | `funnel_stage`, `site_id`, `robot_type` (if provided), `task_type` (if provided), `has_robot_detail` (bool), `has_task_detail` (bool) | Conversion at the request stage — these properties should match what intake-agent needs |
| `request__form_error` | Form submission fails or validation fails | `funnel_stage`, `error_type` | Tracks friction at request |
| `request__form_abandon` | User navigates away after starting form (before submit) | `funnel_stage`, `completion_pct` (approx), `site_id` | Identifies dropoff |

### STAGE: hosted_launch — hosted-session setup flow

| Event name | Trigger location | Key properties | Purpose |
| --- | --- | --- | --- |
| `hosted_launch__page_view` | Hosted session setup page mount | `funnel_stage`, `site_id`, `session_id` | Entry to launch stage |
| `hosted_launch__robot_select` | User selects a robot type/profile | `funnel_stage`, `site_id`, `robot_type` | Understanding robot preferences |
| `hosted_launch__task_select` | User selects a task type | `funnel_stage`, `site_id`, `task_type` | Understanding task preferences |
| `hosted_launch__blocker_seen` | A blocking condition is displayed (e.g., "this site cannot run this policy yet") | `funnel_stage`, `site_id`, `blocker_reason` | Tracks which blockers prevent launch |
| `hosted_launch__confirmed` | User confirms and launches the session | `funnel_stage`, `site_id`, `session_id`, `robot_type`, `task_type` | Successful launch |

### STAGE: evaluation — hosted-session workspace

| Event name | Trigger location | Key properties | Purpose |
| --- | --- | --- | --- |
| `evaluation__workspace_open` | `Workspace.tsx` mount | `funnel_stage`, `site_id`, `session_id` | Entry to the workspace |
| `evaluation__output_view` | User opens/inspects a specific output type (point cloud, metrics table, replay, etc.) | `funnel_stage`, `site_id`, `session_id`, `output_type` | Which outputs are consumed |
| `evaluation__time_in_workspace` | Session exit or after a time threshold | `funnel_stage`, `site_id`, `session_id`, `duration_seconds`, `outputs_viewed_count` | Depth of evaluation engagement |

### STAGE: export — download/export actions from workspace

| Event name | Trigger location | Key properties | Purpose |
| --- | --- | --- | --- |
| `export__initiated` | User clicks download or export | `funnel_stage`, `site_id`, `session_id`, `export_format`, `export_scope` (single output vs. full package) | Tracks export intent |
| `export__completed` | Download completes | `funnel_stage`, `site_id`, `session_id`, `export_format`, `file_size_bytes` (if available) | Final funnel conversion |
| `export__error` | Export fails | `funnel_stage`, `site_id`, `session_id`, `error_type` | Friction at final stage |

---

## 4. Required Code Changes

### A. New events in `client/src/lib/analytics.ts`

Add these to the `analyticsEvents` export object:

```typescript
// proof stage
proofPageView: (source?: string) =>
  trackEvent("proof__page_view", { funnel_stage: "proof", source }),

proofReelPlay: (reelId?: string) =>
  trackEvent("proof__reel_play", { funnel_stage: "proof", reel_id: reelId || "main" }),

proofSampleView: (sampleType: string) =>
  trackEvent("proof__sample_view", { funnel_stage: "proof", sample_type: sampleType }),

proofCtaToListing: (ctaLabel: string) =>
  trackEvent("proof__cta_proof_to_listing", { funnel_stage: "proof", cta_label: ctaLabel }),

// listing stage
listingPageView: (filterActive?: string) =>
  trackEvent("listing__page_view", { funnel_stage: "listing", filter_active: filterActive || "none" }),

listingDetailView: (siteId: string, listingId?: string) =>
  trackEvent("listing__detail_view", { funnel_stage: "listing", site_id: siteId, listing_id: listingId || siteId }),

listingFilterApply: (filterType: string, filterValue: string) =>
  trackEvent("listing__filter_apply", { funnel_stage: "listing", filter_type: filterType, filter_value: filterValue }),

listingCtaToRequest: (siteId: string, ctaLabel: string) =>
  trackEvent("listing__cta_to_request", { funnel_stage: "listing", site_id: siteId, cta_label: ctaLabel }),

listingCtaToPackage: (siteId: string) =>
  trackEvent("listing__cta_to_package", { funnel_stage: "listing", site_id: siteId }),

listingProofReelView: (siteId: string) =>
  trackEvent("listing__proof_reel_view", { funnel_stage: "listing", site_id: siteId }),

// request stage
requestPageView: (siteId?: string) =>
  trackEvent("request__page_view", { funnel_stage: "request", site_id: siteId || "direct" }),

requestFormStart: (siteId?: string) =>
  trackEvent("request__form_start", { funnel_stage: "request", site_id: siteId || "" }),

requestFormSubmit: (payload: { siteId?: string; robotType?: string; taskType?: string; hasRobotDetail: boolean; hasTaskDetail: boolean }) =>
  trackEvent("request__form_submit", {
    funnel_stage: "request",
    site_id: payload.siteId || "",
    robot_type: payload.robotType || "",
    task_type: payload.taskType || "",
    has_robot_detail: payload.hasRobotDetail,
    has_task_detail: payload.hasTaskDetail,
  }),

requestFormError: (errorType: string) =>
  trackEvent("request__form_error", { funnel_stage: "request", error_type: errorType }),

// hosted_launch stage
hostedLaunchPageView: (siteId: string, sessionId?: string) =>
  trackEvent("hosted_launch__page_view", { funnel_stage: "hosted_launch", site_id: siteId, session_id: sessionId }),

hostedLaunchRobotSelect: (siteId: string, robotType: string) =>
  trackEvent("hosted_launch__robot_select", { funnel_stage: "hosted_launch", site_id: siteId, robot_type: robotType }),

hostedLaunchTaskSelect: (siteId: string, taskType: string) =>
  trackEvent("hosted_launch__task_select", { funnel_stage: "hosted_launch", site_id: siteId, task_type: taskType }),

hostedLaunchBlockerSeen: (siteId: string, blockerReason: string) =>
  trackEvent("hosted_launch__blocker_seen", { funnel_stage: "hosted_launch", site_id: siteId, blocker_reason: blockerReason }),

hostedLaunchConfirmed: (siteId: string, sessionId: string, robotType: string, taskType: string) =>
  trackEvent("hosted_launch__confirmed", {
    funnel_stage: "hosted_launch", site_id: siteId, session_id: sessionId, robot_type: robotType, task_type: taskType,
  }),

// evaluation stage
evaluationWorkspaceOpen: (siteId: string, sessionId: string) =>
  trackEvent("evaluation__workspace_open", { funnel_stage: "evaluation", site_id: siteId, session_id: sessionId }),

evaluationOutputView: (siteId: string, sessionId: string, outputType: string) =>
  trackEvent("evaluation__output_view", { funnel_stage: "evaluation", site_id: siteId, session_id: sessionId, output_type: outputType }),

evaluationTimeInWorkspace: (siteId: string, sessionId: string, durationSeconds: number, outputsViewedCount: number) =>
  trackEvent("evaluation__time_in_workspace", { funnel_stage: "evaluation", site_id: siteId, session_id: sessionId, duration_seconds: durationSeconds, outputs_viewed_count: outputsViewedCount }),

// export stage
exportInitiated: (siteId: string, sessionId: string, exportFormat: string, exportScope?: string) =>
  trackEvent("export__initiated", { funnel_stage: "export", site_id: siteId, session_id: sessionId, export_format: exportFormat, export_scope: exportScope || "single" }),

exportCompleted: (siteId: string, sessionId: string, exportFormat: string) =>
  trackEvent("export__completed", { funnel_stage: "export", site_id: siteId, session_id: sessionId, export_format: exportFormat }),

exportError: (siteId: string, sessionId: string, errorType: string) =>
  trackEvent("export__error", { funnel_stage: "export", site_id: siteId, session_id: sessionId, error_type: errorType }),
```

### B. Integration points — where to call each event

| File (relative to `client/src/`) | Where to insert | Events to fire |
| --- | --- | --- |
| `pages/Proof.tsx` | In the page component's `useEffect` for mount | `proofPageView()` |
| `pages/Proof.tsx` | On proof-reel play button click handler | `proofReelPlay()` |
| `pages/Proof.tsx` | On sample deliverables link click | `proofSampleView()` |
| `pages/Proof.tsx` | On "View demo listing" CTA click | `proofCtaToListing()` |
| `pages/SiteWorlds.tsx` | In page mount `useEffect` | `listingPageView()` |
| `pages/SiteWorlds.tsx` | In filter/search handler | `listingFilterApply()` |
| `pages/SiteWorldDetail.tsx` | In `useEffect` with `siteId` param | `listingDetailView(siteId)` |
| `pages/SiteWorldDetail.tsx` | On "Request hosted evaluation" button | `listingCtaToRequest(siteId)` |
| `pages/SiteWorldDetail.tsx` | On "Buy site package" button | `listingCtaToPackage(siteId)` |
| `pages/SiteWorldDetail.tsx` | On proof-reel play in listing detail | `listingProofReelView(siteId)` |
| `pages/Contact.tsx` | Guarded block when `hostedMode === true` and page mounts | `requestPageView(siteId)` |
| `pages/Contact.tsx` | On first input focus (use state guard) | `requestFormStart(siteId)` |
| `pages/Contact.tsx` | On successful form submit when `hostedMode === true` | `requestFormSubmit(...)` |
| `pages/Contact.tsx` | On form validation or submission error | `requestFormError()` |
| (future) Hosted session setup page component | Page mount, robot select, task select, blocker render, launch confirm | `hostedLaunch*` events |
| `pages/Workspace.tsx` | Page mount, output card expand, on unmount/time tracking | `evaluation*` events |
| (future) Export/Download component or button handlers | On click, on completion, on error | `export*` events |

### C. Cross-stage: user session and context properties

The analytics layer already sends event-level properties. The funnel events need a few persistent properties that should be set via PostHog's identify or register mechanisms when they become known:

| Property | Source | When available |
| --- | --- | --- |
| `site_id` | URL param or listing selection | From first listing view |
| `session_id` | Server-generated hosted session ID | After request->scoping or launch |
| `robot_type` | User input on request form or hosted setup | During request or hosted_launch |
| `task_type` | User input on request form or hosted setup | During request or hosted_launch |
| `utm_source`, `utm_medium`, `utm_campaign` | URL query params (already available in `inbound-request.ts`) | First page load |

Recommended approach: When the user first visits a listing, set these as PostHog person properties using `posthog.register()` or `posthog.people.set()`. This avoids needing to pass them as event properties everywhere. The event-level `site_id` etc. should still be sent explicitly as a safety net.

---

## 5. Blind Spots in Current Tracking

1. **No hosted-mode contact tracking**: The `Contact` page already imports `{ analyticsEvents }` from `@/lib/analytics`, but the `hostedMode === true` flow (`?mode=hosted`) has no events fired. This is likely the single biggest gap because it's the request-stage conversion point.

2. **Listing detail views are invisible**: PostHog's autocapture might fire a generic `$pageview` on `/world-models/:id`, but there is no structured event with `site_id` that the weekly robot-team growth routine can query. Without a `listing__detail_view(site_id=...)` event, the routine can only count page views, not listing-level demand.

3. **No robot_type or task_type capture anywhere**: The request form asks for these but doesn't propagate them into analytics. The intake-agent needs these fields for routing, and the growth routine needs them for segmentation.

4. **Workspace/evaluation tracking is entirely absent**: The `Workspace.tsx` page has no analytics imports. If hosted sessions do run, there is currently zero instrumentation for what buyers do inside them.

5. **Export/download tracking is absent**: No events for the final funnels end — no way to measure whether hosted-evaluation buyers actually download or consume outputs.

6. **Funnel-stage dimension is missing**: Even if autocapture fires events, there is no way in PostHog to filter "only robot-team funnel events" because there is no consistent `funnel_stage` property across events.

---

## 6. Reporting Spec — What the Weekly Robot-Team Growth Routine Needs

The robot-team growth weekly (BLU-142) should be able to build these metrics from PostHog with no custom server-side joins:

### Metric 1: Funnel by stage
```
Count of distinct users (or sessions) for:
  proof__page_view
  listing__detail_view
  request__form_submit
  hosted_launch__confirmed
  evaluation__workspace_open
  export__completed
```
Presented as a funnel with stage-to-stage conversion rates.

### Metric 2: Top listings by demand intent
```
Count of listing__cta_to_request events
Group by site_id
Sort descending
```

### Metric 3: Request quality
```
Count of request__form_submit events
  Where has_robot_detail = true
  Where has_task_detail = true
```
Percentage of requests with sufficient technical context.

### Metric 4: Robot type distribution
```
Count of request__form_submit or hosted_launch__confirmed
Group by robot_type
```

### Metric 5: Task type distribution
```
Count of request__form_submit or hosted_launch__confirmed
Group by task_type
```

### Metric 6: Proof-to-listing conversion
```
Count of proof__cta_proof_to_listing events
Divided by proof__page_view events
```

### Metric 7: Workspace engagement depth
```
Average evaluation__time_in_workspace.duration_seconds
Average evaluation__time_in_workspace.outputs_viewed_count
Count of distinct session_ids that have evaluation__output_view
```

### Metric 8: Export completion rate
```
Count of export__completed
Divided by count of export__initiated
```

---

## 7. Implementation Notes

- **No dependency additions required**: The existing PostHog + GA4 setup is sufficient. We only need to add event names and call sites.
- **GA4 considerations**: GA4 will receive these events too. GA4 prefers event names in snake_case. The kebab names will work but PostHog should be the primary analytics platform for this funnel.
- **Testing**: After changes, verify each event fires locally with `npm run dev` and check the PostHog debug panel (`posthog.debug()`) or GA4 debug view.
- **Phased rollout**: The easiest wins are the proof, listing, and request events (items 4A, 4B, 4C in section 4). Hosted launch, evaluation, and export events may depend on server-side session creation that is not yet live — those can be added incrementally.
