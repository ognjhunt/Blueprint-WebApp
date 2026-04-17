Issue: BLU-3196 Publish the Sacramento launch scorecard and blocker view
Status: Blocked
Date: 2026-04-17

Actions Taken:
- Read the bound issue heartbeat context and confirmed the run stayed scoped to BLU-3196 only.
- Re-read the analytics-agent instructions, the KPI contract, the Sacramento launch system, the latest routing summary, and the Sacramento scorecard mirror in repo truth.
- Verified the live issue is already assigned, already marked `blocked`, and already points at the Sacramento measurement lane.
- Confirmed the freshest Sacramento analytics mirror still publishes only a blocked operator scorecard because live Firestore, Stripe, PostHog, and GA4 verification is missing.
- Confirmed the Sacramento proof-motion metrics remain `required_not_tracked`, so the scorecard cannot truthfully report live progress on proof-pack delivery, hosted review, or handoff.
- Added the missing Sacramento blocker-view artifact at `knowledge/reports/city-launch-execution/sacramento-ca/2026-04-17-sacramento-launch-scorecard-and-blocker-view.md`.
- Kept the repo breadcrumb aligned with the latest blocked scorecard instead of inflating missing signals into progress.

Outcome:
- The Sacramento scorecard and blocker view remain truthfully blocked.
- The repository now has a durable Sacramento blocker-view artifact that matches the current analytics mirror.
- The report stays bounded to repo truth and does not claim live proof motion that is not present.
- The issue does not move forward until a canonical live signal exists for the missing proof-path metrics.

Next Steps:
- Keep `robot_team_inbound_captured`, `proof_path_assigned`, `proof_pack_delivered`, `hosted_review_ready`, `hosted_review_started`, `hosted_review_follow_up_sent`, `human_commercial_handoff_started`, and `proof_motion_stalled` visibly blocked until the live path changes.
- Add a new proof-bearing update only when the live source path can support a truthful state change.
