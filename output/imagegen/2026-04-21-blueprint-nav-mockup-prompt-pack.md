# Blueprint Nav Mockup Prompt Pack

Date: 2026-04-21

Purpose: Generate a cohesive first-pass UI/UX design base for the primary public-nav pages in `Blueprint-WebApp`.

Scope:
- `World Models`
- `Hosted Evaluation`
- `How It Works`
- `Pricing`
- `Trust`

Model default:
- `gpt-image-2`

Shared art direction:
- Desktop-only, full-page website mockup
- Long-scroll editorial website shown in a tall browser frame
- Strict black, white, and grayscale only
- Paper-white background, dense black typography, charcoal image overlays
- Mostly full-bleed imagery, sparse copy, strong visual hierarchy
- Real facilities, exact-site feeling, one robot shown inside believable scenes
- No generic SaaS dashboard look
- No colorful UI, no purple, no blue gradients, no neon, no glossy startup cards
- Include image-led sections, filmstrip frames, route overlays, subtle world-model cues, document inserts, video or GIF modules
- Minimal believable text only; avoid dense paragraphs and lorem ipsum walls
- Consistent header across all pages:
  - Wordmark: `Blueprint`
  - Nav: `World Models`, `Hosted Evaluation`, `How It Works`, `Pricing`, `Trust`
  - Right-side CTA button: `Inspect a real site`

Global prompt prefix:

```text
Use case: ui-mockup
Asset type: desktop full-page website mockup
Primary request: Create a premium editorial website UI mockup for Blueprint, a company selling site-specific world models built from real capture.
Style/medium: monochrome editorial web design, black/white/grayscale only, sophisticated Swiss-editorial layout, minimal and intuitive, cinematic photography mixed with subtle product proof overlays
Composition/framing: full desktop browser frame, long-scroll page visible, strong section rhythm, large full-bleed imagery, sparse copy blocks, elegant spacing
Lighting/mood: calm, cinematic, documentary, premium, high-contrast but restrained
Color palette: pure black, white, graphite, charcoal, soft paper gray
Materials/textures: concrete, steel, polished floor reflections, paper, glass UI overlays, archival document textures
Constraints: desktop only, visually driven, not text-heavy, keep robots inside real site scenes rather than isolated hero renders, keep the page credible and product-aware
Avoid: generic SaaS cards, bright colors, purple gradients, busy dashboards, cartoon robots, cheesy AI holograms, excessive tiny text, stock-photo startup vibe
```

## 1. World Models

Page goal:
- Discovery and browsing
- Sell the feeling of entering exact-site worlds
- Make the catalog image-led and highly scannable

Prompt:

```text
Use case: ui-mockup
Asset type: desktop full-page website mockup
Primary request: Design the `World Models` page for Blueprint as an image-led discovery catalog for exact-site world models.
Scene/background: grayscale panoramic facility photography spanning warehouse, retail, and industrial interiors
Subject: a robot moving through one exact site with a subtle path overlay, followed by a highly visual catalog of site cards
Style/medium: monochrome editorial web design, luxury magazine pacing, documentary still photography, subtle world-model overlays
Composition/framing: tall desktop browser mockup; hero section with full-bleed panoramic site image, sparse headline, minimal CTA; below that a reel of featured sites, oversized visual cards, image-first catalog grid, and one dramatic section showing a robot-in-scene world-model preview
Lighting/mood: cinematic, crisp, restrained, credible
Text (verbatim): "Blueprint" "World Models" "Hosted Evaluation" "How It Works" "Pricing" "Trust" "Inspect a real site" "Exact-site worlds." "Browse real facilities." "Exact site" "Hosted available"
Constraints: keep copy minimal; use large images more than text; make catalog cards feel premium and highly intuitive
Avoid: giant comparison tables, crowded filters, generic marketplace UI, colorful badges
```

## 2. Hosted Evaluation

Page goal:
- Sell the managed review path
- Make the page feel like stepping into a private review room
- Show reruns, clips, and session review visually

Prompt:

