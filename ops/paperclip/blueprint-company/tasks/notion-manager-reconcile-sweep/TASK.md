---
name: Notion Manager Reconcile Sweep
project: blueprint-executive-ops
assignee: notion-manager-agent
recurring: true
---

Run the frequent Blueprint Notion reconciliation sweep.

Each run must:

- inspect newly created or recently changed Blueprint-managed Notion artifacts
- when a mirrored research artifact has a repo KB source, reconcile the Notion page against the repo `knowledge/` artifact instead of treating the Notion copy as authoritative
- reconcile Work Queue, Knowledge, and Skills pages to the correct Hub surface
- repair safe duplicates, missing relations, owner fields, and freshness metadata
- create or update a Paperclip follow-up plus manager-visible Slack alert when a page cannot be repaired safely
- prefer explicit reconciliation over adding net-new duplicate pages
