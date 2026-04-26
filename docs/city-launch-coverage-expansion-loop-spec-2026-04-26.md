# City Launch Coverage Expansion Loop Spec

Date: 2026-04-26

Status: Proposed implementation spec

Scope: A city-specific expansion loop that keeps Blueprint's public-area capture target inventory growing beyond the first obvious 10-20 locations while preserving evidence, dedupe, review, and notification truth boundaries.

## Problem

The current city-launch candidate path can source, seed, review, promote, demote, and notify for public-area targets, but it is still batch-shaped.

That means a city can end up with a small approved set, for example 6 active approved Durham targets, even though the city may have hundreds or thousands of potentially useful public-facing indoor/common-access places.

The missing layer is a durable coverage-expansion policy:

- category quotas
- neighborhood/geographic tiling
- source-bucket quotas
- stale/duplicate avoidance
- explicit minimum inventory targets
- city-specific breadth rules
- replenishment when approved targets are claimed, captured, rejected, or exhausted

## Goal

For each active city, maintain a rolling supply of capture targets:

- at least `N` approved active targets visible to eligible capturers
- at least `M` evidence-backed candidates in review
- at least `R` rejected or excluded records preserved with reasons so agents do not rediscover the same bad locations
- a broader backlog of researched but not-yet-promoted candidates by category, neighborhood, and source bucket

The loop must expand city coverage without claiming that targets are rights-cleared, operator-approved, payout-guaranteed, or capture-proven.

## Non-Goals

- Do not use this loop to authorize capture inside private, controlled, staff-only, or permission-required areas.
- Do not treat search evidence as rights clearance or operator approval.
- Do not send real notifications for in-review, rejected, inactive, or missing-evidence candidates.
- Do not optimize for raw count at the expense of evidence quality.
- Do not make every city use the same category mix.

## Loop Summary

1. Read the city coverage profile.
2. Read current Firestore inventory: approved, in-review, rejected, inactive, claimed, captured.
3. Compute coverage gaps by category, neighborhood tile, and source bucket.
4. Generate targeted research queries only for under-covered cells.
5. Fetch/verify candidate evidence through governed web-search/web-fetch.
6. Seed candidates into `cityLaunchCandidateSignals`.
7. Auto-run deterministic public-space review.
8. Promote eligible candidates into `cityLaunchProspects`.
9. Notify matching capturers only for newly promoted active prospects.
10. Update scorecards, coverage state, and Paperclip issue proof.
11. Repeat on a cadence until city targets are above threshold.

## City Coverage Profile

Add a per-city coverage profile, stored as repo truth and materialized into Firestore.

Proposed repo path:

`ops/paperclip/playbooks/city-launch-<city-slug>-coverage-policy.json`

Proposed Firestore collection:

`cityLaunchCoveragePolicies/{citySlug}`

Example shape:

```json
{
  "city": "Durham, NC",
  "citySlug": "durham-nc",
  "version": "2026-04-26",
  "inventoryTargets": {
    "approvedActiveMin": 50,
    "inReviewMin": 100,
    "researchedBacklogMin": 250,
    "maxNewCandidatesPerRun": 40
  },
  "geographicTiles": [
    {
      "id": "downtown-core",
      "label": "Downtown Durham",
      "center": { "lat": 35.9956, "lng": -78.9018 },
      "radiusMeters": 1600,
      "approvedActiveMin": 15,
      "inReviewMin": 25
    }
  ],
  "categoryQuotas": [
    { "category": "food_hall", "approvedActiveMin": 4, "inReviewMin": 8 },
    { "category": "indoor_market", "approvedActiveMin": 4, "inReviewMin": 8 },
    { "category": "mall_concourse", "approvedActiveMin": 4, "inReviewMin": 8 },
    { "category": "public_lobby", "approvedActiveMin": 8, "inReviewMin": 16 },
    { "category": "museum_gallery_common_area", "approvedActiveMin": 6, "inReviewMin": 12 },
    { "category": "hotel_lobby_common_area", "approvedActiveMin": 8, "inReviewMin": 16 },
    { "category": "coworking_public_area", "approvedActiveMin": 4, "inReviewMin": 8 },
    { "category": "large_retail_customer_area", "approvedActiveMin": 12, "inReviewMin": 24 }
  ],
  "sourceBucketQuotas": [
    { "sourceBucket": "official_venue_site", "minShare": 0.45 },
    { "sourceBucket": "official_tourism_or_chamber", "minShare": 0.2 },
    { "sourceBucket": "maps_or_directory", "maxShare": 0.25 },
    { "sourceBucket": "news_or_blog_context", "maxShare": 0.1 }
  ],
  "blockedPatterns": [
    "outdoor-primary",
    "staff-only",
    "private facility",
    "camera hostile",
    "campus-wide without zone-specific indoor target"
  ]
}
```

## City Customization Rules

Every city profile should be generated from city-specific evidence, not copied blindly.

Inputs:

- city Deep Research playbook
- city activation payload
- current `cityLaunchProspects`
- current `cityLaunchCandidateSignals`
- rejected candidate ledger
- local geography and neighborhood anchors
- official tourism/chamber/site directories
- venue categories that actually exist in that city

