import { useState, type ReactNode } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import { JOB_CARD_ANSWER_STATEMENT, JOB_CARD_ANSWER_STATEMENT_VERSION } from "@/lib/jobCardAnswerConsent";
import type { SimulationProof as SimulationProofView } from "@/lib/simulationProof";
import { PLAIN_SETUP_CAVEAT, SimulationTestRows, TrustRows, computerTestLine, setupCaveatShown } from "./SimulationProof";
import {
  BareBack, BareBig, BareButton, BareDone, BareFine, BareGroup, BareLabel, BareLead, BareLinks, BareMenu, BareNotice, BareRows, BareSureness, BareTicks,
  type BareTickState,
} from "@/components/bare/Bare";
import {
  ALSO_INVOLVES_PREFIX, REASON_UNSIZED, SITE_ANSWER_LIMITS, TIGHT_FIT_SENTENCE, UNKNOWN_JOB_KIND, UNKNOWN_MULTI_STEP, isScopeNote,
  type AnswerBasis, type AnswerCheck, type AnswerConfidenceLevel, type AnswerEvidence, type AnswerRobot, type SiteAnswer as SiteAnswerView,
} from "@/lib/siteAnswer";

/*
 * The site's answer, bare bones (owner direction, 2026-11-11; rules in the design note's "Bare bones"). Every line
 * here is a constant, or a short line chosen by the data that makes it true; each says why beside it.
 */
export const FIND_COMPANY_LABEL = "Find a company to set it up";
/** Rendered from the statement the introduction route records, so the two never drift. */
export const FIND_COMPANY_CONSENT = JOB_CARD_ANSWER_STATEMENT;
/** The limits of the check, on the page. The email and the job card carry the full note (`SITE_ANSWER_NOTE`). */
export const LIMITS_LINE = SITE_ANSWER_LIMITS;
const INTRODUCTION_FAILED = "We could not send your request just now. Try again shortly.";
/** Said only when the response or the stored card says the card is listed. */
export const SHARED_LISTED = "✓ Shared. We'll email you when a company replies.";
const askedUnlisted = (date: string) => `You asked on ${date}. Blueprint will set up your job card and email you.`;
/** The card is listed, but under the older sharing box, which does not share the answer: said so, and the button is back. */
export const SHARED_WITHOUT_ANSWER = "Your job is shared without this answer. Press the button to share the answer too.";
/**
 * Where the job card stands, read from the owner's own listing: on with the answer (a with-answer statement), on
 * without it (the older box), or off. Null until it is read; the stored answer's `jobCardListed` then decides.
 */
export type CardState = "with_answer" | "without_answer" | "off" | null;
export const READING_LINE = "We're watching your video.";
export const READING_HELPER = "We'll email you when it's ready.";
export const EDIT_JOB_LABEL = "Change my job description";
export const NEW_VIDEO_LABEL = "Send a new video";
/** The reader's "we could not tell the kind of job" line, in plain words; said whenever the server says it. */
export const KIND_UNKNOWN_LINE = "We couldn't tell exactly what the job is, so we only checked picking up and putting down.";
/** Under "Why this robot": the answer is a check of the machine; how it is run is set up when it is installed. */
export const ROBOT_NOT_SOFTWARE = "This answer is about the robot itself, not the software that runs it. The software is set up when the robot is installed.";

