import { useEffect, useRef, useState, type ReactNode } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import { RECORDING_RIGHTS_STATEMENT_V6, RECORDING_RIGHTS_STATEMENT_V6_VERSION } from "@/lib/recordingRightsStatement";
import { READING_LINE, SIMULATION_BUILDING, SIMULATION_READY, type JobOutlook, type JobPhase } from "@/lib/jobOutlook";

/** The job page's lines for the phase, kept in `@/lib/jobOutlook` so staff see the same words; re-exported here. */
export { READING_LINE, SIMULATION_BUILDING, SIMULATION_READY };
import {
  INTRODUCE_LABEL, INTRODUCTION_CANCELLED, INTRODUCTION_REQUEST_STATEMENT_VERSION, INTRODUCTION_STATEMENT_CHANGED, INTRODUCTION_FAILED, INTRODUCTION_REFUSAL_SENTENCES, introduceSentence, introducedOn, introductionRequested, isIntroductionStatementVersion,
  isIntroductionRefusalReason,
} from "@/lib/siteIntroductions";
import type { SimulationProof as SimulationProofView } from "@/lib/simulationProof";
import {
  BareBack, BareButton, BareDone, BareFine, BareGroup, BareLabel, BareLead, BareLinks, BareMenu, BareNotice, BareRows, BareSureness, BareTicks,
  type BareTickState,
} from "@/components/bare/Bare";
import {
  ALSO_INVOLVES_PREFIX, FIRST_LOOK_SOURCE, REASON_DESCRIBED_CLEANING, REASON_NOT_READ, REASON_UNSIZED, LIMITS_JOB_PAGE, SURENESS_STEPS, TIGHT_FIT_SENTENCE, UNKNOWN_JOB_KIND, UNKNOWN_MULTI_STEP,
  firstLookSentence, isScopeNote,
  type AnswerBasis, type AnswerCheck, type AnswerConfidenceLevel, type AnswerEvidence, type AnswerRobot, type JobSharing, type SiteAnswer as SiteAnswerView,
} from "@/lib/siteAnswer";
import type { FirstLookWords } from "@/lib/firstLookWords";
import { simulationContentsLine, youSaidDoneMeans, type SimulationContents } from "@/lib/simulationContents";
import { PROGRESS_FAILED, PROGRESS_MARK, PROGRESS_UNDO, jobTrackerSteps } from "@/lib/jobTracker";
import { CHARGE_MODEL_LABELS, ESTIMATE_LABEL, ESTIMATES_NOT_CHECKED, SIMILAR_JOBS_LABELS, estimateInWords } from "@/lib/companyResponses";
import { COMPANY_START_LABELS, REPLY_DATE_PASSED, replyByLine, SITE_RESPONSE_LABELS, SITE_CLARIFICATION_LIMIT, companyReason, INTRODUCIBLE_RESPONSE_STATES, introductionIfChanged, companyNotApprovedNow, isSiteCompanyActivity, MAY_CHANGE_RESPONSE_STATES,
  NO_REASON_SHOWN, sentToCompany, type SiteCompanyActivity, type SiteCompanyEntry } from "@/lib/companyResponses";
import { COMPANIES_READ_LIMIT, COMPANIES_READ_LINE, COMPANIES_READ_PENDING, COMPANIES_READ_SENTENCE_LABEL, COMPANIES_READ_SUCCESS_LABEL, COMPANIES_READ_TITLE,
  COMPANY_WORDS_BEING_PREPARED, COMPANY_WORDS_LIMIT, replyAsReadLine, replyLimitLine, replyPendingLine, type CompaniesReadSiteWords, type CompaniesReadText } from "@/lib/companiesRead";

/**
 * Exactly what deployment companies read of the site's own sentence and success rule (2026-11-24), on the site's own
 * page: the words as a company's page shows them, or a plain line while names and contact details are being taken out
 * (companies read none of them until then). No step to confirm: the site changes its words if it wants to.
 */
export function CompaniesReadYourWords({ view }: { view: CompaniesReadSiteWords }) {
  const rows: Array<[string, CompaniesReadText]> = [];
  if (view.sentence) rows.push([COMPANIES_READ_SENTENCE_LABEL, view.sentence]);
  if (view.successRule) rows.push([COMPANIES_READ_SUCCESS_LABEL, view.successRule]);
  if (!rows.length) return null;
  return <section className="site-companies-read" aria-label={COMPANIES_READ_TITLE}>
    <h2 className="bare-label">{COMPANIES_READ_TITLE}</h2>
    <dl className="company-response-facts">
      {rows.map(([label, item]) => <div key={label}><dt>{label}</dt>
        <dd>{"text" in item ? `“${item.text}”` : "limit" in item ? COMPANIES_READ_LIMIT : COMPANIES_READ_PENDING}</dd></div>)}
    </dl>
    <p className="bare-helper">{COMPANIES_READ_LINE}</p>
  </section>;
}

/*
 * The site's job page below its title, bare bones (frame of 2026-11-12). Three sections, in order: where the job
 * stands with deployment companies, the first look on paper, and the simulation of the site. Every line here is a
 * constant, or a short line chosen by the data that makes it true; each says why beside it.
 */
