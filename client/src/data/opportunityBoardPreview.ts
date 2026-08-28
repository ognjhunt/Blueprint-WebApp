/**
 * Opportunity board — preview fixture.
 *
 * This is a DESIGN MOCK. Every listing below is invented to exercise the board
 * layout; none of it describes a real facility, a real operator, a real
 * measurement, or a real commercial term.
 *
 * That distinction is load-bearing in this repo, which forbids fake supply and
 * fabricated operational states on the public surface. Two things keep this
 * fixture on the right side of that line:
 *
 *   1. It renders only under `/internal/*`, which is noindex and is not linked
 *      from the public navigation.
 *   2. Every surface that renders it must carry the preview banner and the
 *      per-row demo marking. `PREVIEW_NOTICE` exists so that labelling is a
 *      shared constant rather than something each view remembers to repeat.
 *
 * If any of this is ever promoted to a public route it has to be replaced by
 * Pipeline-backed records first — not relabelled.
 */

export const PREVIEW_NOTICE =
  "Design preview. Every listing on this page is invented to demonstrate the layout — not a real site, measurement, or commercial term.";

export type ListingStatus =
  | "eval-open"
  | "shortlisting"
  | "onsite-week"
  | "pilot-live"
  | "qualifying"
  | "did-not-qualify";

/** Which of the four screening conditions a captured site cleared. */
export type GateId = "fixed-scene" | "bounded-task" | "known-objects" | "clear-window";

/**
 * How a figure on a listing was established. The board never shows a number
 * without one, which is the same discipline the public figures follow.
 */
export type Provenance = "measured" | "site-reported" | "benchmark";

export interface TaskFamily {
  id: string;
  label: string;
}

export const taskFamilies: readonly TaskFamily[] = [
  { id: "tote-case", label: "Tote and case handling" },
  { id: "palletizing", label: "Palletizing" },
  { id: "machine-tending", label: "Machine tending" },
  { id: "textile", label: "Textile and laundry" },
  { id: "kitting", label: "Kitting and sequencing" },
];

export interface BoardListing {
  id: string;
  /** Vertical, not operator: identity is withheld until a site shortlists. */
  vertical: string;
  area: string;
  task: string;
  familyId: TaskFamily["id"];
  /** Median human cycle time in seconds, or null while a site is qualifying. */
  humanCycleSeconds: number | null;
  /** The acceptance bar, written the way the contract states it. */
  successGate: string;
  /** Pilot fee band floor and ceiling, in whole dollars. */
  pilotBand: [number, number] | null;
  decision: string | null;
  status: ListingStatus;
  /** Teams currently inside the eval. Null where the state has no count. */
  entrants: number | null;
  gatesCleared: readonly GateId[];
  cycleProvenance: Provenance;
  /** Present only on the row the detail view expands. */
  note?: string;
}

