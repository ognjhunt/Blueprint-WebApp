import { useState, type ReactNode } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import { RECORDING_RIGHTS_STATEMENT_V4, RECORDING_RIGHTS_STATEMENT_V4_VERSION } from "@/lib/recordingRightsStatement";
import { type JobOutlook, type JobPhase } from "@/lib/jobOutlook";
import {
  INTRODUCE_LABEL, INTRODUCTIONS_USED, INTRODUCTION_REQUEST_STATEMENT_VERSION, INTRODUCTION_STATEMENT_CHANGED, INTRODUCTION_FAILED, INTRODUCTION_REFUSAL_SENTENCES, introduceSentence, introducedOn,
  isIntroductionRefusalReason,
} from "@/lib/siteIntroductions";
import { GAP_COULD_BE_CHANCE, GAP_UNLIKELY_CHANCE, optionParts, testSubLine, type SimulationOption, type SimulationProof as SimulationProofView } from "@/lib/simulationProof";
import { PLAIN_SETUP_CAVEAT, SimulationTestRows, TRIAL_LINE, TrustRows, setupCaveatShown, testNotRunLine, testResultOf, type TestResult } from "./SimulationProof";
import {
  BareBack, BareBig, BareButton, BareParts, BareDone, BareFine, BareGroup, BareLabel, BareLead, BareLinks, BareMenu, BareNotice, BareRows, BareSureness, BareTicks,
  type BareTickState,
} from "@/components/bare/Bare";
import {
  ALSO_INVOLVES_PREFIX, FIRST_LOOK_SOURCE, REASON_UNSIZED, LIMITS_JOB_PAGE, SURENESS_STEPS, TIGHT_FIT_SENTENCE, UNKNOWN_JOB_KIND, UNKNOWN_MULTI_STEP,
  firstLookSentence, isScopeNote,
  type AnswerBasis, type AnswerCheck, type AnswerConfidenceLevel, type AnswerEvidence, type AnswerRobot, type JobSharing, type SiteAnswer as SiteAnswerView,
} from "@/lib/siteAnswer";
import type { FirstLookWords } from "@/lib/firstLookWords";
import { companyAnswered, isSiteCompanyActivity, sentToCompanies, sentToCompany, type SiteCompanyActivity, type SiteCompanyEntry } from "@/lib/companyResponses";

/*
 * The site's job page below its title, bare bones (frame of 2026-11-12). Four sections, in order: where the job
 * stands with deployment companies, the first look on paper, the simulation of the site, and, folded, our own early
 * trial of openly available robot software. The trial is supporting evidence, never the site's answer. Every line here
 * is a constant, or a short line chosen by the data that makes it true; each says why beside it.
 */
/** Sharing is the service (2026-11-12): a shared job's section opens with this. */
export const SHARED_LINE = "We share your job with the deployment companies we approve.";
/** Shared, but not in front of companies right now: Blueprint's hold, a rights hold, or the site closed it. */
export const NOT_VISIBLE_LINE = "Your job is not visible to companies right now.";
/** An older job (agreed to a statement before 2026-11-12): one line, then the v4 sentence and its button (PACKAGE_D D1.3, 17:15Z). */
export const OLDER_JOB_LINES = "Not shared yet.";
/** The button under the recording statement v4 on the job page: "By sending, you agree …" reads right beside it. */
export const OLDER_JOB_AGREE = "Agree and send my job";
export const OLDER_JOB_FAILED = "We could not save your agreement just now. Try again shortly.";
/** No statement that shares the job was given, and none is offered here (the job's video comes first). */
export const NOT_SHARED_YET = "Your job is not shared with any company yet.";
/** A withdrawn job, or a closed one whose summary is not visible (review, 2026-11-12). */
export const NOTHING_IS_SHARED = "Nothing is shared.";
export const READING_LINE = "We're watching your video.";
export const READING_HELPER = "Your job page shows it when it is ready.";
export const EDIT_JOB_LABEL = "Change my job description";
export const NEW_VIDEO_LABEL = "Send a new video";
/** The reader's "we could not tell the kind of job" line, in plain words; said whenever the server says it. */
export const KIND_UNKNOWN_LINE = "We couldn't tell exactly what the job is, so we only checked picking up and putting down.";
/** Under "Why this robot": the first look is a check of the machine; how it is run is set up when it is installed. */
export const ROBOT_NOT_SOFTWARE = "This is the first look: it looks at the robot's reach, strength and track record, not the software that runs it.";
/** The section titles. */
export const SECTION_COMPANIES = "Deployment companies";
export const SECTION_FIRST_LOOK = "First look";
export const SECTION_SIMULATION = "Simulation of your site";
export const SECTION_TRIAL = "Early trial of openly available robot software";
export { TRIAL_LINE };
/** The simulation's own lines, by the phase. */
export const SIMULATION_BUILDING = "We're building the simulation of your site.";
export const SIMULATION_READY = "The simulation of your site is ready.";
export const VIEW_SIMULATION_LABEL = "View the simulation of your site";
export const doneMeans = (rule: string) => `Done means: ${rule.trim().replace(/[.!?]+$/, "")}.`;

