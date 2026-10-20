/**
 * A few tape-measure readings of the work, taken where it happens.
 *
 * The scene an evaluation runs in is rebuilt from footage, and footage has no
 * ruler: website scenes carry estimated metres. These readings are what
 * Blueprint checks the rebuilt scene against before an evaluation can count
 * toward a recommendation. They are evidence for review, never a result.
 *
 * Entry stays light. Nothing is required, there is no robot, budget or
 * simulation question, and each reading keeps the unit it was typed in, so a
 * saved 30 inches never quietly becomes 30 cm. Entry is text, read strictly:
 * a decimal point or comma, or inches as a tape shows them ("30 1/4"); what
 * cannot be read is refused, never dropped. Owner and film-only links see the
 * same form (founder decision, 2026-10-19): the person holding the tape is
 * often the colleague who films. The server records which link saved each
 * reading, and the name field is never pre-filled with someone else's name.
 * If someone else saved first, what this person typed is kept and only the
 * fields they did not touch take the newer values.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { withCsrfHeader } from "@/lib/csrf";
import { SITE_MEASUREMENTS_SAVED_EVENT } from "@/data/robotFit";
import {
  ARTICULATIONS,
  REFERENCE_PAPERS,
  REFERENCE_SHEET_BOUNDS_M,
  REFERENCE_SHEET_SAMPLE_ID,
  SITE_MEASUREMENT_FAMILIES,
  UNIT_LABELS,
  familySpec,
  parseReading,
  readingsFor,
  toSi,
  unitsFor,
  type Articulation,
  type EntryUnit,
  type MeasurementFamily,
  type MeasurementQuantity,
  type MeasurementReading,
  type MeasurementSaveInput,
  type PresentedSiteMeasurements,
  type ReferencePaper,
} from "@/data/siteMeasurements";

type Entry = { value: string; unit: EntryUnit };
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const ARTICULATION_LABELS: Record<Articulation, string> = {
  hinged: "On hinges, like a door or lid",
  sliding: "It slides out, like a drawer",
};

const PAPER_LABELS: Record<ReferencePaper, string> = {
  letter: "Yes, US Letter",
  a4: "Yes, A4",
  other: "Yes, another size",
  none: "No",
};

const SHEET_READING = familySpec("rigid_pick_place").readings.find(
  (reading) => reading.sampleId === REFERENCE_SHEET_SAMPLE_ID,
)!;

/** US browsers start in inches and pounds; any reading's unit can be changed. */
function defaultUnit(quantity: MeasurementQuantity): EntryUnit {
  const imperial = typeof navigator !== "undefined" && /^en-US\b/i.test(navigator.language || "");
  return unitsFor(quantity)[imperial ? 1 : 0];
}

function ReadingRow({ id, reading, entry, onChange }: {
  id: string;
  reading: MeasurementReading;
  entry: Entry;
  onChange: (entry: Entry) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label htmlFor={id}>{reading.label}</label>
      <span id={`${id}-hint`} className="ms-field-hint">{reading.hint}</span>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 7.5rem", gap: "8px" }}>
        <input id={id} type="text" inputMode="decimal" autoComplete="off" value={entry.value}
          aria-describedby={`${id}-hint`} onChange={(event) => onChange({ ...entry, value: event.target.value })} />
        <select aria-label={`Unit for ${reading.label}`} value={entry.unit}
          onChange={(event) => onChange({ ...entry, unit: event.target.value as EntryUnit })}>
          {unitsFor(reading.quantity).map((unit) => <option key={unit} value={unit}>{UNIT_LABELS[unit]}</option>)}
        </select>
      </div>
    </div>
  );
}

