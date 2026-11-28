import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { ArrowLeft, ArrowDown, Download, Eye, FileText, MapPin } from "lucide-react";
import type { User } from "firebase/auth";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { companyApplicationHref, companyJobReturnPath, companyJobSignInHref } from "@/lib/authReturnPath";
import { CHARGE_MODELS, CHARGE_MODEL_LABELS, ESTIMATE_LABEL, ESTIMATE_LIMITS, ESTIMATE_UNITS, INTRODUCIBLE_RESPONSE_STATES, SIMILAR_JOBS, SIMILAR_JOBS_LABELS,
  VISIT_NOTE_LIMIT, isApplicationEstimate, type ApplicationEstimate, type ChargeModel, type SimilarJobs } from "@/lib/companyResponses";
import { COMPANY_QUESTION_LIMIT, COMPANY_RESPONSE_LABELS, COMPANY_START_LABELS, COMPANY_START_WINDOWS, FIT_RESPONSE_STATES,
  COMPANY_ESTIMATE_STATEMENT_VERSIONS, companyQuestionOverdue, companyQuestionWaiting, companyResponseNeedsNote, type CompanyReplyDetails, type CompanyResponseState,
  type CompanyStartWindow } from "@/lib/companyResponses";
import { MinimalSiteLayout } from "@/components/site/MinimalSiteLayout";
import { CompanyTermsPrompt } from "@/components/site/CompanyTermsPrompt";
import { RobotTeamEarlyAccess } from "@/components/site/RobotTeamEarlyAccess";
import { jobTitleForDisplay, type CompanyJobPage } from "@/types/taskBrowse";
import { JOB_PAGE_HEADINGS, JOB_SUMMARY_DOWNLOAD_LABEL, JOB_SUMMARY_UNAVAILABLE, NOTHING_TESTED_AT_SITE, NOT_STATED, NOT_STATED_YET,
  PACKET_FACTS_PENDING, SIMULATION_DOWNLOAD_HINT, SIMULATION_NOT_FINISHED, SIMULATION_WITHOUT_OBJECT,
  SITE_ANSWERS_HINT, SITE_DESCRIPTION_CANT_BE_SHOWN, VIDEO_PREPARING, fitRowMarks, fitRowValue, fitRowsHoldSiteAnswers, fitRowsShown, jobSummaryFileName,
  sharedOnInWords, simulationDownloadLabel, type FitSummaryRow } from "@/lib/companyJobPage";
import { SITE_REPLY_BEING_PREPARED, SITE_REPLY_LIMIT, SUCCESS_RULE_CANT_BE_SHOWN } from "@/lib/companiesRead";
import { BROWSE_JOBS_PATH, type LibraryAccess } from "@/lib/robotTeamAccess";
import { CompanySignInLinkFailure, readSignInLinkFromAddress, SIGN_IN_LINK_ENDED, SIGN_IN_TRY_AGAIN, signInWithCompanyLink, stripSignInLinkFromAddress } from "@/lib/companySignInLink";
import { PartnerApplication } from "@/components/site/PartnerApplication";
import { COMPANY } from "@/data/company";
import { PILOT_COMPANY_CONFIRMED_PENDING, PILOT_COMPANY_DECLINED, PILOT_COMPANY_QUESTION, PILOT_CONFIRM_FAILED, PILOT_CONFIRM_LABEL,
  PILOT_CONFIRM_OTHER_ANSWERS, PILOT_REQUEST_BANNER, pilotCompanyConfirmedLine, pilotCompanyRefusedLine, pilotRequestAskedLine,
  pilotTermsLines } from "@/lib/pilotOffers";
import { PilotSheet } from "@/components/site/PilotSheet";
import { ASK_FOR_SIMULATION_LABEL, SIMULATION_ASK_FAILED } from "@/lib/simulationRequest";

/**
 * The job page for a visitor who is not signed in: what the job holds and how to see it (owner, 2026-11-23). No first
 * look: it is the site's own, and the company's page does not show it (owner, 2026-11-25).
 */
export const GATE_HEADING = "Apply to see this job";
export const GATE_WHAT_YOU_SEE = "The site shared this job with the robot deployment companies Blueprint approves. Approved companies see:";
export const GATE_UNLOCKS = [
  "The site's video of the job, without sound, and its description",
  "Its answers about weight, size, rate and hours",
  "A simulation of the site to open in your own tools, when it is ready",
] as const;
/** A signed-out company that opened a new-job email's link: one press spends the link and opens the job. */
export const LINK_SIGN_IN_HEADING = "Sign in to see this job";
export const LINK_SIGN_IN_LINE = "The link in your email signs you in once.";
export const GATE_RETURN = "Apply below. Once you're approved, the link we email you brings you back to this job.";
/** A declined company opening a job: why it cannot see it, and where to write (stress test, 2026-11-24). */
export const DECLINED_COMPANY_LINE = "Only approved deployment companies can see jobs, and we cannot offer your company access yet. "
  + "We will email you if that changes, and you can reach us at";
export const DECLINED_COMPANY_CONTACT = COMPANY.emails.hello;

/**
 * A public live job's own facts on its gated page (`/jobs/<ref>`): the same kind, country, day and simulation state the
 * public list shows, read from it, nothing more. Nothing for a job address that is not a public reference.
 */
