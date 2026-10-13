import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Button, Card, Eyebrow, StatusChip } from "@/components/blueprint";
import { AdmitFreeEvaluationForm } from "@/components/admin/AdmitFreeEvaluationForm";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import {
  JOB_STAGES,
  JOB_STAGE_LABELS,
  type ActionOwner,
  type JobConsoleDetail,
  type JobConsoleListResponse,
  type JobConsoleRow,
  type JobStage,
} from "@/types/jobConsole";

type Tone = "proof" | "warn" | "block" | "info" | "neutral";

export function stageTone(stage: JobStage): Tone {
  if (stage === "scheduled") return "proof";
  if (stage === "withdrawn" || stage === "no_passing_run") return "block";
  if (["admission", "recommend", "recommendation_review", "coordination"].includes(stage)) return "warn";
  if (stage === "closed") return "neutral";
  return "info";
}

const OWNER_LABELS: Record<ActionOwner, string> = {
  blueprint: "Blueprint",
  site: "Site",
  robot_team: "Robot team",
  none: "No action",
};

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
}

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
    // The selection still works without a shareable URL.
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

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="runway-meta">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-runway-text">{children}</dd>
    </div>
  );
}

function runSummary(row: JobConsoleRow) {
  const { runs } = row;
  const parts = [
    runs.running ? `${runs.running} running` : "",
    runs.queued ? `${runs.queued} queued` : "",
    runs.reported ? `${runs.reported} reported` : "",
    runs.noResult ? `${runs.noResult} no result` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "None";
}

function bestRunLabel(row: JobConsoleRow) {
  const best = row.runs.best;
  if (!best) return "No reported run";
  const rate = best.successRatePct === null ? "rate not reported" : `${best.successRatePct}% success`;
  const target = best.meetsTarget === true ? "meets target" : best.meetsTarget === false ? "below target" : "no target";
  return `${best.teamName || best.teamId}: ${rate} over ${best.episodesRun} episodes (${target}, development simulation)`;
}

function JobDetail({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const api = useAdminFetch();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["admin-job-console", "detail", requestId],
    enabled: Boolean(api.currentUser),
    queryFn: () => api.get<JobConsoleDetail>(`/api/admin/jobs/${encodeURIComponent(requestId)}`),
  });
  const data = detail.data;
  const job = data?.job;

  return (
    <section aria-labelledby="job-detail-heading" className="runway-panel p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="runway-meta">Job {requestId}</p>
          <h2 id="job-detail-heading" className="mt-2 break-words text-2xl font-semibold text-runway-text">
            {job ? job.siteName : "Loading job…"}
          </h2>
          {job?.siteLocation ? <p className="mt-1 text-sm text-runway-mute">{job.siteLocation}</p> : null}
        </div>
        <Button variant="secondary" size="sm" iconLeft={<ArrowLeft />} onClick={onClose}>Back to jobs</Button>
      </div>
      {detail.error ? <p role="alert" className="mt-4 text-sm text-runway-red">{(detail.error as Error).message}</p> : null}
      {job && data ? (
        <div className="mt-6 grid gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip tone={stageTone(job.stage)} square>{JOB_STAGE_LABELS[job.stage]}</StatusChip>
            <p className="text-sm text-runway-text"><span className="runway-meta mr-2">Next ({OWNER_LABELS[job.actionOwner]})</span>{job.nextAction}</p>
          </div>
          {job.attention.length ? (
            <ul className="grid gap-1 text-sm text-runway-signal" aria-label="Needs attention">
              {job.attention.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <a className="runway-cta-ghost min-h-0 px-4 py-2 text-sm" href={data.links.recommendation}>Open recommendation form</a>
            <a className="runway-cta-ghost min-h-0 px-4 py-2 text-sm" href={data.links.lead}>Open lead record</a>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Received">{dateLabel(job.createdAtIso)}</Fact>
            <Fact label="Last activity">{dateLabel(job.lastActivityIso)}</Fact>
            <Fact label="Account">{job.claimed ? "Claimed" : "Unclaimed"}</Fact>
            <Fact label="Brief">{job.brief.state.replace(/_/g, " ")}{job.brief.unresolvedGates ? ` · ${job.brief.unresolvedGates} open gates` : ""}</Fact>
            <Fact label="Capture">{job.capture.state.replace(/_/g, " ")}</Fact>
            <Fact label="Public card">{job.listing.state.replace(/_/g, " ")}</Fact>
            <Fact label="Recommendation">{job.recommendation.state === "none" ? "None" : `${job.recommendation.state.replace(/_/g, " ")} · ${job.recommendation.teamName || job.recommendation.teamId}`}</Fact>
            <Fact label="Booking">{job.booking.state.replace(/_/g, " ")}</Fact>
            <Fact label="Withdrawal">{job.withdrawal.state.replace(/_/g, " ")}</Fact>
            <Fact label="Ops notice">{job.opsNotice ? `${job.opsNotice.state}${job.opsNotice.summary ? ` · ${job.opsNotice.summary}` : ""}` : "None"}</Fact>
          </dl>

          <div>
            <h3 className="runway-rule-head runway-meta">Timeline</h3>
            <ol className="mt-4 grid gap-2">
              {data.timeline.map((entry) => (
                <li key={entry.key} className="flex flex-wrap items-center gap-3 text-sm">
                  <StatusChip tone={entry.done ? "proof" : "neutral"} square dot={entry.done}>{entry.done ? "Done" : "Open"}</StatusChip>
                  <span className={entry.done ? "text-runway-text" : "text-runway-mute"}>{entry.label}</span>
                  {entry.atIso ? <span className="runway-num text-xs text-runway-faint">{dateLabel(entry.atIso)}</span> : null}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="runway-rule-head runway-meta">Evaluation requests</h3>
            {!data.admissions.length ? <p className="mt-4 text-sm text-runway-mute">No robot team has asked to evaluate this job.</p> : null}
            <div className="mt-4 grid gap-4">
              {data.admissions.map((candidate) => (
                <Card key={candidate.evaluationRequestId} pad="lg" className="grid gap-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h4 className="text-lg font-semibold text-runway-text">{candidate.team?.name || "No bound team"}</h4>
                      <p className="break-words text-sm text-runway-mute">
                        Setup {candidate.setup.name || candidate.setup.setupId}
                        {candidate.setup.reference ? <> · <span className="break-all">{candidate.setup.reference}</span></> : null}
                      </p>
                      <p className="runway-num mt-1 text-xs text-runway-faint">Request {candidate.evaluationRequestId} · {dateLabel(candidate.submittedAtIso)}</p>
                    </div>
                    <StatusChip tone={candidate.admitted ? "proof" : candidate.blockers.length ? "block" : "warn"} square>
                      {candidate.admitted ? "Admitted" : candidate.blockers.length ? "Blocked" : "Awaiting admission"}
                    </StatusChip>
                  </div>
                  {candidate.handoff ? (
                    <p className="text-sm text-runway-body">Run <span className="runway-num text-runway-text">{candidate.handoff.runId}</span></p>
                  ) : null}
                  {!candidate.admitted && candidate.blockers.length ? (
                    <ul className="grid gap-1 text-sm text-runway-red">
                      {candidate.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  ) : null}
                  {!candidate.admitted && candidate.team ? (
                    <AdmitFreeEvaluationForm
                      candidate={candidate}
                      defaults={data.admissionDefaults}
                      currentUser={api.currentUser}
                      onAdmitted={() => queryClient.invalidateQueries({ queryKey: ["admin-job-console"] })}
                    />
                  ) : null}
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h3 className="runway-rule-head runway-meta">Runs</h3>
            {!data.runs.length ? <p className="mt-4 text-sm text-runway-mute">No evaluation runs are recorded for this job.</p> : (
              <div className="mt-4 overflow-x-auto">
                <table className="runway-table min-w-[36rem]">
                  <caption className="sr-only">Evaluation runs for this job</caption>
                  <thead><tr><th scope="col">Team</th><th scope="col">Outcome</th><th scope="col">Success</th><th scope="col">Episodes</th><th scope="col">Target</th></tr></thead>
                  <tbody>
                    {data.runs.map((run) => (
                      <tr key={run.runId}>
                        <td>{run.teamName || run.teamId}<br /><span className="runway-num text-xs text-runway-faint">{run.runId}</span></td>
                        <td>{run.outcome.replace(/_/g, " ")}</td>
                        <td className="runway-num">{run.successRatePct === null ? "—" : `${run.successRatePct}%`}</td>
                        <td className="runway-num">{run.episodesRun ?? "—"}</td>
                        <td>{run.meetsTarget === true ? "Meets" : run.meetsTarget === false ? "Below" : "No target"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-runway-mute">Development simulation results. Not physical-success or partner proof.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function AdminJobConsole() {
  const api = useAdminFetch();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<JobStage | "">("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(() => readJobParam());

  useEffect(() => writeJobParam(selected), [selected]);

  const jobs = useInfiniteQuery({
    queryKey: ["admin-job-console", "list", stage, submittedSearch],
    enabled: Boolean(api.currentUser),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam) params.set("cursor", pageParam);
      if (stage) params.set("stage", stage);
      if (submittedSearch) params.set("q", submittedSearch);
      return api.get<JobConsoleListResponse>(`/api/admin/jobs?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
  const rows = useMemo(() => jobs.data?.pages.flatMap((page) => page.jobs) ?? [], [jobs.data]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-10 text-ink-900 md:px-8">
      <div className="mx-auto max-w-[88rem]">
        <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow tone="brass" rule>Founder operations</Eyebrow>
            <h1 className="mt-5 font-display text-4xl font-semibold uppercase tracking-[0.005em] text-runway-text">Job console</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-runway-mute">
              One row per site job, with where it stands in the beta loop and the next step. Read from the
              records; every action opens the existing form that checks it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="runway-cta-ghost min-h-0 px-4 py-2 text-sm" href="/admin/robot-team-access">Robot teams</a>
            <a className="runway-cta-ghost min-h-0 px-4 py-2 text-sm" href="/admin/leads">Leads</a>
            <Button variant="secondary" iconLeft={<RefreshCw />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-job-console"] })}>
              Refresh
            </Button>
          </div>
        </header>

        {selected ? (
          <div className="mt-8">
            <JobDetail requestId={selected} onClose={() => setSelected(null)} />
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end">
              <div className="md:w-64">
                <label className="runway-label" htmlFor="job-stage-filter">Stage</label>
                <select id="job-stage-filter" className="runway-input" value={stage}
                  onChange={(event) => setStage(event.target.value as JobStage | "")}>
                  <option value="">All stages</option>
                  {JOB_STAGES.map((value) => <option key={value} value={value}>{JOB_STAGE_LABELS[value]}</option>)}
                </select>
              </div>
              <form className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end" onSubmit={onSearch} role="search">
                <div className="flex-1">
                  <label className="runway-label" htmlFor="job-search">Search site name</label>
                  <input id="job-search" className="runway-input" type="search" value={search} maxLength={120}
                    onChange={(event) => setSearch(event.target.value)} placeholder="Site, location, company or job id" />
                </div>
                <Button type="submit" variant="secondary">Search</Button>
              </form>
            </div>

            {jobs.isLoading ? <p className="py-12 text-runway-mute">Loading jobs…</p> : null}
            {jobs.error ? <p role="alert" className="py-12 text-runway-red">{(jobs.error as Error).message}</p> : null}
            {!jobs.isLoading && !jobs.error && !rows.length ? (
              <Card pad="lg" className="mt-8"><p className="text-runway-mute">No site jobs match this view.</p></Card>
            ) : null}

            {rows.length ? (
              <ul className="mt-8 grid gap-3" aria-label="Site jobs">
                {rows.map((row) => (
                  <li key={row.requestId} className="runway-panel grid gap-4 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-runway-text">{row.siteName}</p>
                      <p className="break-words text-xs text-runway-mute">{[row.siteLocation, row.company].filter(Boolean).join(" · ") || row.requestId}</p>
                      <p className="runway-num mt-1 text-xs text-runway-faint">Last activity {dateLabel(row.lastActivityIso)}</p>
                    </div>
                    <div><StatusChip tone={stageTone(row.stage)} square>{JOB_STAGE_LABELS[row.stage]}</StatusChip></div>
                    <div className="min-w-0 text-sm">
                      <p className="text-runway-text"><span className="runway-meta mr-2">{OWNER_LABELS[row.actionOwner]}</span>{row.nextAction}</p>
                      <p className="mt-1 text-xs text-runway-mute">
                        Requests {row.evaluations.pendingAdmission} pending / {row.evaluations.admitted} admitted · Runs {runSummary(row)}
                      </p>
                      {row.runs.best ? <p className="mt-1 text-xs text-runway-mute">Best: {bestRunLabel(row)}</p> : null}
                      {row.attention.length ? <p className="mt-1 text-xs text-runway-signal">{row.attention.join(" · ")}</p> : null}
                    </div>
                    <div>
                      <Button variant="secondary" size="sm" onClick={() => setSelected(row.requestId)}
                        aria-label={`Open ${row.siteName}`}>
                        Open
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {jobs.hasNextPage ? (
              <div className="mt-6">
                <Button variant="secondary" disabled={jobs.isFetchingNextPage} onClick={() => jobs.fetchNextPage()}>
                  {jobs.isFetchingNextPage ? "Loading…" : "Load more jobs"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