Examples:

- Durham should overweight food halls, hotel/public lobbies, galleries, visitor centers, university-adjacent public spaces, and downtown/RTP tiles.
- Austin should overweight retail centers, hotel/public lobbies, convention/pre-function areas, coworking/public tech spaces, and neighborhood commercial corridors.
- Sacramento should overweight public markets, civic/visitor centers, hotel/common areas, convention spaces, and mixed commercial corridors.
- Chicago should use tighter neighborhood tiling because the city is too large for a single generic center/radius.

## Database Additions

### `cityLaunchCoveragePolicies`

One document per city.

Fields:

- `city`
- `citySlug`
- `version`
- `inventoryTargets`
- `geographicTiles`
- `categoryQuotas`
- `sourceBucketQuotas`
- `blockedPatterns`
- `createdAtIso`
- `updatedAtIso`
- `ownerAgent`

### `cityLaunchCoverageRuns`

One document per expansion run.

Fields:

- `id`
- `city`
- `citySlug`
- `status`: `planned | running | completed | blocked | failed`
- `trigger`: `scheduled | manual | low_inventory | post_capture_replenishment`
- `coverageBefore`
- `coverageAfter`
- `gapCells`
- `queryPlan`
- `seededCandidateIds`
- `promotedProspectIds`
- `keptInReviewCandidateIds`
- `rejectedCandidateIds`
- `dedupedCandidateIds`
- `createdAtIso`
- `completedAtIso`
- `failureReason`

### `cityLaunchCoverageCells`

Optional projection collection for dashboards and scorecards.

Document ID:

`{citySlug}:{tileId}:{category}`

Fields:

- `city`
- `citySlug`
- `tileId`
- `category`
- `approvedActiveCount`
- `inReviewCount`
- `rejectedCount`
- `inactiveCount`
- `researchedBacklogCount`
- `approvedActiveMin`
- `inReviewMin`
- `lastExpandedAtIso`
- `nextExpansionPriority`

## Existing Collections Reused

### `cityLaunchCandidateSignals`

Still the intake ledger for newly found candidates.

The existing dedupe contract should stay:

- preferred dedupe key: `citySlug + providerPlaceId`
- fallback dedupe key: `citySlug + name + rounded lat/lng`
- repeated sightings increment `seenCount`
- status remains one of `queued | in_review | promoted | rejected`

Add optional fields:

- `coverageRunId`
- `coverageTileId`
- `coverageCategory`
- `sourceBucket`
- `sourceQuality`
- `discoveryQuery`
- `duplicateOfCandidateId`
- `excludedByCoveragePolicyReason`

### `cityLaunchProspects`

Still the app-facing approved target ledger after review promotion.

Add optional fields:

- `coverageRunId`
- `coverageTileId`
- `coverageCategory`
- `claimState`: `available | claimed | captured | exhausted | paused`
- `lastShownAtIso`
- `lastClaimedAtIso`
- `lastCapturedAtIso`

### `cityLaunchNotifications`

Used only after new approved active targets are promoted.

No notifications for review-only inventory.

## APIs

### Admin: coverage summary

`GET /api/admin/growth/city-launch/coverage?city=Durham%2C%20NC`

Returns:

- city policy
- current counts by status
- counts by category
- counts by tile
- quota gaps
- last run
- recommended next action

### Admin: plan expansion run

`POST /api/admin/growth/city-launch/coverage/plan`

Body:

```json
{
  "city": "Durham, NC",
  "dryRun": true,
  "maxQueries": 20,
  "maxCandidates": 40
}
```

Returns:

- gap cells
- query plan
- expected candidate categories
- duplicate-risk warnings

### Admin: execute expansion run

`POST /api/admin/growth/city-launch/coverage/run`

Body:

```json
{
  "city": "Durham, NC",
  "apply": true,
  "maxCandidates": 40
}
```

Behavior:

- creates `cityLaunchCoverageRuns`
- executes query plan
- seeds `cityLaunchCandidateSignals`
- auto-runs review for newly written candidate IDs
- returns seeded/promoted/in-review/rejected/deduped counts

### Creator app: unchanged target feed

`GET /api/creator/city-launch/targets`

This should continue exposing only approved active prospects.

## Scripts

### `scripts/city-launch/plan-coverage-expansion.ts`

Dry-run only by default.

Responsibilities:

- read policy
- read Firestore state
- compute gaps
- build query plan
- print expected expansion cells

Example:

```bash
npm exec -- tsx scripts/city-launch/plan-coverage-expansion.ts --city "Durham, NC"
```

### `scripts/city-launch/run-coverage-expansion.ts`

Apply requires explicit flag.

Responsibilities:

- run the planned query batches
- write `cityLaunchCoverageRuns`
- save intermediate evidence
- seed candidate signals
- run deterministic review
- print proof summary

Example:

```bash
npm exec -- tsx scripts/city-launch/run-coverage-expansion.ts --city "Durham, NC" --apply --max-candidates 40
```

### `scripts/city-launch/audit-coverage-inventory.ts`

