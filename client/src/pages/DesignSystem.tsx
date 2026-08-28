/**
 * DesignSystem — Blueprint token-proof page.
 *
 * Renders the live design tokens directly so they can be eyeballed in the real
 * app: the runway ground/ink ramps, the amber signal and its signal-ink
 * partner, the outlined status chips, the three type families (Barlow / Barlow
 * Condensed / IBM Plex Mono), square chrome, and the provenance dots.
 *
 * Intentionally has NO dependency on shadcn primitives — raw Tailwind utilities
 * + the runway component classes only. Square chrome, hairline borders, mono
 * labels for measurable values.
 */

import type { ReactNode } from "react";

type Swatch = { name: string; cls: string; hex: string; use: string };

const GROUND_RAMP: Swatch[] = [
  { name: "runway-black", cls: "bg-runway-black", hex: "#0c0f0e", use: "deepest ground: section bands, table headers" },
  { name: "runway-deep", cls: "bg-runway-deep", hex: "#101312", use: "page canvas" },
  { name: "runway-panel", cls: "bg-runway-panel", hex: "#141816", use: "cards, panels" },
  { name: "runway-raised", cls: "bg-runway-raised", hex: "#1a1f1c", use: "hover, raised rows" },
  { name: "runway-line-soft", cls: "bg-runway-line-soft", hex: "#232926", use: "row dividers inside a panel" },
  { name: "runway-line", cls: "bg-runway-line", hex: "#2a302d", use: "default hairline" },
  { name: "runway-line-strong", cls: "bg-runway-line-strong", hex: "#3a423e", use: "emphasised edge, input borders" },
];

const INK_RAMP: Swatch[] = [
  { name: "runway-text", cls: "bg-runway-text", hex: "#e8e6dd", use: "primary bone text" },
  { name: "runway-body", cls: "bg-runway-body", hex: "#c9cdc4", use: "secondary body copy" },
  { name: "runway-mute", cls: "bg-runway-mute", hex: "#9ba19a", use: "supporting copy" },
  { name: "runway-faint", cls: "bg-runway-faint", hex: "#6a716b", use: "meta, labels, disabled" },
];

const SIGNAL_RAMP: Swatch[] = [
  { name: "runway-signal", cls: "bg-runway-signal", hex: "#ffb000", use: "brand + primary action" },
  { name: "signal-lit", cls: "bg-runway-signal-lit", hex: "#ffc63d", use: "hover on dark" },
  { name: "signal-deep", cls: "bg-runway-signal-deep", hex: "#e09a00", use: "pressed, and amber on a light ground" },
  { name: "signal-dim", cls: "bg-runway-signal-dim", hex: "#5c4a12", use: "chip borders" },
  { name: "signal-ink", cls: "bg-runway-signal-ink", hex: "#171200", use: "text on a signal fill — never white" },
];

type StatusRow = {
  state: string;
  chip: string;
  label: string;
  fg: string;
  border: string;
};

const STATUS_ROWS: StatusRow[] = [
  {
    state: "Open / attention",
    chip: "runway-chip-open",
    label: "Open",
    fg: "runway-signal #ffb000",
    border: "signal-dim #5c4a12",
  },
  {
    state: "Pass / live / measured",
    chip: "runway-chip-live",
    label: "Measured",
    fg: "runway-green #46b96c",
    border: "green-dim #22513a",
  },
  {
    state: "Neutral / site-reported",
    chip: "runway-chip-neutral",
    label: "Site-reported",
    fg: "runway-sky #9fb9cf",
    border: "sky-dim #33434e",
  },
  {
    state: "Fail / did not qualify",
    chip: "runway-chip-fail",
    label: "Did not qualify",
    fg: "runway-red #ff5c45",
    border: "red-dim #59261e",
  },
  {
    state: "Inactive",
    chip: "runway-chip-quiet",
    label: "Inactive",
    fg: "runway-mute #9ba19a",
    border: "line-strong #3a423e",
  },
];

const PROVENANCE: { dot: string; label: string; note: string }[] = [
  {
    dot: "bg-runway-green",
    label: "Measured",
    note: "Blueprint captured it on site, with method and date.",
  },
  {
    dot: "bg-runway-sky",
    label: "Site-reported",
    note: "The operator attested it.",
  },
  {
    dot: "bg-runway-signal",
    label: "Benchmark",
    note: "A band from comparable listings.",
  },
];

const DISPLAY_SCALE: { token: string; cls: string; px: string }[] = [
  { token: "display-xl", cls: "text-display-xl", px: "96px" },
  { token: "display-l", cls: "text-display-l", px: "64px" },
  { token: "display-m", cls: "text-display-m", px: "46px" },
  { token: "title-xl", cls: "text-title-xl", px: "32px" },
  { token: "title-l", cls: "text-title-l", px: "24px" },
  { token: "title-m", cls: "text-title-m", px: "20px" },
];

