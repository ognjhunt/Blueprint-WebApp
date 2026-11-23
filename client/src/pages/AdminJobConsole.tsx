/**
 * The admin job page (`/admin/jobs`, `/admin/jobs?job=<id>`), built the way the site's own job page is built: the
 * minimal site's theme and header, and the bare-bones parts (`@/components/bare/Bare`).
 *
 * It works out nothing. The server says where each job stands, from the same outlook the site's job page shows, and
 * every other line is a record (`server/utils/jobConsoleData.ts`). Each part shows only when it has something true
 * to show (owner, 2026-11-17: "only keep stuff that is needed").
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import { BareBack, BareButton, BareLead, BareMenu, BareNotice, BareRows, BareScreen } from "@/components/bare/Bare";
import { JobCompaniesConsole } from "@/components/admin/JobCompaniesConsole";
import { SiteMeasurementsConsole } from "@/components/admin/SiteMeasurementsConsole";
import { JobWorkflowPanel } from "@/components/admin/JobWorkflowPanel";
import { RobotFitConsole } from "@/components/admin/RobotFitConsole";
import { AccountDeletionQueue } from "@/components/admin/AccountDeletionQueue";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { AdminJobDetail, AdminJobListResponse, AdminJobRow, AdminJobStop, AdminJobTotals } from "@/types/jobConsole";

/** A time in words, in the viewer's own zone; null when the record holds none that reads. */
export function timeInWords(value: string | null | undefined, withTime = true): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("en-US", withTime
    ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" });
}

function sizeInWords(bytes: number) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

const usd = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

const WHOSE: Readonly<Record<AdminJobStop["whose"], string>> = {
  site: "The site's step.",
  blueprint: "Blueprint's step.",
  none: "Nothing is left to do.",
};

function readJobParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("job");
  } catch {
    return null;
  }
}

function writeJobParam(requestId: string | null) {
  try {
    const url = new URL(window.location.href);
    if (requestId) url.searchParams.set("job", requestId);
    else url.searchParams.delete("job");
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // The page still works without a shareable address.
  }
}

