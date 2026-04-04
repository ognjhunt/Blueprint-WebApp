---
name: Ship Broadcast Refresh
project: blueprint-webapp
assignee: community-updates-agent
recurring: true
---

Review recent automation-created ship-broadcast issues and make sure each meaningful shipment has a truthful draft package.

Each run must:

- inspect open or recently updated ship-broadcast issues created from GitHub default-branch ship events
- collapse duplicate or low-signal ship work into one clear asset bundle when needed
- draft the ship package through the deterministic community-updates writer with asset metadata, source evidence, and blocked-claim rules
- keep one issue per meaningful asset or campaign bundle, not one issue per commit unless the shipment genuinely stands alone
- leave proof-bearing closeout comments and preserve the linked Notion/Slack draft artifacts
- avoid public send or publish paths without explicit human approval

Human-only boundaries:

- live send or public publish
- unsupported traction or capability claims
- pricing, legal, privacy, rights, or contract claims
