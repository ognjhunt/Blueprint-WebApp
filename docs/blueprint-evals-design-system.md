# Blueprint Evals — design system

The public and product surfaces run one visual system: a dark instrument
surface that reads like the room a deployment is run from. This document is the
contract. It describes what already exists in `tailwind.config.ts` and
`client/src/index.css`; it is not a proposal.

## The idea in one line

Eval → Pilot → Deploy. The site's job is to make a measured figure the most
credible thing on the page, so the surface recedes and the numbers carry it.

## Ground and ink

| Token | Hex | Use |
| --- | --- | --- |
| `runway-black` | `#0c0f0e` | deepest ground: section bands, table headers |
| `runway-deep` | `#101312` | page canvas |
| `runway-panel` | `#141816` | cards, panels |
| `runway-raised` | `#1a1f1c` | hover, raised rows |
| `runway-line` | `#2a302d` | default hairline |
| `runway-line-soft` | `#232926` | row dividers inside a panel |
| `runway-line-strong` | `#3a423e` | emphasised edge, input borders |
| `runway-text` | `#e8e6dd` | primary bone text |
| `runway-body` | `#c9cdc4` | secondary body copy |
| `runway-mute` | `#9ba19a` | supporting copy |
| `runway-faint` | `#6a716b` | meta, labels, disabled |

The ground is green-black, not blue-black: it sits under a warm amber signal
without the colour clash a cool base produces.

The legacy `ink-*` and `paper-*` ramps are aliases onto this same surface.
`ink-900` is the strongest text (bone, not black) and `paper-0` is the card
(panel, not white). Rung ordering is preserved, so `text-ink-500` still means
"muted" and needs no rewrite.

## Signal

`runway-signal` `#ffb000` is the brand and the primary action. It is the only
saturated fill permitted for a control, so a filled amber button always means
"the one thing to do here". Its text partner is `runway-signal-ink` `#171200`
at 11.4:1 — never white.

- `signal-lit` `#ffc63d` — hover on dark
- `signal-deep` `#e09a00` — pressed, and amber on a light ground
- `signal-dim` `#5c4a12` — chip borders

## Status

Status is always an **outlined chip**, never a fill, so it never competes with
a filled signal control in the same view.

| State | Foreground | Border | Class |
| --- | --- | --- | --- |
| Open / attention | `runway-signal` | `signal-dim` | `runway-chip runway-chip-open` |
| Pass / live / measured | `runway-green` `#46b96c` | `green-dim` `#22513a` | `runway-chip-live` |
| Neutral / site-reported | `runway-sky` `#9fb9cf` | `sky-dim` `#33434e` | `runway-chip-neutral` |
| Fail / did not qualify | `runway-red` `#ff5c45` | `red-dim` `#59261e` | `runway-chip-fail` |
| Inactive | `runway-mute` | `line-strong` | `runway-chip-quiet` |

## Type

- **Display** — Barlow Condensed, **uppercase**, `tracking-[0.005em]`,
  weight 600–700. Use `font-display uppercase` or the `.runway-display`
  helper. A condensed face needs no negative tracking; pulling it tighter
  closes the counters. Never set display type in sentence case.
- **Body** — Barlow. 15–19px, `leading-[1.6]`, `runway-body` or `runway-mute`.
- **Data** — IBM Plex Mono, `tabular-nums`. Every figure, ID, timestamp,
  threshold, and axis label. Use `.runway-num`.
- **Eyebrow / label** — mono, 10–11px, uppercase, `tracking-[0.16em]`+.
  Use `.runway-eyebrow`, `.runway-eyebrow-muted`, `.runway-meta`.

## Chrome

Square. Every radius token resolves to `0`; `rounded-full` survives for status
dots and avatars only. Separation comes from a 1px hairline, not a shadow and
not a corner.

## Components available

`.runway-cta`, `.runway-cta-ghost`, `.runway-panel`, `.runway-chip` (+ state
modifiers), `.runway-prov`, `.runway-table`, `.runway-input`, `.runway-label`,
`.runway-display`, `.runway-display-sm`, `.runway-rule-head`, `.runway-meta`,
`.runway-num`, `.runway-grid`, `.runway-hazard`, `.runway-pulse`.

## Provenance

Every published figure carries where it came from — this is the product's
central claim, so it is a UI primitive rather than a footnote. Use
`.runway-prov` with a coloured dot:

- green dot — **measured** (Blueprint captured it on site, with method and date)
- sky dot — **site-reported** (the operator attested it)
- amber dot — **benchmark** (a band from comparable listings)

A figure with no provenance does not ship. Where the record is silent, say so
in place of the figure rather than filling the gap.

## Rules

1. One filled amber control per view. Everything else is ghost or text.
2. Status reads as an outlined chip; never colour a whole row or card fill.
3. Figures are mono and tabular. Body copy is never mono.
4. Display type is uppercase condensed. Body type is never uppercase past a
   short label.
5. No shadows for elevation on the dark ground — use `runway-panel` on
   `runway-deep`, or a hairline.
6. Never put small white text on `runway-signal`; use `runway-signal-ink`.
