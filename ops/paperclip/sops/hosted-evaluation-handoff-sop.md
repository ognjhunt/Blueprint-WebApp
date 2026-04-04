# Hosted-Evaluation Handoff & Blocker SOP

Follow-up from BLU-142. Defines the human-reviewed operating path from inbound robot-team request through hosted launch readiness and blocker escalation.

## Scope

This SOP covers the full chain from the moment a robot-team buyer submits a hosted-evaluation request to the moment the first hosted session either runs successfully or hits a blocker. It covers:

- owner handoffs across request review, scoping, launch-readiness, and blocker escalation
- explicit mandatory human-approval gates
- queue/staffing risks that make the generic motion untruthful today
- recommended next ops action to keep the path dependable without overselling

## Funnel Map

| Step | Surface | Owner | Output |
|------|---------|-------|--------|
| 1. Submitter fills hosted-evaluation contact form | `/contact` or hosted-eval form | buyer (anonymous) | Firestore `contactRequests` + `ops/marketplaceWishlist/requests` + email to `ops@tryblueprint.io` |
| 2. Request lands in ops queue | Firestore + email notification | `ops-lead` (review) | triaged, classified, prioritized |
| 3. Scoping & site feasibility | human review + site-world lookups | `ops-lead` + `intake-agent` | scoped request with site-world ID confirmed or pending |
| 4. Launch readiness check | `server/routes/site-world-sessions.ts`, site-world health checks | `ops-lead` + product infra | Go/No-Go with explicit blockers listed |
| 5. Hosted session creation | `POST /api/site-world-sessions/hosted` | system (`createHostedSessionRun`) | session record + workspace URL |
| 6. Runtime execution & outputs | orchestrator + runtime + presentation demo | system + buyer | episodes, outputs, exports |
| 7. Review & handoff | hosted-session workspace | `ops-lead` | results delivered to buyer |

## Owner Handoffs

### 1. Request Review (ops-lead)

**Trigger:** New contact form submission with `requestSource: "website-contact-form"` or similar robot-team inbound.

**What happens:**
- The contact handler (`server/routes/contact.ts`) writes to:
  - `contactRequests` — main ops queue
  - `ops/marketplaceWishlist/requests` — secondary queue
  - Sends email to `ops@tryblueprint.io`
- An `ops_automation` field is included with `status: "pending"`, `queue: "support_triage"`, and `next_action: "triage contact request"`.

**Ops-lead actions:**
1. Review the contact request in Firestore or from the email notification
2. Confirm buyer type: must be `robot_team` to access hosted sessions (enforced in `ensureLaunchAccess` at line 149-156 of `site-world-sessions.ts`)
3. If not `robot_team`: route back to general sales/support — hosted session is not available
4. If `robot_team`: create a Paperclip issue in the Blueprint-WebApp project with the request details and assign to yourself

**Deliverable:** Paperclip issue with status `todo`, request payload attached, buyer type confirmed.

### 2. Scoping (ops-lead + intake-agent)

**Trigger:** Paperclip issue created from Step 1.

**What happens:**
- Ops-review identifies the target site(s) for the evaluation
- Maps to an existing site-world in `siteWorlds` collection, or determines a new capture is needed

**Scoping checklist:**
- [ ] Buyer's robot profile is supported (see `EmbodimentType` in `server/types/hosted-session.ts`: humanoid, mobile_manipulator, fixed_arm, mobile_base, cart, other)
- [ ] The requested task maps to a known task catalog entry (`TaskCatalogEntry`)
- [ ] The requested scenario exists in the scene library (`ScenarioCatalogEntry`)
- [ ] The target site-world exists in Firestore `siteWorlds` with `status` ready/packaged
- [ ] If no site-world exists: initiate capture request (route to field-ops/capturer)
- [ ] Backend variant is identified: `resolveHostedRuntime` must find a `SiteWorldRuntimeSummary` with `launchable: true`

**Deliverable:** Scoped request with confirmed site-world ID, robot profile ID, task ID, scenario ID, and start-state ID — all required fields for `CreateHostedSessionRequest`.

### 3. Launch-Readiness Review (ops-lead)

**Trigger:** Scoping complete, all IDs confirmed.

**Mandatory human-approval gate:** The ops-lead must explicitly confirm that the hosted evaluation is truthful and not oversold before launching.

**Launch readiness checklist:**
- [ ] Site-world is not in a blocked state (not "archived", "pending_capture", or "processing")
- [ ] Backend variant reports `launchable: true` with `blockers: []`
- [ ] `resolveHostedRuntime` returns a valid runtime with `runtime_base_url` and `websocket_base_url`
- [ ] Presentation UI state: check `PresentationLaunchState.status` — must be `live_viewer` or `artifact_backed` for demo mode
- [ ] If `status: "blocked"`: see Blocker SOP below
- [ ] Buyer account has `buyerType: "robot_team"` (enforced at runtime but confirm proactively)
- [ ] Commercial terms are clear (pricing, invoicing — see finance-support-agent for the commercial blocker packet)

**Deliverable:** Explicit Go/No-Go decision recorded in the Paperclip issue.

### 4. Hosted Session Launch

**Trigger:** Go decision confirmed.

**What happens:**
- Session is created via `createHostedSessionRun` in `server/utils/hosted-session-orchestrator.ts`
- Session record is written to Firestore `hostedSessions` collection
- A workspace URL is returned for the buyer to access the hosted evaluation
- The session enters `creating` -> `ready` -> `running` state

