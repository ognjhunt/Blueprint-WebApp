import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEAVES_OUT_BOTH, LEAVES_OUT_FIRST_LOOK, LEAVES_OUT_TRIAL, NOTHING_IS_SHARED, PACKET_BUILDING, PACKET_WAITS_ON_SITE, NOTHING_SHARED, SiteAnswer as SiteAnswerScreen, SiteAnswerDetail, SiteAnswerDetails, detailScreens, evidenceTick, sureReason, ticksOf, type DetailScreen } from "@/components/site/SiteAnswer";
import { projectSimulationProof } from "@/lib/simulationProof";
import { REASON_UNSIZED, UNKNOWN_JOB_KIND, UNKNOWN_MULTI_STEP, type AnswerRobot } from "@/lib/siteAnswer";
import { allZeroEvaluation, cannotAssessAnswer, noPickAnswer, preparingEvaluation, readingAnswer, readyAnswer, serverOutlookFor, winnerEvaluation } from "../fixtures/siteAnswer";
import type { ComponentProps } from "react";

/**
 * The answer screen as the job page renders it: with the outlook the server sends for that answer and proof. The
 * screen itself shows the working screen when no outlook came (review, 2026-11-11); a test about the phase passes its
 * own outlook, or null, and that is used as given.
 */
function SiteAnswer(props: ComponentProps<typeof SiteAnswerScreen>) {
  return <SiteAnswerScreen {...props} outlook={"outlook" in props ? props.outlook : serverOutlookFor(props.answer, props.proof ?? null)} />;
}

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

/**
 * Words a site manager should never meet, and anything that looks like a raw code; and since the frame of 2026-11-12,
 * the old frame's words for the trial and the first look ("deployment company" is now the page's own word).
 */
const BANNED = /episode|candidate|screening|embodiment|checkpoint|payload|anonymi[sz]ed|[a-z]_[a-z]|sha256|AI robot|paper check|which did best|top AI/i;
/** "Your answer" as a heading or a claim; the recorded statement's own "your answer" stays word for word. */
const YOUR_ANSWER = /Your answer/;
const FIND = "Share my job";
const QUESTION = "May we share a summary of your job with deployment companies we approve?";
/** The recorded statement, word for word: the share step's own words around it changed, it did not. */
const CONSENT = "Shares a summary of your job and your answer, including later test results, without saying who you are, with companies we've approved. Your video, address and contacts stay private.";
/** The job page's one limits line, in every state. */
const LIMITS = "Nothing here is a test at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
const TRIAL_LINE = "This is our own trial of openly available robot software. It does not predict what a deployment company's robot would do.";
const FIRST_LOOK = "On paper, the robot most likely to fit: Universal Robots UR10e.";
const SOURCE = "From published specifications and where it has been used.";
const sharedOn = (date: string) => `Shared on ${date}. Deployment companies we approve can see a summary of your job. Nothing more is needed from you.`;
const notVisible = (date: string) => `You shared a summary of your job on ${date}. It is not visible to companies right now.`;
/** The server's sharing state (`jobSharingOf`), as the answer carries it. */
const VISIBLE = { sharing: { state: "visible" as const, sharedAtIso: "2026-11-10T09:00:00.000Z" }, jobCardListed: true };
const HIDDEN = { sharing: { state: "not_visible" as const, sharedAtIso: "2026-11-10T09:00:00.000Z" }, jobCardListed: true };
const region = (name: string) => screen.getByRole("region", { name });
const companies = () => region("Deployment companies");
const firstLook = () => region("First look");
/** The early trial is folded by default; a test that reads its rows opens it, as a site would. */
function openTrial() {
  const fold = document.querySelector("details.site-trial");
  expect(fold).not.toHaveAttribute("open");
  fold!.setAttribute("open", "");
  return region("Early trial of openly available robot software");
}
const winnerProof = projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick });
const WORD_BUDGET = 110;
const words = (text: string | null) => (text?.match(/[^\s]+/g) ?? []).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