/** Sharing is the service (2026-11-12): a shared job's section opens with this. */
export const SHARED_LINE = "Posted for approved deployment companies";
/** Listed, but no approved deployment company can see jobs yet: the page does not say posted (finding L1-N1). */
export const NO_COMPANY_CAN_SEE_LINE = "Your job is ready for deployment companies, but no approved company can see it yet.";
export const PREPARING_TO_SHARE_LINE = "Companies will see your job once the video and job details are ready.";
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
export const READING_HELPER = "Your job page shows it when it is ready.";
export const EDIT_JOB_LABEL = "Change my job description";
export const NEW_VIDEO_LABEL = "Send a new video";
/** The reader's "we could not tell the kind of job" line, in plain words; said whenever the server says it. */
export const KIND_UNKNOWN_LINE = "We couldn't tell exactly what the job is, so we only checked picking up and putting down.";
/** Under "Why this robot": the first look is a check of the machine; how it is run is set up when it is installed. */
export const ROBOT_NOT_SOFTWARE = "This is the first look: it looks at the robot's reach, strength and track record, not the software that runs it.";
/** The section titles. */
/** Owner, 2026-11-23: companies apply, and the site sees its applicants and accepts the ones it wants to meet. */
export const SECTION_COMPANIES = "Applicants";
export const SECTION_FIRST_LOOK = "First look";
export const SECTION_SIMULATION = "Simulation of your site";
/** The simulation's own lines, by the phase. */
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
  // What was done: the spots were measured in the simulation of the site and set against the robot's published reach.
  // No robot software runs in the simulation (dropped 2026-11-14), so the words never sound like a test of a robot.
  if (robot.sceneChecked) return SCENE_REACH_REASON;
  return null;
}

/** Under "How sure are we?" when the reach came from the simulation of the site (outreach audit, 2026-11-27). */
export const SCENE_REACH_REASON = "We measured your spots in the simulation of your site and compared them with the robot's published reach.";

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
  if (reason === REASON_DESCRIBED_CLEANING) return "From your description, the job is cleaning, which we can't check robots against yet.";
  if (reason.startsWith("From your video, the job looks like more than picking an object up and putting it down"))
    return "From your video, the job looks like more than picking something up and putting it down.";
  return reason;
}

type AnsweredEntry = Extract<SiteCompanyEntry, { kind: "answered" }>;

/**
 * An application at a glance, as the site reads it (owner, 2026-11-23): how the company charges, its estimate before a
 * site visit (labelled, never a quote), how many similar jobs it has done and what a visit must confirm, each only when
 * the company gave it. [label, value, label beside the value].
 */
function applicationGlance(entry: AnsweredEntry, estimateNote?: string | null): Array<[string, string, string | null]> {
  const details = entry.details ?? {};
  const estimate = estimateOf(entry);
  return [
    ...(details.chargeModel ? [["Charges", CHARGE_MODEL_LABELS[details.chargeModel], null] as [string, string, null]] : []),
    ...(estimate ? [["Estimate", estimate, ESTIMATE_LABEL] as [string, string, string]] : []),
    // An estimate taken out after the site saw one: the row stays, saying so.
    ...(!estimate && estimateNote ? [["Estimate", NOT_GIVEN, null] as [string, string, null]] : []),
    ...(details.similarJobs ? [["Similar jobs done", SIMILAR_JOBS_LABELS[details.similarJobs], null] as [string, string, null]] : []),
    ...(details.visitMustConfirm ? [["A visit must confirm", details.visitMustConfirm, null] as [string, string, null]] : []),
  ];
}

const NOT_GIVEN = "Not given";
/** The estimate in words ("$4,000 to $6,000 a month"), or null when the answer gives none. */
const estimateOf = (entry: AnsweredEntry) => {
  const details = entry.details ?? {};
  return details.chargeModel && details.estimate ? estimateInWords(details.chargeModel, details.estimate) : null;
};

/** The site accepted this company: the introduction is made or on its way. */
const accepted = (entry: AnsweredEntry) => Boolean(entry.company || entry.introducedAtIso || entry.introductionPending);
/** The site can still accept this company, or already did (stress test, 2026-11-24: a company whose introduction was
 * cancelled and can no longer be accepted stayed in the table as if it could). */
const comparable = (entry: AnsweredEntry) => INTRODUCIBLE_RESPONSE_STATES.includes(entry.state) && (entry.canIntroduce === true || accepted(entry));

/** Beside an estimate that changed: the one before, and whether the site had accepted the company by then. */
export const estimateChangedSinceLooked = (before: string) => `Changed since you last looked. It was ${before}.`;
export const estimateChangedAfterAccept = (before: string) => `Changed after you accepted. It was ${before}.`;
export const ESTIMATE_ADDED_AFTER_ACCEPT = "Given after you accepted.";
export const answerUpdatedAfterAccept = (date: string) => `They updated their answer on ${date}, after you accepted.`;

/**
 * The applicants side by side, when two or more can be accepted or were (owner, 2026-11-23: "how simple will it be to
 * decide?"): one row each, the same columns, "Not given" where a company left a field out, "Accepted" beside a company
 * already accepted. A company that can no longer be accepted is left out; it stays in the list below with its answer.
 * Accepting several is fine: the choice that matters comes after the visits. Below the phone breakpoint each row is a
 * card (`marketplace-jobs.css`); the explicit roles keep it a table for screen readers when the CSS stacks it.
 */
