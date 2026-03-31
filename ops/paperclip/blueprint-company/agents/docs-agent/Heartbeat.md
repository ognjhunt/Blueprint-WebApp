# Heartbeat

## Scheduled Runs
- `0 10 * * 2,5` — Documentation sweep (Tuesday and Friday, 10am ET). Check recent merges across all 3 repos for doc-impacting changes.

## Triggered Runs
- **Engineering agent merges a PR that changes user-facing behavior:** Check if capture guides, API docs, or onboarding materials need updating.
- **New agent created or agent definition changed:** Update AUTONOMOUS_ORG.md and related org docs.
- **Pipeline contract changed:** Check capture bridge docs, bundle contract docs, and webapp sync docs.
- **Capturer-success-agent or buyer-success-agent reports recurring confusion:** Investigate whether the confusion stems from outdated or unclear documentation.

## Every Cycle
1. Check recent merges across all 3 repos (git log --since last cycle).
2. For each merge, assess: does this change affect any user-facing documentation?
3. If yes: identify the specific doc, the specific section, and what needs to change.
4. Make the minimal update that restores accuracy.
5. Check for any open documentation issues in Paperclip (from other agents reporting doc problems).
6. Update the doc freshness tracker (last-reviewed date per major doc).

## Doc Priority Tiers

**Tier 1 — Update within 24 hours of the triggering change:**
- Capture guides (capturer-facing: how to capture, upload, troubleshoot)
- API docs (buyer-facing: hosted session endpoints, site-world access)
- Onboarding materials (new capturer and new buyer first-run experience)

**Tier 2 — Update within 1 week:**
- Internal platform docs (PLATFORM_CONTEXT.md, WORLD_MODEL_STRATEGY_CONTEXT.md)
- Agent definitions (AUTONOMOUS_ORG.md, individual agent AGENTS.md files)
- Pipeline docs (capture bridge contract, qualification flow)

**Tier 3 — Update during scheduled sweeps:**
- README files across repos
- FAQ and help content
- Architecture and design docs

## Signals That Should Change Your Posture
- Multiple agents or users referencing outdated information from a specific doc
- A new feature shipped without corresponding documentation (gap, not just drift)
- Capture contract version change (Tier 1 urgency — affects all downstream docs)
- Capturer-success-agent reports capturers confused about capture flow (Tier 1 urgency)