```text
Use case: ui-mockup
Asset type: desktop full-page website mockup
Primary request: Design the `Hosted Evaluation` page for Blueprint as a cinematic private review-room experience for exact-site evaluation before purchase.
Scene/background: grayscale exact-site facility scene with darker tonal treatment, soft reflections, and a floating session window
Subject: a private hosted session UI layered over a real site image, with filmstrip frames of reruns, observation views, and failure-review clips further down the page
Style/medium: monochrome editorial web design with subtle product interface overlays, premium and sparse
Composition/framing: tall desktop browser mockup; dramatic hero with full-bleed site image and one floating review window; follow with storyboard-like sections for request access, open the site, review runs, export artifacts; include embedded video or GIF style strips and artifact cards
Lighting/mood: controlled, intimate, high-trust, cinematic
Text (verbatim): "Blueprint" "World Models" "Hosted Evaluation" "How It Works" "Pricing" "Trust" "Inspect a real site" "Review before you buy." "Request access" "Review runs" "Export artifacts"
Constraints: make the page conversion-oriented but not salesy; more visual than textual; the hosted path must feel concrete
Avoid: dashboard-heavy SaaS visuals, colorful charts, long feature lists
```

## 3. How It Works

Page goal:
- Explain the pipeline without turning it into a text wall
- Show the sequence from capture to package to hosted run

Prompt:

```text
Use case: ui-mockup
Asset type: desktop full-page website mockup
Primary request: Design the `How It Works` page for Blueprint as a visual documentary of the pipeline from real capture to world-model product.
Scene/background: contact-sheet style facility imagery, capture frames, route traces, package documents, and robot-in-scene stills
Subject: a four-stage visual sequence showing Capture, Package, Run, and Deliver
Style/medium: black-and-white editorial web storytelling, documentary layouts, contact sheets, subtle technical overlays
Composition/framing: tall desktop browser mockup; hero built from layered capture frames and one strong headline; below that four large chapter sections named Capture, Package, Run, Deliver, each with one dominant image and one proof insert such as a manifest page, route overlay, or export artifact stack
Lighting/mood: informative, tactile, exacting, elegant
Text (verbatim): "Blueprint" "World Models" "Hosted Evaluation" "How It Works" "Pricing" "Trust" "Inspect a real site" "Capture to world model." "Capture" "Package" "Run" "Deliver"
Constraints: explain process through sequence and imagery rather than bullets; keep it intuitive at a glance
Avoid: simplistic icon rows, colorful process diagrams, dense explanatory copy
```

## 4. Pricing

Page goal:
- Help buyers choose the right path
- Keep pricing visual, premium, and simple rather than spreadsheet-like

Prompt:

```text
Use case: ui-mockup
Asset type: desktop full-page website mockup
Primary request: Design the `Pricing` page for Blueprint as a premium editorial decision page for choosing between site package, hosted evaluation, and enterprise paths.
Scene/background: quiet grayscale facility imagery with large negative space, subtle product inserts, and documentary artifact thumbnails
Subject: three large pricing slabs or poster-like sections for Site Package, Hosted Evaluation, and Enterprise, each paired with a distinct visual treatment
Style/medium: monochrome editorial commerce page, minimal, expensive, product-aware
Composition/framing: tall desktop browser mockup; calm hero section, then large stacked offer panels, then a simplified visual comparison band using artifact thumbnails and short labels instead of a dense pricing table
Lighting/mood: quiet confidence, premium, clear
Text (verbatim): "Blueprint" "World Models" "Hosted Evaluation" "How It Works" "Pricing" "Trust" "Inspect a real site" "Choose the right path." "Site Package" "Hosted Evaluation" "Enterprise"
Constraints: do not make this look like a typical SaaS pricing page; keep it image-led and sparse
Avoid: giant grid tables, too many plan bullets, colorful badges, fake discounts
```

## 5. Trust

Page goal:
- Make provenance, rights, and restrictions feel legible and concrete
- Show evidence visually, not as legal text

Prompt:

```text
Use case: ui-mockup
Asset type: desktop full-page website mockup
Primary request: Design the `Trust` page for Blueprint as an evidence-led editorial page about provenance, rights, privacy, and freshness.
Scene/background: grayscale archival boards made from capture frames, timestamps, document snippets, route traces, and subtle evidence cards
Subject: a hero built from real-site proof materials, followed by documentary sections for provenance timeline, rights and privacy handling, and freshness or restriction visibility
Style/medium: monochrome editorial archive aesthetic, premium and rigorous, part museum wall and part product proof page
Composition/framing: tall desktop browser mockup; hero with layered proof board composition; below that three large visual evidence sections and a clean compact FAQ block near the end
Lighting/mood: rigorous, calm, authoritative, trustworthy
Text (verbatim): "Blueprint" "World Models" "Hosted Evaluation" "How It Works" "Pricing" "Trust" "Inspect a real site" "Proof stays attached." "Provenance" "Rights" "Freshness"
Constraints: make trust feel tangible through visible evidence; keep text minimal and readable
Avoid: legal-page look, endless policy paragraphs, security-software cliches, colorful compliance icons
```
