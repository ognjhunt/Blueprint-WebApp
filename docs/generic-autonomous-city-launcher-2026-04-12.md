# Generic Autonomous City Launcher

Date: 2026-04-12

Status: Active architecture

## Goal

Accept a city and a bounded budget posture, then route the launch through the existing Blueprint org so the system can:

- prepare the city packet
- create the live Paperclip issue tree
- track sourcing, buyer research, first touches, and spend in canonical ledgers
- hold human gates on spend, rights, posture, and non-standard commercial terms
- prevent multi-city sprawl until one city is operationally proven

## Core Principle

The launcher is generic at the orchestration layer, not generic in the sense of pretending every city is equally proven.

The system may prepare any city.
The org should only widen once one city has actual proof.

## Inputs

- `city`
- `budgetTier`
  - `zero_budget`
  - `low_budget`
  - `funded`
- optional spend overrides within policy
- `founderApproved`

## Outputs

- canonical city launch system doc
- canonical execution issue bundle
- canonical activation payload
- canonical target ledger
- routed Paperclip root issue plus child task issues
- activation record in Firestore
- city launch ledgers:
  - prospects
  - buyer targets
  - touches
  - budget events
- research materialization audit artifact showing what deep-research records were written
- city scorecard with tracked outreach and spend metrics

## Human Gates

Remain human-gated:
- new city activation
- spend above the approved operator threshold
- posture-changing public claims
- rights/privacy exceptions that set precedent
- non-standard commercial commitments

Remain operator-owned:
- source policy inside guardrails
- invite/access-code issuance inside policy
- intake thresholds
- trust kit and first-capture thresholds
- standard quotes inside approved bands

Source-policy rule:
- private controlled interiors stay on operator introductions, buyer-linked requests, and curated professional supply
- public, non-controlled commercial locations such as groceries, retail stores, and similar walk-in sites may use bounded online/community sourcing, as long as the capture brief is public-area-only and preserves privacy, signage, and provenance rules
- for that public commercial lane, the sourcing plan should name where those everyday capturers already are online: local city/community groups, neighborhood forums, retail/shopping communities, creator communities, and lightweight campus or gig networks that do not imply private-interior access

## Expansion Guard

The launcher keeps a single-city-until-proven rule.

Widening should stay blocked until the active city has:
- at least one proof-ready listing or proof pack
- at least one hosted review started
- at least three approved capturers
- at least two onboarded capturers

## Canonical Code Paths

- `server/utils/cityLaunchExecutionHarness.ts`
- `server/utils/cityLaunchProfiles.ts`
- `server/utils/cityLaunchPolicy.ts`
- `server/utils/cityLaunchLedgers.ts`
- `server/utils/cityLaunchResearchParser.ts`
- `server/utils/cityLaunchDoctrine.ts`
- `server/utils/cityLaunchResearchMaterializer.ts`
- `server/utils/cityLaunchCaptureTargets.ts`
- `server/utils/cityLaunchScorecard.ts`
- `server/routes/admin-growth.ts`
- `server/routes/admin-leads.ts`

## Operating Rule

Use the generic launcher for all new city work.

Do not spin up one-off city packets or side ledgers outside this system unless the founder or CTO explicitly approves an exception.
