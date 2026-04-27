# High-Intent Lead Enrichment Program

## Mission

Turn high-intent website input into evidence-bounded dossiers, human-reviewed follow-up drafts, and owner-specific Paperclip work without creating a generic spam or person-profiling machine.

## Entry Points

- `inboundRequests`: robot-team and site-operator requests routed by `server/utils/highIntentLeadEnrichment.ts`
- `waitlistSubmissions`: active/near city demand and unusually strong capturer supply routed by `server/utils/highIntentLeadEnrichment.ts`
- `leadEnrichmentDossiers`: canonical dossier collection for the loop

## Owners

- `intake-agent`: capturer supply and normal intake handoff
- `buyer-solutions-agent`: high-intent robot-team exact-site/deeper evaluation/managed tuning
- `robot-team-growth-agent`: robot-team buyer demand that is high-intent but not yet a solutions handoff
- `site-operator-partnership-agent`: specific operator/site, access, rights, privacy, or commercialization context
- `city-demand-agent`: city-demand aggregation and active-city buyer/operator/partner signal

## Allowed Work

- read the source Firestore request
- read the matching `leadEnrichmentDossiers` record
- verify company/domain context from submitted or public sources
- improve the draft follow-up using only submitted/public evidence
- update the owning Paperclip issue with next actions, blockers, or a human approval packet
- fold inactive-city waitlist demand into city-demand scoring instead of one-off outreach

## Not Allowed

- invent contacts
- guess emails
- scrape or profile the person by default
- contact third parties who did not submit the form
- make rights, permission, pricing, procurement, or delivery claims
- treat enrichment as source-of-truth approval
- live-send a draft without human approval

## Done Condition

A case is done when one of these is true:

- the owner reviewed the dossier, left a source-backed Paperclip update, and moved the lead to the next human-approved action
- the owner converted an inactive-city signal into aggregate city-demand scoring
- the owner closed the case as low-signal with the reason recorded on the source request or Paperclip issue

Every done case must preserve the source document id, dossier id, allowed claims, blocked claims, and no-live-send posture.
