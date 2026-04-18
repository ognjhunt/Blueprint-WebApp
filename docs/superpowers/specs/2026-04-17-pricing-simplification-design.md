# Pricing Simplification Design

Date: 2026-04-17

Owner: `webapp-codex`

Status: Approved for implementation by user-directed autonomy

## Goal

Simplify `/pricing` into a shorter, premium buying page that tells a robot team what the three commercial paths are, how to choose between them, what changes scope, and what to do next.

The page should match the new public-site standard:

- fewer sections
- shorter copy
- stronger comparison surfaces
- less repetition
- faster commercial comprehension
- exact-site and trust-safe language preserved

## Product Constraints

This page must remain aligned with repo doctrine:

- Blueprint is capture-first and world-model-product-first.
- Pricing must stay anchored to one real site and the two main product paths: site package and hosted evaluation.
- Public pricing must not imply blanket site approval, unrestricted export rights, or guaranteed deployment outcomes.
- Custom scope should remain a separate branch for private sites, unusual rights models, or managed support.
- Pricing should remain adjacent to proof, not replace proof.

## Problem Summary

The current page is truthful but repetitive:

- the comparison component already explains the three commercial paths
- later sections restate the same distinctions with different labels
- the page stacks “typical first purchase,” “what happens after inquiry,” buyer workflow, where to start, cadence, minimums, proof path, note cards, and custom scope

The result is more like a pricing handbook than a fast public buying page.

## Recommended Direction

Turn the page into a five-section commercial surface:

1. Hero
2. Offer comparison
3. How to choose
4. Scope and trust
5. Closing CTA

The comparison component should remain the dominant content block because it already contains the strongest factual pricing surface.

## Alternative Approaches Considered

### Approach A: Minimal rate card

Structure:
- short hero
- pricing cards only
- CTA

Pros:
- fastest scan

Cons:
- removes the buyer guidance needed to interpret package vs hosted vs custom
- increases the chance of pricing being read without trust context

### Approach B: Comparison-led pricing page

Structure:
- short hero
- existing comparison surface
- one compact “how to choose” section
- one compact “what changes scope” section
- short closing CTA

Pros:
- keeps the strongest commercial component
- removes repeated copy without losing clarity
- fits the new premium editorial direction

Cons:
- requires careful trimming so custom-scope nuance still remains visible

### Approach C: FAQ-style pricing explainer

Structure:
- hero
- question-and-answer sections
- CTA

Pros:
- easy to write

Cons:
- too text-heavy
- would regress toward the same handbook problem

## Selected Approach

Approach B is the best fit.

Pricing should feel like a confident buying page:

- inspect the three paths
- choose the one that matches the current question
- understand what changes scope
- take the next step

## New Information Architecture

### 1. Hero

Purpose:
- make the page legible in one glance
- state that pricing is public but still tied to the exact site question
- offer one primary and one secondary CTA

Headline:
- `Public pricing for the exact-site paths that matter first.`

Support line:
- `Most teams start with one of three moves: buy the site package, run the hosted path, or scope a custom program around one real facility.`

Hero signal strip:
- `Site package`
- `Hosted session-hour`
- `Custom scope only when needed`

CTA hierarchy:
- primary: `Inspect sample site`
- secondary: `Book scoping call`

### 2. Offer Comparison

Purpose:
- remain the main pricing surface
- preserve current price anchors and buyer-readable path comparison

Implementation direction:
- keep `OfferComparison`
- tighten its framing text if needed, but do not duplicate its logic elsewhere on the page

The page should let this section do most of the commercial work.

### 3. How To Choose

Purpose:
- replace several duplicated explanatory sections

Recommended content:
- `Package first`
- `Hosted first`
- `Custom first`

Each item should answer one question:
- when is this the right first move?

This should be a compact three-card section, not another process essay.

### 4. Scope And Trust

Purpose:
- merge the current cadence, minimums, proof-path, and inquiry sections into one smaller honest block

Recommended headings:
- `What changes scope`
- `Typical first reply`
- `What pricing does not claim`

Required truths:
- pricing is public, but rights/privacy/export terms may still be request-scoped
- private-site work, unusual trust review, and higher-touch support are quoted separately
- exact-site proof and adjacent-site proof must remain clearly distinguished
- no deployment guarantee is implied by price visibility

### 5. Closing CTA

Purpose:
- give the user one clean next step instead of another full section of notes

Headline:
- `Need a site that is not in the public catalog yet?`

Actions:
- `Book scoping call`
- `Request custom quote`
- optional lightweight path: `Email a short brief`

This section should be visually decisive and shorter than the current custom-scope block.

## Content Rules

- do not explain the same commercial path twice
- one sentence per support paragraph where possible
- keep package vs hosted vs custom language concrete
- avoid generic “sales process” copy
- keep proof, rights, and export boundaries visible without turning the page into policy text

## What Must Remain Visible

Simplification must preserve:

- public price anchors for site package and hosted session-hour
- package vs hosted vs custom distinctions
- public pricing with request-scoped trust review where relevant
- exact-site proof vs adjacent-site proof distinction
- the custom branch for private sites or managed support

## Visual Rules

- move the page toward the same warm editorial system used on Home and `/world-models`
- let the comparison surface be visually dominant
- avoid stacked white-card repetition after the comparison
- keep mobile order tight and linear

## Implementation Shape

Scope for this pass:

- simplify `client/src/pages/Pricing.tsx`
- update `client/tests/pages/Pricing.test.tsx`

Out of scope for this pass:

- changing price values in `OfferComparison`
- redesigning the comparison component internals unless required by the new page structure
- changing contact routing

## Acceptance Criteria

The design is successful when all are true:

- the page explains the three commercial paths within one short scroll
- the main flow has five sections or fewer
- copy is materially shorter than the current pricing page
- the comparison surface remains the dominant commercial element
- trust and scope caveats stay visible without taking over the page
- the page sounds like a premium buying surface, not a pricing FAQ dump

## File Impact

- Modify: `client/src/pages/Pricing.tsx`
- Modify: `client/tests/pages/Pricing.test.tsx`

## Risks

### Risk 1: Removing too much guidance makes the price table feel cold

Mitigation:
- keep one concise “how to choose” section immediately after the comparison

### Risk 2: Trust nuance gets lost

Mitigation:
- keep one compact scope-and-trust section with explicit non-guarantee and request-scoped terms

### Risk 3: The page still feels repetitive

Mitigation:
- let the comparison component own the core path explanation and delete downstream duplication