/** A date in words. A bare `YYYY-MM-DD` is read as that calendar day, whatever the viewer's time zone. */
function dateInWords(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const SURE: Readonly<Record<AnswerConfidenceLevel, { filled: 1 | 2 | 3; word: string }>> = {
  low: SURENESS_STEPS[0], fair: SURENESS_STEPS[1], good: SURENESS_STEPS[2],
};

/** A check that holds, said plainly; a check not settled is a question, never a tick. A failed check never reaches the pick. */
const CHECK_PASS: Readonly<Record<AnswerCheck["key"], string>> = { reach: "Reaches far enough", payload: "Strong enough", cycle_time: "Fast enough" };
const CHECK_OPEN: Readonly<Record<AnswerCheck["key"], string>> = {
  reach: "Can't tell yet if it reaches far enough", payload: "Can't tell yet if it is strong enough", cycle_time: "Can't tell yet if it is fast enough",
};

/** The track record in plain words, by its level, and whether the source names this model or only robots like it. */
export function evidenceTick(evidence: Pick<AnswerEvidence, "level" | "scope"> | undefined): string | null {
  if (!evidence) return null;
  const family = evidence.scope === "family";
  if (evidence.level === "production") return family ? "Robots like this are already used for jobs like this" : "Already used for jobs like this";
  if (evidence.level === "pilot") return family ? "Robots like this were tried at a customer for jobs like this" : "Tried at a customer for jobs like this";
  return family ? "Robots like this are sold for jobs like this" : "Sold for jobs like this";
}

/** A passed check with little to spare: the server ends its sentence with this (`TIGHT_FIT_SENTENCE`), or the card says so. */
export const isTight = (check: { text?: string; tight?: boolean }) =>
  check.tight === true || (typeof check.text === "string" && check.text.endsWith(` ${TIGHT_FIT_SENTENCE}`));

/** A reach check on a robot that moves measures how high and low the hand goes (`measure: "height"`). */
const HEIGHT_PASS = "Reaches high and low enough";
const HEIGHT_OPEN = "Can't tell yet if it reaches high and low enough";

export function ticksOf(checks: Array<Pick<AnswerCheck, "key" | "outcome"> & { text?: string; tight?: boolean; measure?: AnswerCheck["measure"] }>, evidence: Pick<AnswerEvidence, "level" | "scope"> | undefined) {
  const items: Array<{ key: string; state: BareTickState; text: string }> = checks
    .filter(check => check.outcome !== "fail")
    .map(check => {
      const height = check.key === "reach" && check.measure === "height";
      return { key: check.key, state: check.outcome === "pass" ? "yes" : "unsure",
        text: check.outcome === "pass" ? `${height ? HEIGHT_PASS : CHECK_PASS[check.key]}${isTight(check) ? ", only just" : ""}` : height ? HEIGHT_OPEN : CHECK_OPEN[check.key] };
    });
  const record = evidenceTick(evidence);
  return record ? [...items, { key: "evidence", state: "yes" as const, text: record }] : items;
}

/**
 * The one plain reason under "How sure are we?", from what the checks rest on: the sizes (reach, cycle) and the
 * weight (payload) estimated from the video, or the reach checked in the scene. Null when neither holds.
 */
export function sureReason(robot: AnswerRobot): string | null {
  const estimated = robot.checks.filter(check => check.estimated);
  // A reach check on a robot that moves measured heights, not the distance between the spots.
  const heights = estimated.some(check => check.key === "reach" && check.measure === "height");
  const sizes = estimated.some(check => (check.key === "reach" && check.measure !== "height") || check.key === "cycle_time");
  const weight = estimated.some(check => check.key === "payload");
  const what = [sizes ? "sizes" : null, heights ? "heights" : null].filter(Boolean).join(" and ");
  if (what && weight) return `We estimated the ${what} and weight from your video.`;
  if (what) return `We estimated the ${what} from your video.`;
  if (weight) return "We estimated the weight from your video.";
  if (robot.sceneChecked) return "We checked its reach in a simulation of your site.";
  return null;
}

/** Lines that change what the answer covers: never moved to the details. */
export function scopeLines(answer: SiteAnswerView): string[] {
  return [...(answer.formNote ? [answer.formNote] : []),
    ...answer.unknowns.flatMap(line => line === UNKNOWN_JOB_KIND ? [KIND_UNKNOWN_LINE]
      : line === UNKNOWN_MULTI_STEP || line.startsWith(ALSO_INVOLVES_PREFIX) ? [line] : [])];
}

/** The short reason a job cannot be checked, by the server's own reason. */
function cannotLine(reason: string | null): string | null {
  if (!reason) return null;
  if (reason === REASON_UNSIZED) return "Your video didn't show the job clearly enough for us to measure it.";
  if (reason.startsWith("From your video, the job looks like more than picking an object up and putting it down"))
    return "From your video, the job looks like more than picking something up and putting it down.";
  return reason;
}

type AnsweredEntry = Extract<SiteCompanyEntry, { kind: "answered" }>;

/** A company's details after an introduction: what the site was given, nothing more. */
function IntroducedDetails({ entry }: { entry: AnsweredEntry }) {
  const company = entry.company!;
  const website = typeof company.website === "string" && /^https?:\/\//i.test(company.website) ? company.website : null;
  return <div className="site-job-introduced">
    <BareLead>{introducedOn(company.name, entry.introducedAtIso ? dateInWords(entry.introducedAtIso) : "")}</BareLead>
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {company.contactName && <li>{company.contactName}</li>}
      <li><a className="ms-text-link" href={`mailto:${company.email}`}>{company.email}</a></li>
      {website && <li><a className="ms-text-link" href={website} target="_blank" rel="noreferrer noopener">{website}</a></li>}
    </ul>
  </div>;
}

/**
 * Under the section's sentence: the one line for the automatic send, each send recorded by hand and each answer, by
 * alias only ("Company A"), in the order they came. Beside each company that answered Interested and can be introduced,
 * "Introduce us" and the sentence saying what it shares; after an introduction, that company's name and contact
 * details, and only that company's. No free text from a company is shown here: the server sends none.
 */
function CompanyEntries({ token, activity, onIntroduced }: { token: string; activity: SiteCompanyActivity | undefined;
  onIntroduced?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!isSiteCompanyActivity(activity)) return null;
  const sent = activity.sent && Number.isInteger(activity.sent.count) && activity.sent.count > 0 && typeof activity.sent.firstAtIso === "string"
    ? activity.sent : null;
  const used = activity.introductions && Number.isInteger(activity.introductions.used) ? activity.introductions.used : 0;
  const max = activity.introductions && Number.isInteger(activity.introductions.max) ? activity.introductions.max : 3;
  const limitReached = used >= max;
  if (!sent && activity.entries.length === 0) return null;
  async function introduce(alias: string) {
    if (busy) return;
    setBusy(alias); setErrors(current => ({ ...current, [alias]: "" }));
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/introductions`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        // The version of the sentence shown beside the button: pressing it is the agreement it records.
        body: JSON.stringify({ alias: alias.replace(/^Company /, ""), statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 409 || response.status === 400) {
        setErrors(current => ({ ...current, [alias]: isIntroductionRefusalReason(result?.reason)
          ? INTRODUCTION_REFUSAL_SENTENCES[result.reason as keyof typeof INTRODUCTION_REFUSAL_SENTENCES]
          : result?.code === "introduction_statement_changed" ? INTRODUCTION_STATEMENT_CHANGED : INTRODUCTION_FAILED }));
        return;
      }
      if (!response.ok || result?.ok !== true) throw new Error(INTRODUCTION_FAILED);
      onIntroduced?.();
    } catch { setErrors(current => ({ ...current, [alias]: INTRODUCTION_FAILED })); }
    finally { setBusy(null); }
  }
  // "Introduce us" is offered beside an answer the server says can be introduced (`interested`, or `tested_can_do`, E9).
  const INTRODUCIBLE: readonly string[] = ["interested", "tested_can_do"];
  const interestedWaiting = activity.entries.some(entry => entry.kind === "answered" && INTRODUCIBLE.includes(entry.state) && !entry.company);
  return <>
    {sent && <BareLead>{sentToCompanies(sent.count, dateInWords(sent.firstAtIso))}</BareLead>}
    {activity.entries.length > 0 && <ul className="site-job-company-entries" aria-label="Sent and answered" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {activity.entries.map((entry, index) => <li key={`${entry.kind}-${entry.alias}-${entry.atIso}-${index}`}>
        <BareLead>{entry.kind === "sent" ? sentToCompany(entry.alias, dateInWords(entry.atIso))
          : companyAnswered(entry.alias, dateInWords(entry.atIso), entry.state)}</BareLead>
        {entry.kind === "answered" && entry.company && typeof entry.company.name === "string" && typeof entry.company.email === "string"
          && <IntroducedDetails entry={entry} />}
        {entry.kind === "answered" && !entry.company && entry.canIntroduce === true && !limitReached && <>
          <BareButton onClick={() => void introduce(entry.alias)} disabled={busy !== null} helper={introduceSentence(entry.alias)}>
            {busy === entry.alias ? "Asking…" : INTRODUCE_LABEL}</BareButton>
          {errors[entry.alias] && <p role="alert">{errors[entry.alias]}</p>}
        </>}
      </li>)}
    </ul>}
    {limitReached && interestedWaiting && <BareNotice>{INTRODUCTIONS_USED}</BareNotice>}
  </>;
}

/** One section of the page, headed, so each is its own region. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className="site-answer-section" aria-labelledby={id}>
    <h2 className="bare-label" id={id}>{title}</h2>
    {children}
  </section>;
}

/**
 * Section 1: where the job stands with deployment companies, as the server decided it (`answer.sharing`, from the
 * predicate that decides what a company can see). Sharing is the service (2026-11-12): a job is shared because its
 * site accepted recording statement v4; there is no share button. A shared job says so, then the send line, the answers
 * and the introductions. An older job says what changed and offers v4 once, as the agreement that shares it.
 */
function Companies({ token, answer, onChanged, ended }: { token: string; answer: SiteAnswerView; onChanged?: () => void;
  ended: "withdrawn" | "closed" | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const sharing: JobSharing = answer.sharing ?? { state: "not_shared", sharedAtIso: null };
  async function agree() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/recording-consent`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        // The version of the exact sentence shown above the button.
        body: JSON.stringify({ granted: true, statementVersion: RECORDING_RIGHTS_STATEMENT_V4_VERSION }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(typeof result?.error === "string" ? result.error : OLDER_JOB_FAILED);
      setAgreed(true);
      onChanged?.();
    } catch (failure) { setError(failure instanceof Error && failure.message ? failure.message : OLDER_JOB_FAILED); }
    finally { setBusy(false); }
  }
  let body: ReactNode;
  // A withdrawn job shares nothing, and a closed one whose job is not visible says so plainly.
  const ends = ended === "withdrawn" || (ended === "closed" && sharing.state !== "visible");
  if (ends) body = <BareGroup><BareLead>{NOTHING_IS_SHARED}</BareLead></BareGroup>;
  else if (sharing.state === "visible" || sharing.state === "preparing" || agreed) body = <BareGroup>
    <BareLead>{SHARED_LINE}</BareLead>
    <CompanyEntries token={token} activity={answer.companies} onIntroduced={onChanged} />
  </BareGroup>;
  else if (sharing.state === "not_visible") body = <BareGroup>
    <BareLead>{SHARED_LINE}</BareLead>
    <BareNotice role="status">{NOT_VISIBLE_LINE}</BareNotice>
    <CompanyEntries token={token} activity={answer.companies} onIntroduced={onChanged} />
  </BareGroup>;
  else if (sharing.olderStatement) body = <BareGroup>
    <BareLead>{OLDER_JOB_LINES}</BareLead>
    <BareButton onClick={() => void agree()} disabled={busy} helper={RECORDING_RIGHTS_STATEMENT_V4}>{busy ? "Saving…" : OLDER_JOB_AGREE}</BareButton>
    {error && <p role="alert">{error}</p>}
  </BareGroup>;
  else body = <BareGroup><BareLead>{NOT_SHARED_YET}</BareLead></BareGroup>;
  return <Section id="site-job-companies" title={SECTION_COMPANIES}>{body}</Section>;
}

export interface SiteAnswerProps {
  token: string; answer: SiteAnswerView; proof?: SimulationProofView | null; onIntroductionRequested?: () => void;
  /** Opens the job description editor (Job settings). */
  onEditJob?: () => void;
  /** Starts a new video. */
  onUpdateVideo?: () => void;
  /** The page has a step the site must take first: the answer's own buttons stay, quiet. */
  quietAction?: boolean;
  onShowDetails?: () => void;
  onShowSettings?: () => void;
  /** The job's outlook, decided once on the server (`server/utils/jobOutlook.ts`): the page follows its phase. */
  outlook?: JobOutlook | null;
  /** The link to view the simulation of the site, when there is one. */
  sceneViewUrl?: string | null;
  /** What counts as done, in the site's own words, when it gave them. */
  successRule?: string | null;
  /** The first look as the Pipeline's published table words it; when present it replaces the robot rows. */
  firstLookTable?: FirstLookWords | null;
}

const SURE_STEPS = SURENESS_STEPS;
/** Said under the dots when a set-up flag lowers how sure the trial result is. */
export const SETUP_LOWERS = "Our simulation set-up may have affected this result.";
export const TESTING_LINE = "in the simulation of your site. We'll email you when it finishes.";

/** "Did the job in 7 of 10 tries". */
const didJob = (option: SimulationOption) => `Did the job in ${option.succeeded} of ${option.scored} ${option.scored === 1 ? "try" : "tries"}`;

/**
 * The early trial's result, inside its folded section: what the trial found, by `testResultOf`. The option named is
 * always row 1 of the ranked list; "did best" and "was ahead" come only from the probability rule.
 */
function TrialHead({ result }: { result: Exclude<TestResult, null> }) {
  if (result.kind === "testing") return <BareGroup>
    <h3 className="bare-label">Running now</h3>
    {/* An unknown count is never "0 robots". */}
    <BareBig sub={TESTING_LINE}>{result.entered >= 1 ? `${result.entered} ${result.entered === 1 ? "robot" : "robots"}` : "Robots"}</BareBig>
  </BareGroup>;
  const top = result.top;
  const sub = top.maker ? `Robot software by ${top.maker}` : undefined;
  if (result.kind === "no_clear_winner") return <BareGroup>
    <h3 className="bare-label">Tried in our trial</h3>
    <BareBig sub={testSubLine(result) ?? undefined}>No clear winner yet</BareBig>
    {result.setupFlag && <BareNotice>{PLAIN_SETUP_CAVEAT}</BareNotice>}
  </BareGroup>;
  if (result.kind === "none_finished") return <BareGroup>
    <h3 className="bare-label">Tried in our trial</h3>
    {/* "Closest" only when the run graded how far the top option got. A zero is a valid result of the trial. */}
    <BareBig sub={testSubLine(result) ?? undefined}>No robot finished the job in our trial.</BareBig>
    {result.setupFlag && <BareNotice>{PLAIN_SETUP_CAVEAT}</BareNotice>}
  </BareGroup>;
  // A winner, or the only option tried, which did the job at least once.
  const step = result.kind === "winner" ? (result.wording === "did_best" ? 2 : 1) : 0;
  const sure = SURE_STEPS[Math.max(0, step - (result.setupFlag ? 1 : 0))];
  const reason = result.setupFlag ? SETUP_LOWERS : result.kind === "one_option" ? "Only one robot could be tried."
    : result.wording === "did_best" ? GAP_UNLIKELY_CHANCE : GAP_COULD_BE_CHANCE;
  return <>
    <BareGroup>
      <h3 className="bare-label">{result.kind === "one_option" ? "Tried in our trial"
        : result.wording === "did_best" ? "Did best in our trial" : "Was ahead in our trial"}</h3>
      <BareBig sub={sub}><BareParts parts={optionParts(top.label)} /></BareBig>
    </BareGroup>
    <BareGroup>
      <BareTicks label="Why" items={[{ key: "did", state: "yes", text: didJob(top) },
        result.kind === "winner"
          ? { key: "ahead", state: "yes", text: result.others === 1 ? "Ahead of the other robot we tried" : `Ahead of the ${result.others} other robots we tried` }
          : { key: "only", state: "yes", text: "The only robot we could try on the job" }]} />
    </BareGroup>
    <BareGroup><BareSureness filled={sure.filled} word={sure.word} reason={reason} /></BareGroup>
  </>;
}

/**
 * The job page's sections. The first look leads whenever it exists, in every phase; the simulation of the site says
 * where it stands; our early trial is folded, labelled, and never said to be the site's answer. There is no share
 * step: a job is shared because its site accepted recording statement v4.
 */
export function SiteAnswer({ token, answer, proof, onIntroductionRequested, onEditJob, onUpdateVideo, quietAction = false,
  onShowDetails, onShowSettings, outlook = null, sceneViewUrl = null, successRule = null, firstLookTable = null }: SiteAnswerProps) {
  const pick = answer.state === "ready" ? answer.pick : null;
  // The phase is the server's (one decision for the page, sharing and emails). When unsure, the job is still being
  // worked on (review, 2026-11-11): with no outlook the page says the packet is being built and offers no button; a
  // result whose trial has not loaded yet shows the trial running.
  const test = testResultOf(proof);
  const working: JobPhase = test?.kind === "testing" || proof?.state === "running" ? "testing" : "building";
  const phase: JobPhase = answer.state === "reading" || outlook?.phase === "reading" ? "reading"
    : !outlook ? working
    : outlook.phase === "result" && (!test || test.kind === "testing") ? "testing"
    : outlook.phase;
  const links = [onShowDetails && answer.state !== "reading" ? { key: "details", label: "See details", onClick: onShowDetails } : null,
    onShowSettings ? { key: "settings", label: "Job settings", onClick: onShowSettings } : null].filter(Boolean) as Array<{ key: string; label: string; onClick: () => void }>;
  const notices = scopeLines(answer);
  const reading = answer.state === "reading" || phase === "reading";
  // An answer that cannot be checked stays as it is, whatever the trial found, unless the job is still being built
  // or a trial result leads (as before).
  const cannot = answer.state === "cannot_assess" && phase !== "building" && phase !== "testing" && phase !== "result";

  const endedBySite = phase === "ended_by_site" ? (outlook?.reason === "permission_withdrawn" ? "withdrawn" as const : "closed" as const) : null;
  const companies = <Companies token={token} answer={answer} onChanged={onIntroductionRequested} ended={endedBySite} />;

  // Section 2: the first look.
  let firstLook: ReactNode;
  if (reading) firstLook = <BareGroup>
    <div className="bare-spinner" aria-hidden="true" />
    <BareLead>{READING_LINE}</BareLead>
    <p className="bare-helper">{READING_HELPER}</p>
  </BareGroup>;
  else if (answer.state === "cannot_assess") {
    const fix = answer.reason === REASON_UNSIZED ? onUpdateVideo && { label: NEW_VIDEO_LABEL, run: onUpdateVideo } : onEditJob && { label: EDIT_JOB_LABEL, run: onEditJob };
    const reason = cannotLine(answer.reason);
    firstLook = <>
      <BareGroup>
        <BareLead>{answer.headline}</BareLead>
        {reason && <p className="bare-helper">{reason}</p>}
      </BareGroup>
      {notices.length > 0 && <BareGroup label="Before you rely on this">{notices.map(line => <BareNotice key={line}>{line}</BareNotice>)}</BareGroup>}
      {fix && <BareGroup><BareButton onClick={fix.run} quiet={quietAction}>{fix.label}</BareButton></BareGroup>}
    </>;
  } else if (!pick) firstLook = <>
    <BareGroup>
      <BareLead>{answer.headline}</BareLead>
      {answer.reason && <p className="bare-helper">{answer.reason}</p>}
    </BareGroup>
    {notices.length > 0 && <BareGroup label="Before you rely on this">{notices.map(line => <BareNotice key={line}>{line}</BareNotice>)}</BareGroup>}
  </>;
  else {
    const sure = SURE[answer.confidence.level];
    firstLook = <>
      <BareGroup>
        <BareLead>{firstLookSentence(pick)}</BareLead>
        <p className="bare-helper">{FIRST_LOOK_SOURCE}</p>
      </BareGroup>
      <BareGroup>
        <BareTicks label="Why" items={ticksOf(pick.checks, pick.evidence[0])} />
        {answer.sceneNote && <BareNotice>{answer.sceneNote}</BareNotice>}
        {notices.map(line => <BareNotice key={line}>{line}</BareNotice>)}
      </BareGroup>
      <BareGroup>
        {/* The reason is the server's own first reason for its sureness (`confidence.reasons`, composed in server/utils/siteAnswer.ts). */}
        <BareSureness filled={sure.filled} word={sure.word} reason={answer.confidence.reasons[0] ?? sureReason(pick)} />
      </BareGroup>
    </>;
  }

  // The Pipeline's first-look table, when it exists, replaces the robot rows: each robot, then its sentence.
  const tableRows = !reading && firstLookTable && Array.isArray(firstLookTable.rows) && firstLookTable.rows.length > 0 ? firstLookTable : null;
  if (tableRows) firstLook = <>
    <BareGroup>
      <ul className="site-first-look-table" aria-label="Robots checked" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {tableRows.rows.map((row, index) => <li key={`${row.robot ?? "robot"}-${index}`}>
          {row.robot && <strong>{row.robot}</strong>} {row.text}
        </li>)}
      </ul>
      {tableRows.more && <p className="bare-helper">{tableRows.more}</p>}
      <p className="bare-helper">{FIRST_LOOK_SOURCE}</p>
    </BareGroup>
  </>;

  // Section 3: the simulation of the site, by the phase; the server's reason sentence for an ending, else the
  // trial's own line for why it did not run.
  const ended = phase === "no_test" || phase === "ended_by_site" || phase === "cannot_match";
  const notRun = cannot ? null : (ended ? outlook?.sentence : null) ?? (phase === "building" || phase === "testing" || phase === "result" ? null : testNotRunLine(proof));
  const simulationLine = phase === "building" ? (outlook?.reason === "step_failed" && outlook.sentence ? outlook.sentence : SIMULATION_BUILDING)
    : phase === "testing" || phase === "result" ? SIMULATION_READY
    : phase === "waiting_on_site" ? outlook?.sentence ?? "Tell us in one sentence what the robot should do, so we can build the simulation of your job."
    : notRun;
  const caveat = !reading && !cannot && phase !== "result" && setupCaveatShown(proof);
  const rule = successRule?.trim() ? doneMeans(successRule) : null;
  const viewable = Boolean(sceneViewUrl) && !reading;
  const simulation = simulationLine || caveat || rule || viewable ? <Section id="site-job-simulation" title={SECTION_SIMULATION}>
    <BareGroup>
      {simulationLine && <BareLead>{simulationLine}</BareLead>}
      {caveat && <BareNotice>{PLAIN_SETUP_CAVEAT}</BareNotice>}
      {rule && <p className="bare-helper">{rule}</p>}
      {viewable && <p><a className="ms-text-link" href={sceneViewUrl!} target="_blank" rel="noreferrer">{VIEW_SIMULATION_LABEL}</a></p>}
    </BareGroup>
  </Section> : null;

  // Section 4, folded: our own early trial, while it runs or once it has a result.
  const trialResult: Exclude<TestResult, null> | null = phase === "testing"
    ? (test?.kind === "testing" ? test : { kind: "testing", entered: proof?.options?.entered ?? 0 })
    : phase === "result" && test && test.kind !== "testing" ? test : null;
  const trial = trialResult ? <section className="site-answer-section" aria-labelledby="site-job-trial">
    <details className="bare-group site-trial">
      <summary className="bare-label" id="site-job-trial">{SECTION_TRIAL}</summary>
      <p className="bare-helper">{TRIAL_LINE}</p>
      <TrialHead result={trialResult} />
    </details>
  </section> : null;

  return <section className="site-answer-bare" aria-label="Your job">
    {companies}
    <Section id="site-job-first-look" title={SECTION_FIRST_LOOK}>{firstLook}</Section>
    {simulation}
    {trial}
    <BareLinks links={links} />
    <BareFine>{LIMITS_JOB_PAGE}</BareFine>
  </section>;
}

const BASIS_WORDS: Readonly<Record<AnswerBasis, string>> = {
  site_measured: "you measured this", site_stated: "you told us", video_observed: "seen in your video",
  video_estimate: "estimated from your video", scene_measured: "sized in a simulation of your site",
};

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}

