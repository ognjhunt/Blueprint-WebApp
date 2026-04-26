# Durham, NC Indoor Location Supply Report

- generated_at: 2026-04-25T23:20:00.000Z
- source_ledger: `ops/paperclip/playbooks/city-launch-durham-nc-indoor-location-supply.json`
- rejected_ledger: `ops/paperclip/playbooks/city-launch-durham-nc-indoor-location-supply-rejected.json`
- evidence_log: `ops/paperclip/playbooks/city-launch-durham-nc-indoor-location-supply-evidence-log.json`
- status: validated research artifact; not rights clearance, operator approval, payment approval, or capture provenance

## Deep Research Reuse

The Durham Deep Research playbook remains the first source map. It says Durham should stay capture-first and proof-led, with reversible research and supply work proceeding before live community or buyer replies. This indoor supply pass uses that posture but corrects the earlier shallow 8-item public-facing shortlist by broadening across indoor malls, food halls, indoor markets, public lobbies, visitor centers, galleries, museums, hotel lobby/common areas, convention concourses, public coworking, and large retail/cafe interiors.

## Sources Searched

Search/fetch followed `ops/paperclip/programs/parallel-search-mcp-policy.md` categories and stored the query log in the evidence artifact. Sources favored official venue pages, official tourism pages, venue visitor/floor-plan pages, and explicit policy pages where available.

Key source buckets:
- indoor malls and shopping concourses
- food halls and indoor public markets
- visitor centers and public lobbies
- hotel/public lobby and coffee/bar common areas
- museum/gallery/arts-center visitor areas
- convention/pre-function concourses
- public coworking floors
- retail cafe/customer interiors
- rejected mixed/outdoor familiar sites

## Counts

| Outcome | Count |
| --- | ---: |
| Accepted into indoor supply ledger | 16 |
| Verified and promotion-ready by deterministic evidence fields | 9 |
| Review-only / partially verified | 7 |
| Rejected familiar or unsafe candidates | 9 |

## Accepted Indoor-Suitable Candidates

Verified / promotion-ready after seed and public-space review:

| Candidate | Indoor posture | Why indoor-suitable |
| --- | --- | --- |
| Durham Food Hall - interior hall and public seating | indoor_only | Source-backed food hall with public common seating and vendor circulation. |
| The Streets at Southpoint - indoor mall concourse and food court | indoor_primary | Zone-scoped to the enclosed mall concourse/food court; outdoor lifestyle wing excluded. |
| Durham Green Flea Market - indoor vendor hall | mixed_indoor_outdoor | Mixed market retained only for source-backed indoor booth/vendor hall aisles. |
| Durham Visitor Info Center - interior visitor space | indoor_only | Official visitor center with public interior, displays, maps, and posted hours. |
| 21c Museum Hotel Durham - public museum galleries | indoor_only | Official museum galleries are free/open; guest-only hotel areas excluded. |
| The Durham Hotel - lobby Coffee Bar | indoor_only | Official coffee bar is served in an airy two-story lobby and functions as a public gathering area. |
| Frontier RTP Building 800 - free public coworking floor | indoor_primary | Official free public coworking floor in Building 800; tenant/private spaces excluded. |
| Durham Arts Council - public galleries | indoor_only | Official galleries are free/open to the public daily. |
| Foster's Market - indoor cafe and market | mixed_indoor_outdoor | Accepted only for indoor cafe/market customer areas; porch/lawn excluded. |

Review-only accepted supply:

| Candidate | Reason kept review-only |
| --- | --- |
| Nasher Museum of Art - Great Hall and public galleries | Public access is clear, but camera/artwork policy needs explicit review. |
| Museum of Life and Science - indoor exhibit zones | Indoor exhibit evidence is clear, but child/privacy/camera policy needs review. |
| Rubenstein Arts Center - public gallery and Ruby Lounge | Public building/gallery evidence is clear, but Duke venue camera policy needs review. |
| Durham Convention Center - pre-function hallway and lobby | Indoor concourse evidence is clear, but event-dependent access requires operator/event review. |
| Durham Marriott City Center - lobby and Starbucks area | Public-facing lobby evidence is clear, but hotel/operator review is needed. |
| Aloft Durham Downtown - Re:Mix/W XYZ lobby lounge | Public-facing lobby lounge evidence is clear, but hotel/operator review is needed. |
| JB Duke Hotel - Lobby Lounge | Public-facing lounge evidence is clear, but campus hotel/operator review is needed. |

