# Governance Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/governance` into a shorter buyer-readable trust page with clearer hierarchy and fewer repeated trust sections.

**Architecture:** Keep the implementation scoped to `Governance.tsx` and its focused page test. Replace the current many-section policy wall with a shorter editorial trust snapshot that preserves rights, privacy, provenance, restriction, and hosted-access truths.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library

---

## File Structure

- Modify: `client/src/pages/Governance.tsx`
- Modify: `client/tests/pages/Governance.test.tsx`
- Create: `docs/superpowers/specs/2026-04-17-governance-simplification-design.md`

### Task 1: Lock the Simplified Governance Contract in Tests

**Files:**
- Modify: `client/tests/pages/Governance.test.tsx`

- [ ] **Step 1: Write the failing test for the simplified trust page**

Replace the current assertions with:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Governance from "@/pages/Governance";

describe("Governance", () => {
  it("renders the simplified buyer-readable trust page", () => {
    render(<Governance />);

    expect(
      screen.getByRole("heading", {
        name: /Trust should be readable before purchase\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Rights stay explicit$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted access stays bounded$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^No trust claims beyond the listing$/i).length).toBeGreaterThan(0);

    expect(screen.getByRole("heading", { name: /What a buyer should be able to read\./i })).toBeInTheDocument();
    expect(screen.getByText(/Provenance and freshness/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights and restrictions/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted-access boundary/i)).toBeInTheDocument();
    expect(screen.getByText(/Redaction and retention/i)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /What Blueprint shows and what it does not claim\./i })).toBeInTheDocument();
    expect(screen.getByText(/Published today/i)).toBeInTheDocument();
    expect(screen.getByText(/Not claimed/i)).toBeInTheDocument();
    expect(screen.getByText(/No certification or compliance claim is implied unless Blueprint publishes it explicitly\./i)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /How the boundary stays controlled\./i })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Inspect sample listing/i })
        .some((link) => link.getAttribute("href") === "/world-models/siteworld-f5fd54898cfb"),
    ).toBe(true);

    expect(screen.queryByText(/Operational control matrix/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Public listing policy/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused governance test and verify it fails**

Run:

```bash
npx vitest run client/tests/pages/Governance.test.tsx
```

Expected:
- FAIL

### Task 2: Simplify the Governance Page

**Files:**
- Modify: `client/src/pages/Governance.tsx`

- [ ] **Step 1: Replace the hero with the shorter trust framing**

Use:

```tsx
<h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.5rem]">
  Trust should be readable before purchase.
</h1>
```

Support line:

```tsx
"Blueprint makes rights, privacy, provenance, restrictions, and hosted-access boundaries part of the buyer surface instead of hiding them behind sales copy."
```

Hero strip:

```tsx
[
  "Rights stay explicit",
  "Hosted access stays bounded",
  "No trust claims beyond the listing",
]
```

- [ ] **Step 2: Merge the overlapping trust cards and principles into one section**

Use section heading:

```tsx
"What a buyer should be able to read."
```

Create four cards:

```tsx
[
  { title: "Provenance and freshness", body: "..." },
  { title: "Rights and restrictions", body: "..." },
  { title: "Hosted-access boundary", body: "..." },
  { title: "Redaction and retention", body: "..." },
]
```

- [ ] **Step 3: Compress published-vs-not-claimed into one strong truth section**

Use section heading:

```tsx
"What Blueprint shows and what it does not claim."
```

Keep `Published today` and `Not claimed`, but remove the separate buyer-question and principle sections.

- [ ] **Step 4: Replace the listing policy and control matrix with one smaller control section**

Use section heading:

```tsx
"How the boundary stays controlled."
```

Include three concise cards:
- public listing is still bounded
- hosted access is authenticated and entitlement-controlled
- exceptions stay human-gated

Close with links:
- `/world-models/siteworld-f5fd54898cfb`
- `/contact?persona=robot-team`

### Task 3: Verify Governance

- [ ] **Step 1: Run `npx vitest run client/tests/pages/Governance.test.tsx`**
- [ ] **Step 2: Run `npx vitest run client/tests/pages/Pricing.test.tsx client/tests/pages/ExactSiteHostedReview.test.tsx client/tests/components/site/Header.test.tsx`**

Expected:
- PASS

## Self-Review

- spec coverage: hero, readable trust objects, truth boundary, control summary
- placeholder scan: clean

