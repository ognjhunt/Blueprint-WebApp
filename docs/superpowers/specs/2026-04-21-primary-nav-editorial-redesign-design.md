# Primary Nav Editorial Redesign Design

## Goal

Rebuild the five primary public-nav pages in `Blueprint-WebApp` so they follow one cohesive monochrome editorial system:

- `World Models`
- `Hosted Evaluation`
- `How It Works`
- `Pricing`
- `Trust`

The new system should feel image-led, premium, and intuitive, with Blueprint’s exact-site world-model product kept legible through proof inserts, route overlays, artifacts, and restrained product UI cues.

## Visual Thesis

Blueprint’s primary-nav experience should read like a black-and-white field atlas for exact-site robotics rather than a conventional SaaS marketing site.

The pages should feel:

- cinematic
- documentary
- sparse
- high-trust
- product-aware without collapsing into dashboards

## Constraints

- Keep Blueprint capture-first and world-model-product-first.
- Use only truthful product framing tied to real capture, hosted review, packaging, provenance, rights, and artifacts.
- Avoid generic AI or robotics visuals.
- Avoid colorful UI and reduce the public marketing palette to black, white, and grayscale.
- Desktop-first implementation for these five routes.
- Reuse repo-grounded images and artifacts where possible instead of inventing unsupported product state.

## Shared System

### Header

- Minimal white header
- Thin border
- Active nav underline treatment
- Keep existing primary nav structure and `Inspect a real site` CTA

### Page Rhythm

Each page should follow this shared structure:

1. Full-bleed or near-full-bleed hero
2. One high-contrast visual proof section
3. One deeper product-detail section
4. One bottom CTA or decision section

### Repeating Motifs

- full-bleed grayscale facility scenes
- route traces
- filmstrip or contact-sheet framing
- manifest / rights / export artifact inserts
- restrained utility UI overlays
- strong editorial typography

## Page Roles

### World Models

Role: browse and discover exact-site worlds

Must emphasize:

- real sites
- image-first catalog
- featured sites
- route/world-model cue overlays
- hosted availability and exact-site labels

### Hosted Evaluation

Role: convert a buyer into the managed review path

Must emphasize:

- one exact site
- hosted review workspace
- reruns and observation views
- path replay
- failure review
- export artifacts

### How It Works

Role: explain the pipeline visually

Must emphasize:

- Capture
- Package
- Run
- Deliver

The sequence should feel documentary, not diagrammatic.

### Pricing

Role: help buyers choose the right commercial path

Must emphasize:

- Site Package
- Hosted Evaluation
- Enterprise

This page should feel premium and visual rather than tabular.

### Trust

Role: de-risk the purchase through visible evidence

Must emphasize:

- provenance
- rights
- freshness

The trust posture should feel archival and evidence-led, not legalistic.

## Implementation Notes

- Use reusable editorial primitives for headings, media frames, proof chips, section shells, CTA bands, and route-trace overlays.
- Reuse current repo assets like public sample proof images, site thumbnails, sample artifacts, and existing commercial-status helpers where they strengthen truthfulness.
- Prefer layout over card grids. Cards should appear only when they carry a specific proof object or offer.
- Keep copy short and section-focused.