Read-only.

Responsibilities:

- summarize current city inventory
- compare against policy
- flag duplicate clusters
- flag exhausted categories/tiles

## Research Calls

Use governed Parallel Search MCP policy.

Allowed tools:

- `web-search`
- `web-fetch`

Use Deep Research only for initial city planning or a major policy refresh, not every expansion run.

Query generation should be cell-specific:

```text
site:official-domain-or-public-source "Durham" "food hall" "public seating" indoor
"Durham NC" "hotel lobby" "coffee bar" "public"
"Durham NC" "gallery" "open to the public" hours photography policy
"RTP" "public coworking" "Building 800" visitor hours
```

Every accepted candidate must store:

- source query
- source URL
- source evidence summary
- allowed capture zones
- avoid zones
- public-access posture
- indoor posture
- camera policy evidence when found

Every rejected candidate must store:

- place name or candidate ID
- source URL if available
- rejection reason
- category/tile where it was found

## Agent And Skill Ownership

### `capturer-growth-agent`

Owns:

- city coverage policy drafts
- category quota recommendations
- geographic tile recommendations
- sourcing query plans
- candidate artifact generation
- expansion run proof comment

Skills:

- `city-launch-operations`
- `capturer-growth-operations`
- `platform-doctrine`
- governed `web-search` / `web-fetch`

### `public-space-review-agent`

Owns:

- deterministic review of seeded candidates
- promote / keep-in-review / reject outcomes
- no-rights/no-payout/no-operator-approval language boundary
- notification path after promotion

### `analytics-agent`

Owns:

- coverage dashboard
- count-by-status/category/tile
- depletion rate
- time-to-replenish
- duplicate rate
- approved-to-captured conversion

### `field-ops-agent`

Owns:

- post-promotion execution state
- claimed/captured/exhausted feedback
- route/capture feasibility signals

### `rights-provenance-agent`

Owns:

- rights/privacy review after actual capture or when source evidence raises ambiguity
- not part of automatic promotion unless policy says human/right review is required

### `city-launch-agent`

Owns:

- making city activation depend on coverage state, not one-off sourcing artifacts
- deciding whether a city is under-covered, live, or replenishment-blocked

## Cadence

Baseline:

- coverage audit: daily during active launch
- expansion run: every 48-72 hours while approved active targets are below target
- public-space review: weekday morning plus event-triggered after seed apply
- full city policy refresh: weekly or after major city strategy change

Triggers:

- `approvedActiveCount < approvedActiveMin`
- `inReviewCount < inReviewMin`
- a category or tile falls below quota
- a batch of targets is marked captured/exhausted
- duplicate rate exceeds threshold
- rejection rate exceeds threshold

## Done Conditions

A coverage expansion run is complete only when it records:

- coverage before
- gap cells selected
- query plan
- candidates found
- candidate IDs seeded
- duplicate IDs skipped or merged
- review result
- promotion count
- in-review count
- rejection count
- coverage after
- exact blocker if targets were not found

## Metrics

Per city:

- approved active target count
- in-review candidate count
- researched backlog count
- rejected/excluded count
- approved active targets by category
- approved active targets by tile
- candidates per source bucket
- duplicate rate
- rejection rate
- promotion rate
- average age of approved targets
- targets claimed/captured/exhausted per week
- replenishment lag

## Policy Defaults

Initial recommended defaults for a newly active city:

- `approvedActiveMin`: 50
- `inReviewMin`: 100
- `researchedBacklogMin`: 250
- `maxNewCandidatesPerRun`: 40
- minimum categories per city: 6
- minimum geographic tiles per city: 4

Larger cities should scale up:

- mid-sized city: 50 approved / 100 in review / 250 backlog
- large city: 150 approved / 300 in review / 750 backlog
- major metro: 300 approved / 600 in review / 1500 backlog

These are coverage inventory targets, not promises that work is paid, claimed, or rights-cleared.

## First Implementation Slice

1. Add `cityLaunchCoveragePolicies` and `cityLaunchCoverageRuns` utility functions.
2. Add `audit-coverage-inventory.ts`.
3. Add Durham coverage policy JSON.
4. Add `plan-coverage-expansion.ts` with no external calls first.
5. Add query-plan generation from gaps.
6. Add `run-coverage-expansion.ts` behind `--apply`.
7. Pipe accepted candidates through existing `seed-public-review-candidates.ts` shape.
8. Reuse `reviewCityLaunchCandidateBatch()` for promotion and notifications.
9. Add admin coverage summary endpoint.
10. Add tests for quota gap calculation, dedupe preservation, and no notification for review-only candidates.

## Acceptance Criteria

- Re-running expansion does not create duplicate candidates for the same place.
- Rejected/stale locations suppress rediscovery unless the policy version changes or a manual override is recorded.
- A city can show whether it is under target by category and tile.
- Agents search under-covered cells instead of repeating obvious venues.
- Promotion remains deterministic and evidence-gated.
- Notifications only go to matching creators after promotion.
- The creator target feed remains approved-active only.
- Every run leaves proof-bearing Firestore and Paperclip state.