/** "about 3–4.9 kg" → "up to 4.9 kg": the top of the range a passed check needs. */
export const liftUpTo = (need: string) => need.replace(/^about /, "up to ").replace(/^up to ([\d.]+)–/, "up to ");

/** One check as a row: the job's side and the robot's, the very figures of its sentence, with the robot's source. */
function checkRow(check: AnswerCheck, robot: AnswerRobot) {
  const spec = robot.specs.find(entry => entry.label === (check.key === "reach" ? (check.measure === "height" ? "Working height" : "Reach")
    : check.key === "payload" ? "Rated payload" : ""));
  const label = check.key === "reach" ? "Reach" : check.key === "payload" ? "Strength" : "Speed";
  const open = check.outcome === "unknown" ? "Can't tell yet. " : "";
  const tight = check.outcome === "pass" && isTight(check) ? " · only just enough" : "";
  let figures: string;
  if (check.need === undefined && check.has === undefined) figures = check.text;
  else if (check.key === "reach" && check.basis === "scene_measured") figures = `checked in a simulation of your site${check.has ? ` · reaches ${check.has}` : ""}`;
  else if (check.key === "reach" && check.measure === "height") figures = [check.need && `needs ${check.need}`, check.has && `working height ${check.has}`].filter(Boolean).join(" · ") || check.text;
  else if (check.key === "reach") figures = [check.need && `needs ${check.need}`, check.has && `reaches ${check.has}`].filter(Boolean).join(" · ") || check.text;
  // A pass needs at most the top of the range; a check not settled says the whole range that straddles the rating.
  else if (check.key === "payload") figures = [check.need && `needs to lift ${check.outcome === "pass" ? liftUpTo(check.need) : check.need}`,
    check.has && `lifts up to ${check.has}`].filter(Boolean).join(" · ") || check.text;
  else figures = [check.need && `your target ${check.need}`, check.has && `takes ${check.has} on paper`].filter(Boolean).join(" · ") || check.text;
  return { key: check.key, label, value: <>{open}{figures}{tight}{spec && <> (<SourceLink href={spec.sourceUrl}>source</SourceLink>)</>}</> };
}