describe("the job page's sections, bare bones", () => {
  it("leads with deployment companies, then the first look: the robot, its source, why in plain ticks, how sure, two links and the limits", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} onShowDetails={vi.fn()} onShowSettings={vi.fn()} />);
    const page = screen.getByRole("region", { name: "Your job" });
    // The sections in order; with nothing to say about the simulation or a trial, neither section is shown.
    expect([...page.querySelectorAll("h2")].map(node => node.textContent)).toEqual(["Deployment companies", "First look"]);
    // The share question, the one button and the recorded statement directly under it.
    expect(within(companies()).getByText(QUESTION)).toBeVisible();
    const button = within(companies()).getByRole("button", { name: FIND });
    expect(button).toHaveClass("bare-button");
    expect(within(companies()).getByText(CONSENT)).toHaveAttribute("id", button.getAttribute("aria-describedby"));
    // The first look in one sentence, then where it comes from.
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(within(firstLook()).getByText(SOURCE)).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Why" })).getAllByRole("listitem").map(item => item.textContent))
      .toEqual(["✓Reaches far enough", "✓Strong enough", "✓Already used for jobs like this"]);
    expect(firstLook()).toHaveTextContent("How sure are we? Fairly sure");
    // The reason line is the server's own first reason for its sureness, whatever it is.
    expect(within(firstLook()).getByText(readyAnswer.confidence.reasons[0])).toBeVisible();
    expect(within(page).getByRole("navigation", { name: "More" })).toHaveTextContent("See details ›Job settings ›");
    expect(within(page).getByText(LIMITS)).toBeVisible();
    // Nothing else: no figures, quotes, sources or other robots on this screen.
    expect(container.textContent).not.toMatch(/1\.3 m|12\.5 kg|Yaskawa|source/);
    expect(container.textContent).not.toMatch(BANNED);
    expect(container.textContent).not.toMatch(YOUR_ANSWER);
    expect(container.querySelectorAll(".bare-button")).toHaveLength(1);
  });

  it("calls a robot that only may fit the closest robot, and says none clearly fits", () => {
    const possible = { ...readyAnswer, headline: "No robot clearly fits. The closest is Universal Robots UR10e.",
      pick: { ...readyAnswer.pick!, verdict: "possible" as const, checks: [{ ...readyAnswer.pick!.checks[0], outcome: "unknown" as const }, readyAnswer.pick!.checks[1]] } };
    render(<SiteAnswer token="owner-token" answer={possible} />);
    expect(within(firstLook()).getByText("On paper, the closest robot: Universal Robots UR10e. No robot clearly fits.")).toBeVisible();
    expect(within(firstLook()).getByText(SOURCE)).toBeVisible();
    // A check that is not settled is a question, never a tick.
    const items = within(screen.getByRole("list", { name: "Why" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("?Can't tell yet if it reaches far enough");
    expect(items[0]).not.toHaveTextContent("✓");
    for (const item of items) expect(item.querySelector(".bare-mark")).toHaveAttribute("aria-hidden", "true");
  });

  it("says each tick by the data that makes it true", () => {
    const check = (key: "reach" | "payload" | "cycle_time", outcome: "pass" | "unknown" | "fail") => ({ key, outcome });
    expect(ticksOf([check("reach", "pass"), check("payload", "pass"), check("cycle_time", "pass")], undefined).map(item => item.text))
      .toEqual(["Reaches far enough", "Strong enough", "Fast enough"]);
    expect(ticksOf([check("reach", "unknown"), check("payload", "unknown"), check("cycle_time", "unknown")], undefined).map(item => [item.state, item.text]))
      .toEqual([["unsure", "Can't tell yet if it reaches far enough"], ["unsure", "Can't tell yet if it is strong enough"], ["unsure", "Can't tell yet if it is fast enough"]]);
    // A failed check never reaches the pick, and is never said as a tick.
    expect(ticksOf([check("reach", "fail")], undefined)).toEqual([]);
    expect(evidenceTick({ level: "production", scope: "model" })).toBe("Already used for jobs like this");
    expect(evidenceTick({ level: "production", scope: "family" })).toBe("Robots like this are already used for jobs like this");
    expect(evidenceTick({ level: "pilot", scope: "model" })).toBe("Tried at a customer for jobs like this");
    expect(evidenceTick({ level: "pilot", scope: "family" })).toBe("Robots like this were tried at a customer for jobs like this");
    expect(evidenceTick({ level: "offered", scope: "model" })).toBe("Sold for jobs like this");
    expect(evidenceTick({ level: "offered", scope: "family" })).toBe("Robots like this are sold for jobs like this");
    expect(evidenceTick(undefined)).toBeNull();
    // A pass with little to spare says so; the server ends its sentence with "This is a tight fit."
    expect(ticksOf([{ key: "reach", outcome: "pass", text: "Reach: … This arm reaches 1.3 m. This is a tight fit." }], undefined).map(item => item.text))
      .toEqual(["Reaches far enough, only just"]);
    expect(ticksOf([{ key: "payload", outcome: "pass", tight: true }], undefined).map(item => item.text)).toEqual(["Strong enough, only just"]);
    // The fallback reason under "How sure", when the server sends none, names only what the estimated checks rest on.
    const robot = (keys: string[], sceneChecked = false) => ({ ...readyAnswer.pick!, sceneChecked,
      checks: readyAnswer.pick!.checks.map(entry => ({ ...entry, estimated: keys.includes(entry.key) })) }) as AnswerRobot;
    expect(sureReason(robot(["reach", "payload"]))).toBe("We estimated the sizes and weight from your video.");
    expect(sureReason(robot(["reach"]))).toBe("We estimated the sizes from your video.");
    expect(sureReason(robot(["payload"]))).toBe("We estimated the weight from your video.");
    expect(sureReason(robot([], true))).toBe("We checked its reach in a simulation of your site.");
    expect(sureReason(robot([]))).toBeNull();
  });

  it("keeps every line that changes what the first look covers in view, in plain words", () => {
    const scoped = { ...readyAnswer, formNote: "Your two spots are about 2.6 m apart (estimated from your video), so the job needs a robot that moves between them, such as an arm on a wheeled base.",
      unknowns: [UNKNOWN_JOB_KIND, "Your video does not show the whole work area.", ...readyAnswer.unknowns,
        "Your job also involves peeling and stacking; this checks only the picking up and putting down.", UNKNOWN_MULTI_STEP] };
    render(<SiteAnswer token="owner-token" answer={scoped} />);
    const notices = [...document.querySelectorAll(".bare-notice")].map(node => node.textContent);
    expect(notices).toEqual([scoped.formNote, "We couldn't tell exactly what the job is, so we only checked picking up and putting down.",
      "Your job also involves peeling and stacking; this checks only the picking up and putting down.", UNKNOWN_MULTI_STEP]);
    // An ordinary unknown is for the details screen.
    expect(screen.queryByText("Your video does not show the whole work area.")).toBeNull();
  });

  it("keeps the first look first when our early trial has a result, and folds the trial under its fixed line", () => {
    // 7 of 10 against 3 of 10 and 2 of 10 is about 0.96 against the next: ahead, fairly sure, and it could still be chance.
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={winnerProof} onShowDetails={() => {}} />);
    const page = screen.getByRole("region", { name: "Your job" });
    expect([...page.querySelectorAll("h2, summary")].map(node => node.textContent)).toEqual(["Deployment companies", "First look", "Simulation of your site",
      "Early trial of openly available robot software"]);
    // The first look leads, whatever the trial found; the trial is never said to be the answer.
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(within(region("Simulation of your site")).getByText("The simulation of your site is ready.")).toBeVisible();
    const trial = openTrial();
    expect(within(trial).getByText(TRIAL_LINE)).toBeVisible();
    expect(within(trial).getByRole("heading", { level: 3, name: "Was ahead in our trial" })).toBeVisible();
    expect(trial.querySelector(".bare-big")).toHaveTextContent(/^Franka arm \+ π0\.5$/);
    // The option breaks on purpose: the robot, then "+ its software", each its own part.
    expect([...trial.querySelectorAll(".bare-big .bare-part")].map(part => part.textContent?.trim())).toEqual(["Franka arm", "+ π0.5"]);
    expect(within(trial).getByText("Robot software by Physical Intelligence")).toBeVisible();
    expect(within(within(trial).getByRole("list", { name: "Why" })).getAllByRole("listitem").map(item => item.textContent))
      .toEqual(["✓Did the job in 7 of 10 tries", "✓Ahead of the 2 other robots we tried"]);
    expect(trial).toHaveTextContent("How sure are we? Fairly sure");
    expect(within(trial).getByText("With this few tries the gap could still be chance.")).toBeVisible();
    // Sharing is offered with its recorded statement, as before a trial result existed.
    expect(within(companies()).getByRole("button", { name: FIND })).toBeVisible();
    expect(within(companies()).getByText(CONSENT)).toBeVisible();
    expect(within(page).getByText(LIMITS)).toBeVisible();
    expect(page.textContent).not.toMatch(BANNED);
  });

  it("says did best only by the probability rule, and lowers how sure by one step when a set-up flag is raised", () => {
    const clear = projectSimulationProof({ evaluation: [{ ...winnerEvaluation, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
      index === 0 ? { ...row, succeeded: 10, failed: 0 } : row) } }], pick: readyAnswer.pick });
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={clear} />);
    expect(within(openTrial()).getByRole("heading", { level: 3, name: "Did best in our trial" })).toBeVisible();
    expect(region("Early trial of openly available robot software")).toHaveTextContent("How sure are we? Sure");
    unmount();
    const flagged = projectSimulationProof({ evaluation: [{ ...winnerEvaluation, outcomeCaveat: "scene_setup" as const, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
      index === 0 ? { ...row, succeeded: 10, failed: 0 } : row) } }], pick: readyAnswer.pick });
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={flagged} />);
    const trial = openTrial();
    expect(trial).toHaveTextContent("How sure are we? Fairly sure");
    expect(within(trial).getByText("Our simulation set-up may have affected this result.")).toBeVisible();
  });

  it("says a zero as a valid result of the trial: no robot finished, with the set-up notice", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={projectSimulationProof({ evaluation: [allZeroEvaluation], pick: readyAnswer.pick })} />);
    const trial = openTrial();
    expect(within(trial).getByRole("heading", { level: 3, name: "Tried in our trial" })).toBeVisible();
    expect(within(trial).getByText("No robot finished the job in our trial.")).toHaveClass("bare-big");
    // The fixture carries no progress, so nothing is called closest.
    expect(within(trial).getByText("4 robots tried; none finished the job.")).toBeVisible();
    expect(within(trial).getByText("This result may come from how we set up the simulation of your site, not from the robots.")).toBeVisible();
    expect(within(trial).getByText(TRIAL_LINE)).toBeVisible();
    expect(screen.queryByText(/Did best|Was ahead/)).toBeNull();
    // The first look still stands beside a zero.
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(screen.getByText(LIMITS)).toBeVisible();
  });

  it("says the set-up notice under no clear winner when a set-up flag is raised, as the email and the card do", () => {
    const tie = projectSimulationProof({ evaluation: [{ ...winnerEvaluation, outcomeCaveat: "scene_setup" as const, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
      index < 2 ? { ...row, scored: 2, succeeded: 1, failed: 1 } : row) } }], pick: readyAnswer.pick });
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={tie} />);
    const trial = openTrial();
    expect(within(trial).getByText("No clear winner yet")).toBeVisible();
    expect(within(trial).getByText("This result may come from how we set up the simulation of your site, not from the robots.")).toBeVisible();
  });

  it("says no clear winner yet with the top option's count, and that the trial runs while it runs", () => {
    const tie = projectSimulationProof({ evaluation: [{ ...winnerEvaluation, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
      index < 2 ? { ...row, scored: 2, succeeded: 1, failed: 1 } : row) } }], pick: readyAnswer.pick });
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={tie} />);
    const trial = openTrial();
    expect(within(trial).getByText("No clear winner yet")).toHaveClass("bare-big");
    expect(within(trial).getByText(/^Top: Franka arm \+ .*, did the job in 1 of 2 tries\.$/)).toBeVisible();
    unmount();
    const running = projectSimulationProof({ evaluation: [{ ...preparingEvaluation, state: "running", screening: { candidates: preparingEvaluation.screening!.candidates.map(row => ({ ...row, state: "running" })) } }], pick: readyAnswer.pick });
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={running} />);
    const runningTrial = openTrial();
    expect(within(runningTrial).getByRole("heading", { level: 3, name: "Running now" })).toBeVisible();
    expect(within(runningTrial).getByText("2 robots")).toHaveClass("bare-big");
    expect(within(runningTrial).getByText("in the simulation of your site. We'll email you when it finishes.")).toBeVisible();
    // The job packet is still being built: no button, no statement; the first look stands.
    expect(within(companies()).getByText(PACKET_BUILDING)).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    expect(screen.queryByText(CONSENT)).toBeNull();
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
  });

  it("says the simulation is being built, with the first look and the two links, and no button", () => {
    // The server's outlook says the job is on its way to a simulation; the page shows the sections for that phase.
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={projectSimulationProof({ evaluation: [], pick: readyAnswer.pick })}
      outlook={{ phase: "building", reason: null, sentence: null }} onShowDetails={() => {}} onShowSettings={() => {}} />);
    expect(within(companies()).getByText("We're building your job packet. Nothing has been shared.")).toBeVisible();
    expect(within(region("Simulation of your site")).getByText("We're building the simulation of your site.")).toBeVisible();
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(screen.getByRole("navigation", { name: "More" })).toHaveTextContent("See details ›Job settings ›");
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    expect(screen.queryByText(CONSENT)).toBeNull();
    expect(document.querySelector("details.site-trial")).toBeNull();
    expect(screen.getByText(LIMITS)).toBeVisible();
    unmount();
    // A run queued with nothing entered yet is being built too; a held run is not (sharing is offered on the first look).
    const queued = projectSimulationProof({ evaluation: [{ ...preparingEvaluation, screening: { candidates: [] } }], pick: readyAnswer.pick });
    const { unmount: second } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={queued} />);
    expect(screen.getByText("We're building the simulation of your site.")).toBeVisible();
    second();
    render(<SiteAnswer token="owner-token" answer={readyAnswer}
      proof={projectSimulationProof({ evaluation: [{ ...winnerEvaluation, outcome: "held_capability" as const }], pick: readyAnswer.pick })} />);
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(screen.getByRole("button", { name: FIND })).toBeVisible();
    expect(screen.getByText("Our early trial did not run. Our trial can't do this kind of job yet.")).toBeVisible();
  });

  it("shows the success rule and the link to the simulation when the page has them", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={winnerProof} sceneViewUrl="https://viewer.example.test/scene"
      successRule="The carton sits square on the pallet." />);
    const simulation = region("Simulation of your site");
    expect(within(simulation).getByText("Done means: The carton sits square on the pallet.")).toBeVisible();
    expect(within(simulation).getByRole("link", { name: "View the simulation of your site" })).toHaveAttribute("href", "https://viewer.example.test/scene");
  });

  // Review, 2026-11-12: a job waiting for its sentence asks for it, and offers nothing else.
  it("asks for the job in one sentence while the job waits on the site, with no button", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={null}
      outlook={{ phase: "waiting_on_site", reason: "task_not_named", sentence: "Tell us in one sentence what the robot should do, so we can build the simulation of your job." }} />);
    expect(screen.getByText("Tell us in one sentence what the robot should do, so we can build the simulation of your job.")).toBeVisible();
    // Review, 2026-11-12: while the job waits for its sentence, the section says what comes next, not "we're building".
    expect(within(companies()).getByText(PACKET_WAITS_ON_SITE)).toBeVisible();
    expect(PACKET_WAITS_ON_SITE).toBe("Tell us what the job is and we will build its job packet.");
    expect(screen.queryByText(PACKET_BUILDING)).toBeNull();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  it("shows a fact about one robot and the object on that robot's own row only", () => {
    const evaluation = { ...winnerEvaluation, screening: { ...winnerEvaluation.screening!, candidates: winnerEvaluation.screening!.candidates
      .map((row, index) => index === 0 ? { ...row, robotNotes: ["The object is wider than this robot's gripper opens."] } : row) } };
    const proof = projectSimulationProof({ evaluation: [evaluation] as never, pick: readyAnswer.pick });
    const notes = proof.options.options.map(option => option.notes ?? []);
    expect(notes.filter(list => list.length)).toEqual([["The object is wider than this robot's gripper opens."]]);
    expect(proof.options.setupNotes ?? []).not.toContain("The object is wider than this robot's gripper opens.");
  });

  // Rule 1 (review, 2026-11-11): when unsure, the job is still being worked on, so nothing is offered to share.
  it("says the packet is being built and offers no button when no outlook came", () => {
    const { unmount } = render(<SiteAnswerScreen token="owner-token" answer={readyAnswer} proof={null} outlook={null} />);
    expect(within(companies()).getByText(PACKET_BUILDING)).toBeVisible();
    expect(screen.getByText("We're building the simulation of your site.")).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    unmount();
    // A run under way with no outlook: the trial runs, still nothing to share.
    render(<SiteAnswerScreen token="owner-token" answer={readyAnswer} outlook={null}
      proof={projectSimulationProof({ evaluation: [{ ...preparingEvaluation, state: "running" }], pick: readyAnswer.pick })} />);
    expect(within(openTrial()).getByRole("heading", { level: 3, name: "Running now" })).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  it("says the trial runs, offers no button, when the result has not loaded yet, and never says 0 robots", () => {
    render(<SiteAnswerScreen token="owner-token" answer={readyAnswer} proof={null} outlook={{ phase: "result", reason: null, sentence: null }} />);
    const trial = openTrial();
    expect(within(trial).getByRole("heading", { level: 3, name: "Running now" })).toBeVisible();
    expect(within(trial).getByText("Robots", { exact: true })).toBeVisible();
    expect(screen.queryByText(/0 robots/)).toBeNull();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  it("says what is true of the card on the other-kind and no-pick screens, and while building", () => {
    const { unmount } = render(<SiteAnswer token="owner-token" answer={{ ...cannotAssessAnswer, ...VISIBLE }} />);
    expect(within(companies()).getByText(sharedOn("November 10, 2026"))).toBeVisible();
    unmount();
    const { unmount: second } = render(<SiteAnswer token="owner-token" answer={{ ...noPickAnswer, ...HIDDEN }}
      outlook={{ phase: "no_test", reason: "no_grant", sentence: "We have not built a simulation for this job." }} />);
    expect(within(companies()).getByText(notVisible("November 10, 2026"))).toBeVisible();
    second();
    // Shared at the start (the start form's opt-in), while the packet is still being built: shared, no button.
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE }} outlook={{ phase: "building", reason: null, sentence: null }} />);
    expect(within(companies()).getByText(sharedOn("November 10, 2026"))).toBeVisible();
    expect(screen.queryByText(PACKET_BUILDING)).toBeNull();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });
  // The independent review's states (2026-11-12): the section says what is true of the card in every phase, and the
  // button and its question show only when nothing is shared and sharing is allowed.
  describe.each([
    ["building", { answer: readyAnswer, proof: projectSimulationProof({ evaluation: [preparingEvaluation], pick: readyAnswer.pick }),
      outlook: { phase: "building" as const, reason: null, sentence: null } }, PACKET_BUILDING, false],
    ["held, kept on file", { answer: cannotAssessAnswer, proof: null, outlook: { phase: "cannot_match" as const, reason: "kept_on_file" as const,
      sentence: "We can't build a simulation for this kind of job yet. We've kept your job on file." } }, NOTHING_SHARED, false],
    ["with a first look", { answer: readyAnswer, proof: null, outlook: { phase: "no_test" as const, reason: "window_expired" as const,
      sentence: "The time for this job ran out before our early trial could run." } }, null, true],
    ["with a trial result", { answer: readyAnswer, proof: projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick }),
      outlook: { phase: "result" as const, reason: null, sentence: null } }, null, true],
    ["with a zero", { answer: readyAnswer, proof: projectSimulationProof({ evaluation: [allZeroEvaluation], pick: readyAnswer.pick }),
      outlook: { phase: "result" as const, reason: null, sentence: null } }, null, true],
    ["closed by its owner", { answer: readyAnswer, proof: null, outlook: { phase: "ended_by_site" as const, reason: "closed_by_owner" as const,
      sentence: "You closed this job's simulation run." } }, NOTHING_IS_SHARED, false, "shared", NOTHING_IS_SHARED],
    ["withdrawn", { answer: readyAnswer, proof: projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick }),
      outlook: { phase: "ended_by_site" as const, reason: "permission_withdrawn" as const,
        sentence: "Permission to use your video was withdrawn, so this job has stopped." } }, NOTHING_IS_SHARED, false, NOTHING_IS_SHARED, NOTHING_IS_SHARED],
  ] as const)("the deployment companies section, %s", (_, page, notShared, offered, visibleSays?: string, hiddenSays?: string) => {
    const show = (sharing: object) => render(<SiteAnswer token="owner-token" answer={{ ...page.answer, ...sharing }} proof={page.proof}
      outlook={page.outlook} />);
    it("not shared: says so, or asks when sharing is allowed", () => {
      show({});
      if (offered) {
        expect(within(companies()).getByText(QUESTION)).toBeVisible();
        expect(within(companies()).getByRole("button", { name: FIND })).toBeVisible();
      } else {
        expect(within(companies()).getByText(notShared!)).toBeVisible();
        expect(screen.queryByRole("button", { name: FIND })).toBeNull();
        expect(screen.queryByText(QUESTION)).toBeNull();
      }
      expect(companies().textContent).not.toMatch(/^Shared|You shared|can see a summary/);
    });
    it("shared and visible: says companies can see it, with no button (a withdrawn job shares nothing)", () => {
      show(VISIBLE);
      if (visibleSays && visibleSays !== "shared") {
        expect(within(companies()).getByText(visibleSays)).toBeVisible();
        expect(companies().textContent).not.toMatch(/can see a summary|not visible/);
        return;
      }
      expect(within(companies()).getByRole("status")).toHaveTextContent(sharedOn("November 10, 2026"));
      expect(screen.queryByRole("button", { name: FIND })).toBeNull();
      expect(screen.queryByText(QUESTION)).toBeNull();
      expect(companies().textContent).not.toMatch(/Nothing has been shared|not visible/);
    });
    it("shared but hidden right now: says it is not visible, never that companies can see it (closed or withdrawn: nothing is shared)", () => {
      show(HIDDEN);
      if (hiddenSays) {
        expect(within(companies()).getByText(hiddenSays)).toBeVisible();
        expect(companies().textContent).not.toMatch(/can see a summary|right now/);
        return;
      }
      expect(within(companies()).getByRole("status")).toHaveTextContent(notVisible("November 10, 2026"));
      expect(companies().textContent).not.toMatch(/can see a summary|Nothing has been shared/);
      expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    });
  });
  it("says a failed step while building, and the ending's reason with the first look after an ending", () => {
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={null}
      outlook={{ phase: "building", reason: "step_failed", sentence: "A step failed and we're working on it. We'll email you the result." }} />);
    expect(within(region("Simulation of your site")).getByText("A step failed and we're working on it. We'll email you the result.")).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    unmount();
    const { unmount: second } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={null}
      outlook={{ phase: "no_test", reason: "no_grant", sentence: "We have not built a simulation for this job." }} />);
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(within(region("Simulation of your site")).getByText("We have not built a simulation for this job.")).toBeVisible();
    expect(screen.getByRole("button", { name: FIND })).toBeVisible();
    second();
    // A run the site closed itself: the first look with the reason, nothing shared and no button.
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={null}
      outlook={{ phase: "ended_by_site", reason: "closed_by_owner", sentence: "You closed this job's simulation run." }} />);
    expect(screen.getByText("You closed this job's simulation run.")).toBeVisible();
    expect(within(companies()).getByText(NOTHING_IS_SHARED)).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  it("says why our early trial gave no result, when that is known, beside the first look", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={projectSimulationProof({ evaluation: [{ ...winnerEvaluation, outcome: "held_budget" as const }], pick: readyAnswer.pick })} />);
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(screen.getByText("Our early trial did not finish. It stopped at a limit on our side.")).toBeVisible();
    expect(screen.getByText(LIMITS)).toBeVisible();
  });

  it("says nothing about the early trial before it starts", () => {
    const notStarted = projectSimulationProof({ evaluation: [], pick: readyAnswer.pick });
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={notStarted} />);
    expect(container.textContent).not.toMatch(/early trial|our trial|running now|simulation test/i);
  });

  it("while reading, says only that it is watching the video, and where the first look will show", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readingAnswer} onShowDetails={vi.fn()} onShowSettings={vi.fn()} />);
    expect(within(firstLook()).getByText("We're watching your video.")).toBeVisible();
    expect(screen.getByText("Your job page shows it when it is ready.")).toBeVisible();
    expect(container.textContent).not.toMatch(/email/i);
    expect(within(companies()).getByText(PACKET_BUILDING)).toBeVisible();
    expect(screen.getByRole("navigation", { name: "More" })).toHaveTextContent("Job settings ›");
    expect(screen.queryByText(/See details/)).toBeNull();
    expect(container.textContent).not.toMatch(/minute|second|hour/i);
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  it("offers the one thing the site can do about a first look that cannot be checked, for the reason it gives", () => {
    const onEditJob = vi.fn(), onUpdateVideo = vi.fn();
    const { unmount } = render(<SiteAnswer token="owner-token" answer={cannotAssessAnswer} onEditJob={onEditJob} onUpdateVideo={onUpdateVideo} />);
    expect(cannotAssessAnswer.reason).toBe(REASON_UNSIZED);
    expect(within(firstLook()).getByText(cannotAssessAnswer.headline)).toBeVisible();
    expect(screen.getByText("Your video didn't show the job clearly enough for us to measure it.")).toBeVisible();
    expect(within(companies()).getByText(NOTHING_SHARED)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Send a new video" }));
    expect(onUpdateVideo).toHaveBeenCalledTimes(1);
    unmount();
    render(<SiteAnswer token="owner-token" answer={{ ...cannotAssessAnswer, reason: "From your video, the job looks like more than picking an object up and putting it down (folding), which we can't check robots against yet. If that is not right, edit the job description to say what the robot should do, and we will read the video again." }}
      onEditJob={onEditJob} onUpdateVideo={onUpdateVideo} />);
    expect(screen.getByText("From your video, the job looks like more than picking something up and putting it down.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Change my job description" }));
    expect(onEditJob).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("says why there is no pick and offers no button", () => {
    render(<SiteAnswer token="owner-token" answer={noPickAnswer} />);
    expect(within(firstLook()).getByText(noPickAnswer.headline)).toBeVisible();
    expect(screen.getByText(noPickAnswer.reason!)).toBeVisible();
    expect(screen.getByText(noPickAnswer.formNote!)).toBeVisible();
    expect(within(companies()).getByText(NOTHING_SHARED)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never shows a site a banned word or a raw code, in any state or on the details screen", () => {
    for (const answer of [readyAnswer, noPickAnswer, cannotAssessAnswer, readingAnswer]) {
      for (const proof of [winnerProof, projectSimulationProof({ evaluation: [allZeroEvaluation], pick: readyAnswer.pick }), null]) {
        const { container, unmount } = render(<><SiteAnswer token="owner-token" answer={answer} proof={proof} />
          <SiteAnswerDetails answer={answer} proof={proof} onBack={vi.fn()} /></>);
        expect(container.textContent).not.toMatch(BANNED);
        expect(container.textContent).not.toMatch(YOUR_ANSWER);
        unmount();
      }
    }
  });

  it("stays near the bare-bones word count", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} onShowDetails={vi.fn()} onShowSettings={vi.fn()} />);
    // The recorded statement (30 words), the share question (14), the first look's sentence and source (19) and the
    // limits line (19) may not be dropped; the rest is about 25 words. The budget was 90 before the frame of
    // 2026-11-12 added the section titles, the share question and the source line the planner's decisions require.
    expect(words(container.textContent)).toBeLessThanOrEqual(WORD_BUDGET);
  });
});