**System behavior:**
- The session is stored in-memory, in Firestore, and in the live store (`setLiveHostedSession`)
- State transitions are mirrored asynchronously in production mode
- Failed sessions get diagnostic records (`HostedSessionFailureDiagnostic`) attached with `source`, `operation`, `code`, `summary`, and optional `traceback`

### 5. Blocker Handling During Execution

**Blockers are tracked via:**
- `HostedSessionFailureDiagnostic` — technical failures during create/reset/step/render/presentation_launch
- `HostedSessionLaunchBlockerDetail` — pre-launch blockers from access/qualification/runtime/presentation_demo sources
- `HostedSessionPendingOperation` — queued operations that may time out

**When a blocker is detected:**
1. System records the failure diagnostic in the session record
2. If the block is recoverable (runtime timeout, retryable error): the system attempts re-resolution
3. If the block is non-recoverable (missing artifact, permission denied, backend not launchable): the session status becomes `failed`
4. Ops-lead is notified (via existing email/queue infrastructure)
5. Ops-lead reviews the diagnostic, determines if the blocker can be resolved, and either:
   - Fixes the root cause and re-creates the session
   - Escalates to the appropriate team (capturer, infra, product)
   - Communicates the blocker to the buyer with a truthful timeline

## Blocker SOP

### Blocker Classification

| Blocker Source | Example | Resolution Owner | Escalation Path |
|----------------|---------|-----------------|-----------------|
| `access` | User not authenticated, not robot_team | ops-lead | N/A — buyer reclassification |
| `qualification` | Site-world not qualified, missing capture | ops-lead | capturer supply queue |
| `runtime` | Backend fails to initialize, VM crash | ops-lead | infrastructure team |
| `presentation_demo` | Presentation UI assets missing, launch fails | ops-lead | product surfaces team |

### Mandatory Human Gates

The following steps **require human approval** — they must NOT be automated away:

1. **Buyer type confirmation** — ensure the buyer is actually a robot-team before enabling hosted session access
2. **Site-world truthfulness** — confirm the site-world being used is real, has real capture provenance, and the package/manifest accurately represents what is available
3. **Commercial terms** — any pricing, invoicing, or procurement discussion must be human-gated
4. **Blocker communication** — all buyer-facing communications about blockers, delays, or capability limits must be human-reviewed
5. **Go/No-Go decision** — the final launch decision must be made by the ops-lead, not automated

These gates reflect the product rule: "Do not overstate simulated or generated outputs as ground truth." Every hosted session must be anchored to real capture provenance and truthful site representation.

## Queue & Staffing Risks

### Risk 1: Firebase Admin Credentials

**Issue:** `BLU-68` tracks restoration of Firebase Admin credentials for intake Firestore triage. Without working Firebase Admin SDK, the contact form cannot write to `contactRequests`, `ops/marketplaceWishlist/requests`, or `hostedSessions`.

**Impact:** If Firebase Admin is unavailable, the entire intake-to-hosted-session pipeline breaks. Contact form submissions will return `SERVICE_UNAVAILABLE`.

**Mitigation:** Block hosted-evaluation workflows until `BLU-68` is resolved.

### Risk 2: No Dedicated Hosted-Evaluation Request Form

**Issue:** The current contact form (`server/routes/contact.ts`) is a generic form that accepts many request types. Robot-team hosted-evaluation requests arrive as generic contact submissions and require manual triage to identify and scope.

**Impact:** Requests may be delayed in triage; missing technical fields (robot platform, task description, site reference) may not be captured.

**Mitigation:** Consider a dedicated hosted-evaluation intake form with required fields matching `CreateHostedSessionRequest`.

### Risk 3: Site-World Availability

**Issue:** Hosted sessions require a ready site-world with validated capture artifacts. If the requested site doesn't have a completed pipeline run, no hosted session can be launched.

**Impact:** Buyer expectations may not match reality. The system must truthfully communicate when a site-world is not available.

**Mitigation:** The `resolveHostedRuntime` function already provides `launchable: false` with `blockers` array for this case. Ensure this surface is visible to the ops-lead during scoping.

### Risk 4: Presentation Demo Infrastructure

**Issue:** Presentation demos use Vast GPU instances (`provider: "vast"`) for the UI. If these are unavailable, the hosted session can only run in `runtime_only` mode, losing the visual presentation layer.

**Impact:** Reduced buyer experience quality, may affect conversion.

**Mitigation:** Graceful degradation is already implemented — the system falls back to `runtime_only` mode when presentation is unavailable.

## Recommended Next Ops Action

1. **Resolve BLU-68** (Firebase Admin credentials) — blocking the entire intake pipeline
2. **Create a dedicated hosted-evaluation intake form** with fields aligned to `CreateHostedSessionRequest`: `siteWorldId`, `robotProfileId`, `taskId`, `scenarioId`, `startStateId`, `requestedBackend`, `notes`
3. **Add an ops dashboard page** in the client that lists pending hosted-evaluation requests with their scoping status, launch readiness, and blocker state
4. **Document the commercial blocker packet** with finance-support-agent covering hosted-session pricing, invoicing, rights/privacy questions, and export/support boundaries
5. **Add a runbook** for ops-lead to follow when a hosted session fails — including diagnostic interpretation, common failure modes, and escalation contacts
