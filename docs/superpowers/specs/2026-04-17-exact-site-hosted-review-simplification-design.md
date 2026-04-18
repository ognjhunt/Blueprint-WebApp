# Exact Site Hosted Review Simplification Design

Date: 2026-04-17

Owner: `webapp-codex`

Status: Approved for implementation by user-directed autonomy

## Goal

Simplify `/exact-site-hosted-review` into a premium, image-led product page that explains the hosted path for one exact site in seconds instead of reading like an internal workflow memo.

The page should carry forward the taste established on Home and `/world-models`:

- fewer sections
- shorter copy
- stronger visual hierarchy
- clearer CTAs
- less card-grid repetition
- exact-site and provenance-safe truth preserved

## Product Constraints

This page must remain aligned with repo doctrine:

- Blueprint is capture-first and world-model-product-first.
- Hosted evaluation is a managed path around one exact site, not a generic benchmark service.
- The page must not imply deployment guarantees, broad public readiness, or fake customer proof.
- The distinction between public proof, illustrative preview, hosted path, and package path must stay explicit.
- Rights, privacy, provenance, and human-gated commitments must remain visible without taking over the page.

## Problem Summary

The current page has truthful content, but it is too fragmented and too dense for a public product surface:

- many stacked explanatory sections
- multiple repeated CTA blocks
- separate blocks for cadence, support posture, buyer inputs, Blueprint outputs, hosted loop, trust boundary, integration contract, after-inquiry flow, and closing actions
- too many cards explaining the same hosted concept from different angles

The result is a page that behaves more like a hosted-evaluation handbook than a buyer-facing front door.

## Recommended Direction

Adopt a proof-first editorial layout with five main sections:

1. Hero
2. Visual hosted preview
3. Compact commercial split
4. Trust and fit
5. Closing CTA

This keeps the hosted path legible while preserving the truths that matter.

## Alternative Approaches Considered

### Approach A: Minimal product brief

Structure:
- short hero
- one proof panel
- one combined FAQ-style explainer
- closing CTA

Pros:
- fastest scan
- fewest sections

Cons:
- risks collapsing too much commercial nuance
- makes the page feel interchangeable with a generic landing page

### Approach B: Proof-first editorial page

Structure:
- short hero with stronger CTA hierarchy
- large illustrative preview panel
- concise split for buyer input, Blueprint output, and hosted flow
- compact trust and fit section
- tight closing CTA

Pros:
- closest match to the new Home and `/world-models` taste
- preserves truth without repeating every internal concept
- strong visual center of gravity

Cons:
- requires more careful copy compression to avoid removing necessary trust signals

### Approach C: Comparison-led commercial page

Structure:
- hero
- package vs hosted comparison
- hosted loop
- trust block
- CTA

Pros:
- useful for buyers who are already comparing paths

Cons:
- pulls the page toward pricing/offer comparison instead of hosted-review understanding
- duplicates work better handled on Pricing and listing detail pages

## Selected Approach

Approach B is the best fit.

The page should feel like a confident explanation of one commercial path:

- what hosted review is
- what the buyer sees
- what they need to bring
- what stays explicit
- what to do next

It should not attempt to restate the full package, trust, support, and post-inquiry system.

## New Information Architecture

### 1. Hero

Purpose:
- tell the buyer exactly what this page is
- establish that the hosted path is tied to one exact site
- give a clear primary CTA and two secondary paths

Headline:
- `Run one exact site before your team travels.`

Support line:
- `Blueprint hosts the review, keeps it tied to the same capture-backed package, and returns the run evidence your team needs to decide the next move.`

Hero support strip:
- `One exact site`
- `Capture-backed hosted path`
- `Package or hosted next step`

CTA hierarchy:
- primary: `Scope hosted review`
- secondary: `See sample deliverables`
- tertiary: `Inspect sample listing`

The hero should not carry four parallel CTA styles or an extended “what this is” paragraph block.

### 2. Visual Hosted Preview

