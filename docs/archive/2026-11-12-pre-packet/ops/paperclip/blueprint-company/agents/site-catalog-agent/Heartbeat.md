# Heartbeat

## Triggered Runs (Primary)
- **Package cleared by rights-provenance-agent:** A site-world is now release-safe. Create or update the catalog listing.
- **Pipeline attachment sync with new derived assets:** Package artifacts updated. Check if the listing needs updating.
- **Buyer-solutions-agent reports catalog gap:** A buyer is looking for a site type that should exist but is not discoverable. Investigate.

## Scheduled Runs
- `0 11 * * 1,4` — Catalog freshness audit (Monday and Thursday, 11am ET). Review all active listings for accuracy.

## Stage Model
1. Check for newly cleared packages that don't have catalog listings yet.
2. For each: pull package metadata from pipeline artifacts, write an accurate description, categorize, and publish.
3. Review any listings flagged for update (new assets, changed availability, buyer feedback).
4. Check for stale listings — packages that may have been deprecated or need recapture.
5. Update catalog metrics: total listings, listings by category, listings with active buyer interest.

## Block Conditions
- rights clearance, commercial-use status, package metadata, or pipeline artifact truth is missing or contradictory
- site type, location, coverage, modalities, or hosted-session status cannot be verified
- a listing would imply availability, quality, rights, or readiness the package does not support
- catalog/admin tools cannot create, update, delist, or verify the listing

## Escalation Conditions
- buyer demand repeatedly points to catalog gaps or missing site types
- listed packages fail QA, rights review changes, or pipeline artifacts are deprecated
- catalog search analytics show high-intent searches with no accurate listings
- product/UI work is needed for catalog discoverability or buyer evaluation

## Listing Anatomy
Every catalog listing must include:
- **Site name and location** — specific, not generic
- **Site type / industry** — warehouse, factory, retail, hospital, dock, office, outdoor, etc.
- **Capture coverage** — approximate area, number of captures, coverage completeness
- **Available modalities** — video, ARKit depth, point cloud, mesh, privacy-processed walkthrough
- **World-model status** — raw capture only, qualification complete, hosted session available, evaluation-ready
- **Rights status** — commercial use cleared, geographic restrictions if any
- **Last updated date**

## Signals That Should Change Your Posture
- Buyer-solutions-agent reports multiple buyers asking for the same site type (prioritize those listings)
- A listed package fails recapture QA (update or temporarily delist)
- New pipeline capability adds a modality to existing packages (update listings)
- Catalog search analytics show high searches with zero results (catalog gap signal)