function PublicJobFacts({ jobId }: { jobId: string }) {
  const [facts, setFacts] = useState<string | null>(null);
  useEffect(() => {
    if (!/^l-[a-f0-9]{32}$/.test(jobId)) return;
    let active = true;
    fetch("/api/public/live-jobs").then(response => response.ok ? response.json() : null).then((data: { jobs?: unknown } | null) => {
      const job = Array.isArray(data?.jobs) ? (data!.jobs as Array<Record<string, unknown>>).find(row => row?.ref === jobId) : undefined;
      if (!active || !job || typeof job.kind !== "string" || typeof job.postedOn !== "string") return;
      const day = dateInWords(`${job.postedOn}T00:00:00Z`);
      setFacts([job.kind, typeof job.country === "string" ? job.country : null, day && `Posted ${day}`,
        job.simulationReady === true ? "Simulation ready" : null].filter(Boolean).join(" · "));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [jobId]);
  return facts ? <p className="company-job-gate-facts">{facts}</p> : null;
}

/** The job library: the signed-in list on the companies' page, at its own section. */
export const JOB_LIBRARY_URL = BROWSE_JOBS_PATH;
/** Under the words box: the site reads them, with the company's identity and people's names taken out first
 * (`jobCompanies.companyWordsForSite`). */
export const WORDS_REACH_SITE = "The site reads these words, with your company's name, people's names and contact details taken out.";
/** The page's words the job summary repeats live in `@/lib/companyJobPage`, so the two say the same thing. */
export { SIMULATION_DOWNLOAD_HINT, SIMULATION_NOT_FINISHED, SITE_ANSWERS_HINT, VIDEO_PREPARING };

/**
 * The video's and the download's addresses carry a short ticket (`expires`, in seconds; `server/utils/
 * taskEvaluationResultDownloadTicket.ts`). The page asks for fresh ones this long before the first ends, and a failing
 * video asks again only once its address is at least this old, so a fault that is not the ticket never loops.
 */
export const TICKET_REFRESH_MARGIN_MS = 60_000;

/** How long until the page should ask for fresh tickets, or null when no address carries one. Never sooner than the margin. */
export function ticketRefreshDelayMs(urls: readonly (string | null | undefined)[], nowMs = Date.now()): number | null {
  const ends = urls.map(url => url ? Number(new URL(url, "https://blueprint.invalid").searchParams.get("expires")) : NaN)
    .filter(seconds => Number.isFinite(seconds) && seconds > 0);
  if (ends.length === 0) return null;
  return Math.max(TICKET_REFRESH_MARGIN_MS, Math.min(...ends) * 1000 - nowMs - TICKET_REFRESH_MARGIN_MS);
}

/** The wait before a failed ticket refresh is asked again: 30 seconds, doubling, at most five minutes. */
export function ticketRetryDelayMs(failures: number): number {
  return Math.min(5 * 60_000, (TICKET_REFRESH_MARGIN_MS / 2) * 2 ** Math.max(0, failures - 1));
}

type LoadedJob = { kind: "ready"; item: CompanyJobPage } | { kind: "missing"; access: LibraryAccess | null } | { kind: "terms" };

/** The one authorised page request: every access check runs again on each call, and it issues the media tickets. */
async function loadCompanyJob(user: User, jobId: string): Promise<LoadedJob> {
  const response = await fetch(`/api/site-worlds/jobs/${encodeURIComponent(jobId)}`, { headers: await withFirebaseAuthHeaders(user) });
  if (response.status === 404) {
    const body = await response.json().catch(() => null) as { access?: LibraryAccess } | null;
    return { kind: "missing", access: body?.access ?? null };
  }
  if (response.status === 403) {
    const body = await response.json().catch(() => ({})) as { code?: string };
    if (body.code === "terms_acceptance_required") return { kind: "terms" };
  }
  if (!response.ok) throw new Error("unavailable");
  const body = await response.json() as { item?: CompanyJobPage };
  if (!body.item) throw new Error("invalid");
  return { kind: "ready", item: body.item };
}

function dateInWords(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * The company's page for one job (package E, E3), cut to the one thing a company decides on it: whether to apply (owner,
 * 2026-11-25). Everything on it comes from the server's closed payload (`server/utils/companyJobPage.ts`): the site's
 * sentence, its quick answers, the country, the video, what the video shows of the object and how sure each figure is,
 * and the simulation, each when it exists, and the answer form. No first look: it stays on the site's own pages. Two
 * downloads are offered: the simulation package (E9) and the job summary, a PDF of the page's words
 * (`JobSummaryDownload`). The video is played, with its download control hidden (which discourages saving; it cannot
 * prevent it), so the site keeps custody of it.
 */
export default function CompanyJob() {
  const { jobId = "" } = useParams();
  const signInHref = companyJobSignInHref(jobId);
  return <MinimalSiteLayout signInHref={signInHref}>
    <div className="bare-page"><CompanyJobBody jobId={jobId} signInHref={signInHref} /></div>
  </MinimalSiteLayout>;
}

function CompanyJobBody({ jobId, signInHref }: { jobId: string; signInHref: string }) {
  const auth = useOptionalAuth();
  const user = auth?.currentUser ?? null;
  const [state, setState] = useState<"loading" | "ready" | "missing" | "signed_out" | "error" | "terms">("loading");
  const [page, setPage] = useState<CompanyJobPage | null>(null);
  const [access, setAccess] = useState<LibraryAccess | null>(null);
  const [retry, setRetry] = useState(0);
  const loadGeneration = useRef(0);
  // Back to the gated page after signing in elsewhere in this tab (stress test, 2026-11-24): a page the browser restores
  // from its back-forward cache still holds the signed-out gate, so it loads again and reads the account as it is now.
  const shownState = useRef(state);
  shownState.current = state;
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => { if (event.persisted && shownState.current === "signed_out") window.location.reload(); };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  function show(loaded: LoadedJob) {
    if (loaded.kind === "missing") { setAccess(loaded.access); setState("missing"); }
    else if (loaded.kind === "terms") setState("terms");
    else {
      setPage(loaded.item); setState("ready");
      // Opened from a public live job's reference: the address becomes the job's own.
      if (loaded.item.id !== jobId && typeof window !== "undefined")
        window.history.replaceState(window.history.state, "", `/jobs/${encodeURIComponent(loaded.item.id)}${window.location.search}`);
    }
  }
  // A new-job email's link (owner, 2026-11-23): it signs a signed-out company in on the way to this job. A company
  // already signed in goes straight to the job and the link stays unspent. It is spent only on the company's press of
  // Sign in (outreach gap 1, 2026-11-27): a mail scanner that loads the page and runs its scripts spends nothing. The
  // link is read without changing the address and taken out of the address bar in an effect, so React's second mount
  // pass in development still holds it.
  const [link] = useState(readSignInLinkFromAddress);
  useEffect(() => { stripSignInLinkFromAddress(); }, []);
  const [linkState, setLinkState] = useState<"unused" | "signing_in" | "ended">("unused");
  // A press that failed for a moment (a 503, no answer): the link is kept and the page says to try again (review,
  // 2026-11-27). Only the server's sign_in_link_invalid ends it.
  const [linkRetry, setLinkRetry] = useState<string | null>(null);
  const from = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("from");
  const browseQuery = new URLSearchParams();
  if (from && from.length <= 1200) {
    const previous = new URLSearchParams(from);
    for (const key of ["q", "type", "region", "view", "test"]) {
      const value = previous.get(key);
      if (value) browseQuery.set(key, value.slice(0, 100));
    }
  }
  const backHref = browseQuery.size ? `${JOB_LIBRARY_URL}?${browseQuery}#job-${encodeURIComponent(jobId)}` : JOB_LIBRARY_URL;
  const spendLink = () => {
    if (!link || user || linkState !== "unused") return;
    setLinkState("signing_in");
    setLinkRetry(null);
    // Signing in changes the account, and the job loads for it below.
    signInWithCompanyLink(link).catch((error: unknown) => {
      if (error instanceof CompanySignInLinkFailure && error.ended) { setLinkState("ended"); return; }
      setLinkRetry(error instanceof CompanySignInLinkFailure ? error.message : SIGN_IN_TRY_AGAIN);
      setLinkState("unused");
    });
  };
  useEffect(() => {
    const signingIn = Boolean(link) && linkState === "signing_in";
    // Every change of account or job starts a new generation, signing out too: a ticket refresh still on its way
    // for the account before can never put the job back on the page.
    const generation = ++loadGeneration.current;
    if (!user) { setState(auth && !auth.loading && !signingIn ? "signed_out" : "loading"); return; }
    let cancelled = false;
    setState("loading");
    loadCompanyJob(user, jobId).then(loaded => { if (!cancelled && generation === loadGeneration.current) show(loaded); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [jobId, user?.uid, retry, auth?.loading, linkState]);
  // Fresh tickets for the video and the download, from the same page request: a withdrawn job or a lost approval is
  // refused there and the page says so; a failed request leaves the page as it is, and the next failure asks again.
  const refreshing = useRef(false);
  // Refreshes that failed in a row (the network, a 503): each one is asked again after a wait that doubles, at most
  // every five minutes, so the download's link does not stay ended once the service answers again.
  const [refreshFailures, setRefreshFailures] = useState(0);
  const refreshTickets = useCallback(async () => {
    if (!user || refreshing.current) return;
    refreshing.current = true;
    const generation = loadGeneration.current;
    try {
      const loaded = await loadCompanyJob(user, jobId);
      if (generation === loadGeneration.current) { setRefreshFailures(0); show(loaded); }
    } catch { if (generation === loadGeneration.current) setRefreshFailures(count => count + 1); }
    finally { refreshing.current = false; }
  }, [user, jobId]);
  const videoUrl = page?.video.state === "ready" ? page.video.url : null;
  const downloadUrl = page?.simulationDownload?.state === "ready" ? page.simulationDownload.url : null;
  // The viewer's ticket is inside its `content` address: read there, so a page with only the viewer still refreshes it.
  const viewerContentUrl = page?.simulation.state === "ready"
    ? new URL(page.simulation.viewerUrl, "https://blueprint.invalid").searchParams.get("content") : null;
  useEffect(() => {
    if (state !== "ready") return;
    const delay = refreshFailures > 0 ? ticketRetryDelayMs(refreshFailures)
      : ticketRefreshDelayMs([videoUrl, downloadUrl, viewerContentUrl]);
    if (delay === null) return;
    const timer = setTimeout(() => { void refreshTickets(); }, delay);
    return () => clearTimeout(timer);
  }, [state, videoUrl, downloadUrl, viewerContentUrl, refreshTickets, refreshFailures]);

  if (state === "loading") return <div className="bare-screen company-job"><p role="status">Loading…</p></div>;
  if (state === "signed_out" && link && linkState === "unused") return <div className="bare-screen company-job">
    <h1>{LINK_SIGN_IN_HEADING}</h1><p>{LINK_SIGN_IN_LINE}</p>
    {linkRetry && <p role="status">{linkRetry}</p>}
    <button type="button" className="ms-button" onClick={spendLink}>Sign in</button></div>;
  if (state === "terms" && user) return <div className="bare-screen company-job"><CompanyTermsPrompt user={user} onAccepted={() => setRetry(retry + 1)} /></div>;
  // Signed out (owner, 2026-11-23: a tap on a public live job): what the job holds, the one step to see it, and the way
  // back here. Nothing of the job itself is shown: the site agreed to share it with approved companies only.
  // The form is right here, pointed back at this job (research, 2026-11-23: ask at the point of acting, keep the place).
  if (state === "signed_out") return <div className="bare-screen company-job company-job-gate"><h1>{GATE_HEADING}</h1>
    {linkState === "ended" && <p role="status">{SIGN_IN_LINK_ENDED.replace(" on this page.", " on the sign-in page.")}</p>}
    <PublicJobFacts jobId={jobId} />
    <p>{GATE_WHAT_YOU_SEE}</p>
    <ul aria-label="What an approved company sees">{GATE_UNLOCKS.map(line => <li key={line}>{line}</li>)}</ul>
    <p className="ms-field-hint">{GATE_RETURN}</p>
    <div className="company-job-gate-form"><PartnerApplication returnToJob={`/jobs/${jobId}`} heading="Your company" /></div>
    <p>Already approved? <a href={signInHref}>Sign in</a></p></div>;
  if (state === "missing" && access && (access.status === "applied" || (access.status === "approved" && !access.emailVerified)))
    return <div className="bare-screen company-job"><RobotTeamEarlyAccess access={access} email={user?.email ?? null}
      returnTo={companyJobReturnPath(`/jobs/${jobId}`) ?? JOB_LIBRARY_URL} onVerified={() => setRetry(value => value + 1)} /></div>;
  // The page knows the account's access, so it says which case this is instead of guessing.
  if (state === "missing" && (access?.status === "approved" || access?.staff))
    return <div className="bare-screen company-job"><h1>This job is no longer available</h1>
      <p><a href={backHref}>Back to jobs</a></p></div>;
  if (state === "missing" && access?.status === "none") return <div className="bare-screen company-job"><h1>This job is not available</h1>
    <p>Only approved deployment companies can see jobs. <a href={companyApplicationHref(jobId)}>Apply to see jobs</a></p></div>;
  // A company Blueprint did not approve: said as that, in the words of its application page (`RobotTeamEarlyAccess`).
  if (state === "missing" && access?.status === "declined") return <div className="bare-screen company-job"><h1>This job is not available</h1>
    <p>{DECLINED_COMPANY_LINE} <a href={`mailto:${DECLINED_COMPANY_CONTACT}`}>{DECLINED_COMPANY_CONTACT}</a>.</p></div>;
  if (state === "missing") return <div className="bare-screen company-job"><h1>This job is not available</h1>
    <p>It may no longer be shared, or your account may not be approved. <a href={backHref}>Back to jobs</a></p></div>;
  if (state === "error" || !page) return <div className="bare-screen company-job"><div role="alert"><p>This job could not be loaded.</p>
    <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button></div></div>;

  const simulationReady = page.simulationDownload?.state === "ready";
  // One column of what the job is, beside the form; the page ends with the form (owner, 2026-11-25: the cards that sat
  // below the form were missed, and took more room than they were worth).
  return <div className="bare-screen company-job company-job-ready" role="region" aria-label="Job">
    <a className="company-job-back" href={backHref}><ArrowLeft size={17} aria-hidden="true" />Back to jobs</a>
    <h1>{page.headline || jobTitleForDisplay(page.title)}</h1>
    <div className="opportunity-meta">
      {page.country && <span><MapPin size={15} aria-hidden="true" />{page.country}</span>}
      {page.headlineFacts.map(fact => <span key={fact}>{fact}</span>)}
      {sharedOnInWords(page.publishedAtIso) && <span>{sharedOnInWords(page.publishedAtIso)}</span>}
    </div>
    {page.aboutSite.length > 0 && <ul className="company-job-about" aria-label="About the site">
      {page.aboutSite.map(line => <li key={line}>{line}</li>)}</ul>}
    <div className="company-job-actions">
      {user && <a className="ms-button" href="#answer-this-job">Apply or respond<ArrowDown size={16} aria-hidden="true" /></a>}
      {/* Seen in the browser first, with no download (owner, 2026-11-25). */}
      {page.simulation.state === "ready" && <a className="company-job-download" href={page.simulation.viewerUrl}><Eye size={16} aria-hidden="true" />View the simulation</a>}
      {/* Named by the package's version and sized, so an old and a new package are never confused (owner, 2026-11-25). */}
      {page.simulationDownload?.state === "ready" && <a className="company-job-download" href={page.simulationDownload.url}
        download={page.simulationDownload.fileName ?? ""}><Download size={16} aria-hidden="true" />{simulationDownloadLabel(page.simulationDownload.sizeBytes)}</a>}
      {user && <JobSummaryDownload user={user} jobId={page.id} onRefused={refreshTickets} />}
    </div>
    {/* What the download holds, or where the simulation stands, in a line under its buttons. */}
    {(simulationReady || page.simulation.state !== "ready") && <section className="company-job-simulation" aria-label="Simulation of the site">
      {simulationReady
        ? <p className="ms-field-hint">{SIMULATION_DOWNLOAD_HINT}</p>
        : <p className="ms-field-hint" role="status">{page.simulationStatus ?? SIMULATION_NOT_FINISHED}</p>}
      {user && !simulationReady && page.simulationRequest?.state === "can_ask" && <AskForSimulation user={user} jobId={page.id}
        onChanged={refreshTickets} />}
      {page.simulationDownload?.state === "ready" && page.simulationDownload.objectIncluded === false ? <p className="ms-field-hint" role="note">{SIMULATION_WITHOUT_OBJECT}</p> : null}
    </section>}

    {user && page.pilotRequest && <PilotRequestBanner user={user} page={page} onChanged={refreshTickets} />}

    <div className="company-job-grid">
      <div className="company-job-overview">
        <section aria-label="The job">
          <h2>{JOB_PAGE_HEADINGS.job}</h2>
          {page.sentence ? <blockquote>{page.sentence}</blockquote> : <p>{SITE_DESCRIPTION_CANT_BE_SHOWN}</p>}
          {/* Only when the site said, or while its rule is being prepared: no box saying the site has not said. */}
          {(page.successRule || page.successRulePending) && <div className="company-job-success"><h3>{JOB_PAGE_HEADINGS.done}</h3>
            <p>{page.successRule || SUCCESS_RULE_CANT_BE_SHOWN}</p></div>}
        </section>

        <section aria-label="At a glance">
          <h2>{JOB_PAGE_HEADINGS.glance}</h2>
          <FitSummary rows={page.fitSummary} />
          {fitRowsHoldSiteAnswers(page.fitSummary) && <p className="ms-field-hint">{SITE_ANSWERS_HINT}</p>}
        </section>

        {/* The Pipeline's facts about the object, only once there are some (or while they are being checked). */}
        {(page.packetFacts || page.packetFactsPending) && <section aria-label="The object and how sure we are">
          <h2>{JOB_PAGE_HEADINGS.object}</h2>
          {page.packetFacts ? <>
            {page.packetFacts.object.length > 0 && <ul aria-label="The object and where it goes">
              {page.packetFacts.object.map(line => <li key={line}>{line}</li>)}</ul>}
            {page.packetFacts.measured.length > 0 && <><h3>{JOB_PAGE_HEADINGS.measured}</h3>
              <ul aria-label="Measured">{page.packetFacts.measured.map(line => <li key={line}>{line}</li>)}</ul></>}
            {page.packetFacts.estimated.length > 0 && <><h3>{JOB_PAGE_HEADINGS.estimated}</h3>
              <ul aria-label="Estimated">{page.packetFacts.estimated.map(line => <li key={line}>{line}</li>)}</ul></>}
          </> : <p role="status">{PACKET_FACTS_PENDING}</p>}
        </section>}

        <section aria-label="The video">
          <h2>{JOB_PAGE_HEADINGS.video}</h2>
          {page.video.state === "ready"
            ? <CompanyJobVideo url={page.video.url} poster={page.thumbnailUrl ?? undefined} width={page.video.width}
                height={page.video.height} onTicketEnded={refreshTickets} />
            : <p>{VIDEO_PREPARING}</p>}
        </section>

        {/* The same for every job of its kind, so folded: one line until a company opens it. */}
        <section aria-label="A visit must confirm" className="company-job-visit">
          <details>
            <summary>{JOB_PAGE_HEADINGS.visit}</summary>
            <ul aria-label="What a visit must confirm">{page.visitMustConfirm.map(line => <li key={line}>{line}</li>)}</ul>
          </details>
          <p className="ms-field-hint">{NOTHING_TESTED_AT_SITE}</p>
        </section>
      </div>

      {user && <CompanyAnswerForm key={page.id} jobId={page.id} user={user} page={page} />}
    </div>
  </div>;
}

/**
 * The site asked for this company's pilot (owner, 2026-11-28): one banner with the company's own terms as of the request.
 * Confirm is an Apply under the company's response line, shown beside the button and recorded with the answer; because the
 * site already asked, the introduction is then made the way Accept makes it. Need more details and Not a fit are the form's
 * own answers below, unchanged. After the introduction, the pilot sheet.
 */
/**
 * "Ask for a simulation" (owner, 2026-11-28): one press asks for the job's simulation for every company. The page then
 * reads the job again and says when it was asked.
 */
function AskForSimulation({ user, jobId, onChanged }: { user: User; jobId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function ask() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/site-worlds/jobs/${encodeURIComponent(jobId)}/simulation-request`, { method: "POST",
        credentials: "include", headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: "{}" });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok !== true) { setMessage(typeof body?.error === "string" ? body.error : SIMULATION_ASK_FAILED); return; }
      onChanged();
    } catch { setMessage(SIMULATION_ASK_FAILED); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="ms-button" onClick={() => void ask()} disabled={busy}>{busy ? "Saving…" : ASK_FOR_SIMULATION_LABEL}</button>
    {message && <p role="status">{message}</p>}
  </>;
}

function PilotRequestBanner({ user, page, onChanged }: { user: User; page: CompanyJobPage; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = page.pilotRequest!;
  async function confirm() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/site-worlds/jobs/${encodeURIComponent(page.id)}/pilot-request`, { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ decision: "confirm", statementVersion: page.responseStatement.version }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok !== true) { setMessage(typeof body?.error === "string" ? body.error : PILOT_CONFIRM_FAILED); return; }
      // The page reads the job again and says where the request stands.
      onChanged();
    } catch { setMessage(PILOT_CONFIRM_FAILED); }
    finally { setBusy(false); }
  }
  const status = request.state === "confirmed" ? (request.introducedAtIso ? pilotCompanyConfirmedLine(request.introducedAtIso)
    : PILOT_COMPANY_CONFIRMED_PENDING)
    : request.state === "refused" ? pilotCompanyRefusedLine(request.refusal) : null;
  const waiting = request.state === "requested" || request.state === "question" || request.state === "declined";
  return <section className="company-pilot-request" aria-label="Pilot request">
    <h2>{PILOT_REQUEST_BANNER}</h2>
    {/* After the introduction the sheet below holds the terms as of the request: they are not listed twice. */}
    {!page.pilotSheet && <>
      <p className="ms-field-hint">{pilotRequestAskedLine(request.requestedAtIso)}</p>
      <ul aria-label="Your pilot terms">{pilotTermsLines(request.terms, "company").map(line => <li key={line}>{line}</li>)}</ul>
    </>}
    {request.state === "question" && <p className="ms-field-hint">{PILOT_COMPANY_QUESTION}</p>}
    {request.state === "declined" && <p className="ms-field-hint">{PILOT_COMPANY_DECLINED}</p>}
    {status && <p role="status">{status}</p>}
    {waiting && <>
      <button type="button" className="ms-button" onClick={() => void confirm()} disabled={busy}
        aria-describedby="company-pilot-statement">{busy ? "Saving…" : PILOT_CONFIRM_LABEL}</button>
      <p className="ms-field-hint" id="company-pilot-statement">{page.responseStatement.text}</p>
      <p className="ms-field-hint">{PILOT_CONFIRM_OTHER_ANSWERS}</p>
    </>}
    {message && <p role="status">{message}</p>}
    {page.pilotSheet && <PilotSheet sheet={page.pilotSheet} />}
  </section>;
}

/**
 * The site's answers as fields a company scans like a load post. Each answer and each "Not sure" is a row; the questions
 * the site skipped are named on one line under them, not given a row each (owner, 2026-11-25: five "Not stated" rows).
 * A skipped question Blueprint estimated keeps its row, pointing at the estimate.
 */
function FitSummary({ rows }: { rows: FitSummaryRow[] }) {
  if (rows.length === 0) return <p>{NOT_STATED}.</p>;
  const { shown, skipped } = fitRowsShown(rows);
  return <div className="company-fit" aria-label="The site's answers">
    {shown.length > 0 && <dl className="company-fit-summary">{shown.map(row => <div key={row.key}
      className={row.state === "stated" || row.state === "from_video" ? undefined : "company-fit-missing"}>
      <dt>{row.label}</dt>
      <dd>{fitRowValue(row)}{fitRowMarks(row).map(mark => <span key={mark} className="ms-field-hint">{mark}</span>)}</dd>
    </div>)}</dl>}
    {skipped.length > 0 && <p className="company-fit-skipped"><strong>{NOT_STATED_YET}</strong> {skipped.map(row => row.label).join(" · ")}</p>}
  </div>;
}

/**
 * How long a saved file's object URL lives after the save starts. Revoking it at once can cancel the save in Safari and
 * older Firefox; FileSaver.js waits 40 seconds for the same reason (as the job console's package download does).
 */
export const SAVED_FILE_URL_REVOKE_DELAY_MS = 40_000;

/**
 * "Download the job summary (PDF)": the page's words as a PDF a company can forward inside its own team
 * (`server/utils/companyJobSummary.ts`). Fetched with the account's sign-in (an address alone cannot carry it), under
 * every check the page itself has, and saved as `job-summary-<short job ref>.pdf`. A refusal (a withdrawn job, the Terms)
 * reloads the page, which then says why.
 */
function JobSummaryDownload({ user, jobId, onRefused }: { user: User; jobId: string; onRefused: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function download() {
    if (busy) return;
    setBusy(true); setFailed(false);
    try {
      const response = await fetch(`/api/site-worlds/jobs/${encodeURIComponent(jobId)}/summary.pdf`, { headers: await withFirebaseAuthHeaders(user) });
      if (!response.ok) {
        setFailed(true);
        if (response.status === 403 || response.status === 404) onRefused();
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = jobSummaryFileName(jobId);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), SAVED_FILE_URL_REVOKE_DELAY_MS);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="company-job-download" onClick={() => void download()} disabled={busy}>
      <FileText size={16} aria-hidden="true" />{JOB_SUMMARY_DOWNLOAD_LABEL}</button>
    {failed && <p className="company-job-actions-note ms-field-hint" role="alert">{JOB_SUMMARY_UNAVAILABLE}</p>}
  </>;
}

/** Said when the estimate's two ends cannot be read as US dollars from low to high. */
export const ESTIMATE_INVALID = "Enter the estimate in US dollars, such as 1,200 or 0.35, with at most two decimals and the lower "
  + `amount first, or leave both empty. ${ESTIMATE_LIMITS}`;

/**
 * An amount as typed: a dollar sign, spaces and thousands commas are allowed ("$1,200", "$45.00"), and cents up to two
 * decimals ("0.35", ".35"). A comma that does not group thousands ("0,35", "1,2") is refused, never read as something else.
 */
const TYPED_AMOUNT = /^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{0,2})?|\.\d{1,2})$/;

/** The typed estimate in dollars and cents, null when left empty, or "invalid". Needs a way of charging that has a unit. */
export function typedEstimate(model: ChargeModel | undefined, low: string, high: string): ApplicationEstimate | null | "invalid" {
  // Full-width digits and signs (typed on some keyboards) read as their plain forms.
  const read = (value: string) => value.normalize("NFKC").replace(/[$\s]/g, "");
  const [a, b] = [read(low), read(high)];
  if (!a && !b) return null;
  if (!model || !ESTIMATE_UNITS[model]) return "invalid";
  if (![a || b, b || a].every(value => TYPED_AMOUNT.test(value))) return "invalid";
  const amount = (value: string) => Number(value.replace(/,/g, ""));
  const estimate = { lowUsd: amount(a || b), highUsd: amount(b || a) };
  return isApplicationEstimate(estimate, model) ? estimate : "invalid";
}

/** Which end of a refused estimate to point at: "To" when only it fails on its own, else "From". */
export function estimateEndToFix(model: ChargeModel | undefined, low: string, high: string): "low" | "high" {
  const alone = (value: string) => typedEstimate(model, value, value);
  return alone(low) !== "invalid" && low.trim() !== "" && alone(high) === "invalid" ? "high" : "low";
}

/** Under "What a visit must confirm" (stress test round 2, 2026-11-24: the field had no hint). */
export const VISIT_NOTE_HINT = `What you would need to see at the site before you commit, in ${VISIT_NOTE_LIMIT} characters at most. `
  + "The site reads it with your application.";

/** The fields a refusal can point at: marked invalid, focused and scrolled into view (stress test round 2, 2026-11-24). */
type AnswerField = "inputs" | "low" | "high" | "visit" | "question";
/** The field a server refusal names (`interestRefusal`'s `field`), as this form holds it. */
const SERVER_FIELDS: Readonly<Record<string, AnswerField>> = { inputs: "inputs", estimate: "low", visitMustConfirm: "visit",
  question: "question" };

/**
 * The job's video. Its address carries a short ticket; when the page brings a fresh address the video continues from
 * the same place, playing if it was. A failure once its address is a minute old asks the page for a fresh ticket.
 */
function CompanyJobVideo({ url, poster, width, height, onTicketEnded }: { url: string; poster?: string; width: number; height: number;
  onTicketEnded: () => void }) {
  const element = useRef<HTMLVideoElement>(null);
  const place = useRef({ time: 0, playing: false });
  const resume = useRef<{ time: number; playing: boolean } | null>(null);
  const receivedAt = useRef(Date.now());
  const firstUrl = useRef(url);
  useEffect(() => {
    receivedAt.current = Date.now();
    if (url !== firstUrl.current) resume.current = { ...place.current };
  }, [url]);
  const remember = () => { const video = element.current; if (video && !resume.current) place.current.time = video.currentTime; };
  return <video ref={element} src={url} poster={poster} controls controlsList="nodownload noremoteplayback" disablePictureInPicture preload="metadata"
    playsInline onContextMenu={event => event.preventDefault()} width={width} height={height} aria-label="The site's video, without sound"
    onTimeUpdate={remember} onSeeking={remember}
    onPlay={() => { place.current.playing = true; }} onPause={() => { if (!resume.current) place.current.playing = false; }}
    onEnded={() => { place.current.playing = false; }}
    onLoadedMetadata={() => {
      const video = element.current, from = resume.current;
      resume.current = null;
      if (!video || !from) return;
      if (from.time > 0) video.currentTime = from.time;
      if (from.playing) void video.play()?.catch(() => undefined);
    }}
    onError={() => { if (Date.now() - receivedAt.current >= TICKET_REFRESH_MARGIN_MS) onTicketEnded(); }} />;
}

/**
 * The one answer form: Apply, Not a fit or Need more details and the company's words, with the recorded line under it
 * (E5). It offers no tested answer (owner, 2026-11-25). Nothing is chosen for the company: a first answer starts empty
 * and the browser asks for one; a later visit shows the answer it gave, and a stored tested answer, which the form no
 * longer offers, is named above the form and left unchosen.
 */
function CompanyAnswerForm({ jobId, user, page }: { jobId: string; user: User; page: CompanyJobPage }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const prior = page.myAnswer;
  const [answer, setAnswer] = useState<CompanyResponseState | null>(prior && FIT_RESPONSE_STATES.includes(prior.state) ? prior.state : null);
  const [inputs, setInputs] = useState(prior?.inputs ?? "");
  const [details, setDetails] = useState<CompanyReplyDetails>(prior?.details ?? {});
  // The estimate's two ends as typed (dollars and cents; a dollar sign and thousands commas allowed), kept apart from the
  // stored numbers until sent.
  const [estimateLow, setEstimateLow] = useState(prior?.details?.estimate ? String(prior.details.estimate.lowUsd) : "");
  const [estimateHigh, setEstimateHigh] = useState(prior?.details?.estimate ? String(prior.details.estimate.highUsd) : "");
  // The answer on record: the page's, then the one just saved, so "You answered" never names an answer it replaced.
  const [mine, setMine] = useState(page.myAnswer);
  const noteRequired = answer !== null && companyResponseNeedsNote(answer);
  const noteLabel = noteRequired ? "What details would help you decide?" : "Note to the site";
  const formLabel = "Your response";
  // The field a refusal points at, with a count so the same field is focused again on the next refusal.
  const [invalid, setInvalid] = useState<{ field: AnswerField; n: number } | null>(null);
  const fieldRefs = { inputs: useRef<HTMLTextAreaElement>(null), low: useRef<HTMLInputElement>(null), high: useRef<HTMLInputElement>(null),
    visit: useRef<HTMLInputElement>(null), question: useRef<HTMLInputElement>(null) };
  const optional = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!invalid) return;
    if (invalid.field === "question" && optional.current) optional.current.open = true;
    const field = fieldRefs[invalid.field].current;
    field?.scrollIntoView?.({ block: "center" });
    field?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalid]);
  const refuse = (field: AnswerField | null, text: string) => {
    setMessage(text);
    setInvalid(field ? current => ({ field, n: (current?.n ?? 0) + 1 }) : null);
  };
  /** A field's own description, and the refusal's message while the refusal points at it. */
  const invalidProps = (field: AnswerField, describedBy?: string) => {
    const marked = invalid?.field === field;
    const ids = [describedBy, marked ? "company-answer-message" : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": marked ? true : undefined, ...(ids ? { "aria-describedby": ids } : {}) };
  };
  const edited = (field: AnswerField) => { if (invalid?.field === field) setInvalid(null); };
  function choose(state: CompanyResponseState) { setAnswer(state); setMessage(""); setInvalid(null); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || !answer) return;
    const application = INTRODUCIBLE_RESPONSE_STATES.includes(answer);
    // Only an estimate the company can see counts: one typed under a way of charging it then changed to one with no
    // unit ("Not decided yet", "Not specified") is hidden, so it is left out rather than blocking the application.
    const shown = application && details.chargeModel !== undefined && ESTIMATE_UNITS[details.chargeModel] !== null;
    const estimate = shown ? typedEstimate(details.chargeModel, estimateLow, estimateHigh) : null;
    if (estimate === "invalid") { refuse(estimateEndToFix(details.chargeModel, estimateLow, estimateHigh), ESTIMATE_INVALID); return; }
    setSaving(true); setMessage(""); setInvalid(null);
    try {
      const question = answer === "needs_something" ? undefined : details.question?.trim() || undefined;
      const visit = application ? details.visitMustConfirm?.trim() || undefined : undefined;
      const sent: CompanyReplyDetails = { ...(question ? { question } : {}), ...(details.startWindow ? { startWindow: details.startWindow } : {}),
        ...(application && details.chargeModel ? { chargeModel: details.chargeModel } : {}), ...(estimate ? { estimate } : {}),
        ...(application && details.similarJobs ? { similarJobs: details.similarJobs } : {}), ...(visit ? { visitMustConfirm: visit } : {}) };
      const response = await fetch(`/api/site-worlds/tasks/${encodeURIComponent(jobId)}/interest`, { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ state: answer, inputs, statementVersion: page.responseStatement.version,
          ...(answer !== "declined" && Object.keys(sent).length ? { details: sent } : {}),
        }) });
      const body = await response.json();
      if (!response.ok) refuse(typeof body.field === "string" ? SERVER_FIELDS[body.field] ?? null : null, body.error || "Your answer was not saved.");
      else setMessage(body.nextAction);
      if (response.ok) setMine({ state: answer, inputs, details: sent, updatedAtIso: new Date().toISOString(), statementVersion: page.responseStatement.version });
    } catch { setMessage("We could not reach Blueprint. Check your connection and try again."); }
    finally { setSaving(false); }
  }
  return <section id="answer-this-job" aria-label={formLabel} tabIndex={-1}>
    <h2>Your response</h2>
    {mine && <p className="ms-field-hint">{mine.state === "interested" ? "You applied" : `You answered “${COMPANY_RESPONSE_LABELS[mine.state]}”`}{mine.updatedAtIso ? ` on ${dateInWords(mine.updatedAtIso)}` : ""}.
      {(mine.state === "interested" || mine.state === "tested_can_do")
        && !COMPANY_ESTIMATE_STATEMENT_VERSIONS.includes(mine.statementVersion ?? "")
        ? ` ${mine.state === "interested" ? "Send it again" : "Apply"} below so the site sees your company's name, website and any estimate with it.` : ""}</p>}
    {page.pendingQuestion && <p className="ms-field-hint" role="status">{Date.parse(page.pendingQuestion.replyByIso) <= Date.now()
      ? companyQuestionOverdue(dateInWords(page.pendingQuestion.replyByIso), page.pendingQuestion.reminded)
      : companyQuestionWaiting(dateInWords(page.pendingQuestion.askedAtIso), dateInWords(page.pendingQuestion.replyByIso))}</p>}
    {page.clarification && <div className="company-question" role="region" aria-label="Answer from the site">
      <dl className="company-response-facts">
        <div><dt>Your question</dt><dd>{page.clarification.question}</dd></div>
        <div><dt>Answer from the site</dt><dd>{page.clarification.answer ?? (page.clarification.limitReached ? SITE_REPLY_LIMIT : SITE_REPLY_BEING_PREPARED)}</dd></div>
      </dl>
    </div>}
    <form onSubmit={submit} className="ms-form" aria-label={formLabel}>
      <fieldset className="company-answer-options"><legend>Will you apply for this job?</legend>
        {FIT_RESPONSE_STATES.map(state => <label key={state}><input type="radio" name="state" value={state} required
          checked={answer === state} onChange={() => choose(state)} /> {COMPANY_RESPONSE_LABELS[state]}</label>)}
      </fieldset>
      <label>{noteLabel}
        <textarea ref={fieldRefs.inputs} name="inputs" required={noteRequired} minLength={noteRequired ? 4 : undefined} maxLength={2000} value={inputs}
          onChange={event => { setInputs(event.target.value); edited("inputs"); }}
          {...invalidProps("inputs", "company-answer-words-hint")} /></label>
      <p className="ms-field-hint" id="company-answer-words-hint">{WORDS_REACH_SITE}</p>
      {answer && INTRODUCIBLE_RESPONSE_STATES.includes(answer) && <fieldset className="company-application" aria-describedby="company-application-hint">
        <legend>Your application at a glance</legend>
        <p className="ms-field-hint" id="company-application-hint">The site compares these side by side. Every field is optional.</p>
        <label>How you charge<select value={details.chargeModel ?? ""}
          onChange={event => setDetails({ ...details, chargeModel: (event.target.value || undefined) as ChargeModel | undefined })}>
          <option value="">Not specified</option>
          {CHARGE_MODELS.map(model => <option key={model} value={model}>{CHARGE_MODEL_LABELS[model]}</option>)}
        </select></label>
        {details.chargeModel && ESTIMATE_UNITS[details.chargeModel] && <div className="company-estimate" role="group" aria-label="Estimate before a site visit">
          {/* Each end names its unit and the estimate's line to a screen reader (stress test round 2, 2026-11-24). */}
          <span className="company-estimate-title" id="company-estimate-unit">Estimate, in US dollars {ESTIMATE_UNITS[details.chargeModel]}</span>
          <label>From<input ref={fieldRefs.low} inputMode="decimal" value={estimateLow}
            onChange={event => { setEstimateLow(event.target.value); edited("low"); }}
            {...invalidProps("low", "company-estimate-unit company-estimate-hint")} /></label>
          <label>To<input ref={fieldRefs.high} inputMode="decimal" value={estimateHigh}
            onChange={event => { setEstimateHigh(event.target.value); edited("high"); }}
            {...invalidProps("high", "company-estimate-unit company-estimate-hint")} /></label>
          <p className="ms-field-hint" id="company-estimate-hint">{ESTIMATE_LABEL} Leave it empty if you would rather not give one before a visit.</p>
        </div>}
        <label>Similar jobs you have done<select value={details.similarJobs ?? ""}
          onChange={event => setDetails({ ...details, similarJobs: (event.target.value || undefined) as SimilarJobs | undefined })}>
          <option value="">Not specified</option>
          {SIMILAR_JOBS.map(band => <option key={band} value={band}>{SIMILAR_JOBS_LABELS[band]}</option>)}
        </select></label>
        <label>Earliest start<select value={details.startWindow ?? ""}
          onChange={event => setDetails({ ...details, startWindow: event.target.value as CompanyStartWindow || undefined })}>
          <option value="">Not specified</option>
          {COMPANY_START_WINDOWS.map(window => <option key={window} value={window}>{COMPANY_START_LABELS[window]}</option>)}
        </select></label>
        <label>What a visit must confirm<input ref={fieldRefs.visit} maxLength={VISIT_NOTE_LIMIT} value={details.visitMustConfirm ?? ""}
          onChange={event => { setDetails({ ...details, visitMustConfirm: event.target.value }); edited("visit"); }}
          {...invalidProps("visit", "company-visit-hint")} /></label>
        <p className="ms-field-hint" id="company-visit-hint">{VISIT_NOTE_HINT}</p>
      </fieldset>}
      {answer && answer !== "declined" && <details className="company-reply-optional" ref={optional}>
        <summary className="ms-inline-link">Add details</summary>
        {answer !== "needs_something" && <label>Question for the site<input ref={fieldRefs.question} minLength={4} maxLength={COMPANY_QUESTION_LIMIT}
          value={details.question ?? ""} onChange={event => { setDetails({ ...details, question: event.target.value }); edited("question"); }}
          {...invalidProps("question")} /></label>}
        {!INTRODUCIBLE_RESPONSE_STATES.includes(answer) && <label>Earliest start<select value={details.startWindow ?? ""}
          onChange={event => setDetails({ ...details, startWindow: event.target.value as CompanyStartWindow || undefined })}>
          <option value="">Not specified</option>
          {COMPANY_START_WINDOWS.map(window => <option key={window} value={window}>{COMPANY_START_LABELS[window]}</option>)}
        </select></label>}
      </details>}
      <button className="ms-button" disabled={saving} aria-describedby="company-answer-statement">{saving ? "Saving…" : "Send"}</button>
      {message && <p role="status" id="company-answer-message">{message}</p>}
      <p className="ms-field-hint" id="company-answer-statement">{page.responseStatement.text}</p>
    </form>
  </section>;
}
