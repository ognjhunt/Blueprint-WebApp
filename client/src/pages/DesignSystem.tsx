/**
 * DesignSystem — Blueprint token-proof page.
 *
 * Renders the redesign design tokens directly so they can be eyeballed in the
 * real app: brand palette ramps, the four signal families, the type scale in
 * the correct family (Manrope / Newsreader / IBM Plex Mono), radius samples,
 * and shadow samples.
 *
 * Intentionally has NO dependency on shadcn primitives — raw Tailwind utilities
 * + the new Blueprint tokens only. Square chrome, hairline borders, mono labels
 * for measurable values.
 */

import type { ReactNode } from "react";

type Swatch = { name: string; cls: string; hex: string; dark?: boolean };

const INK_RAMP: Swatch[] = [
  { name: "ink-900", cls: "bg-ink-900", hex: "#0d0d0b", dark: true },
  { name: "ink-800", cls: "bg-ink-800", hex: "#1a1a17", dark: true },
  { name: "ink-700", cls: "bg-ink-700", hex: "#2b2b27", dark: true },
  { name: "ink-600", cls: "bg-ink-600", hex: "#45443d", dark: true },
  { name: "ink-500", cls: "bg-ink-500", hex: "#5f5d54", dark: true },
  { name: "ink-400", cls: "bg-ink-400", hex: "#817e72", dark: true },
  { name: "ink-300", cls: "bg-ink-300", hex: "#a8a496" },
  { name: "ink-200", cls: "bg-ink-200", hex: "#cdc9bb" },
  { name: "ink-100", cls: "bg-ink-100", hex: "#e4dfd2" },
  { name: "ink-50", cls: "bg-ink-50", hex: "#f0ece1" },
];

const PAPER_RAMP: Swatch[] = [
  { name: "paper-0", cls: "bg-paper-0", hex: "#ffffff" },
  { name: "paper-1", cls: "bg-paper-1", hex: "#faf7f0" },
  { name: "paper-2", cls: "bg-paper-2", hex: "#f5f1e8" },
  { name: "paper-3", cls: "bg-paper-3", hex: "#ebe4d7" },
  { name: "paper-4", cls: "bg-paper-4", hex: "#ded5c4" },
];

const BRASS_TRIO: Swatch[] = [
  { name: "brass.lit", cls: "bg-brass-lit", hex: "#d8bd8d" },
  { name: "brass", cls: "bg-brass", hex: "#c7a775" },
  { name: "brass.deep", cls: "bg-brass-deep", hex: "#a8854f", dark: true },
];

const NEUTRAL_SURFACES: Swatch[] = [
  { name: "bone", cls: "bg-bone", hex: "#ebe4d7" },
  { name: "graphite", cls: "bg-graphite", hex: "#1a1a17", dark: true },
];

type SignalFamily = {
  label: string;
  meaning: string;
  fg: string;
  bg: string;
  bd: string;
  fgCls: string;
  bgCls: string;
  bdCls: string;
  chipFg: string;
  chipBg: string;
  chipBd: string;
};

const SIGNALS: SignalFamily[] = [
  {
    label: "Proof",
    meaning: "validated / success",
    fg: "#1f6b4f",
    bg: "#eef5f1",
    bd: "#dcebe3",
    fgCls: "bg-proof-fg",
    bgCls: "bg-proof-bg",
    bdCls: "bg-proof-bd",
    chipFg: "text-proof-fg",
    chipBg: "bg-proof-bg",
    chipBd: "border-proof-bd",
  },
  {
    label: "Caution",
    meaning: "pending / missing-evidence",
    fg: "#9a6a16",
    bg: "#faf3e2",
    bd: "#f3e7cb",
    fgCls: "bg-warn-fg",
    bgCls: "bg-warn-bg",
    bdCls: "bg-warn-bd",
    chipFg: "text-warn-fg",
    chipBg: "bg-warn-bg",
    chipBd: "border-warn-bd",
  },
  {
    label: "Blocker",
    meaning: "failure / destructive",
    fg: "#9b3027",
    bg: "#faeae7",
    bd: "#f1d9d5",
    fgCls: "bg-block-fg",
    bgCls: "bg-block-bg",
    bdCls: "bg-block-bd",
    chipFg: "text-block-fg",
    chipBg: "bg-block-bg",
    chipBd: "border-block-bd",
  },
  {
    label: "Info / Action",
    meaning: "action / ranking",
    fg: "#1f4f8f",
    bg: "#eaf1f9",
    bd: "#d7e4f2",
    fgCls: "bg-info-fg",
    bgCls: "bg-info-bg",
    bdCls: "bg-info-bd",
    chipFg: "text-info-fg",
    chipBg: "bg-info-bg",
    chipBd: "border-info-bd",
  },
];

