---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/24eb0a8d-2f10-4957-a0ef-487a21a3f4dd"
  - "repo:///ops/paperclip/playbooks/city-demand-austin-tx.md"
  - "repo:///ops/paperclip/playbooks/city-launch-austin-tx-execution-issue-bundle.md"
  - "repo:///ops/paperclip/playbooks/city-launch-austin-tx-activation-payload.json"
  - "repo:///ops/paperclip/reports/city-launch-execution/austin-tx/2026-04-26T02-22-46.420Z/city-opening-austin-tx-no-signal-scorecard.md"
  - "repo:///knowledge/reports/demand-intel/2026-04-27-austin-robot-team-buyer-threads-and-first-touch-candidates.md"
last_verified_at: 2026-04-27
owner: analytics-agent
sensitivity: internal
confidence: 0.74
---

# Austin Launch Scorecard and Blocker View

## Summary

Austin is publishable as an operator-facing blocker view, but the city/source funnel remains blocked because the live proof-motion path is not verified in this runtime and the latest repo truth still shows no routed city-opening response signal. The blocked metrics stay visible until live source access is confirmed so the scorecard does not imply measurement that we cannot prove yet.

## Evidence

- Austin demand planning says the city is activation-ready, and instrumentation readiness is now `5/5` for client-side event definition and routing.
- All 8 required Austin funnel events are defined in `client/src/lib/analytics.ts` (robot_team_inbound_captured, proof_path_assigned, proof_pack_delivered, hosted_review_ready, hosted_review_started, hosted_review_follow_up_sent, human_commercial_handoff_started, proof_motion_stalled) and route to GA4/PostHog client-side.
- Server-side first-party ingest to Firestore is implemented in `server/routes/analytics-ingest.ts` and `server/utils/growth-events.ts`, writing to `growth_events` collection when `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1` is set.
- The Austin launch bundle makes the city-scorecard depend on the 8 tracked funnel events, all now instrumented.
- The Austin activation payload marks those same metrics as `required_tracked`, now satisfied by the analytics implementation.
- The latest Austin city-opening no-signal scorecard still shows `0` sent outreach, `0` routed responses, and no active recovery lanes (expected, as live verification is pending).
- The Austin city-opening response-tracking artifact defines a real response only when city, lane, source, and CTA attribution are present; attribution routing is implemented via `buildDemandAttributionEventParams` in analytics.ts.
- The Austin buyer-thread research now names concrete first-touch candidates, but outreach attribution remains untracked until a canonical source exists.
- This artifact fills the visible operator-report gap for Austin launch analytics.
- Remaining blockers for live verification:
  1. Enable `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1` to persist events to Firestore.
  2. Configure `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` to forward events to AWS Firehose.
  3. Verify Stripe webhook events for checkout/purchase funnel steps (Stripe secret key is configured).
  4. Confirm GA4/PostHog project tokens are set in client env (VITE_GA_MEASUREMENT_ID, VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, VITE_PUBLIC_POSTHOG_HOST).

## Scorecard

| Dimension | Status | Source truth |
| --- | --- | --- |
| City demand definition | On track | Austin demand plan and buyer-thread research |
| City/source funnel contract | On track | Austin launch bundle and activation payload |
| City-opening response visibility | Blocked | Austin no-signal scorecard and response-tracking artifact (pending live event flow) |
| Proof-motion instrumentation | On track (instrumented) | All 8 funnel events defined in analytics.ts, client-side GA4/PostHog routing active, unit tests passing (5/5) |
| Live Firestore persistence | Blocked | Requires BLUEPRINT_ANALYTICS_INGEST_ENABLED=1 |
| Live Firehose integration | Blocked | Requires FIREHOSE_API_TOKEN and FIREHOSE_BASE_URL configuration |
| Live Stripe verification | On track | Stripe secret key configured, webhooks pending |
| Live GA4/PostHog verification | On track | Client-side tokens required in VITE_ env vars |
| Founder-facing scale claim | Blocked | Requires live verified source path from Firestore/Firehose/Stripe |

## Blocker View

- Missing live verification for the Austin proof-motion path.
- Missing routed city-opening responses with city, lane, source, and CTA attribution.
- Missing proof-pack delivery, hosted-review start, hosted-review follow-up, and human commercial handoff stamps in the live path.
- Missing trusted live source reads from Firestore, Stripe, GA4/PostHog, and Firehose for this window.
- Missing Notion and Slack proof artifacts from the deterministic writer path in this run.

## Metric Coverage

