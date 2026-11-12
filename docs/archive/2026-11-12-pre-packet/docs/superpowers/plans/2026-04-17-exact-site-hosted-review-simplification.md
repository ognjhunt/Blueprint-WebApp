# Exact Site Hosted Review Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/exact-site-hosted-review` into a shorter, proof-first hosted-review page with a clearer CTA hierarchy and fewer explanatory sections.

**Architecture:** Keep the implementation scoped to the page component and its focused test. Preserve the existing hosted preview artwork and truthful commercial links, but collapse the current multi-section handbook flow into five stronger sections that match the editorial direction already established on Home and `/world-models`.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library

---

## File Structure

- Modify: `client/src/pages/ExactSiteHostedReview.tsx`
  Responsibility: replace the current dense hosted-review layout with the simplified editorial version while preserving accurate links, preview labeling, and doctrine-safe product copy.

- Modify: `client/tests/pages/ExactSiteHostedReview.test.tsx`
  Responsibility: update the public contract test to assert the new hero, preview, compact split, trust framing, and closing CTA structure.

- Create: `docs/superpowers/specs/2026-04-17-exact-site-hosted-review-simplification-design.md`
  Responsibility: record the approved design direction for this page.

No routing, navigation, or data-layer files should change in this pass.

### Task 1: Lock the Simplified Hosted-Review Contract in Tests

**Files:**
- Modify: `client/tests/pages/ExactSiteHostedReview.test.tsx`

- [ ] **Step 1: Write the failing test for the new hosted-review structure**

Replace the current test body with assertions shaped like:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExactSiteHostedReview from "@/pages/ExactSiteHostedReview";

