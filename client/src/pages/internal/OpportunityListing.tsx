/**
 * OpportunityListing — one site-task, in full.
 *
 * The board's row expanded: the task, the acceptance rubric that scores every
 * stage, what ships in the eval package, which screening gates the site
 * cleared, and the commercial bands. Design mock; see
 * `opportunityBoardPreview` for why the labelling is mandatory.
 */

import { Link, useRoute } from "wouter";

import { SEO } from "@/components/SEO";
import { deploymentFees, evaluationCredit, formatUsd } from "@/lib/deploymentPricing";
import {
  PREVIEW_NOTICE,
  boardListings,
  formatBand,
  gateMeta,
  provenanceMeta,
  statusMeta,
  type BoardListing,
  type GateId,
} from "@/data/opportunityBoardPreview";

/** The rubric is the acceptance test — the same one at every stage. */
const RUBRIC: readonly { metric: string; threshold: string; method: string; appliesAt: string }[] = [
  {
    metric: "Cycle success",
    threshold: "≥96%",
    method: "Correct lane, first attempt, no re-grasp",
    appliesAt: "Twin · Eval week · Pilot",
  },
  {
    metric: "Cycle time, sustained",
    threshold: "≤27s",
    method: "Rolling median across any 2-hour window",
    appliesAt: "Twin · Eval week · Pilot",
  },
  {
    metric: "Interventions",
    threshold: "≤2 / hr",
    method: "Any human touch of robot, tote, or cell",
    appliesAt: "Eval week · Pilot",
  },
  {
    metric: "Uptime",
    threshold: "≥95%",
    method: "Of the scheduled 22:00–06:00 window",
    appliesAt: "Eval week",
  },
  {
    metric: "Throughput ramp",
    threshold: "≥380 / shift",
    method: "By pilot week 4; human baseline is 460",
    appliesAt: "Pilot gate",
  },
];

const EVAL_PACKAGE: readonly { title: string; detail: string }[] = [
  { title: "Digital twin", detail: "Handheld scan, sim-ready USD and MJCF, versioned" },
  { title: "62 human demonstrations", detail: "Egocentric RGB-D, full cycles including exceptions" },
  { title: "14-SKU object library", detail: "Dimensions, weights, tote CADs" },
  { title: "Site conditions", detail: "Lighting grid, floor spec, power, network" },
];

const SCHEDULE: readonly { when: string; what: string }[] = [
  { when: "Sep 18", what: "Proposals close" },
  { when: "Sep 22", what: "Shortlist · site identity reveals to those teams" },
  { when: "Oct 5–9", what: "On-site eval week, Blueprint-scored" },
  { when: "Nov 2", what: "Pilot · 4 weeks · acceptance gate" },
  { when: "Dec 1", what: "Conversion — automatic if the bar clears" },
];

const ALL_GATES: readonly GateId[] = ["fixed-scene", "bounded-task", "known-objects", "clear-window"];

export default function OpportunityListing() {
  const [, params] = useRoute("/internal/opportunity-board/:id");
  const listing = boardListings.find(
    (candidate) => candidate.id.toLowerCase() === (params?.id ?? "").toLowerCase(),
  );

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-runway-deep px-6 text-center">
        <SEO title="Listing not found | Blueprint" description="Preview listing not found." noIndex />
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-[0.005em] text-runway-text">
            No such listing
          </h1>
          <p className="mt-3 text-[15px] text-runway-mute">That preview listing does not exist.</p>
          <Link href="/internal/opportunity-board" className="runway-cta-ghost mt-6">
            Back to the board
          </Link>
        </div>
      </div>
    );
  }

  return <ListingView listing={listing} />;
}

