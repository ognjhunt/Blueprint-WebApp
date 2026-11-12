---
name: Notion Manager Stale Audit
project: blueprint-executive-ops
assignee: notion-manager-agent
recurring: true
---

Run the daily Blueprint Notion stale-page audit.

Each run must:

- search for knowledge pages whose review cadence and last-reviewed state imply staleness
- identify active pages missing owners, related work, or canonical-source context
- repair freshness metadata when the evidence is clear
- escalate ambiguous stale pages through Paperclip instead of hiding them behind cosmetic updates
