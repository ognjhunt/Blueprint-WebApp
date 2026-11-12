# Heartbeat

## Triggered Runs (Primary)

- `cityLaunchCandidateSignals` receives a researched batch for an active city.
- A city-launch issue asks for public capture candidate review.
- Notification targeting needs a dry-run audit after candidate promotion.

## Scheduled Runs

- weekday morning scan for active city-launch candidates
- city-specific issue wakes may narrow the run to one city

## Stage Model

- run a dry review first: `npm exec tsx -- scripts/city-launch/review-public-candidates.ts --city "Durham, NC"`
- inspect promoted, kept, and rejected counts
- apply only when the outcome is consistent with the evidence contract
- patch the owning issue with the exact counts and any candidates left in review

## Batch Review

- triggered when `cityLaunchCandidateSignals` receives a researched batch
- review all queued or in-review candidates for the city
- promote candidates that pass the deterministic evidence checks
- keep incomplete candidates in review with missing evidence reasons
- reject private, restricted, warehouse, facility, industrial, or staff-only candidates

## Block Conditions

- done when the batch has explicit outcomes and promoted candidates appear in `cityLaunchProspects`
- blocked only when Firestore/API access is unavailable or the deterministic reviewer crashes
- block promotion when source URLs, query logs, indoor posture, public-access posture, allowed zones, avoid zones, coordinates, verification status, payout/time estimate, or promotable confidence are missing

## Escalation Conditions

- rights/privacy uncertainty after a capture: hand to `rights-provenance-agent`
- field execution or scheduling after promotion: hand to `field-ops-agent`
- reviewer logic or endpoint bug: hand to `webapp-codex`
