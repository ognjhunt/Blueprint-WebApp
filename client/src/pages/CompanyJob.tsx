import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { ArrowLeft, ArrowDown, Download, MapPin } from "lucide-react";
import type { User } from "firebase/auth";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { companyApplicationHref, companyJobReturnPath, companyJobSignInHref } from "@/lib/authReturnPath";
import { CHARGE_MODELS, CHARGE_MODEL_LABELS, ESTIMATE_LABEL, ESTIMATE_UNITS, INTRODUCIBLE_RESPONSE_STATES, SIMILAR_JOBS, SIMILAR_JOBS_LABELS,
  VISIT_NOTE_LIMIT, isApplicationEstimate, type ApplicationEstimate, type ChargeModel, type SimilarJobs } from "@/lib/companyResponses";
import { COMPANY_QUESTION_LIMIT, COMPANY_RESPONSE_LABELS, COMPANY_START_LABELS, COMPANY_START_WINDOWS, FIT_RESPONSE_STATES, TESTED_RESPONSE_STATES,
  companyQuestionOverdue, companyQuestionWaiting, companyResponseNeedsNote, type CompanyReplyDetails, type CompanyResponseState, type CompanyStartWindow } from "@/lib/companyResponses";
import { JobCardAnswer } from "@/components/site/JobCardAnswer";
import { MinimalSiteLayout } from "@/components/site/MinimalSiteLayout";
import { CompanyTermsPrompt } from "@/components/site/CompanyTermsPrompt";
import { RobotTeamEarlyAccess } from "@/components/site/RobotTeamEarlyAccess";
import { jobTitleForDisplay, type CompanyJobPage } from "@/types/taskBrowse";
import { ESTIMATE_BELOW, NOTHING_TESTED_AT_SITE, NOT_STATED, NOT_SURE, NO_SUCCESS_RULE, type FitSummaryRow } from "@/lib/companyJobPage";
import { BROWSE_JOBS_PATH, type LibraryAccess } from "@/lib/robotTeamAccess";
import { SIGN_IN_LINK_ENDED, signInWithCompanyLink, takeSignInLinkFromAddress } from "@/lib/companySignInLink";
import { PartnerApplication } from "@/components/site/PartnerApplication";

/** The job page for a visitor who is not signed in: what the job holds and how to see it (owner, 2026-11-23). */
export const GATE_HEADING = "Apply to see this job";
export const GATE_WHAT_YOU_SEE = "The site shared this job with the robot deployment companies Blueprint approves. Approved companies see:";
export const GATE_UNLOCKS = [
  "The site's video of the job, without sound, and its description",
  "Its answers about weight, size, rate and hours",
  "A first look at which kinds of robot most likely fit",
  "A simulation of the site to test in your own tools, when it is ready",
] as const;
export const GATE_RETURN = "Apply below. Once you're approved, the link we email you brings you back to this job.";

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
        // Opened from a public live job's reference: the address becomes the job's own.
        if (body.item.id !== jobId && typeof window !== "undefined")
          window.history.replaceState(window.history.state, "", `/jobs/${encodeURIComponent(body.item.id)}${window.location.search}`);
      }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [jobId, user?.uid, retry, auth?.loading, linkState]);

  if (state === "loading") return <div className="bare-screen company-job"><p role="status">Loading…</p></div>;
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
  if (state === "missing") return <div className="bare-screen company-job"><h1>This job is not available</h1>
    <p>It may no longer be shared, or your account may not be approved. <a href={backHref}>Back to jobs</a></p></div>;
  if (state === "error" || !page) return <div className="bare-screen company-job"><div role="alert"><p>This job could not be loaded.</p>
    <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button></div></div>;

  const simulationReady = page.simulationDownload?.state === "ready";
  return <div className="bare-screen company-job company-job-ready" role="region" aria-label="Job">
    <a className="company-job-back" href={backHref}><ArrowLeft size={17} aria-hidden="true" />Back to jobs</a>
    <h1>{page.headline || jobTitleForDisplay(page.title)}</h1>
    <div className="opportunity-meta">
      {page.country && <span><MapPin size={15} aria-hidden="true" />{page.country}</span>}
      {page.headlineFacts.map(fact => <span key={fact}>{fact}</span>)}
      {dateInWords(page.publishedAtIso) && <span>Shared {dateInWords(page.publishedAtIso)}</span>}
    </div>
    <div className="company-job-actions">
      {user && <a className="ms-button" href="#answer-this-job">Apply or respond<ArrowDown size={16} aria-hidden="true" /></a>}
      {page.simulationDownload?.state === "ready" && <a className="company-job-download" href={page.simulationDownload.url} download><Download size={16} aria-hidden="true" />Download the simulation</a>}
    </div>

    <div className="company-job-grid">
      <div className="company-job-overview">
        <section aria-label="The job">
          <h2>The job, in the site's words</h2>
          {page.sentence ? <blockquote>{page.sentence}</blockquote> : <p>The site's description can't be shown right now.</p>}
          <div className="company-job-success"><h3>What counts as done</h3><p>{page.successRule || NO_SUCCESS_RULE}</p></div>
        </section>

        <section aria-label="At a glance">
          <h2>At a glance</h2>
          <FitSummary rows={page.fitSummary} />
          <p className="ms-field-hint">{SITE_ANSWERS_HINT}</p>
        </section>

        <section aria-label="The video">
          <h2>The video</h2>
          {page.video.state === "ready"
            ? <video src={page.video.url} poster={page.thumbnailUrl ?? undefined} controls controlsList="nodownload noremoteplayback" disablePictureInPicture preload="metadata"
                playsInline onContextMenu={event => event.preventDefault()}
                width={page.video.width} height={page.video.height} aria-label="The site's video, without sound" />
            : <p>{VIDEO_PREPARING}</p>}
        </section>
      </div>

      {user && <CompanyAnswerForm key={page.id} jobId={page.id} user={user} page={page} tested={simulationReady} />}

      <div className="company-job-evidence">
        <section aria-label="First look">
          <h2>First look</h2>
          {page.firstLookRows.length > 0 && <ul aria-label="Robots on paper">{page.firstLookRows.map((row, index) =>
            <li key={`${index}-${row.robot}`}>{row.robot ? <strong>{row.robot}: </strong> : null}{row.text}</li>)}</ul>}
          {page.firstLookMore ? <p className="ms-field-hint">{page.firstLookMore}</p> : null}
          {/* A status only when nothing at all is shown: rows of robots on paper are a first look already. */}
          {page.firstLook ? <JobCardAnswer answer={page.firstLook} titled={false} />
            : page.firstLookRows.length === 0 ? <p role="status">{page.firstLookStatus ?? NO_FIRST_LOOK}</p> : null}
        </section>

        <section aria-label="Simulation of the site">
          <h2>Simulation of the site</h2>
          {page.simulationDownload?.state === "ready"
            ? <p className="ms-field-hint">A 3D simulation of the site, to test in your own tools. Open scene.usda first; the README inside explains each file.</p>
            : null}
          {page.simulation.state === "ready"
            ? <p><a className="ms-button" href={page.simulation.viewerUrl}>View the simulation of the site</a></p>
            : page.simulationDownload?.state !== "ready" ? <p role="status">{page.simulationStatus ?? SIMULATION_NOT_FINISHED}</p> : null}
        </section>

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
        </section>

        <section aria-label="A visit must confirm">
          <h2>A visit must confirm</h2>
          <p className="ms-field-hint">{NOTHING_TESTED_AT_SITE}</p>
          <ul aria-label="What a visit must confirm">{page.visitMustConfirm.map(line => <li key={line}>{line}</li>)}</ul>
        </section>

        <section aria-label="About the site">
          <h2>About the site</h2>
          <ul aria-label="About the site">{page.aboutSite.map(line => <li key={line}>{line}</li>)}</ul>
        </section>
      </div>
    </div>
  </div>;
}

