import { Helmet } from "@/lib/helmet";
import { Plus } from "lucide-react";

import {
  Button,
  Eyebrow,
  StatusChip,
  type StatusChipProps,
} from "@/components/blueprint";
import { OpsShell } from "@/components/blueprint/ops/OpsShell";
import {
  CITY_LAUNCH_COLUMNS,
  type CityCard as CityCardData,
  type CityColumn,
} from "@/components/blueprint/ops/mockData";
import { cn } from "@/lib/utils";

/**
 * City launch — /ops/city-launch
 *
 * A 4-column kanban board (Scouting -> Supply build -> Demand matched -> Live).
 * Each city card carries a signal top-border keyed to its column stage and
 * shows a headline metric, a mono detail line, the city id, and an owner.
 *
 * Illustrative data only — there is no backend behind these counts. Values
 * read as realistic but clearly synthetic so the board renders the full spec
 * without implying real supply, demand, or operational state.
 */

const SIGNAL_HEX: Record<CityCardData["signal"], string> = {
  proof: "#1f6b4f",
  warn: "#9a6a16",
  info: "#2563a6",
  neutral: "#c8bfac",
};

const STAGE_CHIP_TONE: Record<CityColumn["stage"], StatusChipProps["tone"]> = {
  scouting: "neutral",
  "supply-build": "warn",
  "demand-matched": "info",
  live: "proof",
};

function CityCard({ card }: { card: CityCardData }) {
  return (
    <article
      className="border border-line bg-white shadow-sm"
      style={{ borderTop: `3px solid ${SIGNAL_HEX[card.signal]}` }}
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[0.95rem] font-semibold leading-tight tracking-[-0.01em] text-ink-900">
            {card.city}
          </h3>
          <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.08em] text-ink-400">
            {card.id}
          </span>
        </div>

        <p className="font-mono text-[0.8rem] font-medium leading-snug text-ink-900">
          {card.metric}
        </p>

        <p className="font-mono text-[0.72rem] leading-relaxed text-ink-500">
          {card.detail}
        </p>

        <div className="mt-1 border-t border-line-soft pt-3">
          <span className="text-[0.72rem] leading-tight text-ink-500">
            {card.owner}
          </span>
        </div>
      </div>
    </article>
  );
}

function CityColumnView({ column }: { column: CityColumn }) {
  const tone = STAGE_CHIP_TONE[column.stage];
  return (
    <section className="flex min-w-0 flex-col">
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-ink-700">
          {column.title}
        </h2>
        <StatusChip tone={tone} square dot={false} className="tabular-nums">
          {column.cards.length}
        </StatusChip>
      </div>

      {/* Cards */}
      <div className="mt-4 flex flex-col gap-3">
        {column.cards.length > 0 ? (
          column.cards.map((card) => <CityCard key={card.id} card={card} />)
        ) : (
          <div className="border border-dashed border-line px-4 py-6 text-center text-[0.75rem] text-ink-400">
            No cities in this stage.
          </div>
        )}
      </div>
    </section>
  );
}

export default function CityLaunch() {
  const totalCities = CITY_LAUNCH_COLUMNS.reduce(
    (sum, column) => sum + column.cards.length,
    0,
  );

  return (
    <>
      <Helmet>
        <title>City launch · Blueprint Ops</title>
        <meta
          name="description"
          content="Internal ops console — city launch pipeline from scouting to live. Illustrative data, not live supply or readiness."
        />
      </Helmet>

      <OpsShell
        active="city-launch"
        title="City launch"
        sub={`${totalCities} cities · scouting → live`}
        actions={
          <Button variant="brass" size="sm" iconLeft={<Plus aria-hidden="true" />}>
            Scout a city
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow tone="muted" rule>
              Launch pipeline
            </Eyebrow>
            <p className="max-w-[46rem] text-body-s leading-relaxed text-ink-500">
              Cities move left to right as supply and demand come together.
              Card top-borders carry the stage signal — neutral while scouting,
              amber during supply build, blue once demand is matched, green when
              live. Counts are illustrative, not a live operational state.
            </p>
          </div>

          {/* Kanban board */}
          <div
            className={cn(
              "grid grid-cols-1 gap-x-px gap-y-8 overflow-hidden",
              "sm:grid-cols-2 sm:gap-y-0 sm:gap-x-6",
              "xl:grid-cols-4",
            )}
          >
            {CITY_LAUNCH_COLUMNS.map((column) => (
              <CityColumnView key={column.stage} column={column} />
            ))}
          </div>
        </div>
      </OpsShell>
    </>
  );
}
