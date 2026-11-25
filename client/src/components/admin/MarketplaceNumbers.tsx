/**
 * "Marketplace numbers" on the staff job page (owner direction, 2026-11-25: three numbers to watch every day). The three headline
 * numbers first, each with its definition in one plain sentence; then the secondary numbers; then one row per job.
 *
 * It works out nothing: every figure is the server's (`server/utils/marketplaceNumbers.ts`). A number with nothing
 * under it says "No data yet", never 0. No site name and no company name is shown: job ids, times and counts only.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { BareNotice, BareRows } from "@/components/bare/Bare";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { MarketplaceDuration, MarketplaceJobRow, MarketplaceJobSpend, MarketplaceNumbers as Numbers, MarketplaceShare,
  MarketplaceStep, MarketplaceUse, MarketplaceUsdSpread, MarketplaceWindow } from "@/types/marketplaceNumbers";

export const NO_DATA = "No data yet";

/** Each number's definition, in one plain sentence. */
export const DEFINITIONS = {
  firstResponse: "From the site's video arriving to the first answer any company gave, over the shared jobs that have one.",
  firstApply: "From the site's video arriving to the first Apply (or Tested it: can do), over the shared jobs that have one.",
  jobsWithApply: "Of the jobs shared with companies in this window, the share that got at least one Apply.",
  applicationsIntroduced: "Of the applications on those jobs, the share the site accepted and Blueprint introduced (the company was sent the site's details).",
  answers: "Each company's current answer on those jobs.",
  outcomes: "On the introductions made: the site's own marks for a visit and a pilot, and each answer either side gave to \"How did it go?\".",
  cost: (capUsd: number) => `What each job's ledgers count against its one ${usd(capUsd)} cap: each step at what it settled at, or the full amount held while it is not settled.`,
  simulation: "Each time an approved company's viewer loads the simulation, and each time it starts the download (a resumed download is not counted again). Use before this counting went live was not recorded.",
} as const;

