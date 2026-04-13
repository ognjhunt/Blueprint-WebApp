# City Launch Research To Capture Chain

Date: 2026-04-12

Owner: `webapp-codex`

## What Is Now Automatic

- `npm run city-launch:plan -- --city "City, ST"` now produces a deep-research playbook that is expected to end with a structured `city-launch-records` JSON appendix.
- `runCityLaunchExecutionHarness(...)` now calls the city-launch research materializer automatically after activation artifacts and the activation ledger are written.
- The materializer:
  - reads the canonical deep-research playbook when present, or the latest `99-final-playbook.md` run artifact as fallback
  - parses structured capture-location candidates, buyer targets, first-touch candidates, and budget recommendations
  - upserts those into Firestore ledgers with stable ids and research provenance
  - writes a per-run materialization audit artifact into the city-launch execution run directory
- Admin/ops can inspect the detailed ledger records through `GET /api/admin/growth/city-launch/records?city=...`.
- Capture clients can read launch-priority targets from `GET /v1/creator/city-launch/targets?lat=...&lng=...&radius_m=...&limit=...`.

## What Is Still Manual

- Deep research remains advisory by default. The parser/materializer does not auto-promote speculative research into approved field work unless the structured artifact explicitly carries a stronger status and the ledger merge rules allow it.
- Capture-app exposure remains intentionally narrow:
  - only prospects in active/founder-approved city launches
  - only `approved`, `onboarded`, or `capturing` prospect statuses
  - only records with coordinates
- Buyer targets, first-touch details, and budget recommendations are not shown in the capture app.
- Research records without coordinates remain visible to ops/admin lanes only until an operator or later research pass provides mappable location data.

## Safe Capture-App Statuses

- Safe to display as launch-priority capture targets:
  - `approved`
  - `onboarded`
  - `capturing`
- Not safe to display as actionable capture targets:
  - `identified`
  - `contacted`
  - `responded`
  - `qualified`
  - `inactive`

Those statuses stay available to admin/ops lanes, but they do not surface in the capture client as if they are approved work.

## Provenance And Corrections

- Each materialized research-backed record now carries research provenance:
  - source artifact path
  - structured source key
  - source URLs
  - parse timestamp
  - explicit vs inferred field lists
- Stable dedupe keys are derived from city slug plus normalized record identity:
  - prospects: source bucket + site/company name + address/location summary
  - buyer targets: company name + workflow fit
  - touches: reference type + reference name + channel + touch type
  - budget recommendations: category + amount + note
- Ledger upserts preserve more advanced human-updated statuses and retain existing notes/contact metadata instead of blindly downgrading records on reruns.
- Correction ownership:
  - parser bugs or schema drift: implementation lane
  - factual research corrections or stale records: growth/ops lanes updating the canonical playbook or the ledger record
  - capture-surface promotion/demotion: ops/growth ownership through ledger status, not the mobile client

## Remaining Blockers

- Existing deep-research playbooks created before the structured appendix prompt change will not materialize until they are refreshed or manually edited to include the new `city-launch-records` block.
- Capture-app launch targets depend on coordinate-bearing records; non-mappable research cannot yet appear in the field client.
- The broader production inbound smoke blocker remains separate and unchanged by this work.
