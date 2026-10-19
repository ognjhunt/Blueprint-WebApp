/**
 * A site's recorded measurements in the job console, and the source-document
 * export an operator retains as a qualification request's `measurement`.
 *
 * The export needs the request's binding because WebApp holds no scene,
 * task-spec, success-contract or robot-model digest before a run, and it names
 * the site as producer (`site_job:<job>`, founder decision 2026-10-19). A
 * reading that set the scene's metric scale is ticked here and left out of
 * every check. The server keeps an immutable copy of every export, listed here
 * and downloadable again, and refuses to export once recording consent is
 * withdrawn. Loaded only when opened.
 */
import { useState, type FormEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { Button, StatusChip } from "@/components/blueprint";
import {
  UNIT_LABELS,
  familySpec,
  type AdminSiteMeasurements,
  type Articulation,
  type MeasurementDimension,
  type RetainedExport,
  type RetainedExportSummary,
  type RetainedSourceMeasurementExportResponse,
  type SiteMeasurementsConsoleResponse,
} from "@/data/siteMeasurements";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

const ARTICULATION_LABELS: Record<Articulation, string> = { hinged: "hinged", sliding: "sliding" };
const PAPER_LABELS = { letter: "US Letter standard", a4: "A4 standard" } as const;

function dimensions(values: MeasurementDimension[]) {
  return values.map((value) => value.replace(/_/g, " ")).join(", ");
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
}

function download(json: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type Loaded = { status: "idle" | "loading" } | { status: "failed"; message: string }
  | { status: "ready"; measurements: AdminSiteMeasurements | null; consentRevoked: boolean; exports: RetainedExportSummary[] };

export function SiteMeasurementsConsole({ requestId, currentUser }: {
  requestId: string;
  currentUser: FirebaseUser | null;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "idle" });
  const [bindingText, setBindingText] = useState("");
  const [producerId, setProducerId] = useState(`site_job:${requestId}`);
  const [calibration, setCalibration] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exported, setExported] = useState<RetainedSourceMeasurementExportResponse | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const base = `/api/admin/jobs/${encodeURIComponent(requestId)}/site-measurements`;

  async function authorized(init: RequestInit = {}, json = false) {
    return {
      ...init,
      credentials: "include" as const,
      headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader(json ? { "Content-Type": "application/json" } : {})),
    };
  }

  /** Quiet unless first: a refresh after an export keeps the form and its result on screen. */
  async function load(quiet = false) {
    if (!quiet) setLoaded({ status: "loading" });
    try {
      const response = await fetch(base, await authorized());
      const value = (await response.json().catch(() => ({}))) as Partial<SiteMeasurementsConsoleResponse> & { error?: string };
      if (!response.ok) {
        if (!quiet) setLoaded({ status: "failed", message: String(value.error || `Request failed (${response.status})`) });
        return;
      }
      setLoaded({ status: "ready", measurements: value.measurements ?? null, consentRevoked: value.consentRevoked === true,
        exports: Array.isArray(value.exports) ? value.exports : [] });
    } catch {
      if (!quiet) setLoaded({ status: "failed", message: "The site measurements could not be loaded." });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (exporting) return;
    setExportError("");
    setExported(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(bindingText);
    } catch {
      setExportError("The binding is not valid JSON. Paste the request's binding object, or the whole request.");
      return;
    }
    // A pasted qualification request carries its binding; a pasted binding is used as is.
    const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    const binding = record.binding && typeof record.binding === "object" ? record.binding : parsed;
    setExporting(true);
    try {
      const response = await fetch(`${base}/source-document`, await authorized({
        method: "POST",
        body: JSON.stringify({ binding, producerId: producerId.trim(), calibrationSampleIds: calibration }),
      }, true));
      const value = await response.json().catch(() => ({}));
      if (!response.ok) {
        setExportError(String(value.error || `Export failed (${response.status}).`));
        return;
      }
      setExported(value as RetainedSourceMeasurementExportResponse);
      void load(true);
    } catch {
      setExportError("The export could not be sent. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  }

  async function recover(summary: RetainedExportSummary) {
    setRecoveryError("");
    try {
      const response = await fetch(`${base}/exports/${summary.sha256.slice("sha256:".length)}`, await authorized());
      const value = (await response.json().catch(() => ({}))) as Partial<RetainedExport> & { error?: string };
      if (!response.ok || typeof value.json !== "string") {
        setRecoveryError(String(value.error || `That export could not be read (${response.status}).`));
        return;
      }
      download(value.json, summary.fileName);
    } catch {
      setRecoveryError("That export could not be read. Check your connection and try again.");
    }
  }

  const ready = loaded.status === "ready" ? loaded : null;
  const measurements = ready?.measurements ?? null;

  return (
    <details onToggle={(event) => { if (event.currentTarget.open && loaded.status === "idle") void load(); }}>
      <summary className="runway-rule-head runway-meta cursor-pointer">Site measurements</summary>
      <div className="mt-4 grid gap-4">
        {loaded.status === "loading" ? <p className="text-sm text-runway-mute">Loading the site's readings…</p> : null}
        {loaded.status === "failed" ? <p className="text-sm text-runway-red">{loaded.message}</p> : null}
        {ready && !measurements ? (
          <p className="text-sm text-runway-mute">No measurements recorded for this job yet.</p>
        ) : null}
        {ready?.consentRevoked ? (
          <p className="text-sm text-runway-red">
            Recording consent was withdrawn for this job. Its measurements cannot be exported for qualification.
          </p>
        ) : null}
        {measurements ? (
          <>
            <p className="text-sm text-runway-body">
              {familySpec(measurements.family).label}
              {measurements.articulation ? ` (${ARTICULATION_LABELS[measurements.articulation]})` : ""}
              {" · "}revision {measurements.revision} · updated {dateLabel(measurements.updatedAtIso)}
            </p>
            <div className="overflow-x-auto">
              <table className="runway-table min-w-[40rem]">
                <caption className="sr-only">Readings the site recorded</caption>
                <thead><tr><th scope="col">Reading</th><th scope="col">As entered</th><th scope="col">SI</th><th scope="col">Recorded</th></tr></thead>
                <tbody>
                  {measurements.readings.map((reading) => (
                    <tr key={reading.sampleId}>
                      <td>{reading.label}<br /><span className="runway-num text-xs text-runway-faint">{reading.sampleId}</span></td>
                      <td>{reading.basis === "paper_standard"
                        ? PAPER_LABELS[measurements.referencePaper === "a4" ? "a4" : "letter"]
                        : `${reading.value} ${reading.unit ? UNIT_LABELS[reading.unit] : ""}`}</td>
                      <td className="runway-num">{`${reading.si} ${reading.siUnit}`}</td>
                      <td className="text-xs">
                        {`${reading.recordedByScope === "film" ? "Film link" : "Owner link"} · ${reading.recordedByName || "no name"}`}
                        <br />{dateLabel(reading.recordedAtIso)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {measurements.note ? <p className="text-sm text-runway-body">{measurements.note}</p> : null}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusChip tone={measurements.coverage.complete ? "proof" : "warn"} square>
                {measurements.coverage.complete ? "Every check has readings" : "Incomplete"}
              </StatusChip>
              <span className="text-runway-body">
                {measurements.coverage.complete
                  ? "Readings can fill every check."
                  : `Readings cannot fill: ${dimensions(measurements.coverage.missingDimensions)}.`}
              </span>
            </div>
            <p className="text-xs text-runway-mute">
              Site-stated readings. They become qualification evidence only as a pinned source document, beside the
              simulator's readings, under a reviewed fidelity profile.
            </p>

            {!ready?.consentRevoked ? (
              <form method="post" onSubmit={submit} className="grid gap-4" aria-label="Build the source measurement document">
                <div>
                  <label className="runway-label" htmlFor={`${requestId}-binding`}>Qualification request binding (JSON)</label>
                  <textarea id={`${requestId}-binding`} className="runway-input min-h-[8rem] w-full font-mono text-xs" required
                    value={bindingText} onChange={(event) => setBindingText(event.target.value)}
                    placeholder='{"scene_request_id": "…", "site_id": "…", "task_id": "…", … "policy_interface_id": "…"}' />
                </div>
                <div>
                  <label className="runway-label" htmlFor={`${requestId}-producer`}>Measurement producer</label>
                  <input id={`${requestId}-producer`} className="runway-input" required maxLength={192} value={producerId}
                    onChange={(event) => setProducerId(event.target.value)} />
                </div>
                <fieldset className="grid gap-2">
                  <legend className="runway-label">Readings that set the scene's metric scale (left out of every check)</legend>
                  {measurements.readings.map((reading) => (
                    <label key={reading.sampleId} className="flex items-center gap-2 text-sm text-runway-body">
                      <input type="checkbox" checked={calibration.includes(reading.sampleId)}
                        aria-label={`${reading.label} set the scene's metric scale`}
                        onChange={(event) => setCalibration((current) => event.target.checked
                          ? [...current, reading.sampleId] : current.filter((id) => id !== reading.sampleId))} />
                      {reading.label}
                    </label>
                  ))}
                </fieldset>
                {exportError ? <p role="alert" className="text-sm text-runway-red">{exportError}</p> : null}
                <div><Button type="submit" size="sm" disabled={exporting}>{exporting ? "Building…" : "Build source document"}</Button></div>
              </form>
            ) : null}

            {exported ? (
              <div role="status" className="grid gap-2 border border-runway-green-dim p-4 text-sm text-runway-body">
                <p>Retain these exact bytes as the request's measurement artifact.</p>
                <p className="runway-num break-all text-runway-text">{exported.sha256}</p>
                <p>
                  {exported.sampleCount} {exported.sampleCount === 1 ? "sample" : "samples"}, {exported.sizeBytes} bytes.
                  {exported.coverage.complete
                    ? " Every check has its minimum readings."
                    : ` Cannot fill: ${dimensions(exported.coverage.missingDimensions)}. The qualifier will refuse these checks.`}
                </p>
                <p className="break-all text-xs">
                  {exported.retained.alreadyRetained
                    ? `Already retained on ${dateLabel(exported.retained.retainedAtIso)} at ${exported.retained.path}.`
                    : `Retained at ${exported.retained.path}.`}
                </p>
                <div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => download(exported.json, exported.fileName)}
                    aria-label={`Download ${exported.fileName}`}>Download JSON</Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {ready && ready.exports.length ? (
          <div className="grid gap-2">
            <h4 className="runway-label">Retained exports</h4>
            <ul className="grid gap-2 text-xs text-runway-body">
              {ready.exports.map((summary) => (
                <li key={summary.sha256} className="flex flex-wrap items-center gap-3">
                  <span>{dateLabel(summary.exportedAtIso)} · revision {summary.revision} · {summary.producerId}</span>
                  <span className="runway-num break-all text-runway-faint">{summary.sha256}</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void recover(summary)}
                    aria-label={`Download retained export ${summary.sha256}`}>Download</Button>
                </li>
              ))}
            </ul>
            {recoveryError ? <p role="alert" className="text-sm text-runway-red">{recoveryError}</p> : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
