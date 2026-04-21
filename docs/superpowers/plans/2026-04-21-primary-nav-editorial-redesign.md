# Primary Nav Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the five primary public-nav pages around a shared monochrome editorial design system that matches the approved mockup direction while staying grounded in real Blueprint proof and product surfaces.

**Architecture:** Introduce a small set of shared editorial page primitives and media helpers, then rewrite the five route components to use those primitives with repo-grounded assets and copy. Keep route ownership unchanged and avoid introducing new services or unsupported product state.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Wouter, existing Blueprint page/data helpers

---

### Task 1: Shared Editorial Primitives

**Files:**
- Create: `client/src/components/site/editorial.tsx`

- [ ] Define reusable section label, hero shell, monochrome media frame, proof chip, stats strip, and CTA band primitives.
- [ ] Keep these primitives generic enough to be reused across all five page routes without bringing in fake product data.

### Task 2: Shared Media And Content Helpers

**Files:**
- Create: `client/src/lib/siteEditorialContent.ts`

- [ ] Add helpers for selecting truthful imagery from public sample proof assets and existing site-world thumbnails.
- [ ] Add small curated datasets for featured sites, pricing artifacts, trust evidence, and how-it-works chapter imagery.

### Task 3: Header Refinement

**Files:**
- Modify: `client/src/components/site/Header.tsx`

- [ ] Adjust the global public header toward the approved monochrome editorial style.
- [ ] Add a cleaner active-link treatment that better matches the approved nav mockups.

### Task 4: World Models Rewrite

**Files:**
- Modify: `client/src/pages/SiteWorlds.tsx`

- [ ] Replace the current catalog-first marketing layout with the approved editorial discovery flow.
- [ ] Build the new hero, featured reel, “inside the world” proof section, dense visual catalog, and CTA band.

### Task 5: Hosted Evaluation Rewrite

**Files:**
- Modify: `client/src/pages/ExactSiteHostedReview.tsx`

- [ ] Replace the current explainer layout with the approved hosted-review storyboard.
- [ ] Implement the darker hero, floating review window, filmstrip, observation section, path replay section, failure review strip, and export-artifact block.

### Task 6: How It Works Rewrite

**Files:**
- Modify: `client/src/pages/HowItWorks.tsx`

- [ ] Replace the current loop/compare page with the approved documentary four-chapter structure.
- [ ] Build the contact-sheet hero and the `Capture`, `Package`, `Run`, and `Deliver` sections using grounded artifact imagery.

### Task 7: Pricing Rewrite

**Files:**
- Modify: `client/src/pages/Pricing.tsx`
- Modify: `client/src/components/site/OfferComparison.tsx` or remove its use

- [ ] Replace the current compare-and-cards pricing structure with large editorial slabs for `Site Package`, `Hosted Evaluation`, and `Enterprise`.
- [ ] End with a simpler image-led comparison band rather than the current heavy comparison table.

### Task 8: Trust Rewrite

**Files:**
- Modify: `client/src/pages/Governance.tsx`

- [ ] Replace the current text-heavy governance layout with the approved evidence-led trust board.
- [ ] Implement the archival hero, provenance section, rights section, freshness section, and compact FAQ block.

### Task 9: Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-21-primary-nav-editorial-redesign-design.md` only if implementation meaningfully shifts

- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Run `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz`.
- [ ] Capture any residual mismatches between the shipped pages and the approved mockups.