describe("ExactSiteHostedReview", () => {
  it("renders the simplified hosted-review product page", () => {
    render(<ExactSiteHostedReview />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Run one exact site before your team travels\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Blueprint hosts the review, keeps it tied to the same capture-backed package, and returns the run evidence your team needs to decide the next move\./i,
      ),
    ).toBeInTheDocument();

    expect(screen.getByText(/One exact site/i)).toBeInTheDocument();
    expect(screen.getByText(/Capture-backed hosted path/i)).toBeInTheDocument();
    expect(screen.getByText(/Package or hosted next step/i)).toBeInTheDocument();

    expect(screen.getAllByText(/Illustrative product preview/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /What your team brings/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What comes back/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What stays explicit/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Choose the next step for this site\./i })).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link", { name: /Scope hosted review/i })
        .some(
          (link) =>
            link.getAttribute("href")
            === "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package",
        ),
    ).toBe(true);

    expect(
      screen
        .getAllByRole("link", { name: /See sample deliverables/i })
        .some((link) => link.getAttribute("href") === "/sample-deliverables"),
    ).toBe(true);

    expect(screen.queryByRole("heading", { name: /Hosted integration contract/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What happens after inquiry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What Blueprint runs and returns/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused page test and verify it fails**

Run:

```bash
npx vitest run client/tests/pages/ExactSiteHostedReview.test.tsx
```

Expected:
- FAIL
- failure on the old hero copy or the removed section headings

- [ ] **Step 3: Tighten only fragile selectors if needed**

If the failure is caused by duplicate links rather than missing structure, adjust only the selector shape. Keep the contract strict enough that the old page cannot pass.

- [ ] **Step 4: Re-run the focused page test and keep it red**

Run:

```bash
npx vitest run client/tests/pages/ExactSiteHostedReview.test.tsx
```

Expected:
- still FAIL
- but only because the simplified implementation does not exist yet

### Task 2: Rewrite the Page into the New Five-Section Editorial Structure

**Files:**
- Modify: `client/src/pages/ExactSiteHostedReview.tsx`
- Test: `client/tests/pages/ExactSiteHostedReview.test.tsx`

- [ ] **Step 1: Shorten the hero and tighten CTA hierarchy**

Update the hero section in `client/src/pages/ExactSiteHostedReview.tsx` to use:

```tsx
<h1 className="font-editorial mt-5 max-w-4xl text-[3.5rem] leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-[4.7rem]">
  Run one exact site before your team travels.
</h1>
<p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
  Blueprint hosts the review, keeps it tied to the same capture-backed package, and returns the run evidence your team needs to decide the next move.
</p>
```

Use a three-item hero signal strip:

```tsx
[
  "One exact site",
  "Capture-backed hosted path",
  "Package or hosted next step",
]
```

Keep these links:

```tsx
"/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package"
"/sample-deliverables"
publicDemoHref
exactSiteScopingCallPath
```

Rename CTA labels to a tighter hierarchy:

```tsx
"Scope hosted review"
"See sample deliverables"
"Inspect sample listing"
"Book scoping call"
```

- [ ] **Step 2: Remove repeated handbook sections and merge their content**

Delete the current sections driven by:

```tsx
publicToday
responseCadence
integrationContract
afterInquiry
```

Also remove the rendered headings:

```tsx
"What's live today"
"Typical commercial cadence"
"Hosted integration contract"
"What happens after inquiry"
```

Keep only the content that still matters and re-home it into a smaller trust-and-fit section.

- [ ] **Step 3: Keep the hosted preview as the visual anchor**

Retain `HostedIllustrativePanel`, but reposition it as the page’s main visual proof section with a smaller surrounding explanation:

```tsx
<section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
  <div className="grid gap-8 lg:grid-cols-[0.34fr_0.66fr] lg:items-start">
    <div className="max-w-md">
      <SectionLabel>Preview</SectionLabel>
      <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950">
        See the hosted path before the call.
      </h2>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        The preview shows representative setup, run review, and export framing for one exact site. It is an illustrative product preview, not a claim that every pictured panel is already public UI or customer proof.
      </p>
    </div>
    <HostedIllustrativePanel />
  </div>
</section>
```

- [ ] **Step 4: Replace the current multi-block process layout with one compact commercial split**

Create a combined section that renders:

```tsx
const buyerProvides = [
  "The exact site your team wants to review",
  "The robot setup, policy, or checkpoint in scope",
  "The workflow question that matters before travel or pilot week",
];

const blueprintReturns = [
  "A managed hosted run on that same capture-backed site",
  "Run review, failure review, and export surfaces",
  "A concrete next step into package access, more hosted time, or custom scope",
];

const hostedLoop = [
  "Pick the site and workflow",
  "Confirm the robot setup",
  "Run the hosted review",
  "Decide the next commercial step",
];
```

Use section headings:

```tsx
"What your team brings"
"What comes back"
"How the hosted path moves"
```

- [ ] **Step 5: Build one smaller trust-and-fit section**

Add a single section that compresses trust, fit, and cadence into three concise blocks with headings:

```tsx
"What stays explicit"
"When this is a fit"
"Typical first reply"
```

Required statements to preserve:

```tsx
"Hosted review is not a deployment guarantee."
"Rights, privacy, restrictions, and export boundaries stay explicit."
"Private-site work, unusual robot fit, or custom export requirements are scoped separately."
"Public-listing and hosted-review questions usually get a first reply within 1 business day."
```

- [ ] **Step 6: Replace the final CTA grid with one shorter decision section**

End the page with:

```tsx
<h2 className="font-editorial text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
  Choose the next step for this site.
</h2>
```

Keep only the highest-signal actions:

```tsx
"Scope hosted review"
"Book scoping call"
"Inspect sample listing"
```

Do not reintroduce another full explanatory column beside the CTA list.

### Task 3: Verify the New Public Contract and Broader Safety Checks

**Files:**
- Modify: `client/src/pages/ExactSiteHostedReview.tsx`
- Modify: `client/tests/pages/ExactSiteHostedReview.test.tsx`

- [ ] **Step 1: Run the focused hosted-review page test**

Run:

```bash
npx vitest run client/tests/pages/ExactSiteHostedReview.test.tsx
```

Expected:
- PASS

- [ ] **Step 2: Run the adjacent public-copy regression tests**

Run:

```bash
npx vitest run client/tests/components/site/PublicCopy.test.tsx client/tests/pages/Home.test.tsx client/tests/pages/SiteWorlds.test.tsx
```

Expected:
- PASS

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run check
```

Expected:
- PASS

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected:
- PASS

- [ ] **Step 5: Refresh graphify outputs required by repo instructions**

Run:

```bash
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Expected:
- PASS

## Self-Review

- Spec coverage:
  - simplified five-section information architecture: covered in Task 2
  - preserve illustrative-preview and truth boundaries: covered in Task 2 Steps 3 and 5
  - tighter CTA hierarchy: covered in Task 2 Steps 1 and 6
  - focused and broader verification: covered in Task 3

- Placeholder scan:
  - no `TODO`, `TBD`, or undefined commands remain

- Type consistency:
  - page file and test file names match the existing repo paths
  - CTA labels and headings are consistent across test and implementation steps
