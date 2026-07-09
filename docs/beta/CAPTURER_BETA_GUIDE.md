# Capturer Beta Guide

**Welcome, and thank you for capturing for Blueprint.** You are one of ~100 external testers
helping us prove the capture → package loop on real sites. This guide is honest about what the
beta does today and what it does not.

Your captures are the product's foundation. Blueprint is **capture-first**: your raw walkthrough,
timestamps, poses, and provenance are treated as **authoritative truth**. Everything downstream
(site cards, evaluations, generated media) is derived from your capture and never rewrites it.

---

## What the beta is

- A scoped beta where Blueprint packages the sites you capture into buyer artifacts
  (Task Evaluation Runs and Post-Training Data Packages).
- **Industrial-first**, but not industrial-only — see supported location types below.
- Still being hardened. Expect rough edges, expect to be asked for a recapture sometimes, and
  expect to report bugs. That is what a beta is for.

**It is not:** a finished consumer app, a guaranteed-payout gig, or a promise that every capture
becomes a sale.

---

## Supported location types

Priority is **industrial** (this is where humanoids deploy first):

- Warehouses, fulfillment / distribution centers, cross-dock
- Factories / manufacturing / assembly plants, line-side and material-handling areas
- Cold storage and similar industrial environments

Also supported where capture is lawful and authorized:

- Grocery and retail sales floors (public aisles), mall common corridors
- Hotel and office lobbies, museums/venues, and similar public common areas

You may be working an **assigned/claimed site** (a specific buyer- or ops-directed target) or an
**open capture** (a site you propose). Both are welcome. Open captures are **review-required** by
default before they can be used.

> Note: today the capture app records a broad site-type label; declaring a precise site type
> (e.g. "distribution center" vs "cold storage") is an area we are still improving. Put the real
> site type and any specifics in your notes so review is accurate.

---

## Before you capture: authorization is required

You must have permission to record the site. Capture authorization is recorded in-app via the
**Venue Permission** flow (`BlueprintCapture/BlueprintCapture/VenuePermissionView.swift`), which
threads a signed authorization into the capture bundle's rights metadata (`rights_consent.json`)
so the pipeline's authorization gate is satisfied. Record:

- **Authorized by** — the site representative's name and title (e.g. *Plant Manager*, *Store Manager*)
- **Dates** — signed date and, if any, an expiry
- **Allowed areas** — e.g. Receiving dock, Pick module, Staging, Main aisle
- **Restrictions** — e.g. *PPE required*, *Escort required*, *LOTO zones off-limits*,
  *No production line access*, *No employee break areas*
- **Signed document** — attach the PDF/photo if you have one

For industrial sites, follow the plant-manager / EHS authorization, PPE/escort, and
restricted-zone rules in
[`docs/legal/INDUSTRIAL_CAPTURE_CONSENT_AND_AUTHORIZATION_2026-07-08.md`](../legal/INDUSTRIAL_CAPTURE_CONSENT_AND_AUTHORIZATION_2026-07-08.md).
No authorization on file = do not record. If staff or signage objects mid-capture, stop.

---

## What makes a good capture

- **Coverage** — walk the whole authorized route with overlap; scan corners, edges, and both
  sides of aisles. Don't trust a "100% coverage" number on a large site — the on-screen coverage
  meter is tuned for small rooms and can read "done" long before a warehouse actually is. Cover
  the route/checkpoints, not the percentage.
- **Lighting** — good, even light. Dim aisles, stockrooms, and night shifts produce weak footage;
  add light or slow down.
- **Scale & pacing** — move slowly and steadily, keep the phone upright, keep tall racking in
  frame. iPhone LiDAR depth is only reliable to roughly **~5 m**, so make slower, closer passes on
  high racking and long aisles.
- **Large sites** — a big warehouse may not fit in one walk or one battery/thermal budget. Break
  it into passes; if the device gets hot or storage runs low, finalize the current segment before
  it fails. Cross-visit stitching of very large sites is still maturing, so note when a site spans
  multiple visits.
- **Authorization** — a capture without recorded authorization cannot be used, no matter how good
  the footage is.
- **Truth** — capture the site as it really is. Do not stage, fake, or misrepresent a space.

---

## The flow

1. **Claim / assigned site** (or start an **open capture**). Assigned targets show an estimated
   payout range before you start.
2. **Authorization** — record or attach the Venue Permission (see above).
3. **Capture** — record the walkthrough per the guidance above.
4. **Upload** — the app uploads the bundle. Large uploads over flaky connections can be slow and
   may retry; keep the app open on Wi-Fi when you can.
5. **Submission & review** — a submission record is written and the capture enters review.

---

## What the submission states mean

| State | Meaning |
|---|---|
| **Uploading** | The bundle is transferring. Not finished until upload completes and a submission record is written. |
| **Under review / review required** | Received; Blueprint is checking coverage, lighting, privacy/redaction, rights, and whether the site is useful. This is the normal next step for open captures. |
| **Approved** | The capture passed review and can move downstream. |
| **Needs recapture / needs refresh** | Coverage or quality was insufficient, or the site changed. You'll be asked to re-capture specific parts. |
| **Permission required** | Authorization is missing or incomplete — record/attach the Venue Permission. |
| **Blocked** | A rights, privacy, or consent issue must be resolved before the capture can be used. |

Rights/privacy review is a **hard gate**: a capture with a non-cleared rights verdict stays in
review and cannot advance to buyer-facing use.

---

## Payout expectations (honest)

- Assigned/claimed targets show an **estimated payout range before you start**. It is an estimate,
  not a guarantee.
- Payout eligibility depends on the capture passing **review and approval** — a submitted or
  under-review capture is not yet a paid capture.
- **Live payout settlement and timing are still being finalized during the beta.** We will not
  promise you a specific payout date here, because we cannot yet honestly back one. When your
  capture is approved and settlement is live, you'll be notified; if anything about a payout looks
  wrong, contact support with your submission id.

---

## Get help / report an issue

**One channel:** email **hello@tryblueprint.io** or use the in-app **Support** page.

When reporting an issue, include:

- Your name / capturer id and organization
- The site name/address and submission or capture id
- What you expected vs what actually happened (the exact blocker)
- The screen/step it happened on, and a screenshot if possible
- Urgency (e.g. "authorization won't save and I'm on site now")

Access blockers and on-site problems are prioritized first.