export function SiteMeasurementsPanel({ token }: { token: string }) {
  const ids = useId();
  const [loaded, setLoaded] = useState<"loading" | "ready" | "failed">("loading");
  const [revision, setRevision] = useState(0);
  const [family, setFamily] = useState<MeasurementFamily | null>(null);
  const [articulation, setArticulation] = useState<Articulation | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [paper, setPaper] = useState<ReferencePaper | null>(null);
  const [sheet, setSheet] = useState<Entry>(() => ({ value: "", unit: defaultUnit("length") }));
  const [measuredBy, setMeasuredBy] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // What this person changed since the last load or save: kept if a newer save arrives first.
  const touched = useRef(new Set<string>());
  const touch = (key: string) => touched.current.add(key);

  const adopt = useCallback((data: PresentedSiteMeasurements, mode: "replace" | "merge" = "replace") => {
    const keep = mode === "merge" ? new Set(touched.current) : new Set<string>();
    setRevision(data.revision);
    if (!keep.has("family")) setFamily(data.family);
    if (!keep.has("articulation")) setArticulation(data.articulation);
    const saved: Record<string, Entry> = Object.fromEntries(Object.entries(data.readings ?? {}).map(
      ([sampleId, reading]) => [sampleId, { value: String(reading.value), unit: reading.unit }]));
    setEntries((current) => {
      const next = { ...saved };
      for (const key of keep) {
        if (!key.startsWith("reading:")) continue;
        const sampleId = key.slice("reading:".length);
        if (current[sampleId]) next[sampleId] = current[sampleId];
      }
      return next;
    });
    if (!keep.has("paper")) setPaper(data.referencePaper);
    if (!keep.has("sheet")) {
      setSheet(data.referenceSheetLongEdge
        ? { value: String(data.referenceSheetLongEdge.value), unit: data.referenceSheetLongEdge.unit }
        : { value: "", unit: defaultUnit("length") });
    }
    if (!keep.has("note")) setNote(data.note ?? "");
    if (mode === "replace") touched.current = new Set();
  }, []);

  const load = useCallback(async () => {
    setLoaded("loading");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/measurements`);
      if (!response.ok) {
        setLoaded("failed");
        return;
      }
      adopt((await response.json()) as PresentedSiteMeasurements);
      setLoaded("ready");
    } catch {
      setLoaded("failed");
    }
  }, [token, adopt]);

  useEffect(() => {
    void load();
  }, [load]);

  const readings = useMemo(() => family
    ? readingsFor(family, articulation).filter((reading) => reading.sampleId !== REFERENCE_SHEET_SAMPLE_ID)
    : [], [family, articulation]);

  const entryFor = (reading: MeasurementReading): Entry =>
    entries[reading.sampleId] ?? { value: "", unit: defaultUnit(reading.quantity) };

  function problem(): string | null {
    if (family === "articulated_open_close" && !articulation) return "Say whether it opens on hinges or slides out.";
    for (const reading of readings) {
      const entry = entries[reading.sampleId];
      const value = entry ? parseReading(entry.value) : undefined;
      if (value === undefined) continue;
      if (value === null) return `${reading.label}: enter a number, such as 76.5 or 30 1/4.`;
      if (value <= 0) return `${reading.label}: enter a number above zero.`;
      if (toSi(value, entry!.unit) > reading.maxSi) {
        return `${reading.label}: ${entry!.value.trim()} ${UNIT_LABELS[entry!.unit]} is more than this reading can be. Check the units.`;
      }
    }
    if (paper === "other") {
      const edge = parseReading(sheet.value);
      const si = typeof edge === "number" ? toSi(edge, sheet.unit) : NaN;
      if (!(si >= REFERENCE_SHEET_BOUNDS_M.min && si <= REFERENCE_SHEET_BOUNDS_M.max)) {
        return "Enter the length of the sheet's long edge, between 10 and 100 cm (4 and 39 inches).";
      }
    }
    return null;
  }

  async function save() {
    if (!family || status.kind === "saving") return;
    const issue = problem();
    if (issue) {
      setStatus({ kind: "error", message: issue });
      return;
    }
    const body: MeasurementSaveInput = {
      revision,
      family,
      articulation: family === "articulated_open_close" ? articulation : null,
      readings: Object.fromEntries(readings.flatMap((reading) => {
        const entry = entries[reading.sampleId];
        const value = entry ? parseReading(entry.value) : undefined;
        return typeof value === "number" ? [[reading.sampleId, { value, unit: entry!.unit }]] : [];
      })),
      referencePaper: paper,
      referenceSheetLongEdge: paper === "other" ? { value: parseReading(sheet.value) as number, unit: sheet.unit } : null,
      measuredBy: measuredBy.trim() || null,
      note: note.trim() || null,
    };
    setStatus({ kind: "saving" });
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/measurements`, {
        method: "PUT",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<PresentedSiteMeasurements> & { error?: string };
      if (response.ok) {
        adopt(data as PresentedSiteMeasurements);
        setStatus({ kind: "saved" });
        // The robot-fit read above rests on these readings; let it refresh in place.
        window.dispatchEvent(new Event(SITE_MEASUREMENTS_SAVED_EVENT));
        return;
      }
      if (response.status === 409 && typeof data.revision === "number") {
        adopt(data as PresentedSiteMeasurements, "merge");
        setStatus({ kind: "error", message: "Someone else saved measurements for this job after you opened it. "
          + "What you typed is kept, and their readings fill the rest; check them and save again." });
        return;
      }
      setStatus({ kind: "error", message: data.error || "We could not save the measurements. Try again." });
    } catch {
      setStatus({ kind: "error", message: "We could not reach Blueprint. Try again shortly." });
    }
  }

  if (loaded === "loading") return <p className="ms-field-hint">Loading the measurements…</p>;
  if (loaded === "failed") {
    return (
      <div>
        <p role="alert" className="ms-field-hint">We could not load the measurements.</p>
        <button type="button" className="ms-text-link" onClick={() => void load()}>Try again</button>
      </div>
    );
  }

  const changed = () => setStatus((current) => (current.kind === "saving" ? current : { kind: "idle" }));

  return (
    <section className="ms-form" aria-label="Measurements" style={{ gap: "18px" }}>
      <div>
        <h3 style={{ margin: "0 0 6px" }}>Measurements</h3>
        <p className="ms-field-hint">
          A few tape-measure readings let Blueprint check the rebuilt scene against your site. An evaluation can
          count toward a recommendation only after that check.
        </p>
        <p className="ms-field-hint">
          Every reading is optional: leave blank anything you cannot measure. Blueprint reviews the readings with
          your footage; they never decide a result on their own.
        </p>
      </div>

      <fieldset className="ms-choice">
        <legend>What does the job do?</legend>
        {SITE_MEASUREMENT_FAMILIES.map((spec) => (
          <label key={spec.family} className="ms-check-row">
            <input type="radio" name={`${ids}-family`} value={spec.family} checked={family === spec.family}
              onChange={() => { setFamily(spec.family); touch("family"); changed(); }} />
            <span>{spec.label}</span>
          </label>
        ))}
      </fieldset>

      {family === "articulated_open_close" && (
        // The current website route evaluates rigid pick and place on one surface (site guide).
        <p className="ms-field-hint">
          Blueprint confirms a door, drawer or lid job with you before any evaluation. Your readings stay with the
          job either way.
        </p>
      )}

      {family === "articulated_open_close" && (
        <fieldset className="ms-choice">
          <legend>How does it open?</legend>
          {ARTICULATIONS.map((value) => (
            <label key={value} className="ms-check-row">
              <input type="radio" name={`${ids}-articulation`} value={value} checked={articulation === value}
                onChange={() => { setArticulation(value); touch("articulation"); changed(); }} />
              <span>{ARTICULATION_LABELS[value]}</span>
            </label>
          ))}
        </fieldset>
      )}

      {family && (
        <>
          {readings.map((reading) => (
            <ReadingRow key={reading.sampleId} id={`${ids}-${reading.sampleId}`} reading={reading} entry={entryFor(reading)}
              onChange={(entry) => {
                setEntries((current) => ({ ...current, [reading.sampleId]: entry }));
                touch(`reading:${reading.sampleId}`);
                changed();
              }} />
          ))}

          <fieldset className="ms-choice" aria-describedby={`${ids}-sheet-hint`}>
            <legend>Was a sheet of printer paper lying flat on the work surface while you filmed?</legend>
            <span id={`${ids}-sheet-hint`} className="ms-field-hint">
              A sheet in view gives the scene a known size. If you have not filmed yet, lay one down before you start.
            </span>
            {REFERENCE_PAPERS.map((value) => (
              <label key={value} className="ms-check-row">
                <input type="radio" name={`${ids}-paper`} value={value} checked={paper === value}
                  onChange={() => { setPaper(value); touch("paper"); changed(); }} />
                <span>{PAPER_LABELS[value]}</span>
              </label>
            ))}
          </fieldset>
          {paper === "other" && (
            <ReadingRow id={`${ids}-sheet`} reading={SHEET_READING} entry={sheet}
              onChange={(entry) => { setSheet(entry); touch("sheet"); changed(); }} />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor={`${ids}-note`}>Anything you could not measure, or that was hard to measure? (optional)</label>
            <textarea id={`${ids}-note`} rows={3} maxLength={1000} value={note}
              onChange={(event) => { setNote(event.target.value); touch("note"); changed(); }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor={`${ids}-name`}>Your name (optional)</label>
            <span id={`${ids}-name-hint`} className="ms-field-hint">So Blueprint knows who took the readings.</span>
            <input id={`${ids}-name`} type="text" maxLength={120} value={measuredBy} aria-describedby={`${ids}-name-hint`}
              onChange={(event) => { setMeasuredBy(event.target.value); changed(); }} />
          </div>

          {status.kind === "error" && <p role="alert" className="ms-error">{status.message}</p>}
          {status.kind === "saved" && (
            <p role="status" className="ms-field-hint">Measurements saved. You can correct them at any time.</p>
          )}
          <button type="button" className="ms-button" disabled={status.kind === "saving"} onClick={() => void save()}>
            {status.kind === "saving" ? "Saving…" : "Save measurements"}
          </button>
        </>
      )}
    </section>
  );
}

/**
 * The job page's disclosure. The panel mounts, and loads, only once someone
 * opens it, so the page itself makes no extra request.
 */
export function SiteMeasurementsDisclosure({ token }: { token: string }) {
  const [opened, setOpened] = useState(false);
  return (
    <details className="ms-task-interest" onToggle={(event) => { if (event.currentTarget.open) setOpened(true); }}>
      <summary>Add measurements (optional)</summary>
      {opened && <SiteMeasurementsPanel token={token} />}
    </details>
  );
}