/** How the pick would be run, by the server's own kind (`answer.approach.kind`), in the words of its sentence made plain. */
export const APPROACH_WORDS: Readonly<Record<NonNullable<SiteAnswerView["approach"]>["kind"], string>> = {
  programmed: "The company that installs it teaches it this move once.",
  camera_guided: "The objects vary, so it needs a camera to pick each one. Ask the company that sets it up how it handles each item.",
};

const LEVEL_WORDS: Readonly<Record<AnswerEvidence["level"], string>> = {
  production: "In real use", pilot: "Tried at a named customer", offered: "Sold for it, no customer named",
};

export type DetailScreen = "why" | "others" | "ruled-out" | "estimated" | "unseen" | "test" | "trust";
const DETAIL_TITLES: Readonly<Record<DetailScreen, string>> = {
  why: "First look: why this robot", others: "Other robots", "ruled-out": "Robots that don't fit", estimated: "What we estimated",
  unseen: "What we couldn't see", test: "Our early trial", trust: "How far to trust the trial",
};

/** Which detail screens have something to say, in the menu's order. */
export function detailScreens(answer: SiteAnswerView, proof?: SimulationProofView | null): DetailScreen[] {
  const pick = answer.state === "ready" ? answer.pick : null;
  const hasTest = Boolean(proof && proof.state !== "not_started");
  // The first look and what it rests on first, as the page leads with it; then our early trial.
  return ([
    (pick || (answer.reason && answer.state !== "ready")) && "why",
    (answer.runnerUp || answer.alsoFit.length || answer.state === "ready") && "others",
    answer.ruledOut.length > 0 && "ruled-out",
    answer.facts.length > 0 && "estimated",
    (answer.unknowns.some(line => !isScopeNote(line)) || answer.confidence.raiseIt.length || answer.confidence.reasons.length) && "unseen",
    hasTest && "test",
    hasTest && proof!.state === "done" && "trust",
  ].filter(Boolean)) as DetailScreen[];
}

