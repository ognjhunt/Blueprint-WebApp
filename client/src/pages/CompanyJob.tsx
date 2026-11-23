import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { ArrowLeft, ArrowDown, Download, MapPin } from "lucide-react";
import type { User } from "firebase/auth";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { companyApplicationHref, companyJobReturnPath, companyJobSignInHref } from "@/lib/authReturnPath";
import { COMPANY_QUESTION_LIMIT, COMPANY_RESPONSE_LABELS, COMPANY_START_LABELS, COMPANY_START_WINDOWS, FIT_RESPONSE_STATES, TESTED_RESPONSE_STATES,
  companyResponseNeedsNote, type CompanyReplyDetails, type CompanyResponseState, type CompanyStartWindow } from "@/lib/companyResponses";
import { JobCardAnswer } from "@/components/site/JobCardAnswer";
import { MinimalSiteLayout } from "@/components/site/MinimalSiteLayout";
import { CompanyTermsPrompt } from "@/components/site/CompanyTermsPrompt";
import { RobotTeamEarlyAccess } from "@/components/site/RobotTeamEarlyAccess";
import { jobTitleForDisplay, type CompanyJobPage } from "@/types/taskBrowse";
import { BROWSE_JOBS_PATH, type LibraryAccess } from "@/lib/robotTeamAccess";
import { SIGN_IN_LINK_ENDED, signInWithCompanyLink, takeSignInLinkFromAddress } from "@/lib/companySignInLink";