/** The site's answers as fixed fields a company scans like a load post: "Not stated" where the site skipped one. */
function FitSummary({ rows }: { rows: FitSummaryRow[] }) {
  if (rows.length === 0) return <p>{NOT_STATED}.</p>;
  return <dl className="company-fit-summary" aria-label="The site's answers">{rows.map(row => <div key={row.key}
    className={row.state === "stated" || row.state === "from_video" ? undefined : "company-fit-missing"}>
    <dt>{row.label}</dt>
    <dd>{row.value ?? (row.state === "unsure" ? NOT_SURE : NOT_STATED)}
      {row.state === "from_video" && <span className="ms-field-hint"> (from the video)</span>}
      {row.estimateBelow && <span className="ms-field-hint"> · {ESTIMATE_BELOW}</span>}</dd>
  </div>)}</dl>;
}

/** Said when the estimate's two ends cannot be read as whole dollars from low to high. */
export const ESTIMATE_INVALID = "Enter the estimate as whole dollars, the lower amount first, or leave both empty.";

/** The typed estimate as whole dollars, null when left empty, or "invalid". Needs a way of charging that has a unit. */
export function typedEstimate(model: ChargeModel | undefined, low: string, high: string): ApplicationEstimate | null | "invalid" {
  const read = (value: string) => value.replace(/[$,\s]/g, "");
  const [a, b] = [read(low), read(high)];
  if (!a && !b) return null;
  if (!model || !ESTIMATE_UNITS[model]) return "invalid";
  const estimate = { lowUsd: Number(a || b), highUsd: Number(b || a) };
  return /^\d+$/.test(a || b) && /^\d+$/.test(b || a) && isApplicationEstimate(estimate) ? estimate : "invalid";
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
  // The estimate's two ends as typed (whole dollars; commas allowed), kept apart from the stored numbers until sent.
  const [estimateLow, setEstimateLow] = useState(prior?.details?.estimate ? String(prior.details.estimate.lowUsd) : "");
  const [estimateHigh, setEstimateHigh] = useState(prior?.details?.estimate ? String(prior.details.estimate.highUsd) : "");
  // The answer on record: the page's, then the one just saved, so "You answered" never names an answer it replaced.
  const [mine, setMine] = useState(page.myAnswer);
  const testedAnswer = answer !== null && TESTED_RESPONSE_STATES.includes(answer);
  const noteRequired = answer !== null && (testedAnswer || companyResponseNeedsNote(answer));
  const noteLabel = testedAnswer ? "What did you test?" : noteRequired ? "What details would help you decide?" : "Note to the site";
  const formLabel = "Your response";
  function choose(state: CompanyResponseState) { setAnswer(state); setMessage(""); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || !answer) return;
    const application = INTRODUCIBLE_RESPONSE_STATES.includes(answer);
    const estimate = application ? typedEstimate(details.chargeModel, estimateLow, estimateHigh) : null;
    if (estimate === "invalid") { setMessage(ESTIMATE_INVALID); return; }
    setSaving(true); setMessage("");
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
      setMessage(response.ok ? body.nextAction : body.error || "Your answer was not saved.");
      if (response.ok) setMine({ state: answer, inputs, details: sent, updatedAtIso: new Date().toISOString(), statementVersion: page.responseStatement.version });
    } catch { setMessage("We could not reach Blueprint. Check your connection and try again."); }
    finally { setSaving(false); }
  }
  return <section id="answer-this-job" aria-label={formLabel} tabIndex={-1}>
    <h2>Your response</h2>
    {mine && <p className="ms-field-hint">{mine.state === "interested" ? "You applied" : `You answered “${COMPANY_RESPONSE_LABELS[mine.state]}”`}{mine.updatedAtIso ? ` on ${dateInWords(mine.updatedAtIso)}` : ""}.
      {(mine.state === "interested" || mine.state === "tested_can_do") && mine.statementVersion !== page.responseStatement.version
        ? " Send it again below so the site sees your company's name, website and any estimate with it." : ""}</p>}
    {page.pendingQuestion && <p className="ms-field-hint" role="status">{Date.parse(page.pendingQuestion.replyByIso) <= Date.now()
      ? companyQuestionOverdue(dateInWords(page.pendingQuestion.replyByIso), page.pendingQuestion.reminded)
      : companyQuestionWaiting(dateInWords(page.pendingQuestion.askedAtIso), dateInWords(page.pendingQuestion.replyByIso))}</p>}
    {page.clarification && <div className="company-question" role="region" aria-label="Answer from the site">
      <dl className="company-response-facts">
        <div><dt>Your question</dt><dd>{page.clarification.question}</dd></div>
        <div><dt>Answer from the site</dt><dd>{page.clarification.answer}</dd></div>
      </dl>
    </div>}
    <form onSubmit={submit} className="ms-form" aria-label={formLabel}>
      <fieldset className="company-answer-options"><legend>Will you apply for this job?</legend>
        {(tested ? [...FIT_RESPONSE_STATES, ...TESTED_RESPONSE_STATES] : FIT_RESPONSE_STATES).map(state => <label key={state}><input type="radio" name="state" value={state} required
          checked={answer === state} onChange={() => choose(state)} /> {COMPANY_RESPONSE_LABELS[state]}</label>)}
      </fieldset>
      <label>{noteLabel}
        <textarea name="inputs" required={noteRequired} minLength={noteRequired ? 4 : undefined} maxLength={2000} value={inputs}
          onChange={event => setInputs(event.target.value)}
          aria-describedby="company-answer-words-hint" /></label>
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
          <span className="company-estimate-title">Estimate, in US dollars {ESTIMATE_UNITS[details.chargeModel]}</span>
          <label>From<input inputMode="numeric" value={estimateLow} onChange={event => setEstimateLow(event.target.value)} /></label>
          <label>To<input inputMode="numeric" value={estimateHigh} onChange={event => setEstimateHigh(event.target.value)} /></label>
          <p className="ms-field-hint">{ESTIMATE_LABEL} Leave it empty if you would rather not give one before a visit.</p>
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
        <label>What a visit must confirm<input maxLength={VISIT_NOTE_LIMIT} value={details.visitMustConfirm ?? ""}
          onChange={event => setDetails({ ...details, visitMustConfirm: event.target.value })} /></label>
      </fieldset>}
      {answer && answer !== "declined" && <details className="company-reply-optional">
        <summary className="ms-inline-link">Add details</summary>
        {answer !== "needs_something" && <label>Question for the site<input minLength={4} maxLength={COMPANY_QUESTION_LIMIT}
          value={details.question ?? ""} onChange={event => setDetails({ ...details, question: event.target.value })} /></label>}
        {!INTRODUCIBLE_RESPONSE_STATES.includes(answer) && <label>Earliest start<select value={details.startWindow ?? ""}
          onChange={event => setDetails({ ...details, startWindow: event.target.value as CompanyStartWindow || undefined })}>
          <option value="">Not specified</option>
          {COMPANY_START_WINDOWS.map(window => <option key={window} value={window}>{COMPANY_START_LABELS[window]}</option>)}
        </select></label>}
      </details>}
      <button className="ms-button" disabled={saving} aria-describedby="company-answer-statement">{saving ? "Saving…" : "Send"}</button>
      {message && <p role="status">{message}</p>}
      <p className="ms-field-hint" id="company-answer-statement">{page.responseStatement.text}</p>
    </form>
  </section>;
}
