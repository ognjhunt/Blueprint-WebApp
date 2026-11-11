import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { EVIDENCE_LEVEL_LABELS, JOB_CARD_LIMITS, JOB_CARD_LIMITS_TESTED, JOB_CARD_LIMITS_TESTING, SURENESS_STEPS, evidenceScopeLabel, type AnswerBasis, type AnswerEvidence } from "@/lib/siteAnswer";
import { BareBack, BareBig, BareFine, BareNotice, BareParts, BareGroup, BareLead, BareLinks, BareRows, BareSureness, BareTicks } from "@/components/bare/Bare";
import { liftUpTo, ticksOf } from "./SiteAnswer";
import { optionParts } from "@/lib/simulationProof";
import type { JobCardAnswerRobot, JobCardAnswerSummary, TaskCardDetail } from "@/types/taskBrowse";

/** The site's set-up notice, said about the site for a company reading the card. */
const CARD_SETUP_CAVEAT = "This result may come from how we set up the simulation of the site, not from the robots.";

export const JOB_CARD_ANSWER_TITLE = "Blueprint's answer for this job";

/** Where a number came from, said about the site for a company reading the card. */
const BASIS_LABELS: Readonly<Record<AnswerBasis, string>> = {
  site_measured: "measured by the site",
  site_stated: "stated by the site",
  video_observed: "seen in the site's video",
  video_estimate: "estimated from the site's video",
  scene_measured: "sized in the scene rebuilt from the site's video",
};

