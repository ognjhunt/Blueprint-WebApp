# Pricing Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/pricing` into a shorter comparison-led buying page with a stronger hero, less repeated commercial explanation, and a cleaner closing CTA.

**Architecture:** Keep the implementation scoped to the page file and its focused test. Reuse `OfferComparison` as the dominant pricing surface, then rebuild the rest of the page into a small set of sections that explain how to choose, what changes scope, and what to do next.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library

---

## File Structure

- Modify: `client/src/pages/Pricing.tsx`
  Responsibility: replace the current stacked pricing explainer layout with the shorter comparison-led pricing page.

- Modify: `client/tests/pages/Pricing.test.tsx`
  Responsibility: define the new public contract for the simplified pricing page.

- Create: `docs/superpowers/specs/2026-04-17-pricing-simplification-design.md`
  Responsibility: record the approved design direction for the page.

No pricing data files or routing files should change in this pass.

### Task 1: Lock the Simplified Pricing Contract in Tests

**Files:**
- Modify: `client/tests/pages/Pricing.test.tsx`

- [ ] **Step 1: Write the failing test for the simplified pricing page**

Replace the current test with assertions shaped like:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the simplified comparison-led pricing page", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Public pricing for the exact-site paths that matter first\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/^Site package$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Hosted session-hour$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Custom scope only when needed$/i)).toBeInTheDocument();

    expect(screen.getByText(/Compare the three commercial paths\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$2,100 - \$3,400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$16 - \$29/i).length).toBeGreaterThan(0);

    expect(screen.getByRole("heading", { name: /How to choose the first move\./i })).toBeInTheDocument();
    expect(screen.getByText(/Package first/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted first/i)).toBeInTheDocument();
    expect(screen.getByText(/Custom first/i)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /What changes scope\./i })).toBeInTheDocument();
    expect(screen.getByText(/What pricing does not claim/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Need a site that is not in the public catalog yet\?/i })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Book scoping call/i })).toHaveAttribute(
      "href",
      "/book-exact-site-review",
    );
    expect(screen.getByRole("link", { name: /Request custom quote/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=enterprise",
    );

    expect(screen.queryByText(/Typical first purchase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/What happens after inquiry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/When not to buy exact-site work yet\./i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused pricing test and verify it fails**

Run:

```bash
npx vitest run client/tests/pages/Pricing.test.tsx
```

Expected:
- FAIL
- failure on the old hero or removed sections

- [ ] **Step 3: Tighten only ambiguous selectors if needed**

If text matching is too broad because of duplicated phrases inside `OfferComparison`, narrow to exact text or role-based selectors without weakening the new contract.

- [ ] **Step 4: Re-run the focused pricing test and keep it red**

Run:

```bash
npx vitest run client/tests/pages/Pricing.test.tsx
```

Expected:
- still FAIL
- but only because the simplified implementation is not in place yet

### Task 2: Simplify the Pricing Page Structure

**Files:**
- Modify: `client/src/pages/Pricing.tsx`
- Test: `client/tests/pages/Pricing.test.tsx`

- [ ] **Step 1: Replace the hero with the shorter comparison-led framing**

Update the hero block in `client/src/pages/Pricing.tsx` to use:

```tsx
<h1 className="font-editorial text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.5rem]">
  Public pricing for the exact-site paths that matter first.
</h1>
<p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
  Most teams start with one of three moves: buy the site package, run the hosted path, or scope a custom program around one real facility.
</p>
```

Add a hero signal strip:

```tsx
[
  "Site package",
  "Hosted session-hour",
  "Custom scope only when needed",
]
```

Use these actions:

```tsx
"Inspect sample site"
"Book scoping call"
```

- [ ] **Step 2: Keep `OfferComparison` as the dominant pricing surface**

Render:

```tsx
<OfferComparison className="mt-10" />
```

Do not duplicate its “compare the three commercial paths” explanation later on the page.

- [ ] **Step 3: Replace the duplicated mid-page sections with one compact “how to choose” section**

Delete the current sections that render:

```tsx
"Typical first purchase"
"What happens after inquiry"
"Buyer workflow"
"Where to start"
```

Replace them with one section headed:

```tsx
"How to choose the first move."
```

Render three cards:

```tsx
[
  {
    title: "Package first",
    body: "Choose this when your team wants the site data contract and plans to run its own stack on that facility.",
  },
  {
    title: "Hosted first",
    body: "Choose this when your team wants runtime evidence, reruns, and exports before moving files into its own environment.",
  },
  {
    title: "Custom first",
    body: "Choose this when the site is private, rights are unusual, or higher-touch managed support changes the work from the start.",
  },
]
```

- [ ] **Step 4: Merge cadence, minimums, proof-path, and note cards into one scope-and-trust section**

Delete the sections driven by:

```tsx
pricingWorkflow
responseCadence
pricingNotes
```

Do not render `WhenNotToBuyModule` in the simplified pricing page.

Replace those sections with one three-card block headed:

```tsx
"What changes scope."
```

Required cards:

```tsx
[
  {
    title: "What changes scope",
    body: "Private-site work, unusual trust review, exclusive rights, and higher-touch managed support are quoted separately when they materially change the job.",
  },
  {
    title: "Typical first reply",
    body: "Public-listing and hosted-review pricing questions usually get a first reply within 1 business day. Request-scoped rights, privacy, export, or commercial review usually gets a first scoped answer within 2 business days.",
  },
  {
    title: "What pricing does not claim",
    body: "Public price visibility does not imply unrestricted export rights, blanket site approval, or a deployment guarantee. Exact-site proof and adjacent-site proof still need to stay clearly labeled.",
  },
]
```

- [ ] **Step 5: Replace the closing custom-scope section with a tighter CTA block**

End the page with:

```tsx
<h2 className="font-editorial text-4xl tracking-[-0.05em] text-white sm:text-[3.1rem]">
  Need a site that is not in the public catalog yet?
</h2>
```

Keep these actions:

```tsx
"Book scoping call"
"Request custom quote"
"Email a short brief"
```

Use the same hrefs as the current page:

```tsx
exactSiteScopingCallPath
"/contact?persona=robot-team&interest=enterprise"
"mailto:hello@tryblueprint.io?subject=Blueprint%20brief"
```

### Task 3: Verify the Simplified Pricing Contract

**Files:**
- Modify: `client/src/pages/Pricing.tsx`
- Modify: `client/tests/pages/Pricing.test.tsx`

- [ ] **Step 1: Run the focused pricing test**

Run:

```bash
npx vitest run client/tests/pages/Pricing.test.tsx
```

Expected:
- PASS

- [ ] **Step 2: Run adjacent nav/public tests**

Run:

```bash
npx vitest run client/tests/pages/ExactSiteHostedReview.test.tsx client/tests/pages/SiteWorlds.test.tsx client/tests/components/site/PublicCopy.test.tsx client/tests/components/site/Header.test.tsx
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

- [ ] **Step 5: Refresh graphify outputs**

Run:

```bash
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Expected:
- PASS

## Self-Review

- Spec coverage:
  - shorter hero: covered in Task 2 Step 1
  - comparison-led structure: covered in Task 2 Step 2
  - duplicated sections collapsed: covered in Task 2 Steps 3 and 4
  - tighter custom CTA close: covered in Task 2 Step 5
  - focused and broader verification: covered in Task 3

- Placeholder scan:
  - no `TODO`, `TBD`, or undefined commands remain

- Type consistency:
  - CTA labels and hrefs are aligned across implementation and test steps
