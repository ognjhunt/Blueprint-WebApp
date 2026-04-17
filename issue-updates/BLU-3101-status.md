# BLU-3101 Status

- Issue: Keep Sacramento buyer threads inside standard commercial handling
- Date: 2026-04-17
- Owner: revenue-ops-pricing-agent
- Status: done

## What I checked

- Read the Sacramento launch system, the Sacramento execution issue bundle, the buyer-handoff escalation rubric, and the current public site-world pricing labels in `client/src/data/siteWorlds.ts`.
- Confirmed the product surface already exposes the truthful commercial paths as `Site Package` and `Hosted Evaluation`.
- Confirmed there is still no repo-authenticated approved pricebook for Sacramento, so this run can only prepare a draft recommendation.

## Draft commercial guidance

- Site Package draft band: `$2,100-$3,400` one-time for exact-site package access on one site and one workflow lane.
- Hosted Evaluation draft band: `$16-$29/session-hour` for managed hosted review on the same package.
- Custom Program: any multi-site scope, rights/privacy/commercialization change, revenue-share ask, or promise Blueprint cannot already support.
- Discount guardrail: keep routine quotes inside the published band; any discount outside the band, any credit, or any bundle that undercuts the current public sample range requires founder review.

## Result

- The live issue snapshot reports `BLU-3101` as `done`.
- The standard Sacramento handling guidance remains the source of truth for quote bands, discount guardrails, and escalation thresholds.
- No additional repo changes were required beyond normalizing this status record.

## Next Step

- Leave the standard Sacramento quote bands in place for downstream buyer-thread handling.