function dateInWords(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function SourceLink({ evidence }: { evidence: AnswerEvidence }) {
  return <a className="ms-text-link" href={evidence.sourceUrl} target="_blank" rel="noreferrer">
    {evidence.sourceTitle}, {evidence.publisher}{evidence.publishedOn ? `, ${dateInWords(evidence.publishedOn)}` : ""}
  </a>;
}

/** The card's head when the simulation test leads: the same result the site's screen shows, said about "the job". */
function CardTestHead({ test }: { test: NonNullable<JobCardAnswerSummary["test"]> }) {
  const top = test.options[0];
  if (test.kind === "testing" || !top) return <BareGroup>
    <p className="bare-label">Testing now</p>
    <BareBig as="p" sub="on the job, in a simulation of the site.">{`${test.entered} AI ${test.entered === 1 ? "robot" : "robots"}`}</BareBig>
  </BareGroup>;
  const did = `${top.succeeded} of ${top.scored} ${top.scored === 1 ? "try" : "tries"}`;
  // A set-up flag is said beside every test result, as on the site's own screen.
  const setup = test.setupFlag ? <BareNotice>{CARD_SETUP_CAVEAT}</BareNotice> : null;
  if (test.kind === "no_clear_winner") return <BareGroup><p className="bare-label">Tested on the job</p>
    <BareBig as="p" sub={`Top: ${top.label}, did the job in ${did}.`}>No clear winner yet</BareBig>{setup}</BareGroup>;
  if (test.kind === "none_finished") return <BareGroup><p className="bare-label">Tested on the job</p>
    <BareBig as="p" sub={top.furthestText ? `Closest: ${top.label} ${top.furthestText}.` : `${test.options.length} AI ${test.options.length === 1 ? "robot" : "robots"} tried; none finished the job.`}>No AI robot finished the job</BareBig>{setup}</BareGroup>;
  const others = test.options.length - 1;
  const step = test.kind === "winner" ? (test.wording === "did_best" ? 2 : 1) : 0;
  const sure = SURENESS_STEPS[Math.max(0, step - (test.setupFlag ? 1 : 0))];
  return <>
    <BareGroup>
      <p className="bare-label">{test.kind === "one_option" ? "Tested on the job" : test.wording === "did_best" ? "Did best on the job" : "Was ahead on the job"}</p>
      <BareBig as="p" sub={top.maker ? `AI software by ${top.maker}` : undefined}><BareParts parts={optionParts(top.label)} /></BareBig>
    </BareGroup>
    <BareGroup>
      <BareTicks label="Why" items={[{ key: "did", state: "yes", text: `Did the job in ${did}` },
        test.kind === "winner"
          ? { key: "ahead", state: "yes", text: others === 1 ? "Ahead of the other AI robot tested" : `Ahead of the ${others} other AI robots tested` }
          : { key: "only", state: "yes", text: "The only AI robot tested on the job" }]} />
    </BareGroup>
    <BareGroup><BareSureness filled={sure.filled} word={sure.word} /></BareGroup>
  </>;
}

const SURE: Readonly<Record<JobCardAnswerSummary["confidence"]["level"], { filled: 1 | 2 | 3; word: string }>> = {
  low: SURENESS_STEPS[0], fair: SURENESS_STEPS[1], good: SURENESS_STEPS[2],
};

/** Each check as a row: the job's figure and the robot's, the very strings of the site's check sentence. */
function checkValue(check: NonNullable<JobCardAnswerRobot["checks"]>[number]): string {
  const open = check.outcome === "unknown" ? "Can't tell yet. " : check.outcome === "fail" ? "Not enough. " : "";
  if (check.key === "reach") return open + [check.need && `needs ${check.need}`, check.has && `reaches ${check.has}`].filter(Boolean).join(" · ")
    + (check.outcome === "pass" && check.tight ? " · only just enough" : "");
  // A pass needs at most the top of the range; a check not settled says the whole range that straddles the rating.
  if (check.key === "payload") return open + [check.need && `needs to lift ${check.outcome === "pass" ? liftUpTo(check.need) : check.need}`,
    check.has && `lifts up to ${check.has}`].filter(Boolean).join(" · ") + (check.outcome === "pass" && check.tight ? " · only just enough" : "");
  return open + [check.need && `the site's target ${check.need}`, check.has && `takes ${check.has} on paper`].filter(Boolean).join(" · ");
}
const CHECK_NAMES = { reach: "Reach", payload: "Strength", cycle_time: "Speed" } as const;

/** One robot's details: its checks' figures, its published figures with their sources, and its track record. */
function RobotRows({ robot, role }: { robot: JobCardAnswerRobot; role: string }) {
  return <BareRows title={`${role}: ${robot.manufacturer} ${robot.name}`} rows={[
    { key: "verdict", label: "Fit", value: robot.verdictLabel },
    ...(robot.checks ?? []).filter(check => check.need || check.has).map(check => ({ key: check.key, label: CHECK_NAMES[check.key], value: checkValue(check) })),
    ...robot.specs.map(spec => ({ key: spec.label, label: spec.label, value: <>{spec.display} (<a href={spec.sourceUrl} target="_blank" rel="noreferrer">source</a>)</> })),
    ...robot.evidence.map((item, index) => ({ key: `evidence-${index}`, label: index === 0 ? "Used for jobs like this" : "Also",
      value: <>{item.summary} <span className="bare-helper">{EVIDENCE_LEVEL_LABELS[item.level]} · {evidenceScopeLabel(item)}. <SourceLink evidence={item} /></span></> })),
    ...(robot.evidence.length ? [] : [{ key: "none", label: "Used for jobs like this", value: "We found no documented use of this robot on this kind of job." }]),
  ]} />;
}

/**
 * The answer a site shared with its card, bare bones, the same way the site sees it: the robot most likely to fit
 * (or the closest), why in plain ticks, how sure, the simulation's line, and "See details" for every figure and source.
 * Inside the browse list's line (`JobCardAnswerLine`), whose summary already says the title and the headline, the
 * title is not said again.
 */
export function JobCardAnswer({ answer, titled = true }: { answer: JobCardAnswerSummary; titled?: boolean }) {
  const [details, setDetails] = useState(false);
  // Focus follows the view: into the details on the way in, back to "See details" on the way out.
  const root = useRef<HTMLElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) return;
    if (details) root.current?.focus();
    else root.current?.querySelector<HTMLElement>('[data-opens="details"]')?.focus();
  }, [details]);
  const show = (next: boolean) => { opened.current = true; setDetails(next); };
  const pick = answer.pick;
  const fits = pick ? /^Fits/.test(pick.verdictLabel) : false;
  const sure = SURE[answer.confidence.level];
  const allEstimated = answer.facts.length > 0 && answer.facts.every(fact => fact.basis === "video_estimate");
  if (details) return <section className="bare-screen site-card-answer" aria-label={JOB_CARD_ANSWER_TITLE} ref={root} tabIndex={-1}>
    <BareBack onClick={() => show(false)} />
    {answer.pick && <RobotRows robot={answer.pick} role={fits ? "Pick" : "Closest"} />}
    {answer.runnerUp && <RobotRows robot={answer.runnerUp} role="Runner-up" />}
    {answer.facts.length > 0 && <BareRows title={allEstimated ? "Estimated from the site's video" : "The numbers"} rows={answer.facts.map(fact => ({
      key: fact.label, label: fact.label, value: <>{fact.display}{!allEstimated && <span className="bare-helper"> ({BASIS_LABELS[fact.basis]})</span>}</> }))} />}
    {answer.unknowns.length > 0 && <BareRows title="What the video couldn't show" rows={answer.unknowns.map(line => ({ key: line, value: line }))} />}
    {answer.test && answer.test.options.length > 0 && <BareRows title="Simulation test" rows={answer.test.options.map((option, index) => ({
      key: `${index}-${option.label}`, label: <>{index + 1}. {option.label}{option.maker && <span className="bare-helper"> · {option.maker}</span>}</>,
      value: `Finished ${option.succeeded} of ${option.scored} ${option.scored === 1 ? "try" : "tries"}${option.succeeded === 0 && option.furthestText ? ` · ${option.furthestText}` : ""}` }))} />}
    {answer.simulation && <BareRows title="Simulation test" rows={[{ key: "simulation", value: answer.simulation }]} />}
    <BareFine>{answer.note}</BareFine>
  </section>;
  const test = answer.test ?? null;
  if (test) return <section className="bare-screen site-card-answer" aria-label={JOB_CARD_ANSWER_TITLE} ref={root} tabIndex={-1}>
    {titled && <h3 className="bare-label">{JOB_CARD_ANSWER_TITLE}</h3>}
    <CardTestHead test={test} />
    {answer.sceneNote && <BareGroup><BareNotice>{answer.sceneNote}</BareNotice></BareGroup>}
    {pick && <BareGroup><p>{fits ? "On paper, most likely to fit" : "On paper, the closest robot"}: {pick.manufacturer} {pick.name}</p></BareGroup>}
    <BareLinks links={[{ key: "details", label: "See details", onClick: () => show(true) }]} />
    <BareFine>{test.kind === "testing" || !test.options.length ? JOB_CARD_LIMITS_TESTING : JOB_CARD_LIMITS_TESTED}</BareFine>
  </section>;
  return <section className="bare-screen site-card-answer" aria-label={JOB_CARD_ANSWER_TITLE} ref={root} tabIndex={-1}>
    {titled && <h3 className="bare-label">{JOB_CARD_ANSWER_TITLE}</h3>}
    {pick ? <BareGroup>
      <p className="bare-label">{fits ? "The robot most likely to fit" : "The closest robot"}</p>
      <BareBig as="p" sub={`by ${pick.manufacturer}${fits ? "" : ". No robot clearly fits yet."}${answer.familyLabel ? ` · Kind of job: ${answer.familyLabel}` : ""}`}>{pick.name}</BareBig>
    </BareGroup> : <BareGroup><BareLead>{answer.headline}</BareLead></BareGroup>}
    {pick && <BareGroup><BareTicks label="Why" items={ticksOf(pick.checks ?? [], pick.evidence[0])} /></BareGroup>}
    {answer.sceneNote && <BareGroup><BareNotice>{answer.sceneNote}</BareNotice></BareGroup>}
    <BareGroup>
      <BareSureness filled={sure.filled} word={sure.word} reason={answer.confidence.reason} />
      {answer.simulation && <p>Simulation test: {answer.simulation}</p>}
    </BareGroup>
    <BareLinks links={[{ key: "details", label: "See details", onClick: () => show(true) }]} />
    <BareFine>{JOB_CARD_LIMITS}</BareFine>
  </section>;
}