function useAdminFetch() {
  const { currentUser } = useAuth();
  return {
    currentUser,
    get: async <T,>(path: string): Promise<T> => {
      const response = await fetch(path, {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(value.error || `Request failed (${response.status})`));
      return value as T;
    },
  };
}

/**
 * How long the saved package's object URL lives after the save starts. Revoking it at once can cancel the save in
 * Safari and older Firefox; FileSaver.js waits 40 seconds for the same reason.
 */
export const PACKAGE_URL_REVOKE_DELAY_MS = 40_000;

/** Fetches the package with the admin's sign-in (an address alone cannot carry it) and saves it. */
function SimulationPackageDownload({ requestId, url, helper }: { requestId: string; url: string; helper: ReactNode }) {
  const { currentUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
      });
      if (!response.ok) {
        const value = await response.json().catch(() => ({}));
        throw new Error(String(value.error || `Download failed (${response.status})`));
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `simulation-${requestId}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), PACKAGE_URL_REVOKE_DELAY_MS);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <BareButton disabled={busy} onClick={() => void download()} helper={helper}>Download the simulation package</BareButton>
    {error ? <BareNotice role="alert">{error}</BareNotice> : null}
  </>;
}

/**
 * Opens the job's scene preview in the vendored viewer. The ticket is minted with the admin's sign-in (an address alone
 * cannot carry it), so the tab is opened at the click, before the fetch, and sent to the viewer once the ticket is back.
 */
function ScenePreviewView({ url }: { url: string }) {
  const { currentUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedLink, setBlockedLink] = useState<string | null>(null);

  async function view() {
    setBusy(true);
    setError(null);
    setBlockedLink(null);
    const opened = window.open("", "_blank");
    if (opened) opened.opener = null;
    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok || typeof value.url !== "string" || !value.url.startsWith("/splat-viewer/")) {
        throw new Error(String(value.error || `The viewer could not be opened (${response.status})`));
      }
      if (opened) opened.location.href = value.url;
      else setBlockedLink(value.url);
    } catch (caught) {
      opened?.close();
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <p><button type="button" className="bare-quiet-button" disabled={busy} onClick={() => void view()}>View the simulation of the site</button></p>
    {blockedLink ? <p><a className="bare-link" href={blockedLink} target="_blank" rel="noopener noreferrer">Open the viewer</a></p> : null}
    {error ? <BareNotice role="alert">{error}</BareNotice> : null}
  </>;
}

/**
 * Which staff tools are open, kept for this browser tab: the sign-in check above the page can re-mount it and a
 * reload re-draws it, and an open tool must not snap shut under a person halfway through a form.
 */
const OPEN_TOOLS_KEY = "admin-job-open-tools";
function openTools(): Set<string> {
  try { return new Set(JSON.parse(window.sessionStorage.getItem(OPEN_TOOLS_KEY) || "[]") as string[]); } catch { return new Set(); }
}
function rememberTool(id: string, open: boolean) {
  try {
    const tools = openTools();
    if (open) tools.add(id); else tools.delete(id);
    window.sessionStorage.setItem(OPEN_TOOLS_KEY, JSON.stringify([...tools]));
  } catch {
    // Without storage a tool simply opens closed.
  }
}

/** A staff tool: closed until opened, and mounted only then, so the page reads nothing it does not show. */
function StaffTool({ id, label, children }: { id: string; label: string; children: () => ReactNode }) {
  const [open, setOpen] = useState(() => openTools().has(id));
  return <details open={open} onToggle={event => {
    const next = event.currentTarget.open;
    rememberTool(id, next);
    setOpen(next);
  }}>
    <summary>{label}</summary>
    {open ? <div className="admin-job-tool">{children()}</div> : null}
  </details>;
}

/** The job, in the site's own sentence, or the internal test's label. */
function jobLine(row: Pick<AdminJobRow, "sentence" | "internalTest">) {
  if (row.internalTest) return row.internalTest.label ? `Internal test: ${row.internalTest.label}` : "Internal test";
  return row.sentence ? `“${row.sentence}”` : "The site has not said what the job is yet.";
}

function JobPage({ requestId, onBack }: { requestId: string; onBack: () => void }) {
  const api = useAdminFetch();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["admin-job-console", "detail", requestId],
    enabled: Boolean(api.currentUser),
    queryFn: () => api.get<AdminJobDetail>(`/api/admin/jobs/${encodeURIComponent(requestId)}`),
  });
  const data = detail.data;
  const back = <BareBack onClick={onBack}>‹ All jobs</BareBack>;
  if (detail.error) return <>{back}<h1>Job</h1><BareNotice role="alert">{(detail.error as Error).message}</BareNotice></>;
  if (!data) return <>{back}<h1>Job</h1><p className="bare-helper" role="status">Loading the job…</p></>;

  const { job, standing } = data;
  const title = job.internalTest ? "Internal test" : job.site?.name || "Site job";
  const sub = job.internalTest ? job.internalTest.label : job.site?.place;
  const pack = data.simulationPackage;
  const packageHelper = pack ? [
    `${pack.files.length} ${pack.files.length === 1 ? "file" : "files"}, ${sizeInWords(pack.sizeBytes)}`,
    pack.builtAtIso ? `built ${timeInWords(pack.builtAtIso, false)}` : null,
  ].filter(Boolean).join(", ") + (pack.files.length <= 8 ? `: ${pack.files.join(", ")}.` : ".") : null;

  return <>
    {back}
    {/* 1. The job. */}
    <h1>{title}</h1>
    {sub ? <p className="bare-sub">{sub}</p> : null}
    <p className="admin-job-sentence">
      {job.sentence ? `${job.drafted ? "Read from the video: " : ""}“${job.sentence}”` : "The site has not said what the job is yet."}
    </p>
    <p className="bare-helper">Job {data.requestId}</p>

    {/* 2. Where it stands: the outlook the site's own page shows, and the records beside it. */}
    <BareRows title="Where it stands">
      <BareLead>{standing.phrase}</BareLead>
      <div className="admin-job-lines">
        {standing.siteSees ? <p>The site's page says: “{standing.siteSees}”</p> : null}
        {standing.companies ? <p>{standing.companies}</p> : null}
        {standing.pipeline ? <p>{standing.pipeline}</p> : null}
      </div>
    </BareRows>

    {/* 3. What was built. */}
    {data.simulationPackageUrl || data.scenePreviewViewUrl ? <BareRows title="What was built">
      <div className="admin-job-lines">
        {data.simulationPackageUrl
          ? <SimulationPackageDownload requestId={data.requestId} url={data.simulationPackageUrl} helper={packageHelper} /> : null}
        {data.scenePreviewViewUrl ? <ScenePreviewView url={data.scenePreviewViewUrl} /> : null}
      </div>
    </BareRows> : null}

    {/* 4. What it has cost so far: only a figure the job's ledgers hold. */}
    {data.cost ? <BareRows title="What it has cost so far">
      <BareLead>{usd(data.cost.spentOrHeldUsd)}</BareLead>
      <div className="admin-job-lines">
        <p className="bare-helper">Spent or held: what each step settled at, or the full amount held for a step not settled yet.</p>
        {data.cost.unreadable.length ? <p className="bare-helper">Left out because it could not be read: {data.cost.unreadable.join(", ")}.</p> : null}
      </div>
    </BareRows> : null}

    {/* 5. What stopped it: privacy, rights or money only. */}
    {data.stops.length ? <BareRows title="What stopped it">
      <ul className="admin-job-list">
        {data.stops.map(stop => <li key={stop.key}>
          {stop.text} {WHOSE[stop.whose]}
          {stop.atIso ? <span className="bare-helper"> {timeInWords(stop.atIso)}</span> : null}
        </li>)}
      </ul>
    </BareRows> : null}

    {/* 6. What happened, from the records that hold a time. */}
    {/* The time on its own line above each event, at every width. */}
    {data.events.length ? <BareRows title="What happened">
      <ol className="admin-job-events">
        {data.events.map(event => <li key={event.key}>
          <span className="bare-helper">{timeInWords(event.atIso)}</span>
          <span>{event.text}</span>
        </li>)}
      </ol>
    </BareRows> : null}

    {/* Staff actions that exist nowhere else. */}
    <BareRows title="Staff tools">
      <BareMenu label="Staff tools" items={[
        ...(job.internalTest ? [] : [{ key: "companies", label: "Deployment companies", body:
          <StaffTool id={`${requestId}:companies`} label="Deployment companies">{() => <JobCompaniesConsole requestId={requestId} currentUser={api.currentUser}
            // A hold changes the sharing line, the stops and the events above: read them again.
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ["admin-job-console", "detail", requestId] })} />}</StaffTool> }]),
        { key: "measurements", label: "Site measurements", body:
          <StaffTool id={`${requestId}:measurements`} label="Site measurements">{() => <SiteMeasurementsConsole requestId={requestId} currentUser={api.currentUser} />}</StaffTool> },
        { key: "evidence", label: "Evidence questions", body:
          <StaffTool id={`${requestId}:evidence`} label="Evidence questions">{() => <JobWorkflowPanel requestId={requestId} currentUser={api.currentUser} />}</StaffTool> },
        { key: "robot-fit", label: "Robot fit", body:
          <StaffTool id={`${requestId}:robot-fit`} label="Robot fit">{() => <RobotFitConsole requestId={requestId} currentUser={api.currentUser} />}</StaffTool> },
      ]} />
    </BareRows>
  </>;
}

/** The owner's totals in one line; a number that could not be read says so. */
export function totalsLine(totals: AdminJobTotals): string {
  const n = (value: number | null) => value == null ? "?" : String(value);
  return [
    `${totals.siteJobs} site jobs (${totals.siteJobsThisWeek} in the last 7 days)`,
    `${n(totals.withVideo)} with a video`,
    `${n(totals.shownToCompanies)} shown to companies`,
    `${n(totals.answered)} with an answer`,
    `${n(totals.introductionsAsked)} introductions asked`,
    `${n(totals.introductionsMade)} made`,
    `${n(totals.outcomeAnswers)} outcome answers`,
    `${n(totals.billableEvents)} billable events`,
  ].join(" · ");
}

/** The totals strip and the billable events CSV, fetched with the admin's sign-in (an address alone cannot carry it). */
function JobTotals() {
  const api = useAdminFetch();
  const [error, setError] = useState<string | null>(null);
  const totals = useQuery({ queryKey: ["admin-job-console", "totals"], enabled: Boolean(api.currentUser),
    queryFn: () => api.get<AdminJobTotals>("/api/admin/jobs/totals") });
  async function downloadCsv() {
    setError(null);
    try {
      const response = await fetch("/api/admin/jobs/billable-events.csv", {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(api.currentUser, await withCsrfHeader({})),
      });
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "billable-events.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), PACKAGE_URL_REVOKE_DELAY_MS);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }
  // The CSV reads only the billable events, so it stays available while the totals load or fail.
  const line = totals.data ? totalsLine(totals.data) : totals.error ? "The totals are unavailable." : "Loading totals…";
  return <p className="bare-helper" aria-label="Totals">
    {line} · <button type="button" className="bare-quiet-button" onClick={() => void downloadCsv()}>Billable events (CSV)</button>
    {error ? <span role="alert"> {error}</span> : null}
  </p>;
}

function JobList({ onOpen }: { onOpen: (requestId: string) => void }) {
  const api = useAdminFetch();
  const jobs = useInfiniteQuery({
    queryKey: ["admin-job-console", "list"],
    enabled: Boolean(api.currentUser),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      const query = params.toString();
      return api.get<AdminJobListResponse>(`/api/admin/jobs${query ? `?${query}` : ""}`);
    },
    getNextPageParam: last => last.nextCursor,
  });
  const rows = useMemo(() => jobs.data?.pages.flatMap(page => page.jobs) ?? [], [jobs.data]);

  return <>
    <h1>Jobs</h1>
    <JobTotals />
    {jobs.isLoading ? <p className="bare-helper" role="status">Loading jobs…</p> : null}
    {jobs.error ? <BareNotice role="alert">{(jobs.error as Error).message}</BareNotice> : null}
    {!jobs.isLoading && !jobs.error && !rows.length ? <p className="bare-helper">No jobs yet.</p> : null}
    {rows.length ? <ul className="bare-menu admin-job-rows" aria-label="Jobs">
      {rows.map(row => {
        const received = timeInWords(row.receivedAtIso, false);
        return <li key={row.requestId}>
          <a className="bare-menu-item" href={`/admin/jobs?job=${encodeURIComponent(row.requestId)}`}
            onClick={event => { event.preventDefault(); onOpen(row.requestId); }}>
            <span className="admin-job-row">
              <span className="admin-job-row-job">{jobLine(row)}</span>
              <span className="bare-helper">{row.standing}{received ? ` · Received ${received}` : ""}</span>
            </span>
          </a>
        </li>;
      })}
    </ul> : null}
    {jobs.hasNextPage ? <p>
      <button type="button" className="bare-quiet-button" disabled={jobs.isFetchingNextPage} onClick={() => void jobs.fetchNextPage()}>
        {jobs.isFetchingNextPage ? "Loading…" : "Show older jobs"}
      </button>
    </p> : null}
    <BareRows title="Privacy requests">
      <BareMenu label="Privacy requests" items={[{ key: "deletion", label: "Account and data deletion requests",
        body: <StaffTool id="privacy-requests" label="Account and data deletion requests">{() => <AccountDeletionQueue />}</StaffTool> }]} />
    </BareRows>
  </>;
}

export default function AdminJobConsole() {
  const [selected, setSelected] = useState<string | null>(() => readJobParam());
  useEffect(() => writeJobParam(selected), [selected]);
  useEffect(() => { window.scrollTo?.(0, 0); }, [selected]);

  return (
    // Bare shell, like the site's own job page: the minimal site's theme and header, then one centred column.
    <div className="minimal-site">
      <header className="ms-container ms-capture-header" style={{ maxWidth: "680px" }}>
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <span className="ms-back" style={{ marginBottom: 0 }}>Staff</span>
      </header>
      <main className="ms-container ms-capture-body" style={{ paddingBlock: "24px 48px", maxWidth: "680px" }}>
        <BareScreen className="admin-job">
          {selected ? <JobPage requestId={selected} onBack={() => setSelected(null)} /> : <JobList onOpen={setSelected} />}
        </BareScreen>
      </main>
    </div>
  );
}
