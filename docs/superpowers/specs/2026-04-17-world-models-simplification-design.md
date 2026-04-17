# World Models Simplification Design

Date: 2026-04-17

Owner: `webapp-codex`

Status: Approved for planning

## Goal

Simplify `/world-models` into a proof-led catalog page that lets a buyer understand the page, see how Blueprint sells access, inspect featured sites, and browse the exact-site catalog with minimal reading.

The new page should feel like the catalog equivalent of the homepage simplification:

- fewer sections
- shorter sentences
- more visual hierarchy
- faster access to the actual listings
- no loss of Blueprint's exact-site, capture-first, provenance-safe positioning

## Product Constraints

This page must remain aligned with repo doctrine:

- Blueprint is capture-first and world-model-product-first.
- The unit of value is the site-specific package and hosted session around one real facility.
- The page must not drift into generic marketplace language.
- The page must not imply broad public readiness where commercial review, rights review, or freshness review are still request-scoped.
- Public proof, package access, and hosted access must stay clearly differentiated.

## Problem Summary

The current page contains too much explanatory scaffolding before a buyer reaches the catalog:

- long hero copy
- a full access-options section
- a full "why teams buy this" section
- a large public-status explainer
- featured cards
- multiple filter rows
- very dense catalog cards

Each of these sections is individually reasonable, but together they make the page behave more like a product handbook than a sharp catalog front door.

## Design Direction

The page should adopt an editorial industrial-catalog feel:

- warm light background
- large image-led featured cards
- restrained, premium filter controls
- fewer containerized explainer blocks
- stronger typography hierarchy
- shorter copy throughout

The center of gravity should be the catalog itself.

## New Information Architecture

The simplified `/world-models` page will have five sections.

### 1. Hero

Purpose:
- Tell the user exactly what the page is
- Establish that these are real sites with two buying paths
- Offer one browse CTA and one access CTA

Headline:
- `Browse exact-site world models.`

Support line:
- `Real facilities, real capture, and clear paths into site packages or hosted sessions.`

CTA set:
- `View Sample Site`
- `Request Access`

The hero should not contain a long explanatory paragraph. The current "shrink the demo-to-deployment gap" framing is too abstract for a catalog page and should be removed.

### 2. Buying Strip

Purpose:
- Replace the current large "Choose how you want access" section
- Give buyers the product model in one glance

Three compact items:
- `Site Package`
- `Hosted Session`
- `Public proof first`

Each item should be one line or one short sentence only.

This section is a compact orientation strip, not a feature grid.

### 3. Featured Sites

Purpose:
- Let the page lead with proof, not explanation
- Highlight the public sample and commercial exemplar

Featured items:
- public sample listing
- commercial exemplar listing

Each featured card should be image-first and answer:
- what site this is
- why it matters
- what action to take next

The featured area should not repeat the full catalog card metadata stack.

### 4. Catalog

Purpose:
- Be the primary focus of the page

Changes:
- Keep only the highest-signal filters visible by default
- Make the filter controls visually lighter and more compact
- Compress public-status explanation into a small legend or microcopy rail
- Make each catalog card much less dense

Each catalog card should answer only:
- what site is this
- what kind of environment or lane is it
- is there public proof
- is the hosted path documented
- what is the next action

Card content to remove or compress from the current design:
- stacked five-metric metadata grid
- separate plain-English commercial note block
- repeated restrictions copy
- long descriptive summaries that belong on the detail page
- multiple CTA blocks competing within the same card

Card content to preserve in compressed form:
- commercial status
- public proof signal
- hosted-path availability
- the package / hosted action split

### 5. Closing CTA

Purpose:
- Give buyers a final direct path if they need a specific site or custom scope

Copy:
- `Need a specific site?`
- `Open a scoped access request.`

This should be short and visually aligned with the simplified homepage CTA block.

## Content Rules

The page should use these writing rules:

- one idea per section
- one sentence per support paragraph when possible
- fewer internal nouns per block
- avoid "train, evaluate, and debug..." style stacked framing
- avoid explaining every trust nuance before the user sees the catalog

The page should sound like a confident product surface, not internal strategy notes translated into UI.

## What Must Remain Visible

Simplification must not remove the following truths:

- exact-site framing
- real capture provenance
- distinction between package and hosted access
- public proof versus request-scoped review
- honest commercial / readiness language

## Visual Rules

- Use the same warm editorial direction introduced on the homepage.
- Reuse existing real proof assets where possible.
- If new raster imagery becomes necessary later, use Codex image generation on `gpt-image-1.5`.
- Prioritize image-led sections over repeated boxed copy sections.
- Keep the catalog scannable on mobile first, not just compressed desktop cards.

## Implementation Shape

Scope for this pass:

- rewrite the `/world-models` page structure in `client/src/pages/SiteWorlds.tsx`
- update `client/tests/pages/SiteWorlds.test.tsx` to lock the simplified structure

Out of scope for this pass:

- redesigning site detail pages
- changing catalog data contracts
- changing pricing logic
- changing hosted-session routing
- changing package routing

## Acceptance Criteria

The design is successful when all are true:

- a buyer sees the catalog within one short scroll
- the page has five sections or fewer in the main flow
- package versus hosted access is legible within seconds
- featured sites are visually dominant and proof-led
- catalog cards are materially simpler than the current version
- the page stays clearly exact-site and capture-grounded
- no section reads like generic marketplace copy

## File Impact

- Modify: `client/src/pages/SiteWorlds.tsx`
- Modify: `client/tests/pages/SiteWorlds.test.tsx`

## Risks

### Risk 1: Oversimplification removes trust signals

Mitigation:
- keep the minimum honest status labels in each card
- keep package versus hosted distinction visible
- move nuance into the detail page rather than deleting it from the product entirely

### Risk 2: Featured area duplicates the hero

Mitigation:
- hero explains the page
- featured cards show the proof
- catalog handles browsing

### Risk 3: Filters remain visually noisy

Mitigation:
- keep only primary filters expanded by default
- reduce explanatory chrome around them

