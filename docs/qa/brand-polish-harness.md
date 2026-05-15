# Brand Polish QA Harness

Status: Local QA harness.

Run:

```bash
npm run qa:polish
```

The command starts the existing Playwright local dev server from `playwright.config.ts` and checks key public routes at desktop and mobile sizes. No live sends, provider calls, payments, deploys, or Notion writes are performed.

## Output

Latest artifacts are written to:

- `output/qa/brand-polish/latest/report.md`
- `output/qa/brand-polish/latest/summary.json`
- `output/qa/brand-polish/latest/notion-layout-checklist.md`
- `output/qa/brand-polish/latest/screenshots/*.png`

The output directory is generated evidence. Use it for local review and issue proof, not as canonical product truth.

## Covered Routes

- `/`
- `/product`
- `/world-models`
- `/pricing`
- `/proof`
- `/capture`
- `/contact`
- `/careers`
- `/faq`
- `/about`
- `/updates`

## Checks

The harness catches obvious local polish defects before screenshots reach a human reviewer:

- desktop and mobile viewport screenshots;
- blank page and framework overlay checks;
- expected H1 and route identity checks;
- primary CTA presence and href checks;
- visible same-origin link checks;
- basic SEO assertions for title, description, robots, and canonical URL;
- basic accessibility checks for visible image alt attributes, interactive names, and form labels;
- mobile horizontal overflow checks;
- visible image load checks;
- placeholder residue checks for `TODO`, `Lorem ipsum`, `undefined`, `[object Object]`, and `NaN`.
- Public Launch Ready posture checks that flag broad prelaunch, apology, placeholder, demo-only, backend-incomplete, and "not ready" language on public buyer routes while still allowing request-scoped proof, access, rights, and availability qualifiers.

Known local dev-server, Firebase persistence, and React Helmet development warnings are filtered out of the console check so the report stays focused on route-level polish defects.

## Notion Layout Review

`output/qa/brand-polish/latest/notion-layout-checklist.md` is a copyable checklist for Notion page/database review. It is intentionally local and does not mutate Notion.

Use the checklist when reviewing Blueprint Hub, onboarding, policy, source-of-truth, or review pages. Repo docs remain canonical drafts, Paperclip remains execution truth, and Notion remains the workspace/review surface.

## Maintenance

Update `scripts/qa/brand-polish.ts` when a public route, canonical route label, or primary CTA changes. Update `e2e/brand-polish.spec.ts` only when the check mechanics change.