Purpose:
- give the page an image-led center
- show the hosted path in a way that feels concrete
- keep illustrative surfaces labeled honestly

This section should keep the strongest existing element: the hosted workspace preview.

Adjustments:
- improve surrounding layout so the preview feels like the page’s anchor, not a mid-page insert
- reduce the amount of surrounding explanatory chrome
- pair the preview with one short statement about what the buyer is looking at

Required explicit label:
- `Illustrative product preview`

Required truth:
- this preview shows representative setup, run review, and export framing
- it does not imply every shown panel is already public product UI or customer proof

### 3. Compact Commercial Split

Purpose:
- replace several separate process sections with one fast, scannable block

This section should combine:
- what your team brings
- what Blueprint returns
- how the hosted path moves

Recommended shape:
- two concise columns for inputs and outputs
- one compact three-step or four-step hosted flow row beneath

Copy rule:
- no long list items
- each bullet or tile should be one sentence or short phrase

### 4. Trust And Fit

Purpose:
- preserve the non-negotiable truth without burying the user in policy prose

This section should merge today’s:
- trust boundary
- commercial cadence
- support posture
- after-inquiry setup language

Recommended content buckets:
- `What stays explicit`
- `When this is a fit`
- `Typical first reply`

This section should clearly say:
- hosted review is not a deployment guarantee
- rights, privacy, export boundaries, and irreversible commitments remain explicit and human-gated
- unusual robot-fit, private-site work, or custom exports are scoped separately

### 5. Closing CTA

Purpose:
- end the page with one strong decision surface instead of another menu of repeated cards

Headline:
- `Choose the next step for this site.`

Actions:
- `Scope hosted review`
- `Book scoping call`

Optional support link:
- `Inspect sample listing`

The closing section should be shorter and more visually decisive than the current final two-column CTA area.

## Content Rules

The page should follow these rules:

- one idea per section
- one support paragraph per section when possible
- fewer internal nouns per block
- no repeated explanation of the same hosted path
- no generic “platform” or “evaluation stack” language
- use plain, commercial, exact-site wording

## What Must Remain Visible

Simplification must preserve:

- exact-site framing
- capture-backed package linkage
- illustrative-preview labeling
- distinction between hosted review and package access
- honest non-guarantee language
- rights, privacy, provenance, and export-boundary visibility

## Visual Rules

- Keep the warm off-white editorial palette introduced on Home and `/world-models`.
- Reuse the existing hosted preview rather than inventing new fake imagery.
- Prefer large surfaces over repeated small cards.
- Keep mobile reading order fast and linear.
- Maintain premium typography and spacing rhythm without making the page feel sparse.

## Implementation Shape

Scope for this pass:

- simplify `client/src/pages/ExactSiteHostedReview.tsx`
- update `client/tests/pages/ExactSiteHostedReview.test.tsx`

Out of scope for this pass:

- changing navigation labels
- redesigning pricing or sample deliverables
- altering hosted-session setup flows
- changing commercial routing or booking links

## Acceptance Criteria

The design is successful when all are true:

- the page reads clearly in one short scroll
- the hosted path is understandable within seconds
- the page has five main sections or fewer
- the illustrative preview becomes the page’s visual center
- copy is materially shorter than the current version
- the page remains exact-site, capture-backed, and truth-safe
- the CTA hierarchy is clearer than the current repeated-action layout

## File Impact

- Modify: `client/src/pages/ExactSiteHostedReview.tsx`
- Modify: `client/tests/pages/ExactSiteHostedReview.test.tsx`

## Risks

### Risk 1: Oversimplification removes critical trust language

Mitigation:
- keep one compact trust-and-fit section with explicit non-guarantee and human-gate language

### Risk 2: The illustrative preview dominates without enough context

Mitigation:
- pair it with one concise framing paragraph and keep the label explicit

### Risk 3: The page still feels repetitive after simplification

Mitigation:
- merge process, cadence, support, and inquiry sections rather than merely shortening each one
