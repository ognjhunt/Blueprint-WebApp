# Heartbeat

## Triggered Runs (Primary)
- start from recent producer outputs, routine proof, and open Paperclip follow-up issues
- verify deterministic natural key first, placement second, metadata third, formatting last
- repair only what the evidence supports
- leave stale, ambiguous, or unsafe pages explicitly visible through Paperclip and manager-visible Slack

## Scheduled Runs
- only resume this as a standing routine after the Notion hygiene contract says broad sweeps are safe again
- inspect newly created or recently changed Work Queue, Knowledge, and Skills pages
- dedupe safe duplicates using stable natural keys
- repair owner, related-work, related-doc, related-skill, execution-surface, output-location, canonical-source, freshness, and founder-visibility fields
- confirm producer artifacts land in the correct Hub surface
- keep `Founder OS` views readable and aligned with the latest founder-facing artifacts
- search for overdue knowledge pages based on review cadence and last-reviewed state
- surface missing owner or missing related-work metadata on active pages
- escalate pages that look stale but cannot be refreshed safely from the available evidence
- inspect Blueprint Hub structure for orphaned pages, broken relations, or pages living in the wrong database
- verify that Skills metadata still points at the right repo skill files and related docs
- look for recurring workspace drift that should become a plugin or policy fix instead of repeated cleanup

## Stage Model
1. **Identify** — find the affected page, database, natural key, producer issue, or repo artifact.
2. **Verify** — confirm identity, placement, ownership, relations, freshness, and canonical source before mutating.
3. **Repair** — apply only the metadata, relation, move, archive, or comment change that evidence supports.
4. **Escalate** — leave ambiguous, unsafe, or unavailable-tool cases blocked with a Paperclip issue and manager-visible note.
5. **Close** — verify the Notion mutation, attach proof to the issue, and name any write-path follow-up needed.

## Block Conditions
- page identity, ownership, natural key, parent database, or move/archive intent is ambiguous
- Blueprint Notion tools are unavailable, denied, or cannot verify the target state
- the page sits outside known Blueprint-managed Hub surfaces
- the fix would alter rights, privacy, legal, commercialization, founder approval, or execution ownership truth
- repo KB and Notion Knowledge disagree and no canonical source can be established

## Escalation Conditions
- recurring drift comes from the producing write path or plugin instead of one page
- founder-facing views show stale or incorrect decision state that cannot be auto-repaired safely
- duplicate pages have conflicting owner, related-work, or source trails
- broad sweep resumption is requested before the hygiene contract says it is safe

## Signals That Should Change Your Posture
- producer agents keep creating new pages for what should be one evolving artifact
- Work Queue ownership disagrees with Paperclip issue ownership
- Knowledge pages have review cadence but no trustworthy freshness trail
- a page appears outside known Blueprint-managed Hub surfaces
- duplicate titles exist but the related work, owner, or source trail conflicts
- recurring drift is coming from the write path itself rather than from one bad page
