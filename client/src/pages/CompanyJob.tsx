import { useEffect, useState } from "react";
import { useParams } from "wouter";
import type { User } from "firebase/auth";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { COMPANY_RESPONSE_LABELS, COMPANY_RESPONSE_STATES, TESTED_RESPONSE_STATES, type CompanyResponseState } from "@/lib/companyResponses";
import { JobCardAnswer } from "@/components/site/JobCardAnswer";
import { MinimalSiteLayout } from "@/components/site/MinimalSiteLayout";
import { CompanyTermsPrompt } from "@/components/site/CompanyTermsPrompt";
import type { CompanyJobPage } from "@/types/taskBrowse";

/** Said while the sound-free copy of the site's video is not ready. */
/** The job library: the signed-in list on the companies' page, at its own section. */
export const JOB_LIBRARY_URL = "/contact/robot-team#robot-team-access";
export const VIDEO_PREPARING = "The video is being prepared.";
export const SIMULATION_NOT_FINISHED = "The simulation of the site is not finished yet.";
export const NO_FIRST_LOOK = "Our first look is not ready yet.";

function dateInWords(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * The company's page for one job (package E, E3). Everything on it comes from the server's closed payload
 * (`server/utils/companyJobPage.ts`): the site's sentence, its quick answers, the country, the video, the first look,
 * the simulation and the early trial, each when it exists, and the answer form. The only download offered is the
 * simulation package (E9); the video is played, with its download control hidden (which discourages saving; it cannot
 * prevent it).
 */
export default function CompanyJob() {
  // The bare route shell with the minimal public frame (paper), as the job library's own page has.
  return <MinimalSiteLayout><CompanyJobBody /></MinimalSiteLayout>;
}

function CompanyJobBody() {
  const { jobId = "" } = useParams();
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

  if (state === "loading") return <div className="ms-page"><p role="status">Loading…</p></div>;
  if (state === "terms" && user) return <div className="ms-page"><CompanyTermsPrompt user={user} onAccepted={() => setRetry(retry + 1)} /></div>;
  if (state === "signed_out") return <div className="ms-page"><h1>Sign in to see this job</h1>
    <p>Jobs are shown to deployment companies Blueprint has approved. <a href="/contact/robot-team">Sign in or apply</a>.</p></div>;
  if (state === "missing") return <div className="ms-page"><h1>This job is not available</h1>
    <p>It may no longer be shared, or your account may not be approved. <a href={JOB_LIBRARY_URL}>Back to the job library</a></p></div>;
  if (state === "error" || !page) return <div className="ms-page"><div role="alert"><p>This job could not be loaded.</p>
    <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button></div></div>;

  return <div className="ms-page company-job" role="region" aria-label="Job">
    <p><a href={JOB_LIBRARY_URL}>‹ Job library</a></p>
    <h1>{page.title}</h1>
    <p className="ms-field-hint">{[page.country, page.publishedAtIso && `Shared on ${dateInWords(page.publishedAtIso)}`].filter(Boolean).join(" · ")}</p>

    <section aria-label="The job">
      <h2>The job, in the site's words</h2>
      {page.sentence ? <blockquote>{page.sentence}</blockquote> : <p>The site has not described the job in its own words.</p>}
      {page.jobFacts.length > 0 && <ul aria-label="The site's answers">{page.jobFacts.map(line => <li key={line}>{line}</li>)}</ul>}
    </section>

    <section aria-label="The video">
      <h2>The video</h2>
      {page.video.state === "ready"
        ? <video src={page.video.url} controls controlsList="nodownload noremoteplayback" disablePictureInPicture preload="metadata"
            playsInline onContextMenu={event => event.preventDefault()} style={{ maxWidth: "100%" }}
            width={page.video.width} height={page.video.height} aria-label="The site's video, without sound" />
        : <p>{VIDEO_PREPARING}</p>}
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
        <p><a className="ms-button" href={page.simulationDownload.url} download>Download the simulation</a></p>
        <p className="ms-field-hint">The site's scene with the job's object in it, and what counts as done. Test in your own tools.</p>
        <p className="ms-field-hint">Open scene.usda. The room's look is a Gaussian splat that some tools cannot show; the collision mesh is in the file too.</p>
      </> : null}
      {page.simulation.state === "ready"
        ? <p><a className="ms-button" href={page.simulation.viewerUrl} target="_blank" rel="noreferrer">View the simulation of the site</a></p>
        : page.simulationDownload?.state !== "ready" ? <p>{SIMULATION_NOT_FINISHED}</p> : null}
    </section>

    {user && <CompanyAnswerForm jobId={page.id} user={user} page={page} />}
  </div>;
}

/** The three answers and the company's words, with the recorded line under it (E5). */
function CompanyAnswerForm({ jobId, user, page }: { jobId: string; user: User; page: CompanyJobPage }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<CompanyResponseState>(page.myAnswer?.state ?? "interested");
  const [inputs, setInputs] = useState(page.myAnswer?.inputs ?? "");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/site-worlds/tasks/${encodeURIComponent(jobId)}/interest`, { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ state: answer, inputs, statementVersion: page.responseStatement.version }) });
      const body = await response.json();
      setMessage(response.ok ? body.nextAction : body.error || "Your answer was not saved.");
    } catch { setMessage("Your answer was not confirmed. Try again."); }
    finally { setSaving(false); }
  }
  return <section aria-label="Your answer">
    <h2>Your answer</h2>
    {page.myAnswer && <p className="ms-field-hint">You answered {COMPANY_RESPONSE_LABELS[page.myAnswer.state]}{page.myAnswer.updatedAtIso ? ` on ${dateInWords(page.myAnswer.updatedAtIso)}` : ""}.
      {(page.myAnswer.state === "interested" || page.myAnswer.state === "tested_can_do") && page.myAnswer.statementVersion !== page.responseStatement.version
        ? " Answer again below so the site can ask for an introduction." : ""}</p>}
    <form onSubmit={submit} className="ms-form" aria-label="Answer about this job">
      <fieldset><legend>Can you take this job?</legend>
        {COMPANY_RESPONSE_STATES.filter(state => page.simulationDownload?.state === "ready" || !TESTED_RESPONSE_STATES.includes(state)).map(state => <label key={state}><input type="radio" name="state" value={state}
          checked={answer === state} onChange={() => setAnswer(state)} /> {COMPANY_RESPONSE_LABELS[state]}</label>)}
      </fieldset>
      <label>A few words about your answer (what you would need, timing, or a question)
        <textarea name="inputs" required minLength={4} maxLength={2000} value={inputs} onChange={event => setInputs(event.target.value)} /></label>
      <button className="ms-button" disabled={saving}>{saving ? "Saving…" : "Send answer"}</button>
      {message && <p role="status">{message}</p>}
      <p className="ms-field-hint">{page.responseStatement.text}</p>
    </form>
  </section>;
}
