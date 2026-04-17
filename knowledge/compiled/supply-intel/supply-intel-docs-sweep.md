---
authority: derived
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
  - system: repo
    ref: "knowledge/reports/launch-research/2026-04-17-supply-intel-docs-sweep.md"
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

The strongest current pattern across marketplace supply playbooks is not broad awareness. It is a narrow, verified supply loop that combines city gating, referral mechanics, product-level quality filters, and a first-action threshold before rewards are paid or access expands.

Kled is the clearest 2026 example of that motion in a data marketplace. Taskrabbit, Uber, Lyft, and DoorDash show the same underlying structure in more traditional supply marketplaces: local eligibility, city-specific incentives, and trust controls that prevent the supply side from becoming a pure spam funnel.

## Evidence

- Kled says its opt-in human data network reached 200,000+ contributors in two weeks, with users earning up to $6,400 per month and 12,000+ structured datasets created.
- Kled V3 adds smarter task surfacing, automated quality enforcement, global payouts, partner-led labeling work, and hardware redemption through Kled Shop.
- Kled's upload handbook tells contributors to upload signal, not noise, and says AI and human review filters scan for quality, emotion, and clarity after upload.
- Kled says launch growth relied on no waitlist and a referral bonus for signing up friends, plus rapid international distribution.
- Uber says referral reward requirements and amounts vary by city, and its driver onboarding explicitly says vehicle requirements vary by region and city.
- Lyft says double-sided referral rewards vary by select cities and the referred driver must meet ride targets within the offer window.
- Taskrabbit requires referrers to be registered Taskers who have completed and invoiced at least one task, limits referrals to active areas, and verifies rewards before payment.
- Taskrabbit's communication flow is platform-gated: users cannot contact a Tasker before booking, which keeps pre-booking trust, selection, and accountability inside the product.
- Taskrabbit's Austin city ambassador program handpicks highly rated, experienced Taskers and uses them for events, social media, and client retention.
- Taskrabbit's Germany launch shows a deliberate city-to-region sequence: Berlin and the Rhine-Ruhr region first, then more regions later.
- DoorDash's Dasher Rewards program is published as a location-specific list, showing that incentives are not uniformly national and can be used to shape local supply behavior.

## Inference

- The first reliable supply cohort in a city is usually a small trusted set, not a raw signup pool.
- Referral loops work best after a contributor has already produced one verified unit of work, because that filters out fake or low-intent recruits.
- City expansion is safer when the company can name a local supply pocket, a local proof standard, and a local trust gate before broad promotion starts.
- High-intent channels are more likely to be partner-led, ambassador-led, or referral-led than generic top-of-funnel acquisition.
- Quality controls belong inside the contributor flow, not only in back-office review, if the marketplace wants durable supply density.

## Open Questions

- Which of Blueprint's current channels can reliably produce the first 25-100 high-signal capturers in a city?
- What is the smallest proof threshold that should unlock a referral reward or ambassador status for Blueprint?
- Which cities should stay in prep mode until there is a known local supply pocket, instead of being opened broadly?
- What product gate should prevent Blueprint from rewarding low-quality supply or fake activation?
- Which parts of Kled's motion are actually reusable for Blueprint, and which depend on data-marketplace-specific economics?

## Blueprint Implications

- Capturer growth should be seeded through trusted local or cohort-based loops, not generic awareness campaigns.
- Referral rewards should follow a verified first output, not just a sign-up.
- City launch should wait for a local supply pocket plus a trust path plus a quality gate.
- Growth reporting should track activated supply, not just registrations.

## Linked Artifacts

- [Supply Intel Docs Sweep research report](../../reports/launch-research/2026-04-17-supply-intel-docs-sweep.md)
- [Supply Intel raw source note](../../raw/web/2026-04-17/supply-intel-docs-sweep-sources.md)

## Authority Boundary

This page is a derived Hermes KB artifact. It does not replace Paperclip work state, approvals, rights/privacy review, compensation policy, legal classification, or launch decisions.
