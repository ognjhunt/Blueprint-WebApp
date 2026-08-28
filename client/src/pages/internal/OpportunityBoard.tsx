/**
 * OpportunityBoard — the screen where a robot team browses qualified sites.
 *
 * This is the design mock for the board: a dense, filterable list where every
 * row is a site-task with its acceptance bar and commercial band already
 * written down, so proposals are comparable by construction.
 *
 * All data is the `opportunityBoardPreview` fixture. The route is internal and
 * noindex, and the preview banner is not optional — see the fixture's header
 * for why that matters here.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";

import { SEO } from "@/components/SEO";
import {
  PREVIEW_NOTICE,
  boardListings,
  formatBand,
  provenanceMeta,
  statusMeta,
  taskFamilies,
  type BoardListing,
  type ListingStatus,
} from "@/data/opportunityBoardPreview";

type FilterState = {
  families: Set<string>;
  statuses: Set<ListingStatus>;
};

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function CheckBox({ on }: { on: boolean }) {
  return on ? (
    <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center border border-runway-signal bg-runway-signal">
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M1.5 5.5 L4 8 L8.5 2"
          stroke="#171200"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  ) : (
    <span className="h-[15px] w-[15px] shrink-0 border border-runway-line-strong" />
  );
}

function FilterRow({
  label,
  count,
  on,
  onToggle,
}: {
  label: string;
  count: number;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={`${label}, ${count} listing${count === 1 ? "" : "s"}`}
      className="flex w-full items-center justify-between gap-3 py-[3px] text-left transition-colors hover:text-runway-text"
    >
      <span className="flex items-center gap-[10px] text-[13px] text-runway-body">
        <CheckBox on={on} />
        {label}
      </span>
      <span className="runway-num text-[11px] text-runway-faint">{count}</span>
    </button>
  );
}

function StatusChipFor({ status, entrants }: { status: ListingStatus; entrants: number | null }) {
  const meta = statusMeta[status];
  const suffix =
    status === "eval-open" && entrants !== null ? (entrants === 0 ? " · New" : ` · ${entrants}`) : "";
  return (
    <span className={`runway-chip ${meta.chip}`}>
      {meta.label.toUpperCase()}
      {suffix}
    </span>
  );
}

export default function OpportunityBoard() {
  const [filters, setFilters] = useState<FilterState>({
    families: new Set<string>(),
    statuses: new Set<ListingStatus>(),
  });

  const rows = useMemo(() => {
    return boardListings.filter((listing) => {
      const familyOk = filters.families.size === 0 || filters.families.has(listing.familyId);
      const statusOk = filters.statuses.size === 0 || filters.statuses.has(listing.status);
      return familyOk && statusOk;
    });
  }, [filters]);

  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of boardListings) {
      counts.set(listing.familyId, (counts.get(listing.familyId) ?? 0) + 1);
    }
    return counts;
  }, []);

  const statusCounts = useMemo(() => {
    const counts = new Map<ListingStatus, number>();
    for (const listing of boardListings) {
      counts.set(listing.status, (counts.get(listing.status) ?? 0) + 1);
    }
    return counts;
  }, []);

  const openCount = boardListings.filter((listing) => listing.status === "eval-open").length;
  const filtered = filters.families.size > 0 || filters.statuses.size > 0;

  return (
    <div className="min-h-screen bg-runway-deep text-runway-text">
      <SEO
        title="Opportunity board preview | Blueprint"
        description="Design preview of the Blueprint opportunity board."
        noIndex
      />

      {/* Preview banner. Not dismissible: the whole page is invented data. */}
      <div className="border-b border-runway-signal-dim bg-runway-signal/[0.07] px-6 py-3 lg:px-8">
        <p className="mx-auto flex max-w-[92rem] items-center gap-3 font-mono text-[10.5px] uppercase leading-[1.6] tracking-[0.1em] text-runway-signal">
          <span aria-hidden="true" className="h-[6px] w-[6px] shrink-0 rounded-full bg-runway-signal" />
          {PREVIEW_NOTICE}
        </p>
      </div>

      <header className="border-b border-runway-line px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[92rem] flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="runway-eyebrow">Eval → Pilot → Deploy</p>
            <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] font-bold uppercase leading-[0.96] tracking-[0.005em]">
              Open evals · Austin
            </h1>
            <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.65] text-runway-mute">
              Sanitized teasers only: industry, region, task, economics and scale. Operator name,
              address and contacts stay withheld until a team is awarded the work.
            </p>
          </div>
          <dl className="flex shrink-0 gap-px border border-runway-line bg-runway-line">
            <div className="bg-runway-panel px-5 py-4">
              <dt className="runway-meta">Listings</dt>
              <dd className="runway-num mt-1 text-[1.6rem] leading-none">{boardListings.length}</dd>
            </div>
            <div className="bg-runway-panel px-5 py-4">
              <dt className="runway-meta">Eval open</dt>
              <dd className="runway-num mt-1 text-[1.6rem] leading-none text-runway-signal">{openCount}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-0 lg:grid-cols-[254px_minmax(0,1fr)]">
        {/* ---- filter rail ---- */}
        <aside className="border-b border-runway-line px-6 py-6 lg:border-b-0 lg:border-r lg:px-8">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">Filters</p>
            <button
              type="button"
              onClick={() => setFilters({ families: new Set(), statuses: new Set() })}
              disabled={!filtered}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-runway-signal transition-colors hover:text-runway-signal-lit disabled:text-runway-faint"
            >
              Clear
            </button>
          </div>

          <div className="mt-5 border-t border-runway-line-soft pt-5">
            <p className="runway-label">Task family</p>
            <div className="flex flex-col gap-[6px]">
              {taskFamilies.map((family) => (
                <FilterRow
                  key={family.id}
                  label={family.label}
                  count={familyCounts.get(family.id) ?? 0}
                  on={filters.families.has(family.id)}
                  onToggle={() =>
                    setFilters((prev) => ({ ...prev, families: toggle(prev.families, family.id) }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-5 border-t border-runway-line-soft pt-5">
            <p className="runway-label">Status</p>
            <div className="flex flex-col gap-[6px]">
              {(Object.keys(statusMeta) as ListingStatus[]).map((status) => (
                <FilterRow
                  key={status}
                  label={statusMeta[status].label}
                  count={statusCounts.get(status) ?? 0}
                  on={filters.statuses.has(status)}
                  onToggle={() =>
                    setFilters((prev) => ({ ...prev, statuses: toggle(prev.statuses, status) }))
                  }
                />
              ))}
            </div>
          </div>

          <p className="mt-6 border-t border-runway-line-soft pt-5 text-[12px] leading-[1.55] text-runway-faint">
            Sites that did not qualify stay on the board with the reason attached. A board that only
            shows wins is not evidence.
          </p>
        </aside>

        {/* ---- the board ---- */}
        <section className="px-6 py-6 lg:px-8">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <p className="runway-meta">
              {rows.length} of {boardListings.length} shown
              {filtered ? " · filtered" : ""}
            </p>
            <p className="runway-meta">Sorted by decision date</p>
          </div>

          <div className="overflow-x-auto">
            <table className="runway-table min-w-[56rem]">
              <caption className="sr-only">
                Qualified site-tasks open to robot teams. Preview data.
              </caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Site · vertical</th>
                  <th scope="col">Task</th>
                  <th scope="col">Human cycle</th>
                  <th scope="col">Success gate</th>
                  <th scope="col">Pilot band</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((listing) => (
                  <BoardRow key={listing.id} listing={listing} />
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 ? (
            <p className="mt-6 border border-dashed border-runway-line-strong p-6 text-center text-[14px] text-runway-mute">
              No listing matches those filters.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 border-t border-runway-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="runway-meta">
              Identity withheld until award · $1,000 to evaluate · $10,000 total if you win
            </p>
            <p className="runway-meta">
              <span className="inline-flex items-center gap-[6px]">
                <span aria-hidden="true" className={`h-[5px] w-[5px] rounded-full ${provenanceMeta.measured.dot}`} />
                Measured on site
              </span>
              <span aria-hidden="true" className="mx-3 text-runway-faint">
                ·
              </span>
              <span className="inline-flex items-center gap-[6px]">
                <span aria-hidden="true" className={`h-[5px] w-[5px] rounded-full ${provenanceMeta["site-reported"].dot}`} />
                Site-reported
              </span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function BoardRow({ listing }: { listing: BoardListing }) {
  const disqualified = listing.status === "did-not-qualify";

  if (disqualified) {
    return (
      <tr className="opacity-60">
        <td className="whitespace-nowrap">
          <span className="runway-num text-[13px] font-semibold text-runway-faint">{listing.id}</span>
        </td>
        <td>
          {listing.vertical}
          <span className="mt-[2px] block text-[11px] text-runway-faint">{listing.area}</span>
        </td>
        <td colSpan={5}>
          <span className="text-[12.5px] text-runway-mute">{listing.note}</span>
        </td>
        <td>
          <StatusChipFor status={listing.status} entrants={listing.entrants} />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="whitespace-nowrap">
        <Link
          href={`/internal/opportunity-board/${listing.id}/anonymous`}
          className="runway-num text-[13px] font-semibold text-runway-signal transition-colors hover:text-runway-signal-lit"
        >
          {listing.id}
        </Link>
      </td>
      <td>
        {listing.vertical}
        <span className="mt-[2px] block text-[11px] text-runway-faint">{listing.area}</span>
      </td>
      <td>{listing.task}</td>
      <td className="whitespace-nowrap">
        <span className="runway-num text-[12.5px]">
          {listing.humanCycleSeconds === null ? "—" : `${listing.humanCycleSeconds}s`}
        </span>
        {listing.cycleProvenance === "site-reported" && listing.humanCycleSeconds !== null ? (
          <span className="mt-[2px] block font-mono text-[9px] uppercase tracking-[0.1em] text-runway-sky">
            Site-reported
          </span>
        ) : null}
      </td>
      <td className="whitespace-nowrap">
        <span className="runway-num text-[12.5px]">{listing.successGate}</span>
      </td>
      <td className="whitespace-nowrap">
        <span className="runway-num text-[12.5px]">{formatBand(listing.pilotBand)}</span>
      </td>
      <td className="whitespace-nowrap">
        <span className="runway-num text-[12.5px]">{listing.decision ?? "—"}</span>
      </td>
      <td className="whitespace-nowrap">
        <StatusChipFor status={listing.status} entrants={listing.entrants} />
      </td>
    </tr>
  );
}
