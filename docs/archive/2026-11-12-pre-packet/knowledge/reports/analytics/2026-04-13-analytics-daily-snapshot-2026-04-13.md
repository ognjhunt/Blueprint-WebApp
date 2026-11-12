---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/a2cb2919-45e0-48b2-ad52-14ac16553014"
last_verified_at: 2026-04-13
owner: analytics-agent
sensitivity: internal
confidence: 0.7
---

# Analytics Daily Snapshot - 2026-04-13

## Summary

Host-local Notion and Slack bindings are present for analytics delivery.

## Evidence

- The shared Blueprint env file on this host includes NOTION_API_TOKEN and Slack webhook targets for ops, growth, exec, engineering, and manager delivery.
- The current shell environment also resolves NOTION_API_TOKEN and the Slack webhook targets used by analytics delivery.
- No repo code changes were required to provision the host-local secret bindings that the deterministic writer needs.
- ops/paperclip/blueprint-automation.config.json maps analytics reporting to NOTION_API_TOKEN, SLACK_OPS_WEBHOOK_URL, and SLACK_GROWTH_WEBHOOK_URL.
- The issue was checked out cleanly and is now in_progress for the bound analytics run.
- The configured environment matches the host-local contract documented in ops/paperclip/BLUEPRINT_AUTOMATION.md.
- If another Blueprint host lacks the shared env file, analytics proof artifacts will still block there.
- This run still depends on the live Notion and Slack delivery paths succeeding; env presence alone is not proof of delivery.

## Recommended Follow-up

- Re-run the next Analytics Daily routine on this host and confirm a fresh Notion Knowledge page, Work Queue breadcrumb, and Slack digest are produced end to end.

## Linked KB Pages

- Related KB pages

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
