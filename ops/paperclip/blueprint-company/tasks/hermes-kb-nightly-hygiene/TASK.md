---
name: Hermes KB Nightly Hygiene
project: blueprint-executive-ops
assignee: market-intel-agent
recurring: true
---

Run the nightly Hermes KB hygiene loop.

Each run must:

- review pages that crossed freshness thresholds or are listed in `knowledge/indexes/stale-pages.md`
- review unresolved contradictions in `knowledge/indexes/contradictions.md`
- promote reusable findings from recent reports into existing compiled pages when appropriate
- refresh backlinks and open questions for pages touched in the run
- avoid inventing canonical truth when the underlying authoritative system is missing or ambiguous
- create or update Paperclip follow-up issues when a page is blocked on real canonical evidence

Human-only boundaries:

- changing canonical source-of-truth systems
- approvals, rights, privacy, pricing, legal, commercialization, or package/runtime truth decisions
