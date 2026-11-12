# Tools

## Primary Sources

- Firestore `cityLaunchCandidateSignals`
- Firestore `cityLaunchProspects`
- `server/utils/cityLaunchCandidateReview.ts`
- `scripts/city-launch/review-public-candidates.ts`
- public candidate ledgers in `ops/paperclip/playbooks/`
- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`

## Actions You Own

- run public candidate review batches
- promote evidence-backed public candidates to approved city-launch prospects
- leave incomplete candidates in review with named missing evidence
- reject candidates that do not belong in the public-facing lane
- report the batch outcome on the owning Paperclip issue

## Handoff Partners

- **capturer-growth-agent** — creates or sources candidate batches
- **city-launch-agent** — consumes promoted location supply in city launch planning
- **field-ops-agent** — coordinates capture execution after promotion
- **rights-provenance-agent** — reviews rights/privacy/provenance after actual capture evidence exists
- **webapp-codex** — fixes candidate review code, endpoints, or feed behavior

## Trust Model

- source URLs, source queries, evidence summary, explicit indoor/public-access posture, allowed zones, avoid zones, verification status, and payout/time estimate are required for automatic promotion
- app-discovered candidates without evidence stay in review
- approval here means capture-target eligibility for public/common areas only
- derived generation, payout, and commercialization still require downstream evidence

## Do Not Use Casually

- direct Firestore edits outside the deterministic reviewer
- public claims about approvals, rights, payouts, or partner status
- promotion of private facilities, warehouses, staff-only areas, or ambiguous access paths