const BODY_SCALE: { token: string; cls: string; px: string }[] = [
  { token: "body-l", cls: "text-body-l", px: "18px" },
  { token: "body", cls: "text-body", px: "16px" },
  { token: "body-s", cls: "text-body-s", px: "14px" },
  { token: "caption", cls: "text-caption", px: "13px" },
  { token: "micro", cls: "text-micro", px: "11px" },
];

const RADII: { token: string; cls: string; value: string }[] = [
  { token: "none", cls: "rounded-none", value: "0" },
  { token: "xs", cls: "rounded-xs", value: "0" },
  { token: "sm", cls: "rounded-sm", value: "0" },
  { token: "md", cls: "rounded-md", value: "0" },
  { token: "lg", cls: "rounded-lg", value: "0" },
  { token: "xl", cls: "rounded-xl", value: "0" },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="runway-eyebrow-muted">{children}</p>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-2 font-display text-title-xl font-bold uppercase leading-[1.02] tracking-[0.005em] text-runway-text">
      {children}
    </h2>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 max-w-prose text-[16px] leading-[1.7] text-runway-body">
      {children}
    </p>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[14px] leading-[1.6] text-runway-mute">{children}</p>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="runway-num text-[12px] text-runway-mute">{children}</span>;
}

export default function DesignSystem() {
  return (
    <div className="min-h-screen bg-runway-deep font-sans text-runway-body">
      {/* Header — square chrome on the deepest ground */}
      <header className="border-b border-runway-line bg-runway-black">
        <div className="mx-auto max-w-container px-6 py-10">
          <p className="runway-eyebrow">
            Blueprint
            <span className="text-runway-faint"> / design tokens</span>
          </p>
          <h1 className="mt-3 max-w-prose font-display text-display-m font-bold uppercase tracking-[0.005em] text-runway-text">
            Token proof sheet.
          </h1>
          <p className="mt-4 max-w-prose text-[17px] leading-[1.7] text-runway-body">
            One dark instrument surface, one saturated signal, square chrome, and
            a hairline where a shadow used to be. Every value below is rendered
            from the live Tailwind theme and the runway component classes — no
            primitives, no decoration.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-container space-y-16 px-6 py-14">
        {/* ---------- Ground and ink ---------- */}
        <section>
          <Eyebrow>Colour</Eyebrow>
          <SectionTitle>Ground and ink</SectionTitle>
          <Lede>
            The ground is green-black, not blue-black: it sits under a warm amber
            signal without the colour clash a cool base produces. The legacy{" "}
            <Mono>ink-*</Mono> and <Mono>paper-*</Mono> ramps are aliases onto
            this same surface, so <Mono>ink-900</Mono> is the strongest text
            (bone, not black) and <Mono>paper-0</Mono> is the card (panel, not
            white). Rung ordering is preserved.
          </Lede>

          <div className="mt-6 space-y-8">
            <PaletteRow title="Ground — deepest to emphasised hairline" swatches={GROUND_RAMP} />
            <PaletteRow title="Ink — bone, never pure white" swatches={INK_RAMP} />
          </div>
        </section>

        {/* ---------- Signal ---------- */}
        <section>
          <Eyebrow>Colour · signal</Eyebrow>
          <SectionTitle>Signal and its ink partner</SectionTitle>
          <Lede>
            <Mono>runway-signal</Mono> is the brand and the primary action. It is
            the only saturated fill permitted for a control, so a filled amber
            button always means &ldquo;the one thing to do here&rdquo;. Its text
            partner is <Mono>signal-ink</Mono> at 11.4:1 — never white.
          </Lede>

          <div className="mt-6">
            <PaletteRow title="Signal ramp" swatches={SIGNAL_RAMP} />
          </div>

          <div className="mt-8 grid gap-px border border-runway-line bg-runway-line md:grid-cols-2">
            <div className="bg-runway-panel p-5">
              <Mono>.runway-cta · signal-ink on signal</Mono>
              <div className="mt-4">
                <button type="button" className="runway-cta">
                  Request evaluation
                </button>
              </div>
              <Note>
                One filled amber control per view. Everything else is ghost or
                text.
              </Note>
            </div>
            <div className="bg-runway-panel p-5">
              <Mono>.runway-cta-ghost · hairline + bone</Mono>
              <div className="mt-4">
                <button type="button" className="runway-cta-ghost">
                  Read the method
                </button>
              </div>
              <Note>
                Secondary actions carry a line, not a fill. On hover the line and
                the label both go to signal.
              </Note>
            </div>
          </div>
        </section>

        {/* ---------- Status ---------- */}
        <section>
          <Eyebrow>Colour · status</Eyebrow>
          <SectionTitle>Outlined status chips</SectionTitle>
          <Lede>
            Status is always an outlined chip, never a fill, so it never competes
            with a filled signal control in the same view. Status never colours a
            whole row or card fill either.
          </Lede>

          <div className="mt-6 overflow-x-auto">
            <table className="runway-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Chip</th>
                  <th>Foreground</th>
                  <th>Border</th>
                  <th>Class</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ROWS.map((row) => (
                  <tr key={row.chip}>
                    <td>{row.state}</td>
                    <td>
                      <span className={`runway-chip ${row.chip}`}>{row.label}</span>
                    </td>
                    <td className="runway-num text-[12px]">{row.fg}</td>
                    <td className="runway-num text-[12px]">{row.border}</td>
                    <td className="runway-num text-[12px]">.{row.chip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Provenance ---------- */}
        <section>
          <Eyebrow>Evidence</Eyebrow>
          <SectionTitle>Provenance dots</SectionTitle>
          <Lede>
            Every published figure carries where it came from. That is the
            product&rsquo;s central claim, so it is a UI primitive rather than a
            footnote. A figure with no provenance does not ship; where the record
            is silent, say so in place of the figure.
          </Lede>

          <div className="mt-6 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-3">
            {PROVENANCE.map((item) => (
              <div key={item.label} className="bg-runway-panel p-5">
                <span className="runway-prov">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${item.dot}`} />
                  {item.label}
                </span>
                <Note>{item.note}</Note>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Type ---------- */}
        <section>
          <Eyebrow>Typography</Eyebrow>
          <SectionTitle>Three families, one voice</SectionTitle>
          <Lede>
            Barlow is the workhorse. Barlow Condensed carries display type, set
            uppercase at <Mono>tracking-[0.005em]</Mono> — a condensed face needs
            no negative tracking, and pulling it tighter closes the counters. IBM
            Plex Mono carries every figure, ID, timestamp, threshold, and axis
            label.
          </Lede>

          <div className="mt-6 grid gap-px border border-runway-line bg-runway-line md:grid-cols-3">
            <div className="bg-runway-panel p-5">
              <Mono>font-display · Barlow Condensed</Mono>
              <p className="runway-display mt-3 text-title-l">
                Site packages, scored.
              </p>
              <Note>
                Uppercase, weight 600–700. Never set display type in sentence
                case.
              </Note>
            </div>
            <div className="bg-runway-panel p-5">
              <Mono>font-sans · Barlow</Mono>
              <p className="mt-3 text-body-l leading-[1.6] text-runway-text">
                Evidence over assertion.
              </p>
              <Note>
                15–19px body copy in runway-body or runway-mute. Never uppercase
                past a short label, and never mono.
              </Note>
            </div>
            <div className="bg-runway-panel p-5">
              <Mono>font-mono · IBM Plex Mono</Mono>
              <p className="runway-num mt-3 text-title-m text-runway-text">SITE-04827</p>
              <p className="runway-num mt-2 text-body-s text-runway-mute">
                rank-fidelity 0.91 · 1,284 episodes · $12,400
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3">
              <Mono>display scale · Barlow Condensed, uppercase</Mono>
            </div>
            <div className="divide-y divide-runway-line-soft border-y border-runway-line">
              {DISPLAY_SCALE.map((t) => (
                <div
                  key={t.token}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <div className="flex w-44 shrink-0 items-baseline justify-between gap-3">
                    <Mono>{t.token}</Mono>
                    <Mono>{t.px}</Mono>
                  </div>
                  <p className={`runway-display ${t.cls}`}>Capture-backed evidence.</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3">
              <Mono>body scale · Barlow</Mono>
            </div>
            <div className="divide-y divide-runway-line-soft border-y border-runway-line">
              {BODY_SCALE.map((t) => (
                <div
                  key={t.token}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <div className="flex w-44 shrink-0 items-baseline justify-between gap-3">
                    <Mono>{t.token}</Mono>
                    <Mono>{t.px}</Mono>
                  </div>
                  <p className={`${t.cls} text-runway-body`}>
                    Capture-backed evidence.
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-3">
            <div className="bg-runway-panel p-5">
              <p className="runway-eyebrow">Eval → pilot → deploy</p>
              <Note>
                <Mono>.runway-eyebrow</Mono> — mono, 11px, uppercase, signal.
              </Note>
            </div>
            <div className="bg-runway-panel p-5">
              <p className="runway-eyebrow-muted">Method and date</p>
              <Note>
                <Mono>.runway-eyebrow-muted</Mono> — the same label, held back.
              </Note>
            </div>
            <div className="bg-runway-panel p-5">
              <p className="runway-meta">Captured 2026-03-11</p>
              <Note>
                <Mono>.runway-meta</Mono> — mono, 10px, faint.
              </Note>
            </div>
          </div>
        </section>

        {/* ---------- Chrome ---------- */}
        <section>
          <Eyebrow>Shape</Eyebrow>
          <SectionTitle>Square chrome, hairline separation</SectionTitle>
          <Lede>
            Every radius token resolves to <Mono>0</Mono>. The scale is kept so
            existing call sites stay valid and simply render square;{" "}
            <Mono>rounded-full</Mono> survives for status dots and avatars only.
            Separation comes from a 1px hairline — not a shadow, and not a
            corner.
          </Lede>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {RADII.map((r) => (
              <div key={r.token} className="flex flex-col items-start gap-3">
                <div
                  className={`h-20 w-full border border-runway-line-strong bg-runway-raised ${r.cls}`}
                />
                <div className="flex w-full items-baseline justify-between">
                  <Mono>{r.token}</Mono>
                  <Mono>{r.value}</Mono>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="runway-panel p-5">
              <Mono>.runway-panel on runway-deep</Mono>
              <Note>
                The card every figure sits in. Elevation is one rung of lightness
                plus a hairline, never a drop shadow.
              </Note>
            </div>
            <div className="border border-runway-line bg-runway-black p-5">
              <Mono>runway-black band</Mono>
              <Note>
                The deepest ground. Section bands and table headers sit here.
              </Note>
            </div>
            <div className="border border-runway-line-strong bg-runway-raised p-5">
              <Mono>runway-raised row</Mono>
              <Note>Hover and raised rows. Same square cut, one rung brighter.</Note>
            </div>
          </div>
        </section>

        {/* ---------- Form controls ---------- */}
        <section>
          <Eyebrow>Components</Eyebrow>
          <SectionTitle>Form controls</SectionTitle>
          <Lede>
            <Mono>.runway-input</Mono> is square, hairline-bordered, and goes to
            signal on focus. Labels are <Mono>.runway-label</Mono> — mono,
            uppercase, faint. Errors are <Mono>runway-red</Mono>.
          </Lede>

          <div className="mt-6 max-w-prose border border-runway-line bg-runway-black p-5">
            <label className="runway-label" htmlFor="design-system-site">
              Site identifier
            </label>
            <input
              id="design-system-site"
              className="runway-input"
              placeholder="SITE-04827"
              readOnly
            />
            <p className="mt-2 text-[13px] text-runway-red">
              This site did not qualify under condition 3.
            </p>
          </div>
        </section>

        {/* ---------- Rules ---------- */}
        <section>
          <Eyebrow>Contract</Eyebrow>
          <SectionTitle>The six rules</SectionTitle>

          <ol className="mt-6 max-w-prose list-decimal space-y-3 pl-5 text-[16px] leading-[1.7] text-runway-body marker:font-mono marker:text-runway-faint">
            <li>One filled amber control per view. Everything else is ghost or text.</li>
            <li>Status reads as an outlined chip; never colour a whole row or card fill.</li>
            <li>Figures are mono and tabular. Body copy is never mono.</li>
            <li>
              Display type is uppercase condensed. Body type is never uppercase
              past a short label.
            </li>
            <li>
              No shadows for elevation on the dark ground — use{" "}
              <Mono>runway-panel</Mono> on <Mono>runway-deep</Mono>, or a
              hairline.
            </li>
            <li>
              Never put small white text on <Mono>runway-signal</Mono>; use{" "}
              <Mono>runway-signal-ink</Mono>.
            </li>
          </ol>
        </section>
      </main>

      <footer className="border-t border-runway-line bg-runway-black px-6 py-8 text-center">
        <Mono>blueprint · design tokens · proof sheet</Mono>
      </footer>
    </div>
  );
}

function PaletteRow({ title, swatches }: { title: string; swatches: Swatch[] }) {
  return (
    <div>
      <div className="mb-3">
        <Mono>{title}</Mono>
      </div>
      <div className="grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
        {swatches.map((sw) => (
          <div key={sw.name} className="flex items-stretch gap-3 bg-runway-panel p-3">
            <div className={`w-12 shrink-0 border border-runway-line ${sw.cls}`} />
            <div className="min-w-0 flex-1">
              <p className="runway-num text-[12px] text-runway-text">{sw.name}</p>
              <p className="runway-num text-[11px] text-runway-faint">{sw.hex}</p>
              <p className="mt-1 text-[13px] leading-[1.5] text-runway-mute">{sw.use}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