describe("the details screens", () => {
  const withFigures = { ...readyAnswer, pick: { ...readyAnswer.pick!, checks: [
    { ...readyAnswer.pick!.checks[0], need: "about 0.9–1.2 m", has: "1.3 m", text: `${readyAnswer.pick!.checks[0].text} This is a tight fit.` },
    { ...readyAnswer.pick!.checks[1], need: "about 9–12 kg", has: "12.5 kg" }] } };
  const words = (text: string | null) => (text?.match(/[^\s]+/g) ?? []).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
  const detail = (screen: DetailScreen, answer = withFigures, proof: Parameters<typeof SiteAnswerDetail>[0]["proof"] = winnerProof) =>
    render(<SiteAnswerDetail answer={answer} proof={proof} screen={screen} onBack={vi.fn()} />);

  it("is a short menu of small screens, each only when it has something to say", () => {
    const onOpen = vi.fn(), onBack = vi.fn();
    render(<SiteAnswerDetails answer={withFigures} proof={winnerProof} onBack={onBack} onOpen={onOpen} />);
    expect(screen.getByRole("heading", { level: 1, name: "Details" })).toHaveAttribute("tabindex", "-1");
    expect(within(screen.getByRole("list", { name: "Details" })).getAllByRole("button").map(button => button.textContent)).toEqual([
      "First look: why this robot", "Other robots", "Robots that don't fit", "What we estimated", "What we couldn't see", "Our early trial", "How far to trust the trial"]);
    fireEvent.click(screen.getByRole("button", { name: "What we estimated" }));
    expect(onOpen).toHaveBeenCalledWith("estimated");
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    // No simulation yet: neither of its screens.
    expect(detailScreens(withFigures, projectSimulationProof({ evaluation: [], pick: withFigures.pick }))).not.toContain("test");
  });

  it("says why this robot in short rows: the figures, the sources, the record, how it is run, and that it is about the robot", () => {
    detail("why");
    expect(screen.getByRole("heading", { level: 1, name: "First look: why this robot" })).toBeVisible();
    expect(screen.getByText(/^needs about 0\.9–1\.2 m · reaches 1\.3 m · only just enough/)).toBeVisible();
    expect(screen.getByText(/^needs to lift up to 12 kg · lifts up to 12\.5 kg/)).toBeVisible();
    expect(screen.getAllByRole("link", { name: "source" }).map(link => link.getAttribute("href"))).toEqual(readyAnswer.pick!.specs.map(spec => spec.sourceUrl));
    expect(screen.getByRole("link", { name: "Example Test News" })).toHaveAttribute("href", readyAnswer.pick!.evidence[0].sourceUrl);
    expect(screen.getByText("The objects vary, so it needs a camera to pick each one. Ask the company that sets it up how it handles each item.")).toBeVisible();
    expect(screen.getByText("This is the first look: it looks at the robot's reach, strength and track record, not the software that runs it.")).toBeVisible();
  });

  it("says a strength it can't tell yet with the whole range that makes it unknown, never as a fail", () => {
    const unsettled = { ...readyAnswer, pick: { ...readyAnswer.pick!, verdict: "possible" as const, checks: [readyAnswer.pick!.checks[0],
      { ...readyAnswer.pick!.checks[1], outcome: "unknown" as const, need: "about 3–4.9 kg", has: "4 kg" }] } };
    detail("why", unsettled);
    expect(screen.getByText(/^Can't tell yet\. needs to lift about 3–4\.9 kg · lifts up to 4 kg/)).toBeVisible();
    expect(screen.queryByText(/needs to lift up to 4\.9 kg/)).toBeNull();
  });

  it("keeps each screen short, the sourced words word for word", () => {
    for (const name of ["why", "others", "ruled-out", "estimated", "unseen", "test"] as const) {
      const { container, unmount } = detail(name);
      expect(words(container.textContent), name).toBeLessThanOrEqual(130);
      unmount();
    }
    const { unmount } = detail("others");
    expect(screen.getAllByRole("definition").map(row => row.textContent)).toEqual(["Yaskawa HC20DTP", "Universal Robots UR20", "Universal Robots UR30",
      "ABB GoFa CRB 15000-12/1.27", "We checked 22 robots from 13 makers, using their published figures from November 11, 2026."]);
    unmount();
    const ruled = detail("ruled-out");
    expect(ruled.container).toHaveTextContent("And 9 more.");
    ruled.unmount();
    const numbers = detail("estimated");
    expect(screen.getByRole("heading", { level: 1, name: "The numbers we used" })).toBeVisible();
    expect(numbers.container).toHaveTextContent("Height of the pallet stackup to 1.2 m (you told us)");
    numbers.unmount();
    const unseen = detail("unseen");
    for (const line of [...readyAnswer.unknowns, ...readyAnswer.confidence.raiseIt]) expect(screen.getByText(line)).toBeVisible();
    unseen.unmount();
    const test = detail("test");
    // A ranked list: the lead line, then each option in order with its count, and the winner's mark on row 1.
    const ranked = screen.getByRole("region", { name: "Ranked" });
    expect(ranked).toHaveTextContent("In our early trial we ran 3 robots on your job, about 10 tries each, in a simulation of your site.");
    expect(test.container).toHaveTextContent("This is our own trial of openly available robot software. It does not predict what a deployment company's robot would do.");
    expect([...ranked.querySelectorAll("dt")].map(node => node.textContent)).toEqual([
      "1. Franka arm + π0.5 · Physical Intelligence", "2. Franka arm + GR00T N1.7 · NVIDIA", "3. Franka arm + MolmoAct 2 · Ai2"]);
    expect(ranked).toHaveTextContent("Finished 7 of 10 tries");
    expect(ranked).toHaveTextContent("· Ahead");
    expect(ranked).toHaveTextContent("With this few tries the gap could still be chance.");
    expect(ranked).toHaveTextContent("1 more robot was planned but did not run.");
    test.unmount();
    detail("trust");
    expect(screen.getByRole("heading", { level: 1, name: "How far to trust the trial" })).toBeVisible();
    expect(screen.getAllByRole("link").length).toBe(3);
  });

  it("calls the numbers estimates only when every one of them is, and the others robots that fit only when they all do", () => {
    const estimated = { ...readyAnswer, facts: readyAnswer.facts.filter(fact => fact.basis === "video_estimate"),
      runnerUp: { ...readyAnswer.runnerUp!, verdict: "possible" as const } };
    const { unmount } = detail("estimated", estimated);
    expect(screen.getByRole("heading", { level: 1, name: "What we estimated" })).toBeVisible();
    expect(screen.getByRole("region", { name: "From your video" })).not.toHaveTextContent("(");
    unmount();
    detail("others", estimated);
    expect(screen.getByRole("heading", { level: 1, name: "Other robots" })).toBeVisible();
    expect(screen.getByText("· may fit")).toBeVisible();
  });
});

describe("the first look and the simulation of the site never disagree", () => {
  const robotFit = (verdict: "fits" | "fits_spec" | "doesnt_fit" | "unknown", openChecks: string[]) =>
    ({ models: [{ name: "UR10e", manufacturer: "Universal Robots", verdict, openChecks }] });

  // Since round 6 the server decides the verdict and the scene's contrary finding once (`sceneNote`), so the page, the
  // job card and the emails cannot disagree; the page renders them and never overrides the label (rewritten from the
  // page-side override).
  it("renders the server's verdict and its scene note, and never overrides the label from the scene table", () => {
    const reach = projectSimulationProof({ evaluation: [], robotFit: robotFit("doesnt_fit", ["reach"]), pick: readyAnswer.pick });
    const note = "The simulation of your site found that the UR10e does not fit. This check uses your own measurement instead, which we trust more.";
    const { unmount } = render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, sceneNote: note }} proof={reach} />);
    expect(screen.getByText(FIRST_LOOK)).toBeVisible();
    expect(screen.getByText(note)).toBeVisible();
    unmount();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, pick: { ...readyAnswer.pick!, verdict: "possible" } }} proof={reach} />);
    expect(screen.getByText("On paper, the closest robot: Universal Robots UR10e. No robot clearly fits.")).toBeVisible();
    expect(screen.queryByText(/does not fit/)).toBeNull();
  });

  it("holds over many generated answers and scene rows: the label is the server's verdict, the notice the server's note", () => {
    let seed = 20261111;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pickOf = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)];
    const CHECKS = ["reach", "payload", "stance", "access", "cycle_time"];
    for (let index = 0; index < 300; index++) {
      const verdict = pickOf(["fits", "fits_on_paper", "possible"] as const);
      const sceneNote = random() < 0.3 ? "The simulation of your site found that the UR10e does not fit. This check uses your own measurement instead, which we trust more." : null;
      const answer = { ...readyAnswer, sceneNote, pick: { ...readyAnswer.pick!, verdict } };
      const open = CHECKS.filter(() => random() < 0.3);
      const proof = projectSimulationProof({ evaluation: [], robotFit: robotFit(pickOf(["fits", "fits_spec", "doesnt_fit", "unknown"] as const), open), pick: answer.pick });
      const { container, unmount } = render(<SiteAnswer token="owner-token" answer={answer} proof={proof} />);
      const text = container.textContent!;
      // The page never says fits while the server says otherwise, and never the reverse.
      expect(text.includes("On paper, the robot most likely to fit:"), `${verdict}`).toBe(verdict !== "possible");
      expect(text.includes("does not fit"), `${verdict} / ${sceneNote}`).toBe(Boolean(sceneNote));
      unmount();
    }
  });
});

