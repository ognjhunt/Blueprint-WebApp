# Proof Motion Tags

This doc is the canonical repo vocabulary for buyer-target, proof-pack, and hosted-review motion.

It defines the names used by the city-launch scorecard, proof-path ledgers, and growth analytics. It does not claim live volume; it only standardizes the labels.

## Firestore Truth Sources

- `cityLaunchBuyerTargets`
  - canonical buyer-target record collection
  - buyer-target records use `status` values such as `researched`, `hosted_review`, and `commercial_handoff`
- `cityLaunchTouches`
  - canonical touch ledger
  - buyer-target-linked touches use `referenceType: buyer_target`
- `inboundRequests.ops.proof_path`
  - canonical proof-path milestone fields
  - `proof_pack_delivered_at`
  - `hosted_review_ready_at`
  - `hosted_review_started_at`
  - `hosted_review_follow_up_at`

## Canonical Analytics Events

- `robot_team_inbound_captured`
- `robot_team_fit_checked`
- `proof_path_assigned`
- `proof_pack_delivered`
- `hosted_review_ready`
- `hosted_review_started`
- `hosted_review_follow_up_sent`
- `human_commercial_handoff_started`

## Shared Tags

- `city`
- `city_slug`
- `source`
- `buyer_segment`
- `requested_lane`
- `proof_path_preference`
- `outcome`
- `review_path`
- `hosted_mode`

## San Diego Example

San Diego uses the same canonical tags as every other city.

- city label: `San Diego, CA`
- city slug: `san-diego-ca`
- proof-motion source paths: the Firestore ledgers above plus the analytics events above

The scorecard should treat buyer motion as blocked only when live evidence is missing, not because the tag vocabulary is ambiguous.
