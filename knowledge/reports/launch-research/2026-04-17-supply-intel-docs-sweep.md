---
authority: draft
source_system: web
source_urls:
  - "https://www.kled.ai/"
  - "https://www.kled.ai/blog/kled%E2%80%99s-opt-in-human-data-network-at-scale"
  - "https://www.kled.ai/blog/kled-v3-expands-rewards-and-contributor-tools"
  - "https://www.kled.ai/blog/kled-integrates-whop-for-payments"
  - "https://handbook.kled.ai/index.pdf"
  - "https://www.kled.ai/blog/kled-expands-special-tasks-with-2.2m-agreement"
  - "https://www.uber.com/us/en/drive/requirements/"
  - "https://help.uber.com/driving-and-delivering/article/%EC%B6%94%EC%B2%9C-%EC%BD%94%EB%93%9C%EB%A1%9C-%EA%B0%80%EC%9E%85%ED%95%98%EA%B8%B0?nodeId=a1dc4e69-ca50-46ce-ba0d-d133ee5c2578"
  - "https://www.uber.com/us/en/blog/earn-cash-between-rides-2/"
  - "https://help.lyft.com/hc/en-us/all/articles/115012927907"
  - "https://support.taskrabbit.com/hc/en-us/articles/360019289531-Tasker-Referral-Program-Terms-and-Conditions"
  - "https://support.taskrabbit.com/hc/en-ca/articles/204409650-Tasker-Referral-Programme"
  - "https://support.taskrabbit.com/hc/en-us/articles/46260520394651-What-s-Required-to-Become-a-Tasker"
  - "https://support.taskrabbit.com/hc/en-us/articles/360035010172-Can-I-Contact-a-Tasker-Before-Booking-a-Task"
  - "https://www.taskrabbit.com/blog/introducing-taskrabbits-city-ambassador-program-in-austin-tx/"
  - "https://www.taskrabbit.com/blog/wp-content/uploads/2019/11/Germany-Launch-Press-Release-Final-US-VERSION-1.pdf"
  - "https://kinsta.taskrabbit.com/blog/the-taskrabbit-summer-drop-2025"
  - "https://dasher.doordash.com/en-us/driving-opportunities"
  - "https://help.doordash.com/dashers/servlet/servlet.ImageServer?id=015Kd000004PmpA&oid=00D1a000000KEiH"
last_verified_at: 2026-04-17
owner: supply-intel-agent
sensitivity: internal
confidence: 0.83
subject_key: supply-intel-docs-sweep
review_status: draft
canonical_refs:
  - system: kb
    ref: "knowledge/compiled/supply-intel/supply-intel-docs-sweep.md"
  - system: repo
    ref: "knowledge/raw/web/2026-04-17/supply-intel-docs-sweep-sources.md"
entity_tags:
  - supply-intel
  - marketplace-supply
  - referral-loops
  - city-sequencing
  - trust-controls
---

# Supply Intel Docs Sweep

## Summary

This sweep found a consistent supply-side pattern across Kled, Taskrabbit, Uber, Lyft, and DoorDash: cities and contributors are gated through local eligibility, rewards are tied to a first verified action, and trust or quality controls are embedded directly into the product loop.

Kled is currently the most visible 2026 example of a data marketplace trying to combine opt-in contributor growth, automated quality enforcement, global payouts, and partner-led task distribution. The legacy marketplaces show the same structure in different forms, especially around local rewards and first-action verification.

## Evidence

- Kled says its opt-in network reached 200,000+ contributors in two weeks, with users earning up to $6,400 per month and 12,000+ structured datasets created.
- Kled V3 adds smarter task surfacing, automated quality enforcement, global payouts, partner-led labeling work, and hardware redemption.
- Kled's upload handbook says contributors should upload signal, not noise, and that AI and human review filters scan for quality, emotion, and clarity.
- Kled says launch growth used no waitlist and a referral bonus for signing up friends, plus rapid international spread.
- Uber says referral reward requirements and amounts vary by city, and local vehicle requirements vary by region and city.
- Lyft says referral rewards vary by select cities and the referred driver must hit ride targets.
- Taskrabbit requires referrers to have completed and invoiced at least one task, verifies rewards, and limits referrals to active areas.
- Taskrabbit prevents pre-booking contact with a Tasker, which keeps selection and accountability inside the platform.
- Taskrabbit's Austin ambassador program handpicks highly rated, experienced Taskers and uses them for events, social media, and client retention.
- Taskrabbit's Germany launch started in Berlin and the Rhine-Ruhr region before expanding later.
- DoorDash publishes a location-specific Dasher Rewards list, showing that incentives can be tuned to local market conditions.

## Inference

- The best early-supply loop is likely a small trusted cohort with a verified first action, not a broad signup funnel.
- City expansion should be staged after a local supply pocket, a trust gate, and a reward rule are all in place.
- Product-level quality control is a supply-side growth lever, not just an ops backstop.
- Referral and ambassador systems are strongest when they are attached to proof of quality rather than raw recruitment counts.

## What This Means For Blueprint

- Blueprint should look for local capturer pockets that can produce the first 25-100 high-signal contributors in a city.
- Blueprint should not treat signups as supply density unless the signup becomes a verified capture or task.
- Blueprint should gate referral rewards on a first acceptable output and a quality threshold.
- Blueprint should keep city launch in prep mode until the local supply path is concrete enough to support trust and retention.

## Open Questions For Downstream Work

- Which channel produces the highest-intent capturer supply for Blueprint in Austin and San Francisco?
- Which local partner, ambassador, or referral path can be turned into a repeatable city-seeding playbook?
- Which product guardrail should block low-quality or fake supply from being rewarded?
- Which city sequencing rule is durable enough to reuse across multiple metros?

## Follow-Up

- Handoff to `capturer-growth-agent`: turn the reusable referral and quality-gating patterns into a capture recruiting playbook.
- Handoff to `city-launch-agent`: convert the city-gating and sequencing pattern into metro launch rules for Austin and San Francisco.

## Linked Artifacts

- [Supply Intel compiled page](../../compiled/supply-intel/supply-intel-docs-sweep.md)
- [Supply Intel raw source note](../../raw/web/2026-04-17/supply-intel-docs-sweep-sources.md)

## Authority Boundary

This report is a support artifact. It does not replace Paperclip work state, approvals, rights/privacy review, compensation policy, legal classification, or launch decisions.
