import { useEffect, useState } from "react";
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

/** Said while the sound-free copy of the site's video is not ready. */
/** The job library: the signed-in list on the companies' page, at its own section. */
export const JOB_LIBRARY_URL = BROWSE_JOBS_PATH;
export const VIDEO_PREPARING = "The video is being prepared.";
/** Said for a job the site sent with its description only. */
export const NO_VIDEO_YET = "No video yet. The site sent this job with its description only.";
/** Under the answer form when there is no video: how to ask for one with the answers that exist. */
export const ASK_FOR_VIDEO = "Need a video to decide? Choose Need more details.";
/** Under the words box: the site reads them, with the company's identity taken out first (`jobCompanies.siteReasonOf`). */
export const WORDS_REACH_SITE = "The site reads these words, with your company's name and contact details taken out.";
export const SIMULATION_NOT_FINISHED = "The simulation of the site is not finished yet.";
export const NO_FIRST_LOOK = "Our first look is not ready yet.";
export const NO_PACKET_FACTS = "Nothing about the object is measured or estimated yet.";
/** Under the site's quick answers: they are its own statements. */
export const SITE_ANSWERS_HINT = "The site's own answers. Blueprint has not checked them.";

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
  const [responseMode, setResponseMode] = useState<ResponseMode>("fit");
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
    if (!user) { setState(auth && !auth.loading ? "signed_out" : "loading"); return; }
    let cancelled = false;
    setState("loading");
    withFirebaseAuthHeaders(user).then(headers => fetch(`/api/site-worlds/jobs/${encodeURIComponent(jobId)}`, { headers }))
      .then(async response => {
        if (cancelled) return;
        if (response.status === 404) {
          const body = await response.json().catch(() => null) as { access?: LibraryAccess } | null;
          if (!cancelled) { setAccess(body?.access ?? null); setState("missing"); }
          return;
        }
        if (response.status === 403) {
          const body = await response.json().catch(() => ({})) as { code?: string };
          if (body.code === "terms_acceptance_required") { setState("terms"); return; }
        }
        if (!response.ok) throw new Error("unavailable");
        const body = await response.json() as { item?: CompanyJobPage };
        if (!body.item) throw new Error("invalid");
        setPage(body.item); setState("ready");
      }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [jobId, user?.uid, retry, auth?.loading]);

  if (state === "loading") return <div className="bare-screen company-job"><p role="status">Loading…</p></div>;
  if (state === "terms" && user) return <div className="bare-screen company-job"><CompanyTermsPrompt user={user} onAccepted={() => setRetry(retry + 1)} /></div>;
  if (state === "signed_out") return <div className="bare-screen company-job"><h1>Sign in to see this job</h1>
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
      {user && <a className="ms-button" href="#answer-this-job" onClick={() => setResponseMode("fit")}>Respond<ArrowDown size={16} aria-hidden="true" /></a>}
      {page.simulationDownload?.state === "ready" && <a className="company-job-download" href={page.simulationDownload.url} download><Download size={16} aria-hidden="true" />Download the simulation</a>}
      {simulationReady && user && <a className="company-job-download" href="#answer-this-job" onClick={() => setResponseMode("simulation")}>Report simulation result<ArrowDown size={16} aria-hidden="true" /></a>}
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
            ? <video src={page.video.url} controls controlsList="nodownload noremoteplayback" disablePictureInPicture preload="metadata"
                playsInline onContextMenu={event => event.preventDefault()}
                width={page.video.width} height={page.video.height} aria-label="The site's video, without sound" />
            : <p>{page.video.state === "none" ? NO_VIDEO_YET : VIDEO_PREPARING}</p>}
        </section>
      </div>

      {user && <CompanyAnswerForm key={page.id} jobId={page.id} user={user} page={page} mode={simulationReady ? responseMode : "fit"} />}

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
          {page.firstLook ? <JobCardAnswer answer={page.firstLook} titled={false} /> : <p>{NO_FIRST_LOOK}</p>}
        </section>

        <section aria-label="Simulation of the site">
          <h2>Simulation of the site</h2>
          {page.simulationDownload?.state === "ready"
            ? <p className="ms-field-hint">A 3D simulation of the site, to test in your own tools. Open scene.usda first; the README inside explains each file.</p>
            : null}
          {page.simulation.state === "ready"
            ? <p><a className="ms-button" href={page.simulation.viewerUrl} target="_blank" rel="noreferrer">View the simulation of the site</a></p>
            : page.simulationDownload?.state !== "ready" ? <p>{SIMULATION_NOT_FINISHED}</p> : null}
        </section>
      </div>
    </div>
  </div>;
}

/**
 * The answers and the company's words, with the recorded line under it (E5). Nothing is chosen for the company: a
 * first answer starts empty and the browser asks for one; a later visit shows the answer it gave.
 */
