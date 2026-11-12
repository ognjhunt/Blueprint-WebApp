# World Models Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/world-models` into a proof-led catalog page with a short hero, compact buying strip, featured listings, a cleaner catalog, and a minimal closing CTA.

**Architecture:** Keep the implementation narrowly scoped to `SiteWorlds.tsx` and its page test. Preserve the existing catalog data and helper functions, but reorganize the rendered page into five sections and reduce card density so the catalog becomes the dominant surface.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library

---

## File Structure

- Modify: `client/src/pages/SiteWorlds.tsx`
  Responsibility: replace the current handbook-style page flow with the simplified five-section catalog experience while reusing existing site data and status helpers.

- Modify: `client/tests/pages/SiteWorlds.test.tsx`
  Responsibility: replace assertions for the old explanatory layout with assertions for the new simplified content model and actions.

No data-layer or API files should change in this pass.

### Task 1: Lock the New `/world-models` Public Contract in Tests

**Files:**
- Modify: `client/tests/pages/SiteWorlds.test.tsx`

- [ ] **Step 1: Write the failing test for the simplified hero and proof-led structure**

Replace the current assertions with a test shaped like this:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteWorlds from "@/pages/SiteWorlds";

describe("SiteWorlds", () => {
  it("renders the simplified catalog-first world-models page", () => {
    render(<SiteWorlds />);

    expect(
      screen.getByRole("heading", {
        name: /Browse exact-site world models\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Real facilities, real capture, and clear paths into site packages or hosted sessions\./i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /View Sample Site/i }),
    ).toHaveAttribute("href", "/world-models/siteworld-f5fd54898cfb");

    expect(
      screen.getAllByRole("link", { name: /Request Access/i })[0],
    ).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=evaluation-package",
    );

    expect(screen.getByText(/Site Package/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted Session/i)).toBeInTheDocument();
    expect(screen.getByText(/Public proof first/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Featured sites\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Harborview Grocery Distribution Annex/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Media Room Demo Walkthrough/i })).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Browse the catalog\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Public demo available/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hosted path documented/i })).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Need a specific site\?/i,
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText(/Common reasons robot teams buy this surface/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/What public status means/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose how you want access/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the page test to verify it fails against the current page**

Run:

```bash
npx vitest run client/tests/pages/SiteWorlds.test.tsx
```

Expected:
- FAIL
- failure on the old hero or removed handbook sections

- [ ] **Step 3: Tighten any ambiguous assertions before implementation**

If the first run fails because of duplicate accessible names rather than missing content, adjust only the fragile selectors. Use this style:

```tsx
expect(screen.getAllByRole("link", { name: /Request Access/i }).length).toBeGreaterThan(0);
```

Do not broaden the test so far that it can pass the old page structure.

- [ ] **Step 4: Re-run the focused page test and keep it red**

Run:

```bash
npx vitest run client/tests/pages/SiteWorlds.test.tsx
```

Expected:
- still FAIL
- but now only for missing implementation, not for weak selectors

- [ ] **Step 5: Commit the red test**

```bash
git add client/tests/pages/SiteWorlds.test.tsx
git commit -m "test: define simplified world-models page contract"
```

### Task 2: Simplify the Page Structure and Above-the-Fold Flow

**Files:**
- Modify: `client/src/pages/SiteWorlds.tsx`
- Test: `client/tests/pages/SiteWorlds.test.tsx`

- [ ] **Step 1: Replace the hero copy and CTA block with the new short catalog framing**

In `client/src/pages/SiteWorlds.tsx`, replace the current header block with a short hero shaped like:

```tsx
<header className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
  <div className="max-w-3xl">
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      World Models
    </p>
    <h1 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.8rem]">
      Browse exact-site world models.
    </h1>
    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
      Real facilities, real capture, and clear paths into site packages or hosted sessions.
    </p>
    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a
        href="/world-models/siteworld-f5fd54898cfb"
        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        View Sample Site
      </a>
      <a
        href="/contact?persona=robot-team&interest=evaluation-package"
        className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
      >
        Request Access
      </a>
    </div>
  </div>

  <div className="grid gap-3 sm:grid-cols-3">
    {[
      ["Site Package", "License the site for your own stack."],
      ["Hosted Session", "Run the site with Blueprint first."],
      ["Public proof first", "Inspect the listing before the sales motion."],
    ].map(([title, body]) => (
      <article
        key={title}
        className="rounded-[1.6rem] border border-black/10 bg-white/80 p-4"
      >
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      </article>
    ))}
  </div>
</header>
```

- [ ] **Step 2: Remove the long access-options and use-case sections**

Delete the rendered sections driven by `layerCards` and `useCaseCards`.

Delete these constants too:

```tsx
const layerCards = [/* ... */];
const useCaseCards = [/* ... */];
```

Also remove now-unused imports:

```tsx
import { ExternalLink, Filter, Play, ScanLine } from "lucide-react";
```

Replace with:

```tsx
import { ExternalLink, Filter } from "lucide-react";
```

- [ ] **Step 3: Rename the catalog lead-in so the page reaches listings faster**

Change the catalog intro block to this structure:

```tsx
<section id="catalog" className="mt-12">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div className="max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        Catalog
      </p>
      <h2 className="font-editorial mt-3 text-4xl tracking-[-0.05em] text-slate-950">
        Browse the catalog.
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Open a site to inspect proof, buying path, and next-step access.
      </p>
    </div>
    <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-slate-600">
      {filteredSites.length} listed sites
    </div>
  </div>
```

- [ ] **Step 4: Run the focused page test**

Run:

```bash
npx vitest run client/tests/pages/SiteWorlds.test.tsx
```

Expected:
- still FAIL
- but on missing featured/catalog structure, not the removed old copy

- [ ] **Step 5: Commit the structural simplification**

```bash
git add client/src/pages/SiteWorlds.tsx client/tests/pages/SiteWorlds.test.tsx
git commit -m "feat: simplify world-models page structure"
```

### Task 3: Make Featured Listings Image-Led and Reduce Catalog Card Density

**Files:**
- Modify: `client/src/pages/SiteWorlds.tsx`
- Test: `client/tests/pages/SiteWorlds.test.tsx`

- [ ] **Step 1: Replace the current featured block with two image-led featured cards**

Use the existing `featuredSampleSite` and `featuredCommercialSite`, but simplify the rendering to cards shaped like:

```tsx
<section className="mt-10">
  <div className="flex items-end justify-between gap-4">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        Featured
      </p>
      <h2 className="font-editorial mt-3 text-4xl tracking-[-0.05em] text-slate-950">
        Featured sites.
      </h2>
    </div>
  </div>

  <div className="mt-6 grid gap-4 lg:grid-cols-2">
    {[featuredSampleSite, featuredCommercialSite].filter(Boolean).map((site) => {
      const featuredSite = site!;
      return (
        <a
          key={featuredSite.id}
          href={`/world-models/${featuredSite.id}`}
          className="group overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_24px_70px_-56px_rgba(15,23,42,0.45)]"
        >
          <div className="relative">
            <SiteWorldGraphic site={featuredSite} />
          </div>
          <div className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {featuredSite.industry}
            </p>
            <h3 className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-900">
              {featuredSite.siteName}
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{featuredSite.summary}</p>
            <p className="mt-4 text-sm font-semibold text-slate-900">
              {getSiteWorldPlainEnglishStatus(featuredSite)}
            </p>
          </div>
        </a>
      );
    })}
  </div>
</section>
```

- [ ] **Step 2: Compress the filters and remove the full public-status explainer block**

Delete the rendered `What public status means` card grid.

Keep the existing filter state, but visually reduce the filter zone to:

```tsx
<div className="mt-5 flex flex-wrap gap-2">
  {[
    ["Public demo available", publicDemoOnly, setPublicDemoOnly],
    ["Hosted path documented", hostedReadyOnly, setHostedReadyOnly],
    ["Export ready", exportReadyOnly, setExportReadyOnly],
  ].map(([label, active, setter]) => (
    <button
      key={label as string}
      type="button"
      onClick={() => (setter as React.Dispatch<React.SetStateAction<boolean>>)((value) => !value)}
      className={active
        ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
        : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"}
    >
      {label}
    </button>
  ))}
</div>
```

Leave category and embodiment filters in place, but place them after the quick filters and keep the styling lighter.

- [ ] **Step 3: Reduce each catalog card to the minimum buyer-facing scan set**

Replace the dense card body with a simplified shape:

```tsx
<div className="space-y-4 p-5 sm:p-6">
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      {site.industry}
    </p>
    <h3 className="mt-2 text-[1.7rem] font-semibold leading-[1.04] tracking-tight text-slate-900">
      <a href={`/world-models/${site.id}`} className="hover:text-slate-700">
        {site.siteName}
      </a>
    </h3>
    <p className="mt-2 text-sm text-slate-500">{site.siteAddress}</p>
    <p className="mt-3 text-sm leading-7 text-slate-600">{site.bestFor}</p>
  </div>

  <div className="flex flex-wrap gap-2">
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
      {formatEmbodimentLabel(site.sampleRobotProfile?.embodimentType)}
    </span>
    {hasPublicDemo(site) ? (
      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
        Public demo
      </span>
    ) : null}
    {isHostedReady(site) ? (
      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
        Hosted path documented
      </span>
    ) : null}
  </div>

  <div className="grid gap-3 sm:grid-cols-2">
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Commercial status
      </p>
      <p className="mt-1 text-sm text-slate-800">{commercialStatus.label}</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Proof
      </p>
      <p className="mt-1 text-sm text-slate-800">{getSiteWorldPublicProofSummary(site)}</p>
    </div>
  </div>

  <div className="grid gap-2 sm:grid-cols-2">
    {site.packages.map((pkg) => (
      <a
        key={pkg.name}
        href={pkg.actionHref}
        className={pkg.name === "Hosted Evaluation"
          ? "inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          : "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"}
      >
        {pkg.actionLabel}
      </a>
    ))}
  </div>
</div>
```

Remove these blocks entirely:

```tsx
<div className="grid gap-2 sm:grid-cols-2">{/* five-metric metadata grid */}</div>
<div>{/* Public proof assets explanation block */}</div>
<div>{/* Plain-English commercial note block */}</div>
<p>{/* readiness disclosure paragraph */}</p>
```

- [ ] **Step 4: Add the minimal closing CTA**

At the bottom of the page, add:

```tsx
<section className="mt-12 rounded-[2rem] border border-black/10 bg-slate-950 px-6 py-10 text-white">
  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
    Access
  </p>
  <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-white">
    Need a specific site?
  </h2>
  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
    Open a scoped access request.
  </p>
  <div className="mt-7">
    <a
      href="/contact?persona=robot-team&interest=evaluation-package"
      className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
    >
      Request Access
    </a>
  </div>
</section>
```

- [ ] **Step 5: Run the focused test and make it pass**

Run:

```bash
npx vitest run client/tests/pages/SiteWorlds.test.tsx
```

Expected:
- PASS

- [ ] **Step 6: Run the adjacent public-copy regression checks**

Run:

```bash
npx vitest run client/tests/pages/SiteWorlds.test.tsx client/tests/pages/Home.test.tsx client/tests/components/site/PublicCopy.test.tsx
```

Expected:
- all selected tests PASS

- [ ] **Step 7: Commit the simplified catalog page**

```bash
git add client/src/pages/SiteWorlds.tsx client/tests/pages/SiteWorlds.test.tsx client/tests/pages/Home.test.tsx client/tests/components/site/PublicCopy.test.tsx
git commit -m "feat: simplify world-models public catalog"
```

### Task 4: Run Final Verification and Refresh the Graph

**Files:**
- Modify: none expected

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run check
```

Expected:
- exit code 0

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected:
- exit code 0
- generated client build output

- [ ] **Step 3: Refresh graphify outputs as required by repo instructions**

Run:

```bash
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Expected:
- `status: "ok"`
- canonical `graphify-out` published

- [ ] **Step 4: Commit any generated architecture artifacts only if they changed**

```bash
git add graphify-out derived/graphify
git commit -m "chore: refresh graphify outputs after world-models simplification"
```

If `git diff --cached --quiet` shows no staged graph changes, skip this commit.

