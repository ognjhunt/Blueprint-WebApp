/**
 * Runway figures — the charts that carry the argument.
 *
 * Deliberately hand-built rather than pulled from a charting library. Every
 * figure here has fewer than ten data points and a fixed shape, so a library
 * would add a bundle and a theming layer to draw six rectangles. More
 * importantly, hand-built marks let each figure prerender fully: the static
 * branch of `GrowIn`/`Reveal` ships the finished bar, so a reader who lands
 * with JavaScript disabled — or a crawler — sees the same chart, not an empty
 * axis.
 *
 * Colour carries meaning and is never chosen for variety:
 *   signal (orange) = Blueprint, or the phase Blueprint compresses
 *   cyan            = the after state in a before/after pair
 *   red             = the gap being argued about
 *   faint grey      = context the reader should not linger on
 *
 * Every quantitative mark is also written out as text inside the same element,
 * so screen readers get the value rather than a decorative div.
 */
import {
  allocationFactors,
  allocationThesis,
  bottleneckChain,
  contractedAnchor,
  deploymentCompiler,
  historicalAnalogues,
  observedDeployments,
  deploymentCostSplit,
  deploymentPipelineMeta,
  flywheelStages,
  installationTotals,
  installations2024,
  oemDeploymentPhases,
  perRobotEconomics,
  regionalShare2024,
  structuralComparison,
} from "@/data/deploymentMarket";
import { cn } from "@/lib/utils";

import { GrowIn, Reveal } from "../motion";

const compactUnits = new Intl.NumberFormat("en-US");

/* ------------------------------------------------ 01 · the deployment gap */

/**
 * Annual industrial-robot installations, 2024. Bars are scaled against China
 * rather than against the largest visible bar, which is the point: the US bar
 * is short because the gap is large, and a rescaled axis would hide that.
 */
export function InstallationGapChart() {
  const max = Math.max(...installations2024.map((row) => row.units));

  return (
    <div>
      <ul className="space-y-5">
        {installations2024.map((row, index) => {
          const width = (row.units / max) * 100;
          const isFocus = row.emphasis !== "other";

          return (
            <li key={row.region}>
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className={cn(
                    "text-[13.5px] tracking-[-0.01em]",
                    isFocus ? "font-semibold text-runway-text" : "text-runway-mute",
                  )}
                >
                  {row.region}
                </span>
                <span className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      "runway-num text-[13.5px]",
                      row.emphasis === "china"
                        ? "text-runway-red"
                        : row.emphasis === "us"
                          ? "text-runway-signal"
                          : "text-runway-faint",
                    )}
                  >
                    {compactUnits.format(row.units)}
                  </span>
                  {row.changePct !== null ? (
                    <span
                      className={cn(
                        "runway-num w-11 text-right text-[11px]",
                        row.changePct < 0 ? "text-runway-red/80" : "text-runway-green/80",
                      )}
                    >
                      {row.changePct > 0 ? "+" : "\u2212"}
                      {Math.abs(row.changePct)}%
                    </span>
                  ) : (
                    <span className="runway-num w-11 text-right text-[11px] text-runway-faint">
                      {row.share}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full bg-runway-raised">
                <GrowIn
                  delay={index * 0.07}
                  className={cn(
                    "h-full",
                    row.emphasis === "china"
                      ? "bg-runway-red"
                      : row.emphasis === "us"
                        ? "bg-runway-signal"
                        : "bg-runway-line",
                  )}
                  style={{ width: `${width}%` }}
                >
                  <span className="sr-only">
                    {row.region}: {compactUnits.format(row.units)} units installed in 2024
                  </span>
                </GrowIn>
              </div>
            </li>
          );
        })}
      </ul>

      <Reveal
        delay={0.3}
        className="mt-9 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-3"
      >
        <div className="bg-runway-deep px-5 py-5">
          <p className="runway-num text-[1.9rem] font-medium leading-none text-runway-red">
            {installationTotals.chinaToUsRatio}×
          </p>
          <p className="mt-3 text-[12.5px] leading-5 text-runway-mute">
            China installed {installationTotals.chinaToUsRatio} robots for every one the US
            installed
          </p>
        </div>
        <div className="bg-runway-deep px-5 py-5">
          <p className="runway-num text-[1.9rem] font-medium leading-none text-runway-text">54%</p>
          <p className="mt-3 text-[12.5px] leading-5 text-runway-mute">
            of every robot installed on earth went to China
          </p>
        </div>
        <div className="bg-runway-deep px-5 py-5">
          <p className="runway-num text-[1.9rem] font-medium leading-none text-runway-signal">−9%</p>
          <p className="mt-3 text-[12.5px] leading-5 text-runway-mute">
            US installations fell year over year
          </p>
        </div>
      </Reveal>
    </div>
  );
}