/** The details menu: one row per small screen, each with "‹ Back". */
export function SiteAnswerDetails({ answer, proof, onBack, onOpen }: {
  answer: SiteAnswerView; proof?: SimulationProofView | null; onBack: () => void; onOpen: (screen: DetailScreen) => void;
}) {
  const screens = detailScreens(answer, proof);
  return <div className="site-answer-details">
    <BareBack onClick={onBack} />
    <h1 tabIndex={-1}>Details</h1>
    <BareMenu label="Details" items={screens.map(screen => ({ key: screen, label: DETAIL_TITLES[screen], onClick: () => onOpen(screen) }))} />
  </div>;
}

/** One detail screen: short labelled rows; the sourced sentences said word for word. */
export function SiteAnswerDetail({ answer, proof, screen, onBack }: {
  answer: SiteAnswerView; proof?: SimulationProofView | null; screen: DetailScreen; onBack: () => void;
}) {
  const pick = answer.state === "ready" ? answer.pick : null;
  const others = [answer.runnerUp, ...answer.alsoFit.map(robot => ({ ...robot, verdict: "fits_on_paper" as const }))].filter(Boolean) as Array<{ manufacturer: string; name: string; verdict: AnswerRobot["verdict"] }>;
  const allFit = others.every(robot => robot.verdict === "fits" || robot.verdict === "fits_on_paper");
  const allEstimated = answer.facts.length > 0 && answer.facts.every(fact => fact.basis === "video_estimate");
  // The scope lines are said on the answer screen, beside the ticks; the rest of what the video could not show is here.
  const otherUnknowns = answer.unknowns.filter(line => !isScopeNote(line));
  const title = screen === "others" && allFit && others.length ? "Other robots that fit" : screen === "estimated" && !allEstimated ? "The numbers we used" : DETAIL_TITLES[screen];
  let body: ReactNode = null;
  if (screen === "why") body = pick ? <BareRows title={pick.manufacturer + " " + pick.name} rows={[
    { key: "form", label: "Kind", value: pick.formLabel },
    ...pick.checks.map(check => checkRow(check, pick)),
    ...pick.evidence.map((item, index) => ({ key: `evidence-${index}`, label: index === 0 ? "Used for jobs like this" : "Also",
      // The paraphrase, then its level and what the source names, then the source itself (its words are there).
      value: <>{item.summary} <span className="bare-helper">{LEVEL_WORDS[item.level]} · names {item.scope === "family" ? `robots like it${item.family ? ` (${item.family})` : ""}` : "this model"} · <SourceLink href={item.sourceUrl}>{item.publisher}</SourceLink></span></> })),
    ...(pick.evidence.length ? [] : [{ key: "no-evidence", label: "Used for jobs like this", value: "We found no documented use of this robot on this kind of job." }]),
    ...(answer.approach ? [{ key: "approach", label: "How it would be run", value: APPROACH_WORDS[answer.approach.kind] }] : []),
    // What the scene rebuilt from the video showed about this robot.
    ...(proof?.robotCheck ? [{ key: "scene", label: "In the simulation", value: proof.robotCheck.line }] : []),
    // The server's note when the site's own measurement outranks the scene: on this screen whatever leads.
    ...(answer.sceneNote ? [{ key: "scene-note", value: answer.sceneNote }] : []),
    { key: "robot-not-software", value: ROBOT_NOT_SOFTWARE },
  ]} /> : <BareRows title="Why we can't check it yet" rows={[{ key: "reason", value: answer.reason }]} />;
  if (screen === "others") body = <BareRows title="Robots" rows={[
    ...others.map((robot, index) => ({ key: `${robot.manufacturer} ${robot.name}`,
      value: <>{robot.manufacturer} {robot.name}{index === 0 && answer.runnerUp && !allFit && robot.verdict === "possible" && <span className="bare-helper"> · may fit</span>}</> })),
    ...(answer.state === "ready" ? [{ key: "checked", value: `We checked ${answer.checked.models} robots from ${answer.checked.makers} makers, using their published figures from ${dateInWords(answer.checked.specsRetrievedOn)}.` }] : []),
  ]} />;
  if (screen === "ruled-out") body = <BareRows title={`${answer.ruledOut.length + answer.ruledOutMore} robots`} rows={[
    ...answer.ruledOut.map(robot => ({ key: `${robot.manufacturer} ${robot.name}`, label: `${robot.manufacturer} ${robot.name}`, value: robot.reason })),
    ...(answer.ruledOutMore > 0 ? [{ key: "more", value: `And ${answer.ruledOutMore} more.` }] : []),
  ]} />;
  if (screen === "estimated") body = <BareRows title={allEstimated ? "From your video" : "Where each came from"}
    rows={answer.facts.map(fact => ({ key: fact.label, label: fact.label, value: <>{fact.display}{!allEstimated && <span className="bare-helper"> ({BASIS_WORDS[fact.basis]})</span>}</> }))} />;
  if (screen === "unseen") body = <>
    {otherUnknowns.length > 0 && <BareRows title="We couldn't see" rows={otherUnknowns.map(line => ({ key: line, value: line }))} />}
    {answer.confidence.raiseIt.length > 0 && <BareRows title="To be surer" rows={answer.confidence.raiseIt.map(line => ({ key: line, value: line }))} />}
    {pick && answer.confidence.reasons.length > 0 && <BareRows title="How sure we are" rows={answer.confidence.reasons.map(line => ({ key: line, value: line }))} />}
  </>;
  if (screen === "test" && proof) body = <><p className="bare-helper">{TRIAL_LINE}</p><SimulationTestRows proof={proof} /></>;
  if (screen === "trust" && proof) body = <TrustRows proof={proof} />;
  return <div className="site-answer-details">
    <BareBack onClick={onBack} />
    <h1 tabIndex={-1}>{title}</h1>
    {body}
  </div>;
}
