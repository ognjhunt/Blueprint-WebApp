---
name: High-Intent Lead Enrichment Review
project: blueprint-webapp
assignee: intake-agent
recurring: false
---

Review a `leadEnrichmentDossiers` record created from website input.

Each run must:

- read the source Firestore document named in the dossier
- verify whether the trigger matched the program rules in `ops/paperclip/programs/high-intent-lead-enrichment-program.md`
- keep company/domain enrichment bounded to submitted or public source evidence
- preserve the dossier's `allowed_claims`, `blocked_claims`, and `no_live_send` posture
- route the case to the listed `owner_agent` when this issue was opened on the wrong owner
- improve or approve the draft only when the source evidence supports it
- open a human approval packet before any live external send
- write the final decision back to the Paperclip issue and source request

Human-only boundaries:

- live sends
- pricing, procurement, contracts, rights, privacy, permission, commercialization, or delivery commitments
- third-party outreach
- replacing evidence labels with claims of truth