/** The browse list's one line, and the full answer when the company opens it. */
export function JobCardAnswerLine({ jobId, headline, user }: { jobId: string; headline: string; user: User | null }) {
  const [state, setState] = useState<"closed" | "loading" | "ready" | "error">("closed");
  const [answer, setAnswer] = useState<JobCardAnswerSummary | null>(null);
  async function load() {
    if (state === "loading" || state === "ready") return;
    setState("loading");
    try {
      const headers = await withFirebaseAuthHeaders(user).catch(() => ({}));
      const response = await fetch(`/api/site-worlds/tasks/${encodeURIComponent(jobId)}`, { headers });
      const body = await response.json() as { item?: TaskCardDetail };
      if (!response.ok || !body.item) throw new Error("unavailable");
      setAnswer(body.item.answerSummary ?? null);
      setState("ready");
    } catch { setState("error"); }
  }
  return <details className="ms-task-interest" onToggle={event => { if ((event.currentTarget as HTMLDetailsElement).open) void load(); }}>
    <summary>{JOB_CARD_ANSWER_TITLE}: {headline}</summary>
    {state === "loading" && <p role="status">Loading…</p>}
    {state === "error" && <p role="alert">The answer could not be loaded. Try again shortly.</p>}
    {state === "ready" && (answer ? <JobCardAnswer answer={answer} titled={false} /> : <p className="ms-field-hint">This answer is no longer shared.</p>)}
  </details>;
}