const TYPE_SCALE: { token: string; cls: string; px: string }[] = [
  { token: "display-xl", cls: "text-display-xl", px: "72px" },
  { token: "display-l", cls: "text-display-l", px: "56px" },
  { token: "display-m", cls: "text-display-m", px: "44px" },
  { token: "title-xl", cls: "text-title-xl", px: "32px" },
  { token: "title-l", cls: "text-title-l", px: "24px" },
  { token: "title-m", cls: "text-title-m", px: "20px" },
  { token: "body-l", cls: "text-body-l", px: "18px" },
  { token: "body", cls: "text-body", px: "16px" },
  { token: "body-s", cls: "text-body-s", px: "14px" },
  { token: "caption", cls: "text-caption", px: "13px" },
  { token: "micro", cls: "text-micro", px: "11px" },
];

const RADII: { token: string; cls: string; value: string }[] = [
  { token: "none", cls: "rounded-none", value: "0" },
  { token: "xs", cls: "rounded-xs", value: "2px" },
  { token: "sm", cls: "rounded-sm", value: "4px" },
  { token: "md", cls: "rounded-md", value: "8px" },
  { token: "lg", cls: "rounded-lg", value: "12px" },
  { token: "xl", cls: "rounded-xl", value: "16px" },
];

const SHADOWS: { token: string; cls: string; note: string; dark?: boolean }[] = [
  { token: "shadow-xs", cls: "shadow-xs", note: "hairline lift" },
  { token: "shadow-sm", cls: "shadow-sm", note: "resting card" },
  { token: "shadow-md", cls: "shadow-md", note: "raised panel" },
  { token: "shadow-lg", cls: "shadow-lg", note: "marketing card" },
  { token: "shadow-ink", cls: "shadow-ink", note: "dark POV tile", dark: true },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-sans text-micro font-semibold uppercase tracking-eyebrow text-ink-500">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-2 text-title-xl font-semibold tracking-tight text-ink-900">
      {children}
    </h2>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-caption text-ink-500">{children}</span>;
}