function usd(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "under a minute", "42 min", "5 h 12 min", "3 d 4 h". */
export function durationInWords(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}

function dateInWords(value: string, withTime = true) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("en-US", withTime ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "40% (2 of 5 jobs)", or "No data yet" when there is nothing to divide by. */
export function shareInWords(share: MarketplaceShare, noun: string): string {
  if (share.share === null) return NO_DATA;
  return `${Math.round(share.share * 100)}% (${share.count} of ${plural(share.of, noun)})`;
}

function durationLine(duration: MarketplaceDuration): { big: string; helper: string | null } {
  const parts = [duration.measured ? `${plural(duration.measured, "job")} measured` : null,
    duration.waiting ? `${duration.waiting} still waiting` : null,
    duration.notMeasurable ? `${duration.notMeasurable} whose times cannot be measured` : null].filter(Boolean);
  if (duration.medianMs === null) return { big: NO_DATA, helper: parts.length ? parts.join(" · ") : null };
  return { big: `Median ${durationInWords(duration.medianMs)}`,
    helper: [`90th percentile ${durationInWords(duration.p90Ms ?? duration.medianMs)}`, ...parts].join(" · ") };
}

function spreadLine(spread: MarketplaceUsdSpread | null): string {
  if (!spread) return NO_DATA;
  return `Median ${usd(spread.medianUsd)} · 90th percentile ${usd(spread.p90Usd)} · largest ${usd(spread.maxUsd)}, over ${plural(spread.jobs, "job")}`;
}

function useLine(use: MarketplaceUse | null): string {
  if (!use) return NO_DATA;
  return `${use.total} on ${plural(use.jobs, "job")}, by ${plural(use.companies, "company", "companies")}`;
}

function stepInWords(step: MarketplaceStep, none: string): string {
  if (step.state === "none") return none;
  if (step.state === "time_unknown") return "Time not recorded";
  return step.afterVideoMs !== null ? `${durationInWords(step.afterVideoMs)} after the video`
    : `${dateInWords(step.atIso)} (no video time to measure from)`;
}

function spendInWords(spend: MarketplaceJobSpend): string {
  if (spend.state === "counted") return usd(spend.usd);
  if (spend.state === "no_ledger") return "No ledger entry";
  if (spend.state === "unreadable") return "Could not be read";
  return "Unavailable right now";
}

function Headline({ label, value, helper, definition }: { label: string; value: string; helper?: string | null; definition: string }) {
  return <div className="admin-numbers-headline">
    <h3 className="bare-label">{label}</h3>
    <p className="admin-numbers-big">{value}</p>
    {helper ? <p className="bare-helper">{helper}</p> : null}
    <p className="bare-helper">{definition}</p>
  </div>;
}

function JobsTable({ jobs }: { jobs: MarketplaceJobRow[] }) {
  if (!jobs.length) return <p className="bare-helper">{NO_DATA}: no job was shared with companies in this window.</p>;
  return <div className="admin-numbers-scroll">
    <table className="admin-numbers-table" aria-label="Each job">
      <thead><tr>
        <th scope="col">Job</th><th scope="col">Shared</th><th scope="col">First response</th><th scope="col">First Apply</th>
        <th scope="col">Applications</th><th scope="col">Introductions</th><th scope="col">Spend</th>
        <th scope="col">Simulation opens</th><th scope="col">Downloads</th>
      </tr></thead>
      <tbody>{jobs.map(job => <tr key={job.jobId}>
        <th scope="row">
          <a className="bare-link" href={`/admin/jobs?job=${encodeURIComponent(job.jobId)}`}>{job.jobId}</a>
          {job.internalTest ? <span className="bare-helper"> Internal test{job.internalTest.label ? `: ${job.internalTest.label}` : ""}</span> : null}
        </th>
        <td>{dateInWords(job.sharedAtIso)}</td>
        <td>{stepInWords(job.firstResponse, "No response yet")}</td>
        <td>{stepInWords(job.firstApply, "No Apply yet")}</td>
        <td>{job.applications}</td>
        <td>{job.introductions}{job.introductionsWaiting ? ` (${job.introductionsWaiting} asked, not made yet)` : ""}</td>
        <td>{spendInWords(job.spend)}</td>
        <td>{job.simulationOpens ?? NO_DATA}</td>
        <td>{job.simulationDownloads ?? NO_DATA}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export function MarketplaceNumbersView({ numbers }: { numbers: Numbers }) {
  const { headline, answers, outcomes, cost, simulation } = numbers;
  const response = durationLine(headline.firstResponse), apply = durationLine(headline.firstApply);
  const recordedOutcomes = outcomes.rows.filter(row => row.introductions > 0);
  const leftOut = [cost.noLedger ? `${plural(cost.noLedger, "job")} with no ledger entry` : null,
    cost.unreadable ? `${plural(cost.unreadable, "job")} with a figure that could not be read` : null,
    cost.unavailable ? `${plural(cost.unavailable, "job")} whose ledgers could not be read right now` : null].filter(Boolean);
  return <>
    <p className="bare-helper">
      {plural(numbers.sharedJobs, "job")} shared with companies since {dateInWords(numbers.sinceIso, false)} (UTC days, today included)
      {numbers.includeTests ? ", internal test jobs included" : ", internal test jobs left out"}.
    </p>
    {numbers.limits.map(limit => <p key={limit} className="bare-helper">{limit}</p>)}

    <div className="admin-numbers-group" aria-label="Headline numbers" role="group">
      <Headline label="Video to first response" value={response.big} helper={response.helper} definition={DEFINITIONS.firstResponse} />
      <Headline label="Video to first Apply" value={apply.big} helper={apply.helper} definition={DEFINITIONS.firstApply} />
      <Headline label="Shared jobs with at least one Apply" value={shareInWords(headline.jobsWithApply, "job")}
        definition={DEFINITIONS.jobsWithApply} />
      <Headline label="Applications that became introductions" value={shareInWords(headline.applicationsIntroduced, "application")}
        definition={DEFINITIONS.applicationsIntroduced} />
    </div>

    <div className="admin-numbers-group" aria-label="Secondary numbers" role="group">
      <div>
        <h3 className="bare-label">Answers</h3>
        <p>Need more details: {shareInWords(answers.needMoreDetails, "answer")}</p>
        <p>Not a fit: {shareInWords(answers.notAFit, "answer")}</p>
        <p className="bare-helper">{DEFINITIONS.answers}</p>
      </div>
      <div>
        <h3 className="bare-label">After introductions</h3>
        {!outcomes.introductions ? <p>{NO_DATA}</p>
          : recordedOutcomes.length ? <ul className="admin-job-list">{recordedOutcomes.map(row =>
            <li key={row.key}>{row.label}: {row.introductions} of {plural(outcomes.introductions, "introduction")}</li>)}</ul>
            : <p>Nothing recorded yet on {plural(outcomes.introductions, "introduction")} made.</p>}
        <p className="bare-helper">{DEFINITIONS.outcomes}</p>
      </div>
      <div>
        <h3 className="bare-label">Spend per job</h3>
        <p>{spreadLine(cost.perJob)}</p>
        {leftOut.length ? <p className="bare-helper">Left out: {leftOut.join("; ")}.</p> : null}
        {cost.lanes.length ? <div className="admin-numbers-scroll">
          <table className="admin-numbers-table" aria-label="Spend by lane">
            <thead><tr><th scope="col">Lane</th><th scope="col">Median</th><th scope="col">90th percentile</th>
              <th scope="col">Largest</th><th scope="col">Total</th></tr></thead>
            <tbody>{cost.lanes.map(lane => <tr key={lane.key}>
              <th scope="row">{lane.label}{lane.unreadable ? <span className="bare-helper"> ({lane.unreadable} could not be read)</span> : null}</th>
              {lane.spread ? <>
                <td>{usd(lane.spread.medianUsd)}</td><td>{usd(lane.spread.p90Usd)}</td>
                <td>{usd(lane.spread.maxUsd)}</td><td>{usd(lane.spread.totalUsd)}</td>
              </> : <td colSpan={4}>{NO_DATA}</td>}
            </tr>)}</tbody>
          </table>
        </div> : null}
        <p className="bare-helper">{DEFINITIONS.cost(cost.capUsd)}</p>
      </div>
      <div>
        <h3 className="bare-label">Simulation use</h3>
        <p>Viewer opens: {useLine(simulation.viewerOpens)}</p>
        <p>Downloads: {useLine(simulation.downloads)}</p>
        <p className="bare-helper">{DEFINITIONS.simulation}</p>
      </div>
    </div>

    <JobsTable jobs={numbers.jobs} />
  </>;
}

/** The section, with its two switches: the window, and whether internal test jobs are counted. */
export function MarketplaceNumbers() {
  const { currentUser } = useAuth();
  const [windowDays, setWindowDays] = useState<MarketplaceWindow>(7);
  const [includeTests, setIncludeTests] = useState(false);
  const numbers = useQuery({
    queryKey: ["admin-job-console", "marketplace-numbers", windowDays, includeTests],
    enabled: Boolean(currentUser),
    // Read on opening the page, not on every return to it: each read counts a window's jobs and their ledgers.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Numbers> => {
      const response = await fetch(`/api/admin/jobs/marketplace-numbers?window=${windowDays}&includeTests=${includeTests ? 1 : 0}`, {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(value.error || `Request failed (${response.status})`));
      return value as Numbers;
    },
  });
  return <BareRows title="Marketplace numbers"><div className="admin-numbers">
    <div className="admin-numbers-controls">
      <div role="group" aria-label="Window">
        {([7, 30] as const).map(days => <button key={days} type="button" className="bare-quiet-button" aria-pressed={windowDays === days}
          onClick={() => setWindowDays(days)}>Last {days} days</button>)}
      </div>
      <label className="admin-numbers-switch">
        <input type="checkbox" checked={includeTests} onChange={event => setIncludeTests(event.currentTarget.checked)} />
        {" "}Include internal test jobs
      </label>
    </div>
    {numbers.data ? <MarketplaceNumbersView numbers={numbers.data} />
      : numbers.error ? <BareNotice role="status">{(numbers.error as Error).message}</BareNotice>
        : <p className="bare-helper" role="status">Loading the numbers…</p>}
  </div></BareRows>;
}