export const boardListings: readonly BoardListing[] = [
  {
    id: "ATX-002",
    vertical: "Commercial laundry",
    area: "North Lamar",
    task: "Sheet feed to ironer",
    familyId: "textile",
    humanCycleSeconds: 11,
    successGate: "≥97% @ ≤16s",
    pilotBand: [20_000, 30_000],
    decision: "Sep 04",
    status: "shortlisting",
    entrants: 5,
    gatesCleared: ["fixed-scene", "bounded-task", "known-objects", "clear-window"],
    cycleProvenance: "measured",
  },
  {
    id: "ATX-007",
    vertical: "3PL fulfillment",
    area: "Del Valle",
    task: "Tote induct & decant",
    familyId: "tote-case",
    humanCycleSeconds: 18,
    successGate: "≥96% @ ≤27s",
    pilotBand: [25_000, 35_000],
    decision: "Sep 18",
    status: "eval-open",
    entrants: 3,
    gatesCleared: ["fixed-scene", "bounded-task", "known-objects", "clear-window"],
    cycleProvenance: "measured",
    note: "Two tote types, 14 rigid SKUs, 0.2–5.4 kg. Exceptions run 3.1% of cycles and are flagged to a lane, not solved.",
  },
  {
    id: "ATX-001",
    vertical: "Returns processing",
    area: "NE Austin",
    task: "Polybag open & sort",
    familyId: "tote-case",
    humanCycleSeconds: 9,
    successGate: "≥94% @ ≤14s",
    pilotBand: [20_000, 30_000],
    decision: "Sep 25",
    status: "eval-open",
    entrants: 1,
    gatesCleared: ["fixed-scene", "bounded-task", "clear-window"],
    cycleProvenance: "measured",
  },
  {
    id: "ATX-004",
    vertical: "Injection molding",
    area: "Round Rock",
    task: "Press unload to cooling rack",
    familyId: "machine-tending",
    humanCycleSeconds: 38,
    successGate: "≥98% @ ≤55s",
    pilotBand: [30_000, 45_000],
    decision: "Oct 02",
    status: "onsite-week",
    entrants: 2,
    gatesCleared: ["fixed-scene", "bounded-task", "known-objects", "clear-window"],
    cycleProvenance: "measured",
  },
  {
    id: "ATX-003",
    vertical: "Tortilla plant",
    area: "East Austin",
    task: "Case pack, 12-count",
    familyId: "tote-case",
    humanCycleSeconds: 15,
    successGate: "≥97% @ ≤22s",
    pilotBand: [25_000, 40_000],
    decision: "Oct 09",
    status: "eval-open",
    entrants: 2,
    gatesCleared: ["fixed-scene", "bounded-task", "known-objects", "clear-window"],
    cycleProvenance: "measured",
  },
  {
    id: "ATX-006",
    vertical: "Auto components DC",
    area: "Georgetown",
    task: "Mixed-case palletize",
    familyId: "palletizing",
    humanCycleSeconds: 26,
    successGate: "≥95% @ ≤34s",
    pilotBand: [30_000, 45_000],
    decision: "Oct 16",
    status: "eval-open",
    entrants: 0,
    gatesCleared: ["fixed-scene", "bounded-task", "known-objects"],
    cycleProvenance: "measured",
  },
  {
    id: "ATX-005",
    vertical: "Restaurant commissary",
    area: "St. Elmo",
    task: "Napkin fold & bin stack",
    familyId: "textile",
    humanCycleSeconds: 6,
    successGate: "1,500/shift, stacked",
    pilotBand: [15_000, 25_000],
    decision: null,
    status: "pilot-live",
    entrants: null,
    gatesCleared: ["fixed-scene", "bounded-task", "known-objects", "clear-window"],
    cycleProvenance: "measured",
  },
  {
    id: "ATX-008",
    vertical: "Tier-1 auto supplier",
    area: "Kyle",
    task: "Kit sequencing to line",
    familyId: "kitting",
    humanCycleSeconds: 42,
    successGate: "Set at listing",
    pilotBand: [35_000, 50_000],
    decision: null,
    status: "qualifying",
    entrants: null,
    gatesCleared: ["bounded-task"],
    cycleProvenance: "site-reported",
  },
  {
    id: "ATX-009",
    vertical: "Grocery distribution",
    area: "Pflugerville",
    task: "Nightly re-slot and replenish",
    familyId: "tote-case",
    humanCycleSeconds: null,
    successGate: "—",
    pilotBand: null,
    decision: null,
    status: "did-not-qualify",
    entrants: null,
    gatesCleared: ["bounded-task", "known-objects"],
    cycleProvenance: "site-reported",
    note: "Nightly re-slotting fails the fixed-scene gate. Gap report delivered; re-screen offered after a slotting freeze.",
  },
];

/** Copy for each status, kept next to the chip tone so they cannot drift. */
export const statusMeta: Record<
  ListingStatus,
  { label: string; chip: string; countable: boolean }
> = {
  "eval-open": { label: "Eval open", chip: "runway-chip-open", countable: true },
  shortlisting: { label: "Shortlisting", chip: "runway-chip-neutral", countable: true },
  "onsite-week": { label: "On-site week", chip: "runway-chip-neutral", countable: true },
  "pilot-live": { label: "Pilot live", chip: "runway-chip-live", countable: true },
  qualifying: { label: "Qualifying", chip: "runway-chip-quiet", countable: false },
  "did-not-qualify": { label: "Did not qualify", chip: "runway-chip-fail", countable: false },
};

export const gateMeta: Record<GateId, { label: string; test: string }> = {
  "fixed-scene": { label: "Fixed scene", test: "Does the work area stay put between shifts?" },
  "bounded-task": { label: "Bounded task", test: "One repeated job, not a category of jobs?" },
  "known-objects": { label: "Known objects", test: "Can everything handled be enumerated in advance?" },
  "clear-window": { label: "Clear window", test: "Is there a period with no untrained people in the space?" },
};

export const provenanceMeta: Record<Provenance, { label: string; dot: string }> = {
  measured: { label: "Measured", dot: "bg-runway-green" },
  "site-reported": { label: "Site-reported", dot: "bg-runway-sky" },
  benchmark: { label: "Benchmark", dot: "bg-runway-signal" },
};

/** Money on the board is a band, never a point estimate. */
export function formatBand(band: BoardListing["pilotBand"]): string {
  if (!band) return "—";
  const k = (n: number) => `${Math.round(n / 1000)}K`;
  return `$${k(band[0])}–${k(band[1])}`;
}
