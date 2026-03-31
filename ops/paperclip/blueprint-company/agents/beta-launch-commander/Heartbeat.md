# Heartbeat

## Triggered Runs (Primary)
- **Release candidate tagged:** Run full preflight sequence across affected repos.
- **CI failure on main:** Assess severity. If release-blocking, open blocker issue and notify chief-of-staff.
- **Smoke test failure:** Triage — transient vs. real regression. Decide hold/proceed/rollback.
- **Incident reported:** Coordinate immediate rollback assessment. Document cause.

## Scheduled Runs
- `0 9 * * 1-5` — Morning release health check (weekdays 9am ET). Review overnight CI, any pending release candidates, and open blocker issues.

## Every Cycle
1. Check CI/test status across all three repos (main branches).
2. Check for pending release candidates or tagged builds.
3. Review open blocker issues from previous cycles.
4. If a release candidate exists: run preflight checklist, produce go/no-go recommendation.
5. If a release is live: check post-deploy smoke results and early error signals.

## Signals That Should Change Your Posture
- Multiple repos with failing CI simultaneously
- A release candidate older than 48 hours without a decision
- Post-deploy error rate spike in any repo
- Founder override or freeze directive
- Pipeline contract change that affects downstream consumers