type ResponseMode = "fit" | "simulation";
type ResponseDraft = { answer: CompanyResponseState | null; inputs: string; details: CompanyReplyDetails };

function CompanyAnswerForm({ jobId, user, page, mode }: { jobId: string; user: User; page: CompanyJobPage; mode: ResponseMode }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<ResponseMode, ResponseDraft>>(() => {
    const empty = { answer: null, inputs: "", details: {} };
    const prior = page.myAnswer;
    if (!prior) return { fit: empty, simulation: empty };
    const draft = { answer: prior.state, inputs: prior.inputs, details: prior.details ?? {} };
    return TESTED_RESPONSE_STATES.includes(prior.state) ? { fit: empty, simulation: draft } : { fit: draft, simulation: empty };
  });
  // The answer on record: the page's, then the one just saved, so "You answered" never names an answer it replaced.
  const [mine, setMine] = useState(page.myAnswer);
  const { answer, inputs, details } = drafts[mode];
  const simulation = mode === "simulation";
  const noteRequired = simulation || (answer !== null && companyResponseNeedsNote(answer));
  const noteLabel = simulation ? "What did you test?" : noteRequired ? "What details would help you decide?" : "Note to the site";
  const formLabel = simulation ? "Simulation result" : "Your response";

  function editDraft(change: Partial<ResponseDraft>) {
    setDrafts(current => ({ ...current, [mode]: { ...current[mode], ...change } }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || !answer) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/site-worlds/tasks/${encodeURIComponent(jobId)}/interest`, { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ state: answer, inputs, statementVersion: page.responseStatement.version,
          ...(answer !== "declined" && (details.verified?.trim() || details.question?.trim() || details.startWindow) ? { details: {
            verified: details.verified?.trim() || undefined,
            question: answer === "needs_something" ? undefined : details.question?.trim() || undefined,
            startWindow: details.startWindow,
          } } : {}),
        }) });
      const body = await response.json();
      setMessage(response.ok ? body.nextAction : body.error || "Your answer was not saved.");
      if (response.ok) setMine({ state: answer, inputs, details, updatedAtIso: new Date().toISOString(), statementVersion: page.responseStatement.version });
    } catch { setMessage("We could not reach Blueprint. Check your connection and try again."); }
    finally { setSaving(false); }
  }
  return <section id="answer-this-job" aria-label={formLabel} tabIndex={-1}>
    <h2>{simulation ? "Simulation result" : "Your response"}</h2>
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
      <fieldset className="company-answer-options"><legend>{simulation ? "What was the result in simulation?" : "Is this job a fit for your company?"}</legend>
        {(simulation ? TESTED_RESPONSE_STATES : FIT_RESPONSE_STATES).map(state => <label key={state}><input type="radio" name="state" value={state} required
          checked={answer === state} onChange={() => editDraft({ answer: state })} /> {COMPANY_RESPONSE_LABELS[state]}</label>)}
      </fieldset>
      {!simulation && page.video.state === "none" && <p className="ms-field-hint">{ASK_FOR_VIDEO}</p>}
      <label>{noteLabel}
        <textarea name="inputs" required={noteRequired} minLength={noteRequired ? 4 : undefined} maxLength={2000} value={inputs}
          onChange={event => editDraft({ inputs: event.target.value })}
          aria-describedby="company-answer-words-hint" /></label>
      <p className="ms-field-hint" id="company-answer-words-hint">{WORDS_REACH_SITE}</p>
      {answer && answer !== "declined" && <details className="company-reply-optional">
        <summary className="ms-inline-link">Add details</summary>
        {!simulation && <label>What you have checked<input maxLength={COMPANY_QUESTION_LIMIT} value={details.verified ?? ""}
          onChange={event => editDraft({ details: { ...details, verified: event.target.value } })} /></label>}
        {answer !== "needs_something" && <label>Question for the site<input minLength={4} maxLength={COMPANY_QUESTION_LIMIT}
          value={details.question ?? ""} onChange={event => editDraft({ details: { ...details, question: event.target.value } })} /></label>}
        <label>Earliest start<select value={details.startWindow ?? ""}
          onChange={event => editDraft({ details: { ...details, startWindow: event.target.value as CompanyStartWindow || undefined } })}>
          <option value="">Not specified</option>
          {COMPANY_START_WINDOWS.map(window => <option key={window} value={window}>{COMPANY_START_LABELS[window]}</option>)}
        </select></label>
      </details>}
      <button className="ms-button" disabled={saving} aria-describedby="company-answer-statement">{saving ? "Saving…" : simulation ? "Send simulation result" : "Send response"}</button>
      {message && <p role="status">{message}</p>}
      <p className="ms-field-hint" id="company-answer-statement">{page.responseStatement.text}</p>
    </form>
  </section>;
}