export default function DesignSystem() {
  return (
    <div className="min-h-screen bg-paper-1 font-sans text-ink-800">
      {/* Header — square ink chrome */}
      <header className="border-b border-line bg-ink-900 text-paper-1">
        <div className="mx-auto max-w-container px-6 py-10">
          <Eyebrow>
            <span className="text-brass">Blueprint</span>
            <span className="text-ink-300"> / design tokens</span>
          </Eyebrow>
          <h1 className="mt-3 max-w-prose text-display-m font-semibold tracking-display">
            Token proof sheet.
          </h1>
          <p className="mt-3 max-w-prose font-display text-body-l text-ink-200">
            Every value rendered from the live Tailwind theme and CSS custom
            properties. No primitives, no decoration.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-container space-y-16 px-6 py-14">
        {/* ---------- Brand palette ---------- */}
        <section>
          <Eyebrow>Color</Eyebrow>
          <SectionTitle>Brand palette</SectionTitle>

          <div className="mt-6 space-y-8">
            <PaletteRow title="Ink ramp" swatches={INK_RAMP} cols={10} />
            <PaletteRow title="Paper ramp" swatches={PAPER_RAMP} cols={5} />
            <PaletteRow title="Brass — the single brand accent" swatches={BRASS_TRIO} cols={3} />
            <PaletteRow title="Bone / Graphite" swatches={NEUTRAL_SURFACES} cols={2} />
          </div>
        </section>

        {/* ---------- Signal families ---------- */}
        <section>
          <Eyebrow>Color · signal set</Eyebrow>
          <SectionTitle>Status signal families</SectionTitle>
          <p className="mt-2 max-w-prose text-body-s text-ink-500">
            The only saturated colors in the system. Each carries meaning: fg
            (text), bg (fill), bd (border).
          </p>

          <div className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {SIGNALS.map((s) => (
              <div key={s.label} className="bg-paper-0 p-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-title-m font-semibold tracking-tight text-ink-900">
                    {s.label}
                  </h3>
                  <Mono>{s.meaning}</Mono>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <FamilySwatch label="fg" cls={s.fgCls} hex={s.fg} dark />
                  <FamilySwatch label="bg" cls={s.bgCls} hex={s.bg} />
                  <FamilySwatch label="bd" cls={s.bdCls} hex={s.bd} />
                </div>

                {/* Sample chip — square status chip (rounded-sm) */}
                <div className="mt-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-caption ${s.chipFg} ${s.chipBg} ${s.chipBd}`}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: s.fg }}
                    />
                    {s.label.split(" ")[0].toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Type scale ---------- */}
        <section>
          <Eyebrow>Typography</Eyebrow>
          <SectionTitle>Type scale</SectionTitle>

          <div className="mt-6 divide-y divide-line border-y border-line">
            {TYPE_SCALE.map((t) => (
              <div
                key={t.token}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <div className="flex w-44 shrink-0 items-baseline justify-between gap-3">
                  <Mono>{t.token}</Mono>
                  <Mono>{t.px}</Mono>
                </div>
                <p className={`${t.cls} font-sans font-semibold text-ink-900`}>
                  Capture-backed evidence.
                </p>
              </div>
            ))}
          </div>

          {/* Family samples */}
          <div className="mt-8 grid gap-px border border-line bg-line md:grid-cols-3">
            <div className="bg-paper-0 p-5">
              <Mono>font-sans · Manrope</Mono>
              <p className="mt-3 text-title-l font-semibold tracking-tight text-ink-900">
                Site packages, scored.
              </p>
              <p className="mt-2 text-body-s text-ink-600">
                UI, headlines, and product copy. Semibold, negative tracking.
              </p>
            </div>
            <div className="bg-paper-0 p-5">
              <Mono>font-display · Newsreader</Mono>
              <p className="mt-3 font-display text-title-l text-ink-900">
                Evidence over assertion.
              </p>
              <p className="mt-2 font-display text-body italic text-ink-600">
                Editorial and proof statements set in the serif.
              </p>
            </div>
            <div className="bg-paper-0 p-5">
              <Mono>font-mono · IBM Plex Mono</Mono>
              <p className="mt-3 font-mono text-title-m text-ink-900">SITE-04827</p>
              <p className="mt-2 font-mono text-body-s text-ink-600">
                rank-fidelity 0.91 · 1,284 episodes · $12,400
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Radius ---------- */}
        <section>
          <Eyebrow>Shape</Eyebrow>
          <SectionTitle>Radius scale</SectionTitle>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {RADII.map((r) => (
              <div key={r.token} className="flex flex-col items-start gap-3">
                <div
                  className={`h-20 w-full border border-line-strong bg-paper-3 ${r.cls}`}
                />
                <div className="flex w-full items-baseline justify-between">
                  <Mono>{r.token}</Mono>
                  <Mono>{r.value}</Mono>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Shadow ---------- */}
        <section>
          <Eyebrow>Shape · elevation</Eyebrow>
          <SectionTitle>Shadow scale</SectionTitle>
          <p className="mt-2 max-w-prose text-body-s text-ink-500">
            Low, paper-grounded. No glow.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {SHADOWS.map((s) => (
              <div key={s.token} className="flex flex-col items-start gap-3">
                <div
                  className={`flex h-24 w-full items-end rounded-md border p-3 ${s.cls} ${
                    s.dark
                      ? "border-ink-700 bg-ink-900 text-paper-1"
                      : "border-line bg-paper-0 text-ink-900"
                  }`}
                >
                  <span className="font-mono text-caption opacity-70">{s.note}</span>
                </div>
                <Mono>{s.token}</Mono>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-ink-900 px-6 py-8 text-center text-paper-1">
        <Mono>blueprint · design tokens · proof sheet</Mono>
      </footer>
    </div>
  );
}

function PaletteRow({
  title,
  swatches,
  cols,
}: {
  title: string;
  swatches: Swatch[];
  cols: number;
}) {
  return (
    <div>
      <div className="mb-3">
        <Mono>{title}</Mono>
      </div>
      <div
        className="grid gap-px border border-line bg-line"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {swatches.map((sw) => (
          <div key={sw.name} className={`p-3 ${sw.cls}`}>
            <div className="flex h-14 flex-col justify-end">
              <span
                className={`font-mono text-caption ${
                  sw.dark ? "text-paper-1" : "text-ink-800"
                }`}
              >
                {sw.name}
              </span>
              <span
                className={`font-mono text-micro tracking-normal ${
                  sw.dark ? "text-ink-200" : "text-ink-500"
                }`}
              >
                {sw.hex}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FamilySwatch({
  label,
  cls,
  hex,
  dark,
}: {
  label: string;
  cls: string;
  hex: string;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-12 w-full border border-line ${cls}`} />
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-micro tracking-normal text-ink-500">
          {label}
        </span>
      </div>
      <span className="font-mono text-micro tracking-normal text-ink-400">
        {hex}
      </span>
      {/* dark flag is informational; kept to satisfy the swatch contract */}
      <span className="sr-only">{dark ? "dark" : "light"}</span>
    </div>
  );
}
