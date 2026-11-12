---
name: Buyer Dossier Refresh
project: blueprint-webapp
assignee: buyer-solutions-agent
recurring: true
---

Maintain reusable buyer dossier pages for active exact-site buyer journeys.

Each run must:

- identify buyers whose context will matter across multiple runs
- update the relevant page in `knowledge/compiled/buyer-dossiers/` instead of creating duplicate dossier pages
- keep the compiled summary current and append dated signal updates when buyer context changes materially
- link to the canonical inbound request, Paperclip work item, and package/runtime truth rather than paraphrasing those systems as if the KB were authoritative
- attach the dossier page into startup context when it materially improves buyer or operator preparation
- create or update a Paperclip follow-up issue if the dossier is blocked on missing canonical evidence

Human-only boundaries:

- pricing, contracts, legal, rights/privacy, or commercialization decisions
- changing canonical source-of-truth systems
