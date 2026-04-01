# Heartbeat

## Every Run
- start from recent producer outputs, routine proof, and open Paperclip follow-up issues
- verify placement first, metadata second, formatting last
- repair only what the evidence supports
- leave stale, ambiguous, or unsafe pages explicitly visible through Paperclip and manager-visible Slack

## Frequent Reconcile Sweep
- inspect newly created or recently changed Work Queue, Knowledge, and Skills pages
- dedupe safe duplicates using stable natural keys
- repair owner, related-work, related-doc, related-skill, execution-surface, output-location, canonical-source, and freshness fields
- confirm producer artifacts land in the correct Hub surface

## Daily Stale Audit
- search for overdue knowledge pages based on review cadence and last-reviewed state
- surface missing owner or missing related-work metadata on active pages
- escalate pages that look stale but cannot be refreshed safely from the available evidence

## Weekly Structure Sweep
- inspect Blueprint Hub structure for orphaned pages, broken relations, or pages living in the wrong database
- verify that Skills metadata still points at the right repo skill files and related docs
- look for recurring workspace drift that should become a plugin or policy fix instead of repeated cleanup

## Signals That Should Change Your Posture
- producer agents keep creating new pages for what should be one evolving artifact
- Work Queue ownership disagrees with Paperclip issue ownership
- Knowledge pages have review cadence but no trustworthy freshness trail
- a page appears outside known Blueprint-managed Hub surfaces
- duplicate titles exist but the related work, owner, or source trail conflicts