/** A date in words. A bare `YYYY-MM-DD` is read as that calendar day, whatever the viewer's time zone. */
function dateInWords(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const SURE: Readonly<Record<AnswerConfidenceLevel, { filled: 1 | 2 | 3; word: string }>> = {
  low: { filled: 1, word: "Not sure yet" }, fair: { filled: 2, word: "Fairly sure" }, good: { filled: 3, word: "Sure" },
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

export function ticksOf(checks: Array<Pick<AnswerCheck, "key" | "outcome"> & { text?: string; tight?: boolean }>, evidence: Pick<AnswerEvidence, "level" | "scope"> | undefined) {
  const items: Array<{ key: string; state: BareTickState; text: string }> = checks
    .filter(check => check.outcome !== "fail")
    .map(check => ({ key: check.key, state: check.outcome === "pass" ? "yes" : "unsure",
      text: check.outcome === "pass" ? `${CHECK_PASS[check.key]}${isTight(check) ? ", only just" : ""}` : CHECK_OPEN[check.key] }));
  const record = evidenceTick(evidence);
  return record ? [...items, { key: "evidence", state: "yes" as const, text: record }] : items;
}

/**
 * The one plain reason under "How sure are we?", from what the checks rest on: the sizes (reach, cycle) and the
 * weight (payload) estimated from the video, or the reach checked in the scene. Null when neither holds.
 */
export function sureReason(robot: AnswerRobot): string | null {
  const estimated = new Set(robot.checks.filter(check => check.estimated).map(check => check.key));
  const sizes = estimated.has("reach") || estimated.has("cycle_time");
  const weight = estimated.has("payload");
  if (sizes && weight) return "We estimated the sizes and weight from your video.";
  if (sizes) return "We estimated the sizes from your video.";
  if (weight) return "We estimated the weight from your video.";
  if (robot.sceneChecked) return "We checked its reach in a computer copy of your site.";
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

/**
 * One button: find a company. One click is the site's explicit choice to share what the line under it says; asked
 * once, it says so instead. When the page has a step the site must take first, the button stays, quiet.
 */
function Introduction({ token, answer, onRequested, quiet, card }: { token: string; answer: SiteAnswerView; onRequested?: () => void; quiet: boolean; card: CardState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState<{ at: string; listed: boolean } | null>(null);
  const asked = requested?.at ?? answer.introductionRequestedAtIso;
  // This page's own press is the latest word; until then, the owner's listing as read, then the stored card.
  const state: "with_answer" | "without_answer" | "off" = requested ? (requested.listed ? "with_answer" : "off")
    : card ?? (answer.jobCardListed === true ? "with_answer" : "off");
  async function ask() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/introduction-request`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ statementVersion: JOB_CARD_ANSWER_STATEMENT_VERSION }),
      });
      const result = await response.json().catch(() => null);
      // A 409 says why in the server's words (for example, the wording on the page changed); the button stays.
      if (response.status === 409 && typeof result?.error === "string") { setError(result.error); return; }
      if (!response.ok || result?.ok !== true) throw new Error(INTRODUCTION_FAILED);
      setRequested({ at: typeof result.requestedAtIso === "string" ? result.requestedAtIso : new Date().toISOString(), listed: result.listed === true });
      onRequested?.();
    } catch { setError(INTRODUCTION_FAILED); }
    finally { setBusy(false); }
  }
  if (asked && state !== "without_answer") return <BareGroup><BareDone>{state === "with_answer" ? SHARED_LISTED : askedUnlisted(dateInWords(asked))}</BareDone></BareGroup>;
  return <BareGroup>
    {asked && <BareNotice role="status">{SHARED_WITHOUT_ANSWER}</BareNotice>}
    <BareButton onClick={() => void ask()} disabled={busy} quiet={quiet} helper={FIND_COMPANY_CONSENT}>{busy ? "Sending…" : FIND_COMPANY_LABEL}</BareButton>
    {error && <p role="alert">{error}</p>}
  </BareGroup>;
}

export interface SiteAnswerProps {
  token: string; answer: SiteAnswerView; proof?: SimulationProofView | null; onIntroductionRequested?: () => void;
  /** Opens the job description editor (Job settings). */
  onEditJob?: () => void;
  /** Starts a new video. */
  onUpdateVideo?: () => void;
  /** The page has a step the site must take first: the answer's own button stays, quiet. */
  quietAction?: boolean;
  onShowDetails?: () => void;
  onShowSettings?: () => void;
  /** Where the job card stands, from the owner's listing; null until read. */
  card?: CardState;
}

/** The scene's negative line about the pick, in plain words: it changes what the answer means, so it is never details-only. */
export const sceneSaysNoFit = (name: string) => `In a simulation of your site, the ${name} does not fit.`;

/**
 * The answer screen: the robot most likely to fit (or the closest), why in a few plain ticks, how sure, one button
 * with its line, two quiet links and the limits line. Everything else is on the details screen.
 */
export function SiteAnswer({ token, answer, proof, onIntroductionRequested, onEditJob, onUpdateVideo, quietAction = false,
  onShowDetails, onShowSettings, card = null }: SiteAnswerProps) {
  const pick = answer.state === "ready" ? answer.pick : null;
  const links = [onShowDetails && answer.state !== "reading" ? { key: "details", label: "See details", onClick: onShowDetails } : null,
    onShowSettings ? { key: "settings", label: "Job settings", onClick: onShowSettings } : null].filter(Boolean) as Array<{ key: string; label: string; onClick: () => void }>;
  const notices = scopeLines(answer);
  const testLine = computerTestLine(proof, pick ? pick.name : null);

  if (answer.state === "reading") return <section className="site-answer-bare" aria-label="Your answer">
    <BareGroup>
      <h2 className="bare-label" id="site-answer-title">Your answer</h2>
      <div className="bare-spinner" aria-hidden="true" />
      <BareLead>{READING_LINE}</BareLead>
      <p className="bare-helper">{READING_HELPER}</p>
    </BareGroup>
    <BareLinks links={links} />
  </section>;

  if (!pick) {
    const fix = answer.state === "cannot_assess"
      ? answer.reason === REASON_UNSIZED ? onUpdateVideo && { label: NEW_VIDEO_LABEL, run: onUpdateVideo } : onEditJob && { label: EDIT_JOB_LABEL, run: onEditJob }
      : null;
    const reason = answer.state === "cannot_assess" ? cannotLine(answer.reason) : answer.reason;
    return <section className="site-answer-bare" aria-label="Your answer">
      <BareGroup>
        <h2 className="bare-label" id="site-answer-title">Your answer</h2>
        <BareLead>{answer.headline}</BareLead>
        {reason && <p className="bare-helper">{reason}</p>}
      </BareGroup>
      {notices.length > 0 && <BareGroup label="Before you rely on this">{notices.map(line => <BareNotice key={line}>{line}</BareNotice>)}</BareGroup>}
      {testLine && <BareGroup><p>{testLine}</p>{setupCaveatShown(proof) && <BareNotice>{PLAIN_SETUP_CAVEAT}</BareNotice>}</BareGroup>}
      {fix && <BareGroup><BareButton onClick={fix.run} quiet={quietAction}>{fix.label}</BareButton></BareGroup>}
      <BareLinks links={links} />
      {answer.state === "ready" && <BareFine>{LIMITS_LINE}</BareFine>}
    </section>;
  }

  // The scene's own "does not fit" (on reach or where it stands) wins over a fit on published figures: the answer
  // then calls it the closest robot, and says why, so the screen and the details never disagree.
  const sceneNo = proof?.robotCheck?.doesNotFit === true;
  const fits = (pick.verdict === "fits" || pick.verdict === "fits_on_paper") && !sceneNo;
  const sure = SURE[answer.confidence.level];
  return <section className="site-answer-bare" aria-label="Your answer">
    <BareGroup>
      <h2 className="bare-label" id="site-answer-title">{fits ? "The robot most likely to fit" : "The closest robot"}</h2>
      <BareBig sub={fits ? `by ${pick.manufacturer}` : `by ${pick.manufacturer}. No robot clearly fits yet.`}>{pick.name}</BareBig>
    </BareGroup>
    <BareGroup>
      <BareTicks label="Why" items={ticksOf(pick.checks, pick.evidence[0])} />
      {sceneNo && <BareNotice>{sceneSaysNoFit(pick.name)}</BareNotice>}
      {notices.map(line => <BareNotice key={line}>{line}</BareNotice>)}
    </BareGroup>
    <BareGroup>
      {/* The reason is the server's own first reason for its sureness (`confidence.reasons`, composed in server/utils/siteAnswer.ts). */}
      <BareSureness filled={sure.filled} word={sure.word} reason={answer.confidence.reasons[0] ?? sureReason(pick)} />
      {testLine && <p>{testLine}</p>}
      {setupCaveatShown(proof) && <BareNotice>{PLAIN_SETUP_CAVEAT}</BareNotice>}
    </BareGroup>
    {answer.nextStep.kind === "introduction" && <Introduction token={token} answer={answer} onRequested={onIntroductionRequested} quiet={quietAction} card={card} />}
    <BareLinks links={links} />
    <BareFine>{LIMITS_LINE}</BareFine>
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
  const spec = robot.specs.find(entry => entry.label === (check.key === "reach" ? "Reach" : check.key === "payload" ? "Rated payload" : ""));
  const label = check.key === "reach" ? "Reach" : check.key === "payload" ? "Strength" : "Speed";
  const open = check.outcome === "unknown" ? "Can't tell yet. " : "";
  const tight = check.outcome === "pass" && isTight(check) ? " · only just enough" : "";
  let figures: string;
  if (check.need === undefined && check.has === undefined) figures = check.text;
  else if (check.key === "reach" && check.basis === "scene_measured") figures = `checked in a simulation of your site${check.has ? ` · reaches ${check.has}` : ""}`;
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
  production: "In real use at a customer", pilot: "Tried at a named customer", offered: "Sold for this kind of job, no customer named",
};

export type DetailScreen = "why" | "others" | "ruled-out" | "estimated" | "unseen" | "test" | "trust";
const DETAIL_TITLES: Readonly<Record<DetailScreen, string>> = {
  why: "Why this robot", others: "Other robots", "ruled-out": "Robots that don't fit", estimated: "What we estimated",
  unseen: "What we couldn't see", test: "The simulation test", trust: "How far to trust it",
};

/** Which detail screens have something to say, in the menu's order. */
export function detailScreens(answer: SiteAnswerView, proof?: SimulationProofView | null): DetailScreen[] {
  const pick = answer.state === "ready" ? answer.pick : null;
  const hasTest = Boolean(proof && proof.state !== "not_started");
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
      value: <>{item.summary} <span className="bare-helper">{LEVEL_WORDS[item.level]}; the source names {item.scope === "family" ? `robots like it${item.family ? ` (${item.family})` : ""}` : "this model"}. <SourceLink href={item.sourceUrl}>{item.sourceTitle}, {item.publisher}</SourceLink></span></> })),
    ...(pick.evidence.length ? [] : [{ key: "no-evidence", label: "Used for jobs like this", value: "We found no documented use of this robot on this kind of job." }]),
    ...(answer.approach ? [{ key: "approach", label: "How it would be run", value: APPROACH_WORDS[answer.approach.kind] }] : []),
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
  if (screen === "test" && proof) body = <SimulationTestRows proof={proof} />;
  if (screen === "trust" && proof) body = <TrustRows proof={proof} />;
  return <div className="site-answer-details">
    <BareBack onClick={onBack} />
    <h1 tabIndex={-1}>{title}</h1>
    {body}
  </div>;
}
