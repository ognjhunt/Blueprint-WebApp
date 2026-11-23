# Production counts read for the audit

Taken on 2026-11-22 by the orchestrator only. The audit agents were barred from
the credential.

How: `fs_readonly.mjs` calls two read endpoints of Firestore and nothing else
(`documents:runAggregationQuery` for counts, `documents:runQuery` with a field
mask). It has no write call. Firestore refused a read-only token scope, so the
guarantee is the script, not the token.

What was read: document counts, state and status values, version strings,
booleans and timestamps. What was never selected: a site's name, address,
email, phone, job description or sentence, a company's name or contact, any
media or media link, any free text. A value distribution is printed only when
the field looks like an enumeration.

| File | What it holds | Script |
|---|---|---|
| `firestore-collection-counts.json` | document count per top-level collection | `fs_collection_counts.mjs` |
| `firestore-group-counts.json` | document count per subcollection, across all jobs | `fs_group_counts.mjs` |
| `firestore-funnel.json` | jobs, uploads, emails, companies and retired systems: counts by state, month and version | `fs_funnel.mjs` |
| `firestore-second-pass.json` | billable events, company views and answers, Terms acceptance, weekly job counts, preparation states | `fs_second_pass.mjs` |

Not answered here, because it would need a personal field: whether the one
approved company record is an outside company or Blueprint's own test account.
