# Site-led public website — September 9, 2026

Owner-directed replacement of the public website. The site owner is the buyer of a scoped, paid Task Evaluation Run; robot teams apply to participate subject to fit and site approval. No marketplace inventory, customer claims, pricing tiers, or guaranteed pilots are introduced.

ADP-010 / partner-proof day 7: support partner admission with a focused site inquiry and a separate supplier application. The old homepage offered free site participation and primarily addressed robot teams. Completion artifact: a responsive five-page public website with durable contact routing, retired-marketing redirects, and browser-verified inquiry flows.

## Public pages

- `/`: approved visual concept, three expandable process steps, and the two audience doors.
- `/contact/site-operator`: paid evaluation inquiry; task/location, budget status, and pilot window.
- `/contact/robot-team`: system description and contact details; participation remains subject to fit and approval.
- `/privacy` and `/terms`: existing policy substance in the same visual theme.

Account, capture, site-package, admin, and result workflows remain supported. Retired marketing URLs resolve through `client/src/data/minimalPublicSite.ts`. The sitemap and crawler summaries advertise only the five maintained public pages.

## Approved art direction and provenance

Reference: [approved concept](site-led-concept.png). Warm ivory, olive-black text, forest-green controls, DM Sans typography, hairline rules, and a single workcell illustration. The illustration is labeled; it is not a capture or customer proof.

Built-in Codex image generation produced the concept and text-free hero. Requested model: GPT-Image-2.5 Sunburst. OpenAI's September 8 announcement confirms its release, but this session's built-in tool does not expose a model selector or return model identity. Therefore the assets are **not** labeled as verified Sunburst output. The user approved the generated concept and directed implementation against it.

Final public artwork: `client/public/images/site-led/workcell.webp` (WebP encoding of the generated PNG, quality 86). Reference source: `exec-bf5bc361-83aa-4bed-904d-45f696210ad8.png`; hero source: `exec-4e9a686d-45e6-4674-9452-2acaee1b3b2b.png`.

Concept prompt: Create a premium minimal desktop Blueprint website with an ivory background, near-black olive text, forest-green buttons, refined large grotesk typography, generous whitespace, and a realistic fixed-arm industrial workcell. Use the headline “Your site. The right robot. A pilot worth running.” and supporting line “Compare two candidates on your real task. Decide what deserves a physical pilot.” Include a site-owner CTA, three process steps, and a small robot-team application link. No statistics, customer logos, dashboards, pricing grids, or testimonials.

Hero edit prompt: Extract the architectural workcell as standalone hero artwork. Remove all text, labels, logos, buttons, numbers, overlay lines, and navigation. Preserve the realistic miniature industrial scene, single fixed arm, forest-green pedestal, conveyor, bins, wire screens, neutral palette, and soft daylight. Place the workcell on the right, fading to empty warm ivory on the left.

## Verification

- `npm run check -- --incremental false`: frontend/server typing.
- Focused Vitest: homepage doors/disclosures, site and supplier payloads, CSRF, retries, whitespace rejection, duplicate prevention, existing contact persistence and logging, route registration, built HTML and crawler output.
- `playwright test -c playwright.site-led.config.ts`: five pages at 1536px and 390px, layout/contrast/image health, mocked inquiry submissions, mobile keyboard navigation, and legacy redirects. Every API request is intercepted; no live inquiry or email is sent.
- `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1 npm run build`: compile/prerender verification without deployment credentials. This compile-only artifact is not a production release.
- `npm run audit:assets`: public asset references and size limits.

Review artifacts: `output/site-led-review/` (ignored). The isolated worktree preserves the user's primary checkout. No production deployment was performed.

Architecture refresh was attempted with both the default Python and the installed graphify launcher’s interpreter. Both lack the `graphify` package (`graphifyy` distribution), so the required AST refresh could not complete; no refreshed graph is claimed. This tooling limitation does not affect the website build or browser tests.

## Video inquiry and release follow-through

The owner requested optional task-video links and uploads before merge. The site form now accepts up to five HTTP(S) links and three MP4/MOV/WebM files (50 MB each), including multiple tasks. Multipart uploads pass CSRF first, have rate/concurrency/file limits, use temporary disk rather than whole-file memory buffers, and validate container signatures. Server-generated Cloud Storage metadata is persisted with the inquiry. Staff email includes private seven-day review links and durable storage URIs; failed inquiry writes clean up uploaded objects. No video is fetched from a submitted external link.

Hosted CI revealed stale public-copy/browser expectations and required agent compatibility notes removed from crawler files. Those were corrected while keeping the five-page UI. The production dependency audit also required multer 2.3.0 and nodemailer 9.1.1; the lock and minimum compatible versions were updated. The existing contact persistence/CSRF contract remains in force.
