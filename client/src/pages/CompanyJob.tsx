import { useEffect, useState } from "react";
import { useParams } from "wouter";
import type { User } from "firebase/auth";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { companyJobSignInHref } from "@/lib/authReturnPath";
import { COMPANY_RESPONSE_LABELS, COMPANY_RESPONSE_STATES, TESTED_RESPONSE_STATES, type CompanyResponseState } from "@/lib/companyResponses";
import { JobCardAnswer } from "@/components/site/JobCardAnswer";
import { BareBack } from "@/components/bare/Bare";
import { MinimalSiteLayout } from "@/components/site/MinimalSiteLayout";
import { CompanyTermsPrompt } from "@/components/site/CompanyTermsPrompt";
import type { CompanyJobPage } from "@/types/taskBrowse";

/** Said while the sound-free copy of the site's video is not ready. */
/** The job library: the signed-in list on the companies' page, at its own section. */
export const JOB_LIBRARY_URL = "/contact/robot-team#robot-team-access";
export const VIDEO_PREPARING = "The video is being prepared.";
/** Said for a job the site sent with its description only. */
export const NO_VIDEO_YET = "No video yet. The site sent this job with its description only.";
/** Under the answer form when there is no video: how to ask for one with the answers that exist. */
export const ASK_FOR_VIDEO = "Need a video to decide? Answer Would need something and say so.";
/** Under the words box: the site reads them, with the company's identity taken out first (`jobCompanies.siteReasonOf`). */
export const WORDS_REACH_SITE = "The site reads these words, with your company's name and contact details taken out.";
export const SIMULATION_NOT_FINISHED = "The simulation of the site is not finished yet.";
export const NO_FIRST_LOOK = "Our first look is not ready yet.";
export const NO_PACKET_FACTS = "Nothing about the object is measured or estimated yet.";
/** Under the site's quick answers: they are its own statements. */
export const SITE_ANSWERS_HINT = "The site's own answers on its job page; not checked.";

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
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user) { setState(auth && !auth.loading ? "signed_out" : "loading"); return; }
    let cancelled = false;
    setState("loading");
    withFirebaseAuthHeaders(user).then(headers => fetch(`/api/site-worlds/jobs/${encodeURIComponent(jobId)}`, { headers }))
      .then(async response => {
        if (cancelled) return;
        if (response.status === 404) { setState("missing"); return; }
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
    <p><a className="ms-button" href={signInHref}>Sign in to this job</a></p>
    <p><a href="/partners#partner-application">Apply as a deployment company</a></p></div>;
  if (state === "missing") return <div className="bare-screen company-job"><h1>This job is not available</h1>
    <p>It may no longer be shared, or your account may not be approved. <a href={JOB_LIBRARY_URL}>Back to the job library</a></p></div>;
  if (state === "error" || !page) return <div className="bare-screen company-job"><div role="alert"><p>This job could not be loaded.</p>
    <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button></div></div>;

  return <div className="bare-screen company-job" role="region" aria-label="Job">
    <BareBack href={JOB_LIBRARY_URL}>‹ Job library</BareBack>
    <h1>{page.title}</h1>
    <p className="ms-field-hint">{[page.country, page.publishedAtIso && `Shared on ${dateInWords(page.publishedAtIso)}`].filter(Boolean).join(" · ")}</p>
    <div className="company-job-actions">
      {page.simulationDownload?.state === "ready" && <a className="ms-button" href={page.simulationDownload.url} download>Download the simulation</a>}
      {user && <a className="bare-inline-link" href="#answer-this-job">{page.myAnswer ? "Update your answer" : "Answer this job"}</a>}
    </div>

    <section aria-label="The job">
      <h2>The job, in the site's words</h2>
      {page.sentence ? <blockquote>{page.sentence}</blockquote> : <p>The site has not described the job in its own words.</p>}
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

    {user && <CompanyAnswerForm jobId={page.id} user={user} page={page} />}

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
      {page.simulationDownload?.state === "ready" ? <>
        <p className="ms-field-hint">The site's scene for this job. The README inside says what it holds. Test in your own tools.</p>
        <p className="ms-field-hint">Open scene.usda. The room's look is a Gaussian splat that some tools cannot show; the collision mesh is in the file too.</p>
      </> : null}
      {page.simulation.state === "ready"
        ? <p><a className="ms-button" href={page.simulation.viewerUrl} target="_blank" rel="noreferrer">View the simulation of the site</a></p>
        : page.simulationDownload?.state !== "ready" ? <p>{SIMULATION_NOT_FINISHED}</p> : null}
    </section>

  </div>;
}

/**
 * The answers and the company's words, with the recorded line under it (E5). Nothing is chosen for the company: a
 * first answer starts empty and the browser asks for one; a later visit shows the answer it gave.
 */
function CompanyAnswerForm({ jobId, user, page }: { jobId: string; user: User; page: CompanyJobPage }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<CompanyResponseState | null>(page.myAnswer?.state ?? null);
  const [inputs, setInputs] = useState(page.myAnswer?.inputs ?? "");
  // The answer on record: the page's, then the one just saved, so "You answered" never names an answer it replaced.
  const [mine, setMine] = useState(page.myAnswer);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || !answer) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/site-worlds/tasks/${encodeURIComponent(jobId)}/interest`, { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ state: answer, inputs, statementVersion: page.responseStatement.version }) });
      const body = await response.json();
      setMessage(response.ok ? body.nextAction : body.error || "Your answer was not saved.");
      if (response.ok) setMine({ state: answer, inputs, updatedAtIso: new Date().toISOString(), statementVersion: page.responseStatement.version });
    } catch { setMessage("Your answer was not confirmed. Try again."); }
    finally { setSaving(false); }
  }
  return <section id="answer-this-job" aria-label="Your answer" tabIndex={-1}>
    <h2>Your answer</h2>
    {mine && <p className="ms-field-hint">You answered {COMPANY_RESPONSE_LABELS[mine.state]}{mine.updatedAtIso ? ` on ${dateInWords(mine.updatedAtIso)}` : ""}.
      {(mine.state === "interested" || mine.state === "tested_can_do") && mine.statementVersion !== page.responseStatement.version
        ? " Answer again below so the site can ask for an introduction." : ""}</p>}
    <form onSubmit={submit} className="ms-form" aria-label="Answer about this job">
      <fieldset className="company-answer-options"><legend>Can you take this job?</legend>
        {COMPANY_RESPONSE_STATES.filter(state => page.simulationDownload?.state === "ready" || !TESTED_RESPONSE_STATES.includes(state)).map(state => <label key={state}><input type="radio" name="state" value={state} required
          checked={answer === state} onChange={() => setAnswer(state)} /> {COMPANY_RESPONSE_LABELS[state]}</label>)}
      </fieldset>
      {page.video.state === "none" && <p className="ms-field-hint">{ASK_FOR_VIDEO}</p>}
      <label>What should the site know?
        <textarea name="inputs" required minLength={4} maxLength={2000} value={inputs} onChange={event => setInputs(event.target.value)}
          placeholder="For example, what you would need or when you could start"
          aria-describedby="company-answer-words-hint" /></label>
      <p className="ms-field-hint" id="company-answer-words-hint">{WORDS_REACH_SITE}</p>
      <button className="ms-button" disabled={saving} aria-describedby="company-answer-statement">{saving ? "Saving…" : "Send answer"}</button>
      {message && <p role="status">{message}</p>}
      <p className="ms-field-hint" id="company-answer-statement">{page.responseStatement.text}</p>
    </form>
  </section>;
}