/** Said while the sound-free copy of the site's video is not ready. */
/** The job library: the signed-in list on the companies' page, at its own section. */
export const JOB_LIBRARY_URL = BROWSE_JOBS_PATH;
export const VIDEO_PREPARING = "The video is being prepared.";
/** Under the words box: the site reads them, with the company's identity taken out first (`jobCompanies.siteReasonOf`). */
export const WORDS_REACH_SITE = "The site reads these words, with your company's name and contact details taken out.";
export const SIMULATION_NOT_FINISHED = "The simulation of the site is not finished yet.";
export const NO_FIRST_LOOK = "Our first look is not ready yet.";
export const NO_PACKET_FACTS = "Nothing about the object is measured or estimated yet.";
/** Under the site's quick answers: they are its own statements. */
export const SITE_ANSWERS_HINT = "The site's own answers. Blueprint has not checked them.";

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
 * The company's page for one job (package E, E3). Everything on it comes from the server's closed payload
 * (`server/utils/companyJobPage.ts`): the site's sentence, its quick answers, the country, the video, what the video
 * shows of the object and how sure each figure is, the first look, and the simulation, each when it exists, and the
 * answer form. The only download offered is the
 * simulation package (E9); the video is played, with its download control hidden (which discourages saving; it cannot
 * prevent it).
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
  function show(loaded: LoadedJob) {
    if (loaded.kind === "missing") { setAccess(loaded.access); setState("missing"); }
    else if (loaded.kind === "terms") setState("terms");
    else { setPage(loaded.item); setState("ready"); }
  }
  // A new-job email's link (owner, 2026-11-23): it signs a signed-out company in on the way to this job. A company
  // already signed in goes straight to the job and the link stays unspent.
  const [link] = useState(takeSignInLinkFromAddress);
  const [linkState, setLinkState] = useState<"unused" | "signing_in" | "ended">("unused");
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
  useEffect(() => {
    if (!link || user || !auth || auth.loading || linkState !== "unused") return;
    setLinkState("signing_in");
    // Signing in changes the account, and the job loads for it below.
    signInWithCompanyLink(link).catch(() => setLinkState("ended"));
  }, [link, user, auth?.loading, linkState]);
  useEffect(() => {
    const signingIn = Boolean(link) && (linkState === "signing_in" || linkState === "unused");
    if (!user) { setState(auth && !auth.loading && !signingIn ? "signed_out" : "loading"); return; }
    let cancelled = false;
    const generation = ++loadGeneration.current;
    setState("loading");
    loadCompanyJob(user, jobId).then(loaded => { if (!cancelled && generation === loadGeneration.current) show(loaded); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [jobId, user?.uid, retry, auth?.loading, linkState]);
  // Fresh tickets for the video and the download, from the same page request: a withdrawn job or a lost approval is
  // refused there and the page says so; a failed request leaves the page as it is, and the next failure asks again.
  const refreshing = useRef(false);
  const refreshTickets = useCallback(async () => {
    if (!user || refreshing.current) return;
    refreshing.current = true;
    const generation = loadGeneration.current;
    try {
      const loaded = await loadCompanyJob(user, jobId);
      if (generation === loadGeneration.current) show(loaded);
    } catch { /* The page stays; the next timer or video failure asks again. */ }
    finally { refreshing.current = false; }
  }, [user, jobId]);
  const videoUrl = page?.video.state === "ready" ? page.video.url : null;
  const downloadUrl = page?.simulationDownload?.state === "ready" ? page.simulationDownload.url : null;
  useEffect(() => {
    if (state !== "ready") return;
    const delay = ticketRefreshDelayMs([videoUrl, downloadUrl]);
    if (delay === null) return;
    const timer = setTimeout(() => { void refreshTickets(); }, delay);
    return () => clearTimeout(timer);
  }, [state, videoUrl, downloadUrl, refreshTickets]);

  if (state === "loading") return <div className="bare-screen company-job"><p role="status">Loading…</p></div>;
  if (state === "terms" && user) return <div className="bare-screen company-job"><CompanyTermsPrompt user={user} onAccepted={() => setRetry(retry + 1)} /></div>;
  if (state === "signed_out") return <div className="bare-screen company-job"><h1>Sign in to see this job</h1>
    {linkState === "ended" && <p role="status">{SIGN_IN_LINK_ENDED.replace(" on this page.", " on the sign-in page.")}</p>}
    <p><a className="ms-button" href={signInHref}>Sign in</a></p>
    <p><a href={companyApplicationHref(jobId)}>Apply to see jobs</a></p></div>;
  if (state === "missing" && access && (access.status === "applied" || (access.status === "approved" && !access.emailVerified)))
    return <div className="bare-screen company-job"><RobotTeamEarlyAccess access={access} email={user?.email ?? null}
      returnTo={companyJobReturnPath(`/jobs/${jobId}`) ?? JOB_LIBRARY_URL} onVerified={() => setRetry(value => value + 1)} /></div>;
  // The page knows the account's access, so it says which case this is instead of guessing.
  if (state === "missing" && (access?.status === "approved" || access?.staff))
    return <div className="bare-screen company-job"><h1>This job is no longer available</h1>
      <p><a href={backHref}>Back to jobs</a></p></div>;
  if (state === "missing" && access?.status === "none") return <div className="bare-screen company-job"><h1>This job is not available</h1>
    <p>Only approved deployment companies can see jobs. <a href={companyApplicationHref(jobId)}>Apply to see jobs</a></p></div>;
  if (state === "missing") return <div className="bare-screen company-job"><h1>This job is not available</h1>
    <p>It may no longer be shared, or your account may not be approved. <a href={backHref}>Back to jobs</a></p></div>;
  if (state === "error" || !page) return <div className="bare-screen company-job"><div role="alert"><p>This job could not be loaded.</p>
    <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button></div></div>;

  const simulationReady = page.simulationDownload?.state === "ready";
  return <div className="bare-screen company-job company-job-ready" role="region" aria-label="Job">
    <a className="company-job-back" href={backHref}><ArrowLeft size={17} aria-hidden="true" />Back to jobs</a>
    <h1>{jobTitleForDisplay(page.title)}</h1>
    <div className="opportunity-meta">
      {page.country && <span><MapPin size={15} aria-hidden="true" />{page.country}</span>}
      {dateInWords(page.publishedAtIso) && <span>Shared {dateInWords(page.publishedAtIso)}</span>}
    </div>
    <div className="company-job-actions">
      {user && <a className="ms-button" href="#answer-this-job">Respond<ArrowDown size={16} aria-hidden="true" /></a>}
      {page.simulationDownload?.state === "ready" && <a className="company-job-download" href={page.simulationDownload.url} download><Download size={16} aria-hidden="true" />Download the simulation</a>}
    </div>

    <div className="company-job-grid">
      <div className="company-job-overview">
        <section aria-label="The job">
          <h2>The job, in the site's words</h2>
          {page.sentence ? <blockquote>{page.sentence}</blockquote> : <p>The site's description can't be shown right now.</p>}
          {page.successRule && <div className="company-job-success"><h3>What counts as done</h3><p>{page.successRule}</p></div>}
          {page.jobFacts.length > 0 && <>
            <ul aria-label="The site's answers">{page.jobFacts.map(line => <li key={line}>{line}</li>)}</ul>
            <p className="ms-field-hint">{SITE_ANSWERS_HINT}</p>
          </>}
        </section>

        <section aria-label="The video">
          <h2>The video</h2>
          {page.video.state === "ready"
            ? <CompanyJobVideo url={page.video.url} poster={page.thumbnailUrl ?? undefined} width={page.video.width}
                height={page.video.height} onTicketEnded={refreshTickets} />
            : <p>{VIDEO_PREPARING}</p>}
        </section>
      </div>

      {user && <CompanyAnswerForm key={page.id} jobId={page.id} user={user} page={page} tested={simulationReady} />}

      <div className="company-job-evidence">
        <section aria-label="The object and how sure we are">
          <h2>The object, and how sure we are</h2>
          {page.packetFacts ? <>
            {page.packetFacts.object.length > 0 && <ul aria-label="The object and where it goes">
              {page.packetFacts.object.map(line => <li key={line}>{line}</li>)}</ul>}
            {page.packetFacts.measured.length > 0 && <><h3>Measured</h3>
              <ul aria-label="Measured">{page.packetFacts.measured.map(line => <li key={line}>{line}</li>)}</ul></>}
            {page.packetFacts.estimated.length > 0 && <><h3>Estimated</h3>
              <ul aria-label="Estimated">{page.packetFacts.estimated.map(line => <li key={line}>{line}</li>)}</ul></>}
          </> : <p>{NO_PACKET_FACTS}</p>}
          <h3>What this job packet does not show</h3>
          <ul aria-label="What this job packet does not show">{page.notShown.map(line => <li key={line}>{line}</li>)}</ul>
        </section>

        <section aria-label="First look">
          <h2>First look</h2>
          {page.firstLookRows.length > 0 && <ul aria-label="Robots on paper">{page.firstLookRows.map((row, index) =>
            <li key={`${index}-${row.robot}`}>{row.robot ? <strong>{row.robot}: </strong> : null}{row.text}</li>)}</ul>}
          {page.firstLookMore ? <p className="ms-field-hint">{page.firstLookMore}</p> : null}
          {/* "Not ready" only when nothing at all is shown: rows of robots on paper are a first look already. */}
          {page.firstLook ? <JobCardAnswer answer={page.firstLook} titled={false} />
            : page.firstLookRows.length === 0 ? <p>{NO_FIRST_LOOK}</p> : null}
        </section>

        <section aria-label="Simulation of the site">
          <h2>Simulation of the site</h2>
          {page.simulationDownload?.state === "ready"
            ? <p className="ms-field-hint">A 3D simulation of the site, to test in your own tools. Open scene.usda first; the README inside explains each file.</p>
            : null}
          {page.simulation.state === "ready"
            ? <p><a className="ms-button" href={page.simulation.viewerUrl}>View the simulation of the site</a></p>
            : page.simulationDownload?.state !== "ready" ? <p>{SIMULATION_NOT_FINISHED}</p> : null}
        </section>
      </div>
    </div>
  </div>;
}

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
 * The one answer form: the answers and the company's words, with the recorded line under it (E5). Once the simulation
 * can be downloaded it also offers the two tested answers. Nothing is chosen for the company: a first answer starts
 * empty and the browser asks for one; a later visit shows the answer it gave.
 */
function CompanyAnswerForm({ jobId, user, page, tested }: { jobId: string; user: User; page: CompanyJobPage; tested: boolean }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const prior = page.myAnswer;
  const [answer, setAnswer] = useState<CompanyResponseState | null>(prior && (tested || !TESTED_RESPONSE_STATES.includes(prior.state)) ? prior.state : null);
  const [inputs, setInputs] = useState(prior?.inputs ?? "");
  const [details, setDetails] = useState<CompanyReplyDetails>(prior?.details ?? {});
  // The answer on record: the page's, then the one just saved, so "You answered" never names an answer it replaced.
  const [mine, setMine] = useState(page.myAnswer);
  const testedAnswer = answer !== null && TESTED_RESPONSE_STATES.includes(answer);
  const noteRequired = answer !== null && (testedAnswer || companyResponseNeedsNote(answer));
  const noteLabel = testedAnswer ? "What did you test?" : noteRequired ? "What details would help you decide?" : "Note to the site";
  const formLabel = "Your response";
  function choose(state: CompanyResponseState) { setAnswer(state); setMessage(""); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || !answer) return;
    setSaving(true); setMessage("");
    try {
      const question = answer === "needs_something" ? undefined : details.question?.trim() || undefined;
      const response = await fetch(`/api/site-worlds/tasks/${encodeURIComponent(jobId)}/interest`, { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ state: answer, inputs, statementVersion: page.responseStatement.version,
          ...(answer !== "declined" && (question || details.startWindow) ? { details: { question, startWindow: details.startWindow } } : {}),
        }) });
      const body = await response.json();
      setMessage(response.ok ? body.nextAction : body.error || "Your answer was not saved.");
      if (response.ok) setMine({ state: answer, inputs, details, updatedAtIso: new Date().toISOString(), statementVersion: page.responseStatement.version });
    } catch { setMessage("We could not reach Blueprint. Check your connection and try again."); }
    finally { setSaving(false); }
  }
  return <section id="answer-this-job" aria-label={formLabel} tabIndex={-1}>
    <h2>Your response</h2>
    {mine && <p className="ms-field-hint">You answered “{COMPANY_RESPONSE_LABELS[mine.state]}”{mine.updatedAtIso ? ` on ${dateInWords(mine.updatedAtIso)}` : ""}.
      {(mine.state === "interested" || mine.state === "tested_can_do") && mine.statementVersion !== page.responseStatement.version
        ? " Answer again below so the site can ask for an introduction." : ""}</p>}
    {page.clarification && <div className="company-question" role="region" aria-label="Answer from the site">
      <dl className="company-response-facts">
        <div><dt>Your question</dt><dd>{page.clarification.question}</dd></div>
        <div><dt>Answer from the site</dt><dd>{page.clarification.answer}</dd></div>
      </dl>
    </div>}
    <form onSubmit={submit} className="ms-form" aria-label={formLabel}>
      <fieldset className="company-answer-options"><legend>Is this job a fit for your company?</legend>
        {(tested ? [...FIT_RESPONSE_STATES, ...TESTED_RESPONSE_STATES] : FIT_RESPONSE_STATES).map(state => <label key={state}><input type="radio" name="state" value={state} required
          checked={answer === state} onChange={() => choose(state)} /> {COMPANY_RESPONSE_LABELS[state]}</label>)}
      </fieldset>
      <label>{noteLabel}
        <textarea name="inputs" required={noteRequired} minLength={noteRequired ? 4 : undefined} maxLength={2000} value={inputs}
          onChange={event => setInputs(event.target.value)}
          aria-describedby="company-answer-words-hint" /></label>
      <p className="ms-field-hint" id="company-answer-words-hint">{WORDS_REACH_SITE}</p>
      {answer && answer !== "declined" && <details className="company-reply-optional">
        <summary className="ms-inline-link">Add details</summary>
        {answer !== "needs_something" && <label>Question for the site<input minLength={4} maxLength={COMPANY_QUESTION_LIMIT}
          value={details.question ?? ""} onChange={event => setDetails({ ...details, question: event.target.value })} /></label>}
        <label>Earliest start<select value={details.startWindow ?? ""}
          onChange={event => setDetails({ ...details, startWindow: event.target.value as CompanyStartWindow || undefined })}>
          <option value="">Not specified</option>
          {COMPANY_START_WINDOWS.map(window => <option key={window} value={window}>{COMPANY_START_LABELS[window]}</option>)}
        </select></label>
      </details>}
      <button className="ms-button" disabled={saving} aria-describedby="company-answer-statement">{saving ? "Saving…" : "Send response"}</button>
      {message && <p role="status">{message}</p>}
      <p className="ms-field-hint" id="company-answer-statement">{page.responseStatement.text}</p>
    </form>
  </section>;
}
