# Private site links and session visibility

State: done (repo-local implementation and focused verification).

Objective: preserve site-claim authority across navigation and remove protected content when the current session no longer permits it, within the authorized 48-hour reliability closeout. Local run: `site-ux-2026-10-07`; external issue identifier and detailed execution budget were not supplied. ADP linkage: partner admission and authorization; no additional ADP backlog identifier or day-gate assignment was supplied. Base: `efd2e6858`.

## Actual journey and boundaries

| Journey step | Current entry / owner | Reliability boundary |
| --- | --- | --- |
| Public entry | `/` → `/contact/site-operator`; `SiteCaptureStart` | Anonymous description intake or signed-in workspace intake. |
| Save description | `POST /api/inbound-request` or `/api/workspace/capture-start` | Mutating intake; tests use intercepted fixture responses only. A workspace 403 falls back to public intake with the same answers. In-memory request ID and retry token support retries only while mounted. |
| Private job link | `/capture-upload/:token`; `SelfCaptureUpload` | Token-scoped keyed component; owner/film capabilities remain server-authoritative. Receipt and processing are distinct facts. |
| Desktop handoff | `CaptureLiveStatus` reads `/api/site-task-brief/:token/status`, then upload status | A retained receipt ends the handoff even if processing is held. No inference of processing, rights clearance or readiness. |
| Site claim | `/claim/:token`; `ClaimSite` | Public signed-summary read, then Firebase verified-email authority and protected workspace claim. |
| Workspace | `/app/tasks/:id`, `ProtectedRoute` | Render visibility follows current auth, profile and required role. Server authorization remains authoritative. |
| Robot-team entry | `/contact/robot-team`; `TaskBrowse` | Separate access intake, outside these fixes. |

Production route side effects were inspected in source, including route composition and claim read/attach separation. No production URLs, real accounts, provider calls, email sends or mutations were used in this lane. Browser contexts were new and anonymous. Vite used a nonexistent fixture Firebase project, excluded dotenv files and stripped inherited credentials. Browser routing aborted every origin except the exact localhost server; all API calls were intercepted. Chromium DNS was also blocked except localhost.

## Reproduced defects and fixes

1. **Cross-token claim state.** Client-side navigation to a second claim retained the first site's actionable form while the new summary loaded. The password and checked terms survived; a delayed retry for the first link could overwrite the second site's summary. `ClaimSiteForToken`, keyed by token, now scopes form state and pending UI completions to the current link. It follows the existing `SelfCaptureUpload` pattern.
2. **Sticky protected-route visibility.** After successful admission, sign-out, admin-role revocation or a change to a capturer profile retained private children while redirect effects ran. Readiness now derives from the current render's identity and authority rather than a sticky boolean.

The claim fix prevents stale UI/consent transfer; it does not cancel an external operation already authorized and in flight for the previous link. Deferred sign-in and verification tests ensure those completions never claim the next token or replace its screen.

## Evidence and reproduction

- Before ClaimSite fix: original 12 tests passed; three new navigation/race tests failed. After: 17/17, including delayed sign-in and verification completion.
- Before ProtectedRoute fix: original two tests passed; all three session-transition regressions failed. After: 5/5.
- Focused regression command: `npx vitest run client/tests/pages/ClaimSite.test.tsx client/tests/components/ProtectedRoute.test.tsx client/tests/components/SiteCaptureStart.test.tsx --maxWorkers=1` → **71 passed**. One existing SiteCaptureStart async `act` warning remains; tests pass.
- Real Chromium before ClaimSite fix: `private claim navigation` failed at the loading-state assertion; the old form remained visible during the second token read.
- Browser command: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:site-reliability:browser` (omit executable override where Playwright Chromium is installed) → **3 passed**: cross-token/back/reload; mobile offline read + keyboard retry with no horizontal overflow; desktop retained footage without processing completion.
- Dedicated browser suite runs in the existing CI E2E job. Its isolated config starts only a local Vite frontend, never Express. It is excluded from the default backend E2E sweep.
- Local raw logs, trace and screenshots: `work/claim-before.log`, `work/guard-before.log`, `work/components-after.log`, `work/browser-before.log`, `work/browser-after.log`, `work/site-reliability/`. They are scratch evidence; tracked regression tests and this report provide the portable reproduction path.
- Required graph refresh attempted: `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz`. Corpus staging passed; dependency bootstrap failed because sandbox networking prevented downloading pinned Graphify. Root integration owns a shared environment and final graph/type verification.

## Limits and handoff

Root integration owns final full typecheck, combined-suite checks, graph refresh, release and deployment decisions. This lane has not proven production behavior, real Firebase sign-in, real email verification, or backend receipt truth; the backend owner separately verifies the signed status reader. Frontend success is not a production launch claim.

Unsubmitted site-intake drafts, including request/retry identity, remain in memory and do not survive a reload. This was observed in source, not silently redefined as durable retention. A future draft-recovery change needs a deliberate private-data retention contract; it is not required to scope these private-link fixes.

Next action: root integrates this candidate and backend receipt recovery, reruns the documented browser command and overall checks, then reviews the release packet. Resume only on a relevant regression or integration failure. No operating-graph or Paperclip update is required for this local candidate; the org guide retires those roles as approval authorities.