function CompareApplicants({ entries, estimateNotes }: { entries: AnsweredEntry[]; estimateNotes: Readonly<Record<string, string>> }) {
  const applied = entries.filter(comparable);
  if (applied.length < 2) return null;
  const columns = ["Charges", "Estimate", "Similar jobs done", "Earliest start"] as const;
  return <div className="site-compare">
    <table aria-label="Compare applicants" role="table">
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Applicant</th>
        {columns.map(column => <th key={column} scope="col" role="columnheader">{column}</th>)}</tr></thead>
      <tbody role="rowgroup">{applied.map(entry => {
        const details = entry.details ?? {};
        const note = estimateNotes[entry.alias];
        const cells: Record<(typeof columns)[number], ReactNode> = {
          Charges: details.chargeModel ? CHARGE_MODEL_LABELS[details.chargeModel] : NOT_GIVEN,
          Estimate: <>{estimateOf(entry) ?? NOT_GIVEN}{note && <span className="site-estimate-changed">{note}</span>}</>,
          "Similar jobs done": details.similarJobs ? SIMILAR_JOBS_LABELS[details.similarJobs] : NOT_GIVEN,
          "Earliest start": details.startWindow ? COMPANY_START_LABELS[details.startWindow] : NOT_GIVEN,
        };
        return <tr key={entry.alias} role="row">
          <th scope="row" role="rowheader">{shownName(entry)}{accepted(entry) && <span className="site-compare-accepted">Accepted</span>}</th>
          {columns.map(column => <td key={column} role="cell" data-label={column}><span>{cells[column]}</span></td>)}
        </tr>;
      })}</tbody>
    </table>
    <p className="bare-helper">{ESTIMATES_NOT_CHECKED} You can accept as many as you like and choose after meeting them.</p>
  </div>;
}

/**
 * The estimates this browser last showed the site, and the ones it showed when the site pressed Accept, so a change is
 * said beside the estimate (stress test, 2026-11-24: an estimate raised after the introduction updated silently).
 * Per viewer and per job (localStorage, keyed by a short hash of the link, never the link): the estimate in words and
 * the alias letter, nothing else of the company. Storage that throws or is empty only means no change can be said.
 */
