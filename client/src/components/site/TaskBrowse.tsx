import { TaskThumbnail } from "./TaskThumbnail";
import { ArrowRight, Box, MapPin, Search } from "lucide-react";
import { TaskFacts } from "./TaskFacts";
import { useEffect, useRef, useState } from "react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { BROWSE_JOBS_LABEL, BROWSE_JOBS_PATH, type LibraryAccess } from "@/lib/robotTeamAccess";
import { RobotTeamEarlyAccess } from "./RobotTeamEarlyAccess";
import { CompanyTermsPrompt } from "./CompanyTermsPrompt";
import { jobTitleForDisplay, libraryStageLabels, type TaskBrowseCard } from "@/types/taskBrowse";

function browseParam(key: string) {
  return typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get(key) ?? "";
}

/** Report whether the library is visible so the page can show the right heading. */
export function TaskBrowse({ onLibrary }: { onLibrary?: (shown: boolean, applied?: boolean) => void }) {
  const [items, setItems] = useState<TaskBrowseCard[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "terms">("loading");
  const [retry, setRetry] = useState(0);
  const [family, setFamily] = useState(() => browseParam("type").slice(0, 100));
  const [region, setRegion] = useState(() => browseParam("region").slice(0, 100));
  const [search, setSearch] = useState(() => browseParam("q").slice(0, 100));
  const [readyToTest, setReadyToTest] = useState(() => browseParam("test") === "1");
  const [access, setAccess] = useState<LibraryAccess | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const auth = useOptionalAuth();
  const currentUser = auth?.currentUser ?? null;
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState("error");
    }, 15_000);
    // Early access: the server returns tasks only to an approved team, so the
    // request carries the signed-in account when there is one.
    withFirebaseAuthHeaders(currentUser).catch(() => ({})).then(headers =>
      fetch("/api/site-worlds/tasks", { signal: controller.signal, headers })).then(async response => {
      // An approved company that has not accepted the current Terms: the prompt, and nothing about any job.
      if (response.status === 403) {
        const body = await response.json().catch(() => ({}));
        if (body?.code === "terms_acceptance_required") { if (!controller.signal.aborted) setState("terms"); return; }
      }
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!Array.isArray(data.items)) throw new Error("invalid library");
      setAccess(data.access ?? null);
      setItems(data.items); setState("ready");
    }).catch(() => { if (!controller.signal.aborted) setState("error"); })
      .finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [retry, currentUser?.uid]);
  // An emailed link to one job (`#job-…`) scrolls to its card.
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  const linkedItem = items.find(item => hash === `#job-${item.id}`);
  useEffect(() => {
    if (state === "ready" && linkedItem) document.getElementById(`job-${linkedItem.id}`)?.scrollIntoView?.({ block: "start" });
  }, [state, linkedItem]);
  useEffect(() => {
    // `applied`: a company that has applied (in review, declined, or approved and verifying) is not asked to apply again.
    const applied = Boolean(access && ["applied", "declined", "approved"].includes(access.status));
    if (state !== "loading") onLibrary?.(state === "ready" ? access === null || access.allowed : Boolean(currentUser), applied);
  }, [state, access, currentUser, onLibrary]);
  const filterParams = { q: search, type: family, region, test: readyToTest ? "1" : "" };
  const filtersQuery = new URLSearchParams(Object.entries(filterParams).filter(([, value]) => value !== "")).toString();
  useEffect(() => {
    if (state !== "ready" || access?.allowed === false || window.location.pathname !== BROWSE_JOBS_PATH) return;
    const url = new URL(window.location.href);
    const selected = new URLSearchParams(filtersQuery);
    // "view" was the open/past toggle; every listed job is open, so an old link's value is dropped.
    for (const key of ["q", "type", "region", "view", "test"]) {
      const value = selected.get(key);
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [state, access, filtersQuery]);
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = items.filter(item => {
    if ((family && item.taskFamily !== family) || (region && item.region !== region)) return false;
    if (readyToTest && item.simulationDownloadAvailable !== true) return false;
    const listing = [item.title, jobTitleForDisplay(item.title), item.taskFamily, item.region, item.objects, item.siteType].join(" ").toLowerCase();
    return terms.every(term => listing.includes(term));
  }).sort((left, right) => (Date.parse(right.publishedAtIso) || 0) - (Date.parse(left.publishedAtIso) || 0));
  const filtersActive = Boolean(terms.length || family || region || readyToTest);
  function clearFilters() {
    setSearch(""); setFamily(""); setRegion(""); setReadyToTest(false);
    searchInput.current?.focus();
  }
  // Nothing library-shaped renders until the server has said who may see it,
  // so a visitor outside early access never sees the library flash by.
  // The way to apply is useful without that lookup. Render the same component
  // on the server, while loading and on failure so a text reader can inspect
  // the first step.
  if ((state === "loading" || state === "error") && !currentUser) {
    return <RobotTeamEarlyAccess access={null} email={null} />;
  }
  if (state === "loading") return <section aria-label={BROWSE_JOBS_LABEL}><p role="status">Loading…</p></section>;
  if (state === "terms" && currentUser) return <section aria-label={BROWSE_JOBS_LABEL}>
    <CompanyTermsPrompt user={currentUser} onAccepted={() => setRetry(retry + 1)} /></section>;
  if (state === "error") return <section aria-label={BROWSE_JOBS_LABEL}><div role="alert"><p>Jobs could not be loaded.</p>
    <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button>
    <p><a href="mailto:hello@tryblueprint.io">Email us about a job or your application</a></p></div></section>;
  // Anything other than an explicit "allowed" is the early-access page.
  const gated = state === "ready" && access !== null && !access.allowed;
  if (gated) return <RobotTeamEarlyAccess access={access} email={currentUser?.email ?? null} onVerified={() => setRetry(value => value + 1)} />;
  // Staff see exactly what an approved company sees, with no hint of their own on this page.
  const regions = [...new Set(items.map(item => item.region).filter(Boolean))].sort();
  const families = [...new Set(items.map(item => item.taskFamily).filter(Boolean))].sort();
  return <section aria-label={BROWSE_JOBS_LABEL} className="opportunities">
    {items.length === 0 ? <div className="opportunities-empty">
      <Box size={24} aria-hidden="true" />
      <h2>No jobs yet.</h2>
      <p>New jobs appear here when their video is ready.</p>
    </div> : <>
      <div className="opportunities-toolbar">
        <div className="opportunities-filters">
          <label className="opportunities-search">
            <span className="sr-only">Search jobs</span>
            <Search size={18} aria-hidden="true" />
            <input ref={searchInput} type="search" value={search} maxLength={100} placeholder="Search jobs" onChange={event => setSearch(event.currentTarget.value)} />
          </label>
          <select aria-label="Job type" value={family} onChange={event => setFamily(event.currentTarget.value)}>
            <option value="">All job types</option>
            {families.map(value => <option key={value}>{value}</option>)}
          </select>
          <select aria-label="Region" value={region} onChange={event => setRegion(event.currentTarget.value)}>
            <option value="">All regions</option>
            {regions.map(value => <option key={value}>{value}</option>)}
          </select>
          <label className="opportunities-ready">
            <input type="checkbox" checked={readyToTest} onChange={event => setReadyToTest(event.currentTarget.checked)} />
            Ready to test
          </label>
        </div>
      </div>
      <div className="opportunities-result-line">
        <p role="status">{filtered.length} {filtered.length === 1 ? "job" : "jobs"}</p>
        {filtersActive && <button type="button" className="ms-inline-link" onClick={clearFilters}>Clear filters</button>}
      </div>
      {filtered.length === 0 ? <div className="opportunities-empty">
        <Search size={24} aria-hidden="true" />
        <h2>No jobs match these filters.</h2>
      </div> : <ul className="opportunities-list">{filtered.map(item => {
        const title = jobTitleForDisplay(item.title);
        const ready = item.simulationDownloadAvailable === true;
        // No label when the stage is unknown, or built but not yet downloadable.
        const simulationStatus = ready ? "Ready to test" : item.simulationStage && item.simulationStage !== "simulation_built"
          ? libraryStageLabels[item.simulationStage] : null;
        return <li key={item.id} id={`job-${item.id}`} className="opportunity-card">
          {item.thumbnailUrl ? <TaskThumbnail src={item.thumbnailUrl} title={title} taskFamily={item.taskFamily} />
            : <span className="opportunity-icon" aria-hidden="true"><Box size={24} strokeWidth={1.5} /></span>}
          <div className="opportunity-content">
            <h2 id={`job-title-${item.id}`}>{title}</h2>
            <div className="opportunity-meta">
              {item.taskFamily !== "Other" && item.taskFamily && <span>{item.taskFamily}</span>}
              {item.region && <span><MapPin size={14} aria-hidden="true" />{item.region}</span>}
            </div>
            {simulationStatus && <div className="opportunity-labels">
              <span className={ready ? "opportunity-label-ready" : undefined}>{simulationStatus}</span>
            </div>}
            <TaskFacts details={item} omitRegion />
            {item.answerHeadline && <p className="opportunity-first-look">{item.answerHeadline}</p>}
          </div>
          <a className="opportunity-open" aria-describedby={`job-title-${item.id}`}
            href={`${item.jobUrl ?? `/jobs/${encodeURIComponent(item.id)}`}${filtersQuery ? `?from=${encodeURIComponent(filtersQuery)}` : ""}`}>
            View job<ArrowRight size={17} aria-hidden="true" />
          </a>
        </li>;
      })}</ul>}
    </>}
  </section>;
}