function ListingView({ listing }: { listing: BoardListing }) {
  const status = statusMeta[listing.status];
  const cleared = new Set(listing.gatesCleared);
  const allClear = ALL_GATES.every((gate) => cleared.has(gate));

  return (
    <div className="min-h-screen bg-runway-deep text-runway-text">
      <SEO
        title={`${listing.id} · ${listing.task} | Blueprint preview`}
        description="Design preview of a Blueprint opportunity listing."
        noIndex
      />

      <div className="border-b border-runway-signal-dim bg-runway-signal/[0.07] px-6 py-3 lg:px-8">
        <p className="mx-auto flex max-w-[86rem] items-center gap-3 font-mono text-[10.5px] uppercase leading-[1.6] tracking-[0.1em] text-runway-signal">
          <span aria-hidden="true" className="h-[6px] w-[6px] shrink-0 rounded-full bg-runway-signal" />
          {PREVIEW_NOTICE}
        </p>
      </div>

      <div className="border-b border-runway-line px-6 py-3 lg:px-8">
        <Link
          href="/internal/opportunity-board"
          className="mx-auto block max-w-[86rem] font-mono text-[11px] uppercase tracking-[0.08em] text-runway-faint transition-colors hover:text-runway-signal"
        >
          ← Open evals
        </Link>
      </div>

      {/* ---- header ---- */}
      <header className="border-b border-runway-line px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[86rem] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="runway-num text-[15px] font-semibold tracking-[0.04em] text-runway-signal">
                {listing.id}
              </span>
              <span className={`runway-chip ${status.chip}`}>
                {status.label.toUpperCase()}
                {listing.status === "eval-open" && listing.entrants !== null
                  ? ` · ${listing.entrants} teams in`
                  : ""}
              </span>
              {allClear ? (
                <span className="runway-chip runway-chip-live">Qualified 4/4</span>
              ) : (
                <span className="runway-chip runway-chip-quiet">
                  Gates {listing.gatesCleared.length}/4
                </span>
              )}
            </div>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,5.4vw,3.8rem)] font-bold uppercase leading-[0.96] tracking-[0.005em]">
              {listing.task}
            </h1>
            <p className="mt-3 text-[15px] text-runway-mute">
              {listing.vertical} · {listing.area} · identity reveals at shortlist
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <button type="button" className="runway-cta">
                Start standard eval — free
              </button>
              <button type="button" className="runway-cta-ghost">
                Listing spec
              </button>
            </div>
            <p className="runway-meta">
              {listing.decision ? `Proposals close ${listing.decision} · ` : ""}Pilot start Nov 2
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[86rem] gap-10 px-6 py-9 lg:grid-cols-[minmax(0,1fr)_366px] lg:px-8">
        {/* ---- left column ---- */}
        <div className="flex flex-col gap-10">
          <section>
            <div className="runway-rule-head">
              <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-runway-faint">
                01 · The task
              </h2>
            </div>
            <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex min-h-[210px] flex-col items-center justify-center gap-3 border border-runway-line bg-[repeating-linear-gradient(0deg,#171b19_0px,#171b19_1px,#101312_1px,#101312_24px)] p-6 text-center">
                <svg width="40" height="40" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                  <circle cx="17" cy="17" r="15.5" stroke="#ffb000" strokeWidth="1.5" />
                  <path d="M14 11.5 L23 17 L14 22.5 Z" fill="#ffb000" />
                </svg>
                <span className="runway-meta">Task video · placeholder</span>
              </div>
              <div className="flex flex-col gap-4">
                <p className="text-[15px] leading-[1.6] text-runway-body">
                  {listing.note ??
                    "One repeated transfer at a fixed station, captured across a full shift so the cycle time is a measurement rather than an estimate."}
                </p>
                <dl className="grid grid-cols-3 gap-px border border-runway-line bg-runway-line">
                  <div className="bg-runway-deep p-3">
                    <dt className="runway-meta">Human cycle</dt>
                    <dd className="runway-num mt-1 text-[1.55rem] leading-none">
                      {listing.humanCycleSeconds === null ? "—" : `${listing.humanCycleSeconds}s`}
                    </dd>
                    <span className="runway-prov mt-2">
                      <span
                        aria-hidden="true"
                        className={`h-[5px] w-[5px] rounded-full ${provenanceMeta[listing.cycleProvenance].dot}`}
                      />
                      {provenanceMeta[listing.cycleProvenance].label} · n=142
                    </span>
                  </div>
                  <div className="bg-runway-deep p-3">
                    <dt className="runway-meta">Per shift</dt>
                    <dd className="runway-num mt-1 text-[1.55rem] leading-none">460</dd>
                    <span className="runway-prov mt-2">
                      <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-runway-green" />
                      Measured
                    </span>
                  </div>
                  <div className="bg-runway-deep p-3">
                    <dt className="runway-meta">Shifts</dt>
                    <dd className="runway-num mt-1 text-[1.55rem] leading-none">2</dd>
                    <span className="runway-prov mt-2">
                      <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-runway-sky" />
                      Site-reported
                    </span>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section>
            <div className="runway-rule-head">
              <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-runway-faint">
                02 · The bar
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-runway-signal">
                Same rubric: eval · pilot · conversion
              </span>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="runway-table min-w-[40rem]">
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col">Threshold</th>
                    <th scope="col">How it is measured</th>
                    <th scope="col">Applies at</th>
                  </tr>
                </thead>
                <tbody>
                  {RUBRIC.map((row) => (
                    <tr key={row.metric}>
                      <td>{row.metric}</td>
                      <td>
                        <span className="runway-num text-[12.5px]">{row.threshold}</span>
                      </td>
                      <td className="text-runway-mute">{row.method}</td>
                      <td>
                        <span className="runway-num text-[11.5px] text-runway-mute">{row.appliesAt}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[13px] leading-[1.55] text-runway-faint">
              Clear this in the pilot and conversion triggers — nothing renegotiates after the fact.
              Flagged exceptions sit outside the denominator: routing them is correct behaviour, not a miss.
            </p>
          </section>

          <section>
            <div className="runway-rule-head">
              <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-runway-faint">
                03 · In the eval package — free
              </h2>
            </div>
            <div className="mt-5 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2">
              {EVAL_PACKAGE.map((item) => (
                <div key={item.title} className="bg-runway-deep p-4">
                  <p className="text-[14px] font-semibold text-runway-text">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-[1.5] text-runway-mute">{item.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-[1.55] text-runway-faint">
              Licensed for this eval only. Training rights are negotiated at conversion — the site keeps a
              veto, and provenance travels with every derivative.
            </p>
          </section>

          <section>
            <div className="runway-rule-head">
              <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-runway-faint">
                04 · Why it qualified
              </h2>
            </div>
            <div className="mt-5 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
              {ALL_GATES.map((gate) => {
                const pass = cleared.has(gate);
                return (
                  <div key={gate} className="flex flex-col gap-2 bg-runway-deep p-4">
                    <span className={`runway-chip self-start ${pass ? "runway-chip-live" : "runway-chip-fail"}`}>
                      {gateMeta[gate].label.toUpperCase()}
                    </span>
                    <p className="text-[12.5px] leading-[1.45] text-runway-mute">{gateMeta[gate].test}</p>
                    <p
                      className={`mt-auto font-mono text-[10px] uppercase tracking-[0.1em] ${
                        pass ? "text-runway-green" : "text-runway-red"
                      }`}
                    >
                      {pass ? "Pass" : "Not cleared"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ---- right rail ---- */}
        <aside className="flex flex-col gap-5">
          <div className="runway-panel p-5">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em]">The deal</p>
            <dl className="mt-3">
              <Row label="Standard eval" value="Free" accent="text-runway-green" />
              <Row label="Eval credit" value={`${formatUsd(evaluationCredit.low)} · returned on deploy`} />
              <Row label="Pilot · 4 weeks" value={`${formatBand(listing.pilotBand)} band`} />
              <Row label="Deployment · 12 mo" value="$8.5–11K / mo band" />
              <Row
                label="Blueprint"
                value={`${formatUsd(deploymentFees.activation.amount)} + ${formatUsd(deploymentFees.robotMonth.low)}/robot-mo`}
                accent="text-runway-signal"
                last
              />
            </dl>
            <p className="mt-3 text-[12.5px] leading-[1.55] text-runway-faint">
              Propose a rate inside the bands. The eval credit comes off Blueprint&rsquo;s activation
              fee if you deploy, so evaluating costs a winning team nothing. Miss the pilot bar and
              the site owes nothing further.
            </p>
          </div>

          <div className="border border-runway-line p-5">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em]">
              Why the site is buying
            </p>
            <dl className="mt-3">
              <Row label="Staffing on this task" value="2.4 FTE / 2 shifts" />
              <Row label="Loaded rate" value="$22.10 / hr" />
              <Row label="Unfilled, trailing 12 mo" value="18% of shifts" accent="text-runway-red" />
              <Row label="Overtime + backfill" value="$31K" last />
            </dl>
            <span className="runway-prov mt-3">
              <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-runway-sky" />
              Site-reported
            </span>
            <p className="mt-3 text-[12px] leading-[1.5] text-runway-faint">
              On wages alone this deal is thin — the buy is the 18% of shifts it cannot fill.
            </p>
          </div>

          <div className="border border-runway-line p-5">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em]">Schedule</p>
            <ol className="mt-3">
              {SCHEDULE.map((step) => (
                <li key={step.when} className="flex gap-4 py-[7px]">
                  <span className="runway-num w-[62px] shrink-0 text-[12px] text-runway-signal">
                    {step.when}
                  </span>
                  <span className="text-[13px] leading-[1.45] text-runway-body">{step.what}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  last,
}: {
  label: string;
  value: string;
  accent?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-[10px] ${
        last ? "" : "border-b border-runway-line-soft"
      }`}
    >
      <dt className="text-[13px] text-runway-mute">{label}</dt>
      <dd className={`runway-num text-[13px] ${accent ?? "text-runway-text"}`}>{value}</dd>
    </div>
  );
}