/** Regional share of 2024 installations, as one stacked rule. */
export function RegionalShareBar() {
  const tones = ["bg-runway-red", "bg-runway-line", "bg-runway-signal"];

  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-sm border border-runway-line">
        {regionalShare2024.map((row, index) => (
          <div
            key={row.region}
            className={cn("flex items-center justify-center", tones[index])}
            style={{ width: `${row.share}%` }}
          >
            <span className="runway-num text-[11px] text-runway-black/80">{row.share}%</span>
          </div>
        ))}
        <div className="flex-1 bg-runway-raised" />
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {regionalShare2024.map((row, index) => (
          <li key={row.region} className="flex items-center gap-2 text-[12.5px] text-runway-mute">
            <span className={cn("h-2 w-2", tones[index])} aria-hidden="true" />
            {row.region} — {row.share}% of 2024 installations
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------- 02 · the six-month bottleneck */

/**
 * The published path to a scaled deployment, laid out on a real month axis so
 * the width of each phase is its actual duration. Months 0–2 is a third of the
 * bar, and that third is the whole business.
 */
export function DeploymentPipelineChart() {
  const span = 8; // months rendered on the axis
  const ticks = [0, 2, 3, 6, 8];

  return (
    <div>
      <p className="runway-meta mb-4 hidden md:block">Months from first contact</p>

      {/* Axis. Ticks live in the track column only, so the label column cannot
          push them out of alignment with the bars beneath. */}
      <div className="mb-3 hidden md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="relative h-4">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="runway-num absolute top-0 -translate-x-1/2 text-[10.5px] text-runway-faint"
              style={{ left: `${(tick / span) * 100}%` }}
            >
              {tick === span ? `${tick}+` : tick}
            </span>
          ))}
        </div>
        <div />
      </div>

      <ol className="space-y-3">
        {oemDeploymentPhases.map((phase, index) => {
          const left = (phase.startMonth / span) * 100;
          const width = ((phase.endMonth - phase.startMonth) / span) * 100;

          return (
            <li
              key={phase.id}
              className="md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]"
            >
              {/* Desktop: true gantt geometry. The bar carries the window only —
                  a 12.5%-wide bar cannot hold a phase name at any type size. */}
              <div className="relative hidden h-14 md:block">
                <GrowIn
                  delay={index * 0.09}
                  className={cn(
                    "absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-sm border px-3",
                    phase.blueprint
                      ? "border-runway-signal bg-runway-signal/[0.16]"
                      : "border-runway-line bg-runway-raised",
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span
                    className={cn(
                      "runway-num truncate text-[11px]",
                      phase.blueprint ? "text-runway-signal" : "text-runway-faint",
                    )}
                  >
                    {phase.window.replace("Months ", "").replace("Month ", "")}
                  </span>
                </GrowIn>
                {phase.blueprint ? (
                  <span
                    aria-hidden="true"
                    className="runway-hazard absolute -top-px h-[3px] rounded-full"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                ) : null}
              </div>

              <div className="hidden md:block">
                <p
                  className={cn(
                    "text-[14px] font-semibold tracking-[-0.015em]",
                    phase.blueprint ? "text-runway-signal" : "text-runway-text",
                  )}
                >
                  {phase.name}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-runway-faint">
                  {phase.owner}
                </p>
                <p className="mt-2 text-[12.5px] leading-6 text-runway-mute">{phase.detail}</p>
              </div>

              {/* Mobile: stacked cards; a 12%-wide bar is unreadable at 390px. */}
              <div
                className={cn(
                  "rounded-sm border p-4 md:hidden",
                  phase.blueprint
                    ? "border-runway-signal bg-runway-signal/[0.12]"
                    : "border-runway-line bg-runway-raised",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={cn(
                      "text-[14px] font-semibold tracking-[-0.015em]",
                      phase.blueprint ? "text-runway-signal" : "text-runway-text",
                    )}
                  >
                    {phase.name}
                  </p>
                  <span className="runway-num shrink-0 text-[11px] text-runway-faint">
                    {phase.window}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-runway-faint">
                  {phase.owner}
                </p>
                <p className="mt-3 text-[13px] leading-6 text-runway-mute">{phase.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <Reveal delay={0.4} className="mt-8 border-t border-runway-line pt-6">
        <p className="text-[13px] leading-6 text-runway-mute">
          <span className="runway-num text-runway-signal">
            {deploymentPipelineMeta.blueprintMonths} of {deploymentPipelineMeta.totalMonths} months
          </span>{" "}
          happen before a robot is ever crated. That is the part Blueprint automates.
        </p>
      </Reveal>
    </div>
  );
}

/** What the two months actually contain, per the OEM's own description. */
export function PreShipmentWork({ steps }: { steps: readonly { step: string; title: string; detail: string }[] }) {
  return (
    <ol className="grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((item, index) => (
        <Reveal
          key={item.step}
          as="li"
          delay={index * 0.06}
          className="bg-runway-panel p-6"
        >
          <div>
            <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
              {item.step}
            </span>
            <h4 className="mt-4 text-[15px] font-semibold leading-6 tracking-[-0.015em] text-runway-text">
              {item.title}
            </h4>
            <p className="mt-2.5 text-[13px] leading-6 text-runway-mute">{item.detail}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

/* --------------------------------------------------- 03 · the unit economics */

/**
 * Per-robot deployment economics. The recurring row is charted on its annual
 * value so the three bars share one dollar axis — a monthly figure beside two
 * one-time figures would be three different units drawn as one chart.
 */
export function UnitEconomicsChart() {
  const max = Math.max(...perRobotEconomics.map((row) => row.amount));
  const toneBar: Record<string, string> = {
    cost: "bg-runway-red",
    fee: "bg-runway-signal",
    recurring: "bg-runway-cyan",
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-14">
      <div>
        <ul className="space-y-7">
          {perRobotEconomics.map((row, index) => (
            <li key={row.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[13.5px] tracking-[-0.01em] text-runway-text">{row.label}</span>
                <span className="runway-num text-[15px] font-medium text-runway-text">{row.value}</span>
              </div>
              <div className="mt-2.5 h-2.5 w-full bg-runway-raised">
                <GrowIn
                  delay={index * 0.08}
                  className={cn("h-full", toneBar[row.tone])}
                  style={{ width: `${(row.amount / max) * 100}%` }}
                >
                  <span className="sr-only">{row.value}</span>
                </GrowIn>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-5 text-runway-faint">{row.note}</p>
            </li>
          ))}
        </ul>
        <p className="runway-meta mt-7 border-t border-runway-line pt-4">
          Bars share one annual-dollar axis · recurring row shown at 12 months
        </p>
      </div>

      <Reveal delay={0.2} className="flex">
        <div className="flex w-full flex-col justify-center rounded-sm border border-runway-cyan/30 bg-runway-cyan/[0.05] p-6">
          <p className="runway-meta text-runway-cyan">Corroborated by an actual order</p>
          <p className="runway-num mt-5 text-[clamp(2.4rem,4vw,3.4rem)] font-medium leading-none text-runway-cyan">
            {contractedAnchor.headline}
          </p>
          <p className="mt-3 text-[13px] text-runway-text">{contractedAnchor.unit}</p>
          <p className="runway-num mt-5 border-t border-runway-cyan/20 pt-4 text-[11.5px] leading-5 text-runway-mute">
            {contractedAnchor.derivation}
          </p>
          <p className="mt-3 text-[12.5px] leading-6 text-runway-faint">{contractedAnchor.note}</p>
        </div>
      </Reveal>
    </div>
  );
}

/**
 * The cost split. This figure's job is to be honest about a hole in the public
 * record: the total is published, the halves are described, the ratio between
 * them is not disclosed. Drawing a guessed percentage here would be the easiest
 * lie on the whole site, so the divider is rendered as an explicit unknown.
 */
export function CostSplitFigure() {
  return (
    <div>
      <div className="grid gap-px overflow-hidden rounded-sm border border-runway-line bg-runway-line md:grid-cols-[1fr_auto_1fr]">
        <div className="bg-runway-signal/[0.1] p-6">
          <p className="runway-meta text-runway-signal">Before the truck rolls</p>
          <p className="mt-4 text-[14px] font-semibold leading-6 text-runway-text">
            Blueprint's half
          </p>
          <p className="mt-2.5 text-[13px] leading-6 text-runway-mute">
            {deploymentCostSplit.frontHalf}
          </p>
        </div>

        <div className="flex items-center justify-center bg-runway-panel px-6 py-5 md:px-4">
          <div className="text-center">
            <p className="runway-num text-[1.6rem] leading-none text-runway-faint">?</p>
            <p className="runway-meta mt-3 max-w-[9rem] leading-4">Split not disclosed</p>
          </div>
        </div>

        <div className="bg-runway-panel p-6">
          <p className="runway-meta">After it arrives</p>
          <p className="mt-4 text-[14px] font-semibold leading-6 text-runway-text">
            The OEM's half
          </p>
          <p className="mt-2.5 text-[13px] leading-6 text-runway-mute">
            {deploymentCostSplit.backHalf}
          </p>
        </div>
      </div>
      <p className="mt-5 max-w-[68ch] text-[13px] leading-6 text-runway-faint">
        {deploymentCostSplit.known}
      </p>
    </div>
  );
}

/* ------------------------------------------------ 04 · the structural case */

/**
 * Doing it yourself versus doing it once. The right-hand column is a constant
 * ×1 against a left-hand column that scales with vendor count — which is the
 * entire argument, so the multiplier is set larger than the prose.
 */
export function StructuralCompareFigure() {
  return (
    <div className="overflow-hidden rounded-md border border-runway-line">
      <div className="hidden grid-cols-[0.9fr_1.3fr_1.3fr] border-b border-runway-line bg-runway-deep md:grid">
        <span className="runway-meta px-5 py-4">The work</span>
        <span className="runway-meta border-l border-runway-line px-5 py-4">
          Each robot company, on its own
        </span>
        <span className="runway-meta border-l border-runway-line bg-runway-signal/[0.12] px-5 py-4 text-runway-signal">
          With Blueprint
        </span>
      </div>

      <dl>
        {structuralComparison.map((row, index) => (
          <Reveal
            key={row.dimension}
            delay={index * 0.05}
            className="grid border-b border-runway-line last:border-b-0 md:grid-cols-[0.9fr_1.3fr_1.3fr]"
          >
            <dt className="bg-runway-deep px-5 py-4 text-[13.5px] font-semibold text-runway-text md:bg-runway-panel md:py-6">
              {row.dimension}
            </dt>
            <dd className="border-t border-runway-line px-5 py-4 md:border-l md:border-t-0 md:py-6">
              <span className="runway-num block text-[15px] text-runway-red">{row.diyCount}</span>
              <span className="mt-2 block max-w-[38ch] text-[13px] leading-6 text-runway-mute">
                {row.diy}
              </span>
            </dd>
            <dd className="border-t border-runway-line bg-runway-signal/[0.06] px-5 py-4 md:border-l md:border-t-0 md:py-6">
              <span className="runway-num block text-[15px] text-runway-signal">
                {row.blueprintCount}
              </span>
              <span className="mt-2 block max-w-[38ch] text-[13px] leading-6 text-runway-text">
                {row.blueprint}
              </span>
            </dd>
          </Reveal>
        ))}
      </dl>
    </div>
  );
}

/* ---------------------------------------------------- 05 · the flywheel */

/**
 * The compounding loop, drawn as one. A four-node ring rather than a list
 * because the claim is specifically that the last stage feeds the first; a
 * numbered list would say the same words and lose that.
 */
export function FlywheelFigure() {
  const size = 460;
  const centre = size / 2;
  const radius = 152;

  const nodes = flywheelStages.map((stage, index) => {
    const angle = (index / flywheelStages.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...stage,
      x: centre + Math.cos(angle) * radius,
      y: centre + Math.sin(angle) * radius,
      angle,
    };
  });

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
      <Reveal className="mx-auto w-full max-w-[30rem] lg:max-w-none">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-auto w-full"
          role="img"
          aria-label="A four-stage loop: more sites captured, preparation gets cheaper, more pilots start, more deployment data, returning to more sites captured."
        >
          <defs>
            <marker
              id="runway-flywheel-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff5c24" />
            </marker>
          </defs>

          {/* Arc segments between nodes, each carrying the direction of travel. */}
          {nodes.map((node, index) => {
            const next = nodes[(index + 1) % nodes.length];
            const startAngle = node.angle + 0.38;
            const endAngle = next.angle - 0.38;
            const x1 = centre + Math.cos(startAngle) * radius;
            const y1 = centre + Math.sin(startAngle) * radius;
            const x2 = centre + Math.cos(endAngle) * radius;
            const y2 = centre + Math.sin(endAngle) * radius;

            return (
              <path
                key={`arc-${node.id}`}
                d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke="#ff5c24"
                strokeWidth="2"
                markerEnd="url(#runway-flywheel-arrow)"
                opacity="0.9"
              />
            );
          })}

          {nodes.map((node, index) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="34" fill="#07080b" />
              <circle
                cx={node.x}
                cy={node.y}
                r="34"
                fill="none"
                stroke="#ff5c24"
                strokeWidth="2"
              />
              <text
                x={node.x}
                y={node.y + 6}
                textAnchor="middle"
                fill="#ff5c24"
                fontSize="17"
                fontFamily="IBM Plex Mono, ui-monospace, monospace"
              >
                {`0${index + 1}`}
              </text>
            </g>
          ))}

          <text
            x={centre}
            y={centre - 8}
            textAnchor="middle"
            fill="#f4f6f8"
            fontSize="22"
            fontWeight="600"
            fontFamily="Inter Tight, Inter, sans-serif"
          >
            Deployment
          </text>
          <text
            x={centre}
            y={centre + 16}
            textAnchor="middle"
            fill="#f4f6f8"
            fontSize="22"
            fontWeight="600"
            fontFamily="Inter Tight, Inter, sans-serif"
          >
            flywheel
          </text>
        </svg>
      </Reveal>

      <ol className="grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2">
        {flywheelStages.map((stage, index) => (
          <Reveal
            key={stage.id}
            as="li"
            delay={index * 0.07}
            className="bg-runway-panel p-6"
          >
            <div>
              <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                {`0${index + 1}`}
              </span>
              <h4 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-runway-text">
                {stage.label}
              </h4>
              <p className="mt-2.5 text-[13px] leading-6 text-runway-mute">{stage.detail}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

/* --------------------------------------------- 06 · the migrating bottleneck */

const bottleneckTone = {
  easing: {
    dot: "bg-runway-green",
    text: "text-runway-green",
    box: "border-runway-line bg-runway-panel",
    label: "Easing",
  },
  binding: {
    dot: "bg-runway-signal",
    text: "text-runway-signal",
    box: "border-runway-signal bg-runway-signal/[0.12]",
    label: "Binding now",
  },
  next: {
    dot: "bg-runway-amber",
    text: "text-runway-amber",
    box: "border-runway-line bg-runway-panel",
    label: "Next",
  },
} as const;

/**
 * Where the constraint actually sits. Drawn as a chain rather than a ranking
 * because the claim is about order: each link stops binding and hands the
 * constraint to the next one, and the industry has already handed it to
 * deployment.
 */
export function BottleneckChainFigure() {
  return (
    <ol className="grid gap-3 lg:grid-cols-4">
      {bottleneckChain.map((link, index) => {
        const tone = bottleneckTone[link.state];
        return (
          <Reveal key={link.id} as="li" delay={index * 0.08} className="relative">
            <div className={cn("h-full rounded-sm border p-6", tone.box)}>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    tone.dot,
                    link.state === "binding" && "runway-pulse",
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.16em]",
                    tone.text,
                  )}
                >
                  {tone.label}
                </span>
              </div>
              <h4
                className={cn(
                  "mt-5 text-[16px] font-semibold tracking-[-0.02em]",
                  link.state === "binding" ? "text-runway-signal" : "text-runway-text",
                )}
              >
                {link.label}
              </h4>
              <p className="mt-2.5 text-[13px] leading-6 text-runway-mute">{link.note}</p>
            </div>
            {index < bottleneckChain.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute -right-3 top-1/2 hidden h-px w-3 -translate-y-1/2 bg-runway-line lg:block"
              />
            ) : null}
          </Reveal>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------- 07 · what the record actually shows */

/**
 * Elapsed time on the three humanoid deployments with enough in public to
 * measure. Bars share one 12-month axis so the comparison is honest about how
 * little the range varies: nobody has done this fast yet.
 */
export function ObservedDeploymentsFigure() {
  const axisMonths = 12;

  return (
    <div>
      <div className="relative mb-4 hidden h-4 sm:block">
        {[0, 3, 6, 9, 12].map((tick) => (
          <span
            key={tick}
            className="runway-num absolute top-0 -translate-x-1/2 text-[10.5px] text-runway-faint"
            style={{ left: `${(tick / axisMonths) * 100}%` }}
          >
            {tick}
          </span>
        ))}
      </div>

      <ul className="space-y-7">
        {observedDeployments.map((entry, index) => (
          <li key={entry.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[14px] font-semibold tracking-[-0.015em] text-runway-text">
                {entry.operator} <span className="text-runway-faint">→</span> {entry.site}
              </span>
              <span
                className={cn(
                  "runway-num text-[13px]",
                  entry.timed ? "text-runway-cyan" : "text-runway-faint",
                )}
              >
                {entry.elapsed}
              </span>
            </div>
            <div className="mt-2.5 h-2.5 w-full bg-runway-raised">
              <GrowIn
                delay={index * 0.09}
                className={cn("h-full", entry.timed ? "bg-runway-cyan" : "runway-hatch")}
                style={{ width: `${(entry.elapsedMonths / axisMonths) * 100}%` }}
              >
                <span className="sr-only">
                  {entry.timed
                    ? `${entry.elapsed}: ${entry.milestone}`
                    : `Duration not disclosed: ${entry.milestone}`}
                </span>
              </GrowIn>
            </div>
            <p className="mt-2.5 max-w-[70ch] text-[12.5px] leading-6 text-runway-mute">
              <span className="text-runway-text">{entry.milestone}.</span> {entry.detail}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {entry.sources.map((source) => (
                <a
                  key={source.href}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-runway-faint underline-offset-4 transition-colors hover:text-runway-signal hover:underline"
                >
                  {source.label}
                </a>
              ))}
            </p>
          </li>
        ))}
      </ul>

      <p className="runway-meta mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-runway-line pt-4">
        <span>Axis: months from first engagement · 12-month span</span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="runway-hatch h-2 w-6" />
          Sequence published, duration not
        </span>
      </p>
    </div>
  );
}

/* --------------------------------------------- 08 · the deployment compiler */

/**
 * The product as a transformation. Two columns of plain nouns with the machine
 * between them — the same shape as a build step, which is exactly the claim:
 * site and task in, deployable configuration out, repeatably.
 */
export function CompilerFigure() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto_1.15fr_auto_1fr] lg:items-stretch lg:gap-3">
      <CompilerColumn
        eyebrow="Site provides"
        title="One real workflow"
        items={deploymentCompiler.inputs}
      />
      <CompilerArrow />
      <Reveal delay={0.1} className="flex">
        <div className="w-full rounded-sm border border-runway-signal bg-runway-signal/[0.1] p-6">
          <p className="runway-meta text-runway-signal">Blueprint runs</p>
          <h4 className="mt-4 text-[18px] font-semibold tracking-[-0.025em] text-runway-text">
            Months 0–2, compiled
          </h4>
          <p className="mt-3 text-[13px] leading-6 text-runway-mute">
            Capture, testbed construction, envelope screening, controlled evaluation, and the
            handoff package — built once and readable by every robot team the site permits.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-px border border-runway-signal/25 bg-runway-signal/25">
            <div className="bg-runway-black px-4 py-4">
              <dt className="runway-meta">Repeated per vendor</dt>
              <dd className="runway-num mt-2 text-[1.4rem] leading-none text-runway-signal">×1</dd>
            </div>
            <div className="bg-runway-black px-4 py-4">
              <dt className="runway-meta">Robot moves</dt>
              <dd className="runway-num mt-2 text-[1.4rem] leading-none text-runway-signal">0</dd>
            </div>
          </dl>
        </div>
      </Reveal>
      <CompilerArrow />
      <CompilerColumn
        eyebrow="Robot team receives"
        title="A qualified opportunity"
        items={deploymentCompiler.outputs}
      />
    </div>
  );
}

function CompilerColumn({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: readonly string[];
}) {
  return (
    <Reveal className="flex">
      <div className="w-full rounded-sm border border-runway-line bg-runway-panel p-6">
        <p className="runway-meta">{eyebrow}</p>
        <h4 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-runway-text">
          {title}
        </h4>
        <ul className="mt-5 space-y-2.5">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-[13px] leading-6 text-runway-mute">
              <span
                aria-hidden="true"
                className="mt-2.5 h-px w-3 shrink-0 bg-runway-signal"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

function CompilerArrow() {
  return (
    <div className="flex items-center justify-center py-1 lg:py-0" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-90 text-runway-faint lg:rotate-0">
        <path
          d="M4 12h15M13 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ---------------------------------------------- 09 · how allocation works */

/** What a robot company weighs before it spends deployment capacity on a site. */
export function AllocationFigure() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
      <Reveal>
        <div className="rounded-sm border border-runway-line bg-runway-panel p-7">
          <p className="runway-meta">Scarcest resource</p>
          <p className="mt-4 text-[clamp(1.4rem,2.4vw,1.9rem)] font-semibold leading-tight tracking-[-0.03em] text-runway-signal">
            {allocationThesis.scarcest}
          </p>
          <p className="mt-5 border-t border-runway-line pt-5 text-[13px] leading-6 text-runway-faint">
            <span className="line-through decoration-runway-faint/60">
              {allocationThesis.notScarcest}
            </span>
          </p>
          <p className="mt-4 text-[13px] leading-6 text-runway-mute">
            {allocationThesis.consequence}
          </p>
        </div>
      </Reveal>

      <ol className="grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2">
        {allocationFactors.map((row, index) => (
          <Reveal key={row.factor} as="li" delay={index * 0.06} className="bg-runway-panel p-6">
            <div>
              <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                {`0${index + 1}`}
              </span>
              <h4 className="mt-4 text-[14.5px] font-semibold leading-6 tracking-[-0.015em] text-runway-text">
                {row.factor}
              </h4>
              <p className="mt-2.5 text-[12.5px] leading-6 text-runway-mute">{row.signal}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------- 10 · historical analogues */

/** Markets that already solved a version of this problem. */
export function AnaloguesFigure() {
  return (
    <ol className="grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
      {historicalAnalogues.map((row, index) => (
        <Reveal key={row.market} as="li" delay={index * 0.06} className="bg-runway-panel p-6">
          <div>
            <h4 className="text-[15px] font-semibold tracking-[-0.02em] text-runway-text">
              {row.market}
            </h4>
            <p className="runway-meta mt-3 text-runway-signal">{row.parallel}</p>
            <p className="mt-4 text-[13px] leading-6 text-runway-mute">{row.detail}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}