describe("sharing the job with deployment companies", () => {
  it("asks once and then says what the route read back: visible to approved companies", async () => {
    const onRequested = vi.fn();
    fetchMock.mockResolvedValue(response({ ok: true, requestedAtIso: "2026-11-11T15:00:00.000Z", listed: true,
      sharing: { state: "visible", sharedAtIso: "2026-11-11T15:00:00.000Z" } }));
    render(<SiteAnswer token="owner token" answer={readyAnswer} onIntroductionRequested={onRequested} />);
    const button = screen.getByRole("button", { name: FIND });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent(sharedOn("November 11, 2026"));
    // What the route records is unchanged: the same statement version.
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: JSON.stringify({ statementVersion: "public-task-card-with-answer-v3" }) });
    expect(screen.queryByText(CONSENT)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/owner%20token/introduction-request", expect.objectContaining({
      method: "POST", referrerPolicy: "no-referrer", headers: expect.objectContaining({ "X-CSRF-Token": "local-test" }) }));
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    expect(onRequested).toHaveBeenCalledTimes(1);
  });
  it("says the summary is not visible when the route reads it back hidden, or when the request was saved but nothing is listed", async () => {
    fetchMock.mockResolvedValue(response({ ok: true, requestedAtIso: "2026-11-11T15:00:00.000Z", listed: true,
      sharing: { state: "not_visible", sharedAtIso: "2026-11-11T15:00:00.000Z" } }));
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: FIND }));
    expect(await screen.findByRole("status")).toHaveTextContent(notVisible("November 11, 2026"));
    expect(screen.queryByText(/can see a summary/)).toBeNull();
    unmount();
    // Review, 2026-11-12: the request is saved, so the page never says it could not send it.
    fetchMock.mockResolvedValue(response({ ok: true, requestedAtIso: "2026-11-11T15:00:00.000Z", listed: false,
      sharing: { state: "not_shared", sharedAtIso: null } }));
    render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: FIND }));
    expect(await screen.findByRole("status")).toHaveTextContent(notVisible("November 11, 2026"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  // Review, 2026-11-12: a summary shared on the start form, or under statement v1 or v2, says what it leaves out, and
  // the existing button with the current recorded statement adds it.
  it.each([
    ["shared on the start form, with a first look", { firstLook: true, trialResult: true }, null, LEAVES_OUT_FIRST_LOOK],
    ["shared on the start form, with a trial result", { firstLook: true, trialResult: true }, "result", LEAVES_OUT_BOTH],
    ["shared under v1, with a trial result", { firstLook: false, trialResult: true }, "result", LEAVES_OUT_TRIAL],
    ["shared under v2, with a trial result", { firstLook: false, trialResult: true }, "result", LEAVES_OUT_TRIAL],
    ["shared under v1, with no trial result", { firstLook: false, trialResult: true }, null, null],
    ["shared under v3", { firstLook: false, trialResult: false }, "result", null],
  ] as const)("says what a summary %s leaves out, and offers to add it", async (_, leavesOut, trial, line) => {
    const answer = { ...readyAnswer, jobCardListed: true, sharing: { state: "visible" as const, sharedAtIso: "2026-11-10T09:00:00.000Z", leavesOut } };
    const outlook = trial ? { phase: "result" as const, reason: null, sentence: null } : { phase: "no_test" as const, reason: "window_expired" as const, sentence: "x" };
    render(<SiteAnswer token="owner-token" answer={answer} proof={trial ? winnerProof : null} outlook={outlook} />);
    expect(within(companies()).getByRole("status")).toHaveTextContent(sharedOn("November 10, 2026"));
    if (!line) { expect(screen.queryByRole("button", { name: FIND })).toBeNull(); return; }
    expect(within(companies()).getByText(line)).toBeVisible();
    expect(within(companies()).getByText(CONSENT)).toBeVisible();
    fetchMock.mockResolvedValue(response({ ok: true, requestedAtIso: "2026-11-12T09:00:00.000Z", listed: true,
      sharing: { state: "visible", sharedAtIso: "2026-11-10T09:00:00.000Z", leavesOut: { firstLook: false, trialResult: false } } }));
    fireEvent.click(within(companies()).getByRole("button", { name: FIND }));
    // The same route, the same recorded statement and version.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: JSON.stringify({ statementVersion: "public-task-card-with-answer-v3" }) });
    await waitFor(() => expect(screen.queryByText(line)).toBeNull());
    expect(screen.getByText(sharedOn("November 10, 2026"))).toBeVisible();
  });

  it("keeps the button with one plain sentence when the request fails", async () => {
    fetchMock.mockResolvedValue(response({ error: "introduction_request_failed" }, 500));
    render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: FIND }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send your request just now. Try again shortly.");
    expect(screen.getByRole("button", { name: FIND })).toBeEnabled();
    expect(document.body.textContent).not.toMatch(/introduction_request_failed/);
  });

  it("shows the server's sentence and keeps the button when the wording has changed", async () => {
    const changed = "The wording on this page has changed. Reload the page to read it, then press the button again.";
    fetchMock.mockResolvedValue(response({ code: "introduction_request_statement_changed", error: changed }, 409));
    render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: FIND }));
    expect(await screen.findByRole("alert")).toHaveTextContent(changed);
    expect(screen.getByRole("button", { name: FIND })).toBeEnabled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("words a refusal by its reason: a closed job, a job waiting for its sentence, or a packet not ready", async () => {
    for (const [reason, sentence] of [["job_closed", "This job is closed, so it cannot be shared."],
      ["needs_job_sentence", "Tell us what the job is first. Then you can share it."],
      ["packet_not_ready", "You can share your job once its job packet is ready."]] as const) {
      fetchMock.mockResolvedValue(response({ code: "introduction_waits_for_answer", reason, error: "x" }, 409));
      const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
      fireEvent.click(screen.getByRole("button", { name: FIND }));
      expect(await screen.findByRole("alert"), reason).toHaveTextContent(sentence);
      unmount();
    }
  });
  it("keeps the button, quiet, with its line, when the site has a step to take first", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} quietAction />);
    expect(screen.getByRole("button", { name: FIND })).toHaveClass("bare-quiet-button");
    expect(screen.getByText(CONSENT)).toBeVisible();
  });

  it("keeps a first look that cannot be checked as it is, whatever the early trial found", () => {
    const proof = projectSimulationProof({ evaluation: [allZeroEvaluation], pick: null });
    render(<SiteAnswer token="owner-token" answer={cannotAssessAnswer} proof={proof} />);
    expect(screen.getByText(cannotAssessAnswer.headline)).toBeVisible();
    expect(screen.queryByText(/No robot finished|Tried in our trial/)).toBeNull();
  });
});
