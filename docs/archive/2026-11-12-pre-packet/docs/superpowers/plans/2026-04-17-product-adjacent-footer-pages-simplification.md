# Product-Adjacent Footer Pages Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/sample-deliverables`, `/proof`, `/for-robot-integrators`, and `/for-site-operators` into shorter, proof-led, editorial public pages.

**Architecture:** Keep the implementation scoped to the four page files and their focused tests. Preserve core proof assets, city-specific logic on `/proof`, and persona truth on the robot-integrator and site-operator pages while removing redundant sections and repeated explanatory copy.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library

---

## File Structure

- Modify: `client/src/pages/SampleDeliverables.tsx`
- Modify: `client/src/pages/Proof.tsx`
- Modify: `client/src/pages/ForRobotIntegrators.tsx`
- Modify: `client/src/pages/ForSiteOperators.tsx`
- Modify: `client/tests/pages/SampleDeliverables.test.tsx`
- Modify: `client/tests/pages/Proof.test.tsx`
- Modify: `client/tests/pages/ForRobotIntegrators.test.tsx`
- Create: `client/tests/pages/ForSiteOperators.test.tsx`
- Create: `docs/superpowers/specs/2026-04-17-product-adjacent-footer-pages-simplification-design.md`

### Task 1: Lock the Simplified Contracts in Tests

- [ ] Update `SampleDeliverables.test.tsx` to assert the shorter proof-led deliverables page.
- [ ] Update `Proof.test.tsx` to assert the tighter proof hub while preserving city-specific behavior.
- [ ] Update `ForRobotIntegrators.test.tsx` to assert the shorter robot-team persona page.
- [ ] Add `ForSiteOperators.test.tsx` to lock the new operator-facing contract.

- [ ] Run:

```bash
npx vitest run client/tests/pages/SampleDeliverables.test.tsx client/tests/pages/Proof.test.tsx client/tests/pages/ForRobotIntegrators.test.tsx client/tests/pages/ForSiteOperators.test.tsx
```

Expected:
- FAIL before implementation

### Task 2: Implement the Four Page Simplifications

- [ ] Rebuild `SampleDeliverables.tsx` around:
  - hero
  - proof-led sample surfaces
  - combined sample contract section
  - package vs hosted section
  - closing CTA/download strip

- [ ] Rebuild `Proof.tsx` around:
  - hero
  - city block when present
  - proof routes
  - compact proof/package/hosted/trust section
  - closing CTA

- [ ] Rebuild `ForRobotIntegrators.tsx` around:
  - hero
  - exact-site value section
  - compact use-case section
  - what you get / what it does not do section
  - closing CTA

- [ ] Rebuild `ForSiteOperators.tsx` around:
  - hero
  - benefits strip
  - combined how-it-works and control section
  - compact eligibility section
  - closing CTA

### Task 3: Verify the Batch

- [ ] Run:

```bash
npx vitest run client/tests/pages/SampleDeliverables.test.tsx client/tests/pages/Proof.test.tsx client/tests/pages/ForRobotIntegrators.test.tsx client/tests/pages/ForSiteOperators.test.tsx
```

- [ ] Run:

```bash
npx vitest run client/tests/pages/About.test.tsx client/tests/pages/FAQ.test.tsx client/tests/pages/Contact.test.tsx client/tests/pages/Governance.test.tsx client/tests/pages/HowItWorks.test.tsx client/tests/pages/Pricing.test.tsx client/tests/pages/ExactSiteHostedReview.test.tsx client/tests/pages/SiteWorlds.test.tsx client/tests/components/site/PublicCopy.test.tsx client/tests/components/site/Header.test.tsx
```

- [ ] Run:

```bash
npm run check
```

- [ ] Run:

```bash
npm run build
```

- [ ] Run:

```bash
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Expected:
- PASS on all commands