const estimateStoreKey = (token: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) hash = Math.imul(hash ^ token.charCodeAt(index), 0x01000193);
  return `blueprint.siteEstimates.${(hash >>> 0).toString(36)}`;
};
type EstimateMemory = Record<string, { seen?: string; accepted?: string }>;
function readEstimateMemory(token: string): EstimateMemory {
  try {
    const raw = JSON.parse(window.localStorage.getItem(estimateStoreKey(token)) ?? "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as EstimateMemory : {};
  } catch { return {}; }
}
function writeEstimateMemory(token: string, memory: EstimateMemory) {
  try { window.localStorage.setItem(estimateStoreKey(token), JSON.stringify(memory)); } catch { /* nothing to say next time */ }
}

/**
 * One line per alias whose estimate changed: after Accept first (what this browser showed when Accept was pressed), else
 * since the site last looked (the earlier visit's estimate, or the first one this visit showed). A first estimate where
 * there was none is not a change, unless the site had already accepted the company.
 */
function useEstimateNotes(token: string, entries: AnsweredEntry[]) {
  const memory = useRef<EstimateMemory | null>(null);
  memory.current ??= readEstimateMemory(token);
  // What the site saw before this visit, fixed for the visit, so a change stays said while the page polls.
  const baseline = useRef<Record<string, string> | null>(null);
  baseline.current ??= Object.fromEntries(Object.entries(memory.current)
    .filter(([, value]) => typeof value?.seen === "string").map(([alias, value]) => [alias, value.seen!]));
  const notes: Record<string, string> = {};
  for (const entry of entries) {
    const now = estimateOf(entry) ?? NOT_GIVEN;
    const before = baseline.current[entry.alias] ??= now;
    // Only while the company is accepted: an introduction cancelled since is not "after you accepted" any more. The
    // server's record of the estimate at Accept first (`acceptedEstimate`), else what this browser showed then.
    const atAccept = !accepted(entry) ? undefined : entry.acceptedEstimate !== undefined
      ? (entry.acceptedEstimate ? estimateInWords(entry.acceptedEstimate.chargeModel, entry.acceptedEstimate.estimate) ?? NOT_GIVEN : NOT_GIVEN)
      : memory.current[entry.alias]?.accepted;
    if (atAccept && atAccept !== now) notes[entry.alias] = atAccept === NOT_GIVEN ? ESTIMATE_ADDED_AFTER_ACCEPT : estimateChangedAfterAccept(atAccept);
    else if (!atAccept && before !== now && before !== NOT_GIVEN) notes[entry.alias] = estimateChangedSinceLooked(before);
  }
  const shown = entries.map(entry => `${entry.alias}=${estimateOf(entry) ?? NOT_GIVEN}`).join("|");
  useEffect(() => {
    const stored = memory.current!;
    for (const entry of entries) stored[entry.alias] = { ...stored[entry.alias], seen: estimateOf(entry) ?? NOT_GIVEN };
    if (entries.length) writeEstimateMemory(token, stored);
  }, [token, shown]);
  const rememberAccept = (alias: string) => {
    const entry = entries.find(item => item.alias === alias);
    if (!entry || !memory.current) return;
    memory.current[alias] = { ...memory.current[alias], accepted: estimateOf(entry) ?? NOT_GIVEN };
    writeEstimateMemory(token, memory.current);
  };
  return { notes, rememberAccept };
}

/** The applicant as the site reads it: the company's name when its answer shows it (`applicant`), else its alias. */
const shownName = (entry: AnsweredEntry) => entry.applicant?.name ?? entry.alias;

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

/** Where the job stands, as a shipment tracker shows a load: six steps, each done, current or still to come. */
export function JobTracker({ sharing, activity }: { sharing: JobSharing; activity: SiteCompanyActivity | undefined }) {
  const steps = jobTrackerSteps(sharing, isSiteCompanyActivity(activity) ? activity : undefined);
  return <ol className="site-job-tracker" aria-label="Where your job stands">
    {steps.map(step => <li key={step.key} className={`site-job-tracker-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
      <span className="site-job-tracker-dot" aria-hidden="true" />
      <span className="site-job-tracker-label">{step.label}<span className="sr-only">{step.state === "done" ? " (done)"
        : step.state === "current" ? " (now)" : " (to come)"}</span></span>
      {step.detail && <span className="site-job-tracker-detail">{step.detail}</span>}
      {step.atIso && <time className="site-job-tracker-date" dateTime={step.atIso}>{dateInWords(step.atIso)}</time>}
    </li>)}
  </ol>;
}

/**
 * After an introduction, the site says how it went: a visit happened, a pilot was agreed. Blueprint cannot see either,
 * so only this press records one, with the date it was pressed; "Undo" takes it back.
 */
function IntroductionProgress({ token, entry, onChanged }: { token: string; entry: AnsweredEntry; onChanged?: () => void }) {
  const [progress, setProgress] = useState(entry.progress ?? {});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { setProgress(entry.progress ?? {}); }, [entry.progress?.visitAtIso, entry.progress?.pilotAtIso]);
  async function mark(step: "visit" | "pilot", done: boolean) {
    if (busy) return;
    setBusy(step); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/introductions/progress`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ alias: entry.alias, step, done }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(typeof result?.error === "string" ? result.error : PROGRESS_FAILED);
      setProgress(result.progress ?? {});
      onChanged?.();
    } catch (failure) { setError(failure instanceof Error && failure.message ? failure.message : PROGRESS_FAILED); }
    finally { setBusy(null); }
  }
  return <div className="site-job-progress" role="group" aria-label={`How it went with ${shownName(entry)}`}>
    {(["visit", "pilot"] as const).map(step => {
      const at = step === "visit" ? progress.visitAtIso : progress.pilotAtIso;
      return at ? <p key={step} className="site-job-progress-done">
        <span>{PROGRESS_MARK[step].done(dateInWords(at))}</span>
        <button type="button" className="ms-inline-link" disabled={busy !== null} onClick={() => void mark(step, false)}
          aria-label={`${PROGRESS_UNDO}: ${PROGRESS_MARK[step].done(dateInWords(at))}`}>{PROGRESS_UNDO}</button>
      </p> : <button key={step} type="button" className="site-job-progress-mark" disabled={busy !== null}
        onClick={() => void mark(step, true)}>{busy === step ? "Saving…" : PROGRESS_MARK[step].press}</button>;
    })}
    {error && <p role="alert">{error}</p>}
  </div>;
}

/**
 * Under the section's sentence: the one line for the automatic send, each send recorded by hand and each answer, by
 * alias only ("Company A"), in the order they came, with why: the company's words as the server gives them (its name,
 * email, website and any link already taken out), or, for an answer that is not a yes with no words to show, that no
 * reason can be shown. Beside each company that answered Interested and can be introduced, "Introduce us" and the
 * sentence saying what it shares; beside one that would need something, that an introduction follows a change of its
 * answer. After an introduction, that company's name and contact details, and only that company's.
 */
function AnswerReason({ entry, estimateNote }: { entry: AnsweredEntry; estimateNote?: string | null }) {
  const reason = typeof entry.reason === "string" && entry.reason.trim() ? entry.reason.trim() : null;
  const verified = entry.details?.verified ?? (entry.state.startsWith("tested_") ? reason : null);
  const start = entry.details?.startWindow && COMPANY_START_LABELS[entry.details.startWindow];
  const glance = applicationGlance(entry, estimateNote);
  return <>
    {(verified || start || glance.length > 0) && <dl className="company-response-facts">
      {glance.map(([label, value, hint]) => <div key={label}><dt>{label}</dt><dd>{value}
        {hint && <span className="bare-helper site-estimate-label"> {hint}</span>}
        {label === "Estimate" && estimateNote && <span className="site-estimate-changed">{estimateNote}</span>}</dd></div>)}
      {verified && <div><dt>What they checked</dt><dd>{verified}</dd></div>}
      {start && <div><dt>Earliest start</dt><dd>{start}</dd></div>}
    </dl>}
    {/* Their words are being prepared: said plainly, never "No reason shared." while they exist. */}
    {entry.wordsPending === true && <p className="bare-helper site-job-company-reason" role="status">{COMPANY_WORDS_BEING_PREPARED}</p>}
    {/* Held at a limit: said as it is, never "being prepared" (a review of PR #1437). */}
    {entry.wordsLimit === true && <p className="bare-helper site-job-company-reason">{COMPANY_WORDS_LIMIT}</p>}
    {!(entry.state.startsWith("tested_") && verified) && !(entry.state === "needs_something" && entry.question) &&
      (reason ? <p className="bare-helper site-job-company-reason">{companyReason(reason)}</p>
        : !INTRODUCIBLE_RESPONSE_STATES.includes(entry.state) && entry.wordsPending !== true && entry.wordsLimit !== true
          && <p className="bare-helper site-job-company-reason">{NO_REASON_SHOWN}</p>)}
    {MAY_CHANGE_RESPONSE_STATES.includes(entry.state) && !entry.question && !entry.company && !entry.introducedAtIso
      && !entry.introductionPending && <p className="bare-helper">{introductionIfChanged(shownName(entry))}</p>}
  </>;
}

/** `alias` is the company's letter on this job, which the route takes; `name` is the company as the site reads it. */
function ReplyQuestion({ token, alias, name, question, onChanged }: { token: string; alias: string; name: string;
  question: NonNullable<AnsweredEntry["question"]>; onChanged?: () => void }) {
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState(question.answer);
  // Sent, and its names and contact details are still being taken out: the company does not read it yet.
  const [savedPending, setSavedPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shownAnswer = question.answer ?? saved;
  const replied = Boolean(shownAnswer) || question.answerPending === true || savedPending;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || answer.trim().length < 2) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/clarifications`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ alias: alias.replace(/^Company /, ""), questionId: question.id, answer: answer.trim() }),
      });
      const result = await response.json();
      if (!response.ok || (typeof result.answer !== "string" && result.pending !== true))
        throw new Error(result.error || "Your answer could not be saved. Try again.");
      // The server answers with the reply as the company reads it, or says it is still being prepared.
      if (typeof result.answer === "string") setSaved(result.answer); else setSavedPending(true);
      onChanged?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your answer could not be saved. Try again.");
    } finally { setBusy(false); }
  }
  // The reply date (three days after the question): a date to aim for, never a lock (`REPLY_WINDOW_MS`).
  const by = !replied && question.replyByIso ? question.replyByIso : null;
  const passed = by !== null && Date.parse(by) <= Date.now();
  return <div className="company-question">
    <dl className="company-response-facts">
      <div><dt>What they need to know</dt><dd>{question.text}</dd></div>
      {shownAnswer && <div><dt>Your reply</dt><dd>{shownAnswer}</dd></div>}
    </dl>
    {/* Exactly what the company reads of the reply (2026-11-24), or that it does not read it yet. */}
    {shownAnswer && <p className="bare-helper">{replyAsReadLine(name)}</p>}
    {!shownAnswer && replied && (question.answerLimit === true ? <p className="bare-helper">{replyLimitLine(name)}</p>
      : <p className="bare-helper" role="status">{replyPendingLine(name)}</p>)}
    {by && <p className={passed ? "bare-helper site-reply-date-passed" : "bare-helper"}>
      {passed ? REPLY_DATE_PASSED(dateInWords(by)) : replyByLine(dateInWords(by))}</p>}
    {!replied && <details>
      <summary className="bare-inline-link">Reply</summary>
      <form className="ms-form" onSubmit={submit}>
        <label>Your reply<textarea rows={2} minLength={2} maxLength={SITE_CLARIFICATION_LIMIT} required value={answer}
          onChange={event => setAnswer(event.target.value)} /></label>
        <p className="bare-helper">Blueprint shares this reply with {name} and keeps your contact details private.</p>
        <button type="submit" className="ms-button" disabled={busy}>{busy ? "Saving…" : "Send reply"}</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>}
    {(saved || savedPending) && !question.answer && <p className="bare-helper" role="status">Reply sent.</p>}
  </div>;
}

/** The section's lines (see `AnswerReason` for each answer's why). */
function CompanyEntries({ token, activity, onIntroduced, posted }: { token: string; activity: SiteCompanyActivity | undefined;
  posted: boolean;
  onIntroduced?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  // A refusal or failure of Accept, with the answer it was pressed beside (`atIso`): it stays said while that answer is
  // shown, or while the company cannot be accepted, and goes once the company can be accepted on a newer answer.
  // A refusal for an answer that changed stays said on the newer answer too, until the next press.
  const [errors, setErrors] = useState<Record<string, { message: string; atIso: string; changed?: boolean }>>({});
  // The sentence the server said is true for this job when it refused another (`statement_not_current`): shown until
  // the job's page reads a sentence of its own again, so a page that could not tell never loops on "reload".
  const [statementOverride, setStatementOverride] = useState<{ version: string; read: string | undefined } | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  const answered = isSiteCompanyActivity(activity)
    ? activity.entries.filter((entry): entry is AnsweredEntry => entry.kind === "answered") : [];
  const { notes: estimateNotes, rememberAccept } = useEstimateNotes(token, answered);
  // The "we are emailing you" line holds only until the server reads the introduction back. Once it no longer offers the
  // button, the request is on record, so a later cancellation that may be asked again shows the button again.
  useEffect(() => {
    if (!isSiteCompanyActivity(activity)) return;
    setRequested(current => current.filter(alias => activity.entries.some(entry =>
      entry.kind === "answered" && entry.alias === alias && entry.canIntroduce === true)));
  }, [activity]);
  if (!isSiteCompanyActivity(activity)) return null;
  // The sentence beside Accept that is true for this job, as the server chose it; the press sends its version.
  const readVersion = isIntroductionStatementVersion(activity.introductionStatementVersion)
    ? activity.introductionStatementVersion : undefined;
  const statementVersion = statementOverride && statementOverride.read === readVersion ? statementOverride.version
    : readVersion ?? INTRODUCTION_REQUEST_STATEMENT_VERSION;
  const errorFor = (entry: AnsweredEntry) => {
    const error = errors[entry.alias];
    return error?.message && (error.atIso === entry.atIso || entry.canIntroduce !== true || error.changed) ? error.message : null;
  };
  async function introduce(alias: string, atIso: string) {
    if (busy) return;
    setBusy(alias); setErrors(current => ({ ...current, [alias]: { message: "", atIso } }));
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/introductions`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        // The version of the sentence shown beside the button: pressing it is the agreement it records. With it, the
        // time of the answer shown beside it, so the server records the estimate this page showed, or refuses.
        body: JSON.stringify({ alias: alias.replace(/^Company /, ""), statementVersion, answerAtIso: atIso }),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 409 || response.status === 400) {
        setErrors(current => ({ ...current, [alias]: { atIso, changed: result?.reason === "answer_changed",
          message: isIntroductionRefusalReason(result?.reason)
            ? INTRODUCTION_REFUSAL_SENTENCES[result.reason as keyof typeof INTRODUCTION_REFUSAL_SENTENCES]
            : result?.code === "introduction_statement_changed" ? INTRODUCTION_STATEMENT_CHANGED : INTRODUCTION_FAILED } }));
        if (result?.code === "introduction_statement_changed" && isIntroductionStatementVersion(result?.statementVersion))
          setStatementOverride({ version: result.statementVersion, read: readVersion });
        // A refusal means this page is out of date (stress test, 2026-11-24: a company changed to "Not a fit" while the
        // page still offered Accept): read the job again, so the entry shows the company's answer as it is now.
        onIntroduced?.();
        return;
      }
      if (!response.ok || result?.ok !== true) throw new Error(INTRODUCTION_FAILED);
      rememberAccept(alias);
      setRequested(current => [...current, alias]);
      onIntroduced?.();
    } catch { setErrors(current => ({ ...current, [alias]: { message: INTRODUCTION_FAILED, atIso } })); }
    finally { setBusy(null); }
  }
  // "Introduce us" is offered beside each answer the server says can be introduced (`interested`, or a stored
  // `tested_can_do`, E9), with no limit per job (owner, 2026-11-12).
  const replies = activity.entries.filter(entry => entry.kind === "answered").length;
  const views = activity.views ?? 0;
  // Where the job stands, in two counts. Not how long the first response took: it decides nothing for the site (owner,
  // 2026-11-25: the site's screen is cut to whom it meets).
  return <>
    {(posted || replies > 0) && <div className="site-company-summary">
      <p className="site-company-metrics">
        {/* `views` counts the distinct approved companies that opened the job (`companyJobViews.ts`). */}
        {activity.views !== null && <span>Viewed by {views} {views === 1 ? "company" : "companies"}</span>}
        <span>{replies} {replies === 1 ? "response" : "responses"}</span>
      </p>
    </div>}
    <CompareApplicants entries={answered} estimateNotes={estimateNotes} />
    {activity.entries.length > 0 && <ul className="site-job-company-entries" aria-label="Company responses">
      {activity.entries.map((entry, index) => <li key={`${entry.kind}-${entry.alias}-${entry.atIso}-${index}`}>
        {entry.kind === "sent" ? <p className="bare-helper">{sentToCompany(entry.alias, dateInWords(entry.atIso))}</p> : <>
          <div className="site-company-response-title">
            <h3>{shownName(entry)}</h3>
            <span className={INTRODUCIBLE_RESPONSE_STATES.includes(entry.state) ? "opportunity-label-ready" : undefined}>
              {SITE_RESPONSE_LABELS[entry.state]}
            </span>
          </div>
          {entry.applicant?.website && !entry.company && <p className="site-company-website">
            <a className="ms-text-link" href={entry.applicant.website} target="_blank" rel="noreferrer noopener">{entry.applicant.website}</a></p>}
          <p className="site-company-reply-date">Answered <time dateTime={entry.atIso}>{dateInWords(entry.atIso)}</time></p>
          {/* Changed after the introduction was made (the server's own times): said even when this browser holds no
              earlier estimate to compare. */}
          {!estimateNotes[entry.alias] && entry.introducedAtIso && entry.atIso > entry.introducedAtIso
            && <p className="bare-helper site-estimate-changed">{answerUpdatedAfterAccept(dateInWords(entry.atIso))}</p>}
        </>}
        {entry.kind === "answered" && <AnswerReason entry={entry} estimateNote={estimateNotes[entry.alias]} />}
        {entry.kind === "answered" && entry.question && <ReplyQuestion key={entry.question.id} token={token}
          alias={entry.alias} name={shownName(entry)} question={entry.question} onChanged={onIntroduced} />}
        {entry.kind === "answered" && entry.company && typeof entry.company.name === "string" && typeof entry.company.email === "string"
          && <><IntroducedDetails entry={entry} /><IntroductionProgress token={token} entry={entry} onChanged={onIntroduced} /></>}
        {/* Asked, not made yet: the company's email has not been sent, so the site is told it is in progress (H2). */}
        {entry.kind === "answered" && !entry.company && entry.introductionPending === true
          && <p className="bare-helper" role="status">{introductionRequested(shownName(entry))}</p>}
        {entry.kind === "answered" && !entry.company && entry.introductionCancelled === true
          && <p className="bare-helper">{INTRODUCTION_CANCELLED}</p>}
        {/* Applied, and Blueprint's approval of the company was withdrawn since: why there is no Accept, said plainly. */}
        {entry.kind === "answered" && !entry.company && entry.notApprovedNow === true && entry.canIntroduce !== true
          && <p className="bare-helper" role="status">{companyNotApprovedNow(shownName(entry))}</p>}
        {entry.kind === "answered" && !entry.company && entry.canIntroduce === true && (requested.includes(entry.alias)
          ? <p className="bare-helper" role="status">{introductionRequested(shownName(entry))}</p>
          : <BareButton onClick={() => void introduce(entry.alias, entry.atIso)} disabled={busy !== null} helper={introduceSentence(shownName(entry), statementVersion)}>
            {busy === entry.alias ? "Asking…" : INTRODUCE_LABEL}
          </BareButton>)}
        {/* Kept after the page reads the job again, beside the company's answer as it is now. */}
        {entry.kind === "answered" && errorFor(entry) && <p role="alert">{errorFor(entry)}</p>}
      </li>)}
    </ul>}
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
export function JobCompanyResponses({ token, sharing = { state: "not_shared", sharedAtIso: null }, activity, onChanged, ended = null }: {
  token: string;
  sharing?: JobSharing;
  activity?: SiteCompanyActivity;
  onChanged?: () => void;
  ended?: "withdrawn" | "closed" | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  async function agree() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/recording-consent`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        // The version of the exact sentence shown above the button.
        body: JSON.stringify({ granted: true, statementVersion: RECORDING_RIGHTS_STATEMENT_V6_VERSION }),
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
    <BareLead>{sharing.state === "visible" ? (sharing.noCompanyCanSee ? NO_COMPANY_CAN_SEE_LINE : SHARED_LINE) : sharing.videoReceived
      ? "Video received. We're preparing your job for posting."
      : sharing.videoReceived === false ? "Send a video to post your job." : PREPARING_TO_SHARE_LINE}</BareLead>
    <CompanyEntries key={token} token={token} activity={activity} onIntroduced={onChanged} posted={sharing.state === "visible"} />
  </BareGroup>;
  else if (sharing.state === "not_visible") body = <BareGroup>
    <BareNotice role="status">{NOT_VISIBLE_LINE}</BareNotice>
    <CompanyEntries key={token} token={token} activity={activity} onIntroduced={onChanged} posted={false} />
  </BareGroup>;
  else if (sharing.olderStatement) body = <BareGroup>
    <BareLead>{OLDER_JOB_LINES}</BareLead>
    <BareButton onClick={() => void agree()} disabled={busy} helper={RECORDING_RIGHTS_STATEMENT_V6}>{busy ? "Saving…" : OLDER_JOB_AGREE}</BareButton>
    {error && <p role="alert">{error}</p>}
  </BareGroup>;
  else body = <BareGroup><BareLead>{sharing.videoReceived === false ? "Send a video to post your job." : NOT_SHARED_YET}</BareLead></BareGroup>;
  // The tracker, while the job is being posted or is posted; a withdrawn, closed or hidden job says so instead.
  const tracked = !ends && (sharing.state === "visible" || sharing.state === "preparing");
  return <section className="site-answer-section site-company-panel" aria-labelledby="site-job-companies">
    <h2 id="site-job-companies">{SECTION_COMPANIES}</h2>
    {tracked && <JobTracker sharing={sharing} activity={activity} />}
    {body}
  </section>;
}

export interface SiteAnswerProps {
  token: string; answer: SiteAnswerView; onIntroductionRequested?: () => void;
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
  /** What the delivered simulation holds (`simulationContentsOf`), when one is delivered: said under "ready". */
  simulationContents?: SimulationContents | null;
  /** The first look as the Pipeline's published table words it; when present it replaces the robot rows. */
  firstLookTable?: FirstLookWords | null;
  /** Optional job questions below company activity, when a required action is not waiting. */
  jobFacts?: ReactNode;
}

/**
 * The job page's sections. The first look leads whenever it exists, in every phase; the simulation of the site says
 * where it stands. There is no share step: a job is shared because its site accepted recording statement v4.
 */
export function SiteAnswer({ token, answer, onIntroductionRequested, onEditJob, onUpdateVideo, quietAction = false,
  onShowDetails, onShowSettings, outlook = null, sceneViewUrl = null, successRule = null, simulationContents = null, firstLookTable = null, jobFacts }: SiteAnswerProps) {
  const pick = answer.state === "ready" ? answer.pick : null;
  // The phase is the server's (one decision for the page, sharing and emails). When unsure, the job is still being
  // worked on (review, 2026-11-11): with no outlook the page says the packet is being built and offers no button.
  const phase: JobPhase = answer.state === "reading" || outlook?.phase === "reading" ? "reading" : outlook?.phase ?? "building";
  const links = [onShowDetails && answer.state !== "reading" ? { key: "details", label: "See details", onClick: onShowDetails } : null,
    onShowSettings ? { key: "settings", label: "Job settings", onClick: onShowSettings } : null].filter(Boolean) as Array<{ key: string; label: string; onClick: () => void }>;
  const notices = scopeLines(answer);
  const reading = answer.state === "reading" || phase === "reading";
  // An answer that cannot be checked stays as it is, unless the job is still being built or its simulation is ready.
  const cannot = answer.state === "cannot_assess" && phase !== "building" && phase !== "simulation_ready";

  const endedBySite = phase === "ended_by_site" ? (outlook?.reason === "permission_withdrawn" ? "withdrawn" as const : "closed" as const) : null;
  const companies = <JobCompanyResponses token={token} sharing={answer.sharing} activity={answer.companies} onChanged={onIntroductionRequested} ended={endedBySite} />;

  // Section 2: the first look.
  let firstLook: ReactNode;
  if (reading) firstLook = <BareGroup>
    <div className="bare-spinner" aria-hidden="true" />
    <BareLead>{READING_LINE}</BareLead>
    <p className="bare-helper">{READING_HELPER}</p>
  </BareGroup>;
  else if (answer.state === "cannot_assess") {
    // An unread video is not fixed by editing the job: no button is offered for it.
    const fix = answer.reason === REASON_UNSIZED ? onUpdateVideo && { label: NEW_VIDEO_LABEL, run: onUpdateVideo }
      : answer.reason === REASON_NOT_READ ? null : onEditJob && { label: EDIT_JOB_LABEL, run: onEditJob };
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

  // Section 3: the simulation of the site, by the phase; the server's reason sentence for an ending.
  const ended = phase === "no_test" || phase === "ended_by_site";
  const notRun = cannot || !ended ? null : outlook?.sentence ?? null;
  const simulationLine = outlook?.reason === "spending_cap_reached" ? outlook.sentence
    : phase === "building" ? (outlook?.reason === "step_failed" && outlook.sentence ? outlook.sentence : SIMULATION_BUILDING)
    : phase === "simulation_ready" ? SIMULATION_READY
    : phase === "waiting_on_site" ? outlook?.sentence ?? "Tell us in one sentence what the robot should do, so we can build the simulation of your job."
    : notRun;
  // What a ready simulation holds, in the facts a company reads (outreach audit D2, 2026-11-27): the room without the
  // job's object, or no success rule. The site's rule is then said as its own words, not as what the simulation checks.
  const contents = phase === "simulation_ready" ? simulationContents : null;
  const contentsLine = simulationContentsLine(contents);
  const rule = !successRule?.trim() ? null : contents && !contents.successRuleIncluded ? youSaidDoneMeans(successRule) : doneMeans(successRule);
  const viewable = Boolean(sceneViewUrl) && !reading;
  const simulation = simulationLine || rule || viewable ? <Section id="site-job-simulation" title={SECTION_SIMULATION}>
    <BareGroup>
      {simulationLine && <BareLead>{simulationLine}</BareLead>}
      {contentsLine && <p className="bare-helper">{contentsLine}</p>}
      {rule && <p className="bare-helper">{rule}</p>}
      {viewable && <p><a className="ms-text-link" href={sceneViewUrl!} target="_blank" rel="noreferrer">{VIEW_SIMULATION_LABEL}</a></p>}
    </BareGroup>
  </Section> : null;

  return <section className="site-answer-bare" aria-label="Your job">
    {companies}
    {jobFacts}
    <Section id="site-job-first-look" title={SECTION_FIRST_LOOK}>{firstLook}</Section>
    {simulation}
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

export type DetailScreen = "why" | "others" | "ruled-out" | "estimated" | "unseen";
const DETAIL_TITLES: Readonly<Record<DetailScreen, string>> = {
  why: "First look: why this robot", others: "Other robots", "ruled-out": "Robots that don't fit", estimated: "What we estimated",
  unseen: "What we couldn't see",
};

/** Which detail screens have something to say, in the menu's order. */
export function detailScreens(answer: SiteAnswerView): DetailScreen[] {
  const pick = answer.state === "ready" ? answer.pick : null;
  // The first look and what it rests on, as the page leads with it.
  return ([
    (pick || (answer.reason && answer.state !== "ready")) && "why",
    (answer.runnerUp || answer.alsoFit.length || answer.state === "ready") && "others",
    answer.ruledOut.length > 0 && "ruled-out",
    answer.facts.length > 0 && "estimated",
    (answer.unknowns.some(line => !isScopeNote(line)) || answer.confidence.raiseIt.length || answer.confidence.reasons.length) && "unseen",
  ].filter(Boolean)) as DetailScreen[];
}

/** The details menu: one row per small screen, each with "‹ Back". */
export function SiteAnswerDetails({ answer, onBack, onOpen }: {
  answer: SiteAnswerView; onBack: () => void; onOpen: (screen: DetailScreen) => void;
}) {
  const screens = detailScreens(answer);
  return <div className="site-answer-details">
    <BareBack onClick={onBack} />
    <h1 tabIndex={-1}>Details</h1>
    <BareMenu label="Details" items={screens.map(screen => ({ key: screen, label: DETAIL_TITLES[screen], onClick: () => onOpen(screen) }))} />
  </div>;
}

/** One detail screen: short labelled rows; the sourced sentences said word for word. */
export function SiteAnswerDetail({ answer, robotCheck, screen, onBack }: {
  answer: SiteAnswerView; robotCheck?: SimulationProofView["robotCheck"]; screen: DetailScreen; onBack: () => void;
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
    ...(robotCheck ? [{ key: "scene", label: "In the simulation", value: robotCheck.line }] : []),
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
  return <div className="site-answer-details">
    <BareBack onClick={onBack} />
    <h1 tabIndex={-1}>{title}</h1>
    {body}
  </div>;
}
