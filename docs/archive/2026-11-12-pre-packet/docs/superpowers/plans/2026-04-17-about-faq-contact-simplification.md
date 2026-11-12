# About, FAQ, and Contact Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/about`, `/faq`, and `/contact` into shorter, cleaner public pages while preserving their functional and doctrinal requirements.

**Architecture:** Keep the implementation scoped to the three page files and their page tests. Reduce repeated explanatory sections, preserve existing routing and form behavior, and bring the layouts into the same editorial public-site system used across the rest of the simplified site.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library

---

## File Structure

- Modify: `client/src/pages/About.tsx`
- Modify: `client/src/pages/FAQ.tsx`
- Modify: `client/src/pages/Contact.tsx`
- Modify: `client/tests/pages/About.test.tsx`
- Modify: `client/tests/pages/FAQ.test.tsx`
- Modify: `client/tests/pages/Contact.test.tsx`
- Create: `docs/superpowers/specs/2026-04-17-about-faq-contact-simplification-design.md`

### Task 1: Lock the Simplified About Contract in Tests

- [ ] Update `client/tests/pages/About.test.tsx` to assert a shorter company-framing page:
  - new hero
  - founder/operating posture card
  - one “what Blueprint is / isn’t” section
  - one deployment-decision story
  - closing CTA

- [ ] Run:

```bash
npx vitest run client/tests/pages/About.test.tsx
```

Expected:
- FAIL

### Task 2: Lock the Simplified FAQ Contract in Tests

- [ ] Update `client/tests/pages/FAQ.test.tsx` to assert the shorter objections page:
  - new hero
  - highest-signal questions only
  - closing CTA
  - absence of the long-tail FAQ items removed from the simplified page

- [ ] Run:

```bash
npx vitest run client/tests/pages/FAQ.test.tsx
```

Expected:
- FAIL

### Task 3: Lock the Simplified Contact Contract in Tests

- [ ] Update `client/tests/pages/Contact.test.tsx` to assert the simplified page chrome while preserving:
  - default robot-team mode
  - hosted mode
  - city-specific guidance
  - fast paths and response expectations

- [ ] Run:

```bash
npx vitest run client/tests/pages/Contact.test.tsx
```

Expected:
- FAIL

### Task 4: Implement About

- [ ] Replace the current repeated-grid About page with the shorter company-framing structure.
- [ ] Keep real founder identity and truthful operating posture.

### Task 5: Implement FAQ

- [ ] Reduce the FAQ list to the highest-signal buyer questions.
- [ ] Add one concise CTA close.

### Task 6: Implement Contact

- [ ] Keep `ContactForm` and query-driven behavior.
- [ ] Simplify layout around the form into fewer supporting cards.
- [ ] Preserve hosted and city-specific messaging.

### Task 7: Verify the Trio

- [ ] Run:

```bash
npx vitest run client/tests/pages/About.test.tsx client/tests/pages/FAQ.test.tsx client/tests/pages/Contact.test.tsx
```

- [ ] Run:

```bash
npx vitest run client/tests/pages/Governance.test.tsx client/tests/pages/HowItWorks.test.tsx client/tests/pages/Pricing.test.tsx client/tests/pages/ExactSiteHostedReview.test.tsx client/tests/pages/SiteWorlds.test.tsx client/tests/components/site/PublicCopy.test.tsx client/tests/components/site/Header.test.tsx
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