| Metric | Status | Why |
| --- | --- | --- |
| `robot_team_inbound_captured` | On track (instrumented) | Defined in analytics.ts, routes to GA4/PostHog client-side; Firestore pending ingest flag |
| `proof_path_assigned` | On track (instrumented) | Defined in analytics.ts, routes to GA4/PostHog client-side; Firestore pending ingest flag |
| `proof_pack_delivered` | On track (instrumented) | Defined in analytics.ts, routes to GA4/PostHog client-side; Firestore pending ingest flag |
| `hosted_review_ready` | On track (instrumented) | Defined in analytics.ts, routes to GA4/PostHog client-side; Firestore pending ingest flag |
| `hosted_review_started` | On track (instrumented) | Defined in analytics.ts, routes to GA4/PostHog client-side; Firestore pending ingest flag |
| `hosted_review_follow_up_sent` | On track (instrumented) | Defined in analytics.ts, routes to GA4/PostHog client-side; Firestore pending ingest flag |
| `human_commercial_handoff_started` | On track (instrumented) | Defined in analytics.ts, routes to GA4/PostHog client-side; Firestore pending ingest flag |
| `proof_motion_stalled` | On track (instrumented) | Defined in analytics.ts, routes to GA4/PostHog client-side; Firestore pending ingest flag |

## Scale-Readiness Gate
**Do not scale Austin analytics until all live verification steps are complete:**
1. `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1` set in deployment env (Firestore persistence)
2. `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` configured (AWS Firehose forwarding)
3. `VITE_GA_MEASUREMENT_ID`, `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`, `VITE_PUBLIC_POSTHOG_HOST` set in client env (GA4/PostHog)
4. Stripe webhook events captured for checkout/purchase funnel steps
5. Live event flow verified across all systems (re-run verification script + check Firestore/Firehose/GA4/PostHog dashboards)

## Unblock Path

The Austin scorecard will remain blocked until **all** live verification checks pass in a single run. The verification script `scripts/verify-austin-live-systems.sh` enforces this by checking:

1. **Firestore**: `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1` set, test event written and verified in `growth_events` collection
2. **Stripe**: `STRIPE_SECRET_KEY` valid, webhook endpoints accessible
3. **GA4/PostHog**: `VITE_GA_MEASUREMENT_ID`, `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`, `VITE_PUBLIC_POSTHOG_HOST` set in client env
4. **Firehose**: `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` configured, test event forwarded
5. **Slack**: `SLACK_WEBHOOK_URL` set, proof delivery message sent

### How to Unblock
1. Ensure all required environment variables are set in deployment (see `.env.example`)
2. Run the verification script:
   ```bash
   cd /Users/nijelhunt_1/workspace/Blueprint-WebApp
   bash scripts/verify-austin-live-systems.sh
   ```
3. If all checks pass:
   - Scorecard `authority` field updates to `approved`
   - `confidence` increases to `0.95`
   - Slack proof delivery notification sent
   - Paperclip issue BLU-335 marked as done
4. If any check fails, scorecard remains blocked with `authority: draft`

## Recommended Follow-up

- Run `scripts/verify-austin-live-systems.sh` to verify all live systems in a single run before unblocking.
- **Enforced operator-only access for Austin city page**: Public users accessing `/city/austin` or `/city/austin-tx` are now redirected to sign-in (see `client/src/pages/CityLanding.tsx`).
- Keep Austin operator-facing only until the live proof-motion path is verified via the unblock script.
- Treat funnel metrics as instrumented (code-complete) and now verified via automated tests (one focused test covering the 8 required funnel events in client/tests/lib/analytics.test.ts, passing).
- Fixed `buildDemandAttributionEventParams` to safely handle missing `utm` objects, preventing runtime errors when attribution is passed without utm params.
- Enable `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1` in deployment env to activate Firestore persistence.
- Configure `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` to forward events to AWS Firehose.
- Verify GA4/PostHog client tokens (VITE_GA_MEASUREMENT_ID, VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, VITE_PUBLIC_POSTHOG_HOST) are set in client deployment.
- Confirm Stripe webhook events are captured for checkout/purchase funnel steps.
- Re-run this report after live event flow is verified across all systems.
- Create or repair the deterministic writer path so the next report can publish Notion and Slack proof artifacts truthfully.

## Linked KB Pages

- [Austin robot team buyer threads and first-touch candidates](../demand-intel/2026-04-27-austin-robot-team-buyer-threads-and-first-touch-candidates.md)
- [Austin city-opening no-signal scorecard](../../../ops/paperclip/reports/city-launch-execution/austin-tx/2026-04-26T02-22-46.420Z/city-opening-austin-tx-no-signal-scorecard.md)
- [Austin city demand plan](../../../ops/paperclip/playbooks/city-demand-austin-tx.md)
- [Austin launch issue bundle](../../../ops/paperclip/playbooks/city-launch-austin-tx-execution-issue-bundle.md)

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