## Rejections And Downgrades

| Candidate | Reason |
| --- | --- |
| Durham Farmers Market / Durham Central Park Pavilion | Outdoor/open-air market; no indoor zone. |
| Boxyard RTP | Outdoor-primary shipping-container/courtyard venue; tenant interiors would need separate zone-specific records. |
| American Tobacco Campus | Campus-wide mixed outdoor/office/restaurant district; no campus-wide indoor capture target. |
| Brightleaf Square | Insufficient source-backed indoor common-access zone. |
| Golden Belt Campus | Campus-wide mixed site; needs a specific gallery/tenant interior candidate. |
| CCB Plaza | Outdoor plaza. |
| Northgate Mall | Historic/stale mall evidence; current public indoor operation not verified. |
| DPAC lobby | Venue rules prohibit video/audio recording devices. |
| Durham County Main Library | Photography/filming policy requires permission and restricts capturing public/staff backgrounds. |

## Payout Estimate Method

The ledger uses a transparent, testable starter formula:

`base_show_up + estimated_minutes * 75 cents + complexity_component + large_area_component + optional weak_evidence_buffer`

Complexity component:
- simple: 500 cents
- standard: 1200 cents
- complex: 2500 cents
- high_complexity: 4500 cents

Large-area component:
- under 5,000 sqft: 0 cents
- 5,000+ sqft: 1,000 cents
- 15,000+ sqft: 2,500 cents
- 50,000+ sqft: 5,000 cents

Review-only candidates may include a weak-evidence buffer in the suggested range, but the ledger does not represent any review-only candidate as a payable job.

## Materialization Path

Dry-run validation:

```bash
npm exec -- tsx scripts/city-launch/seed-public-review-candidates.ts --input ops/paperclip/playbooks/city-launch-durham-nc-indoor-location-supply.json
```

Apply mode, when Firestore credentials are present, now auto-runs deterministic public-space review for the written candidate ids:

```bash
npm exec -- tsx scripts/city-launch/seed-public-review-candidates.ts --input ops/paperclip/playbooks/city-launch-durham-nc-indoor-location-supply.json --apply
```

Explicit promotion review rerun, for backlog recovery or operator audit:

```bash
npm exec -- tsx scripts/city-launch/review-public-candidates.ts --city "Durham, NC"
npm exec -- tsx scripts/city-launch/review-public-candidates.ts --city "Durham, NC" --apply
```

Only `verification_status=verified` candidates with indoor posture, allowed/avoid zones, source query log, source URLs, evidence summary, public-access posture, coordinates, and payout/time estimates can promote. Outdoor-primary and unknown-posture candidates cannot promote.

## Capturer Notification Path

Promoted Durham targets now trigger `city_launch_targets_promoted` records in `cityLaunchNotifications` for matching creator profiles when `notification_preferences.nearby_jobs !== false`. Push send is allowed only for profiles with a usable `notification_device.fcm_token` and authorization status, and only when the city-launch push env flag is configured; otherwise the system writes an in-app/ledger fallback record.

Dry-run audit:

```bash
npm exec -- tsx scripts/city-launch/notify-approved-targets.ts --city "Durham, NC" --dry-run
```

Apply mode is intentionally guarded:

```bash
npm exec -- tsx scripts/city-launch/notify-approved-targets.ts --city "Durham, NC" --apply --creator-id "<test-creator-id>"
```

Notification copy remains review/claiming language only. It does not say the locations are rights-cleared, operator-approved, capture-proven, payout-guaranteed, or approved paid jobs.
