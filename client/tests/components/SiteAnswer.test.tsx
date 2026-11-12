import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOTHING_IS_SHARED, NOT_SHARED_YET, NOT_VISIBLE_LINE, OLDER_JOB_AGREE, OLDER_JOB_LINES, SHARED_LINE, SiteAnswer as SiteAnswerScreen, SiteAnswerDetail, SiteAnswerDetails, detailScreens, evidenceTick, sureReason, ticksOf, type DetailScreen } from "@/components/site/SiteAnswer";
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
/** The recorded statement, word for word: the share step's own words around it changed, it did not. */
/** The job page's one limits line, in every state. */
const LIMITS = "Nothing here is a test at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
const TRIAL_LINE = "This is our own trial of openly available robot software. It does not predict what a deployment company's robot would do.";
const FIRST_LOOK = "On paper, the robot most likely to fit: Universal Robots UR10e.";
const SOURCE = "From published specifications and where it has been used.";
const V4 = "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video and the simulation we build from it, with robot deployment companies we've approved.";
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
    // Sharing is the service (2026-11-12): no share question and no button; a job with no sharing statement says so.
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
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
    expect(container.querySelectorAll(".bare-button")).toHaveLength(0);
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
    // No share button with a trial result either (sharing is the service).
    expect(within(companies()).queryByRole("button", { name: FIND })).toBeNull();
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
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
  });

  it("says the simulation is being built, with the first look and the two links, and no button", () => {
    // The server's outlook says the job is on its way to a simulation; the page shows the sections for that phase.
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={projectSimulationProof({ evaluation: [], pick: readyAnswer.pick })}
      outlook={{ phase: "building", reason: null, sentence: null }} onShowDetails={() => {}} onShowSettings={() => {}} />);
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
    expect(within(region("Simulation of your site")).getByText("We're building the simulation of your site.")).toBeVisible();
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(screen.getByRole("navigation", { name: "More" })).toHaveTextContent("See details ›Job settings ›");
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
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
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
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
    // Sharing is the service: no share step while the job waits for its sentence.
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
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
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
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
    expect(within(companies()).getByText(SHARED_LINE)).toBeVisible();
    unmount();
    const { unmount: second } = render(<SiteAnswer token="owner-token" answer={{ ...noPickAnswer, ...HIDDEN }}
      outlook={{ phase: "no_test", reason: "no_grant", sentence: "We have not built a simulation for this job." }} />);
    expect(within(companies()).getByText(NOT_VISIBLE_LINE)).toBeVisible();
    second();
    // Shared at the start (the start form's opt-in), while the packet is still being built: shared, no button.
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE }} outlook={{ phase: "building", reason: null, sentence: null }} />);
    expect(within(companies()).getByText(SHARED_LINE)).toBeVisible();
    expect(screen.queryByText(NOT_SHARED_YET)).toBeNull();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });
  // Sharing is the service (2026-11-12): in every phase the section says what is true of the job, with no share button.
  describe.each([
    ["building", { answer: readyAnswer, proof: projectSimulationProof({ evaluation: [preparingEvaluation], pick: readyAnswer.pick }),
      outlook: { phase: "building" as const, reason: null, sentence: null } }, false],
    ["held, kept on file", { answer: cannotAssessAnswer, proof: null, outlook: { phase: "cannot_match" as const, reason: "kept_on_file" as const,
      sentence: "We can't build a simulation for this kind of job yet. We've kept your job on file." } }, false],
    ["with a first look", { answer: readyAnswer, proof: null, outlook: { phase: "no_test" as const, reason: "window_expired" as const,
      sentence: "The time for this job ran out before our early trial could run." } }, false],
    ["with a trial result", { answer: readyAnswer, proof: projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick }),
      outlook: { phase: "result" as const, reason: null, sentence: null } }, false],
    ["closed by its owner", { answer: readyAnswer, proof: null, outlook: { phase: "ended_by_site" as const, reason: "closed_by_owner" as const,
      sentence: "You closed this job's simulation run." } }, "closed"],
    ["withdrawn", { answer: readyAnswer, proof: projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick }),
      outlook: { phase: "ended_by_site" as const, reason: "permission_withdrawn" as const,
        sentence: "Permission to use your video was withdrawn, so this job has stopped." } }, "withdrawn"],
  ] as const)("the deployment companies section, %s", (_, page, ended) => {
    const show = (sharing: object) => render(<SiteAnswer token="owner-token" answer={{ ...page.answer, ...sharing }} proof={page.proof}
      outlook={page.outlook} />);
    it("shared and visible: says we share the job, with no share button (a withdrawn job shares nothing)", () => {
      show(VISIBLE);
      if (ended === "withdrawn") { expect(within(companies()).getByText(NOTHING_IS_SHARED)).toBeVisible(); return; }
      expect(within(companies()).getByText(SHARED_LINE)).toBeVisible();
      expect(within(companies()).queryAllByRole("button")).toHaveLength(0);
      expect(companies().textContent).not.toMatch(/summary|not visible|Nothing/);
    });
    it("shared but held: says it is not visible right now (closed or withdrawn: nothing is shared)", () => {
      show(HIDDEN);
      if (ended) { expect(within(companies()).getByText(NOTHING_IS_SHARED)).toBeVisible(); expect(companies().textContent).not.toMatch(/right now/); return; }
      expect(within(companies()).getByRole("status")).toHaveTextContent(NOT_VISIBLE_LINE);
      expect(within(companies()).queryAllByRole("button")).toHaveLength(0);
    });
    it("an older job: says what changed and offers the current statement once, with no company section", () => {
      show({ sharing: { state: "not_shared", sharedAtIso: null, olderStatement: true }, companies: {
        interested: true, entries: [{ kind: "answered", alias: "Company A", atIso: "2026-11-11T10:00:00.000Z", state: "interested" }] } });
      if (ended) { expect(within(companies()).getByText(NOTHING_IS_SHARED)).toBeVisible(); return; }
      expect(within(companies()).getByText(OLDER_JOB_LINES)).toBeVisible();
      expect(within(companies()).getByRole("button", { name: OLDER_JOB_AGREE })).toBeVisible();
      expect(within(companies()).getByText(V4)).toBeVisible();
      expect(companies().textContent).not.toContain("Company A");
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
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
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
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
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
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
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
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
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

describe("an older job takes the current statement on its page", () => {
  const older = { ...readyAnswer, sharing: { state: "not_shared" as const, sharedAtIso: null, olderStatement: true } };
  it("records recording statement v4, the sentence shown above the button, and then says the job is shared", async () => {
    fetchMock.mockResolvedValue(response({ ok: true }));
    const changed = vi.fn();
    render(<SiteAnswer token="owner token" answer={older} onIntroductionRequested={changed} />);
    const button = within(companies()).getByRole("button", { name: OLDER_JOB_AGREE });
    expect(within(companies()).getByText(V4)).toHaveAttribute("id", button.getAttribute("aria-describedby"));
    fireEvent.click(button);
    expect(await within(companies()).findByText(SHARED_LINE)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/self-capture/uploads/owner%20token/recording-consent", expect.objectContaining({ method: "POST",
      body: JSON.stringify({ granted: true, statementVersion: "2026-11-12.v4" }) }));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: OLDER_JOB_AGREE })).toBeNull();
  });

  it("keeps the button with the server's sentence when the agreement cannot be saved", async () => {
    fetchMock.mockResolvedValue(response({ error: "Recording permission needs review. Contact hello@tryblueprint.io with your job link." }, 409));
    render(<SiteAnswer token="owner-token" answer={older} />);
    fireEvent.click(screen.getByRole("button", { name: OLDER_JOB_AGREE }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Recording permission needs review.");
    expect(screen.getByRole("button", { name: OLDER_JOB_AGREE })).toBeEnabled();
  });

  it("offers nothing to a job with no sharing statement and no older one (no video yet)", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
    expect(within(companies()).queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps a first look that cannot be checked as it is, whatever the early trial found", () => {
    const proof = projectSimulationProof({ evaluation: [allZeroEvaluation], pick: null });
    render(<SiteAnswer token="owner-token" answer={cannotAssessAnswer} proof={proof} />);
    expect(screen.getByText(cannotAssessAnswer.headline)).toBeVisible();
    expect(screen.queryByText(/No robot finished|Tried in our trial/)).toBeNull();
  });
});

// PACKAGE_E E4 and E6: under the sharing sentence, one line for the automatic send, each answer by alias, and beside each
// company that can be introduced "Introduce us"; after an introduction, that company's details and only that company's.
describe("the deployment companies section, with sends, answers and introductions", () => {
  const activity = { interested: true, sent: { count: 4, firstAtIso: "2026-11-11T10:00:00.000Z" }, introductions: { used: 0, max: 3 }, entries: [
    { kind: "answered" as const, alias: "Company B", atIso: "2026-11-12T09:00:00.000Z", state: "needs_something" as const, canIntroduce: false },
    { kind: "answered" as const, alias: "Company A", atIso: "2026-11-13T09:00:00.000Z", state: "interested" as const, canIntroduce: true },
  ] };
  const lines = () => within(companies()).getAllByRole("listitem").map(item => item.textContent);

  it("says the one send line and each answer by alias, and offers Introduce us with its sentence only where it can be pressed", () => {
    const stray = { ...activity, entries: activity.entries.map(entry => ({ ...entry, noteForSite: "NOTE-PLANT never shown.", words: "WORDS-PLANT" })) };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: stray as never }} />);
    expect(within(companies()).getByText(SHARED_LINE)).toBeVisible();
    expect(within(companies()).getByText("Sent to 4 deployment companies on November 11, 2026.")).toBeVisible();
    expect(lines()[0]).toBe("Company B answered on November 12, 2026: Would need something.");
    expect(lines()[1]).toContain("Company A answered on November 13, 2026: Interested.");
    const buttons = within(companies()).getAllByRole("button", { name: "Introduce us" });
    expect(buttons).toHaveLength(1);
    expect(within(companies()).getByText("We give Company A your name and contact details, and give you theirs."))
      .toHaveAttribute("id", buttons[0].getAttribute("aria-describedby"));
    expect(companies().textContent).not.toMatch(/NOTE-PLANT|WORDS-PLANT|We will write to you/);
    expect(companies().textContent).not.toMatch(BANNED);
  });

  it("asks for the introduction by alias, then shows what the server reads back", async () => {
    fetchMock.mockResolvedValue(response({ ok: true, introducedAtIso: "2026-11-14T09:00:00.000Z" }));
    const changed = vi.fn();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: activity }} onIntroductionRequested={changed} />);
    fireEvent.click(within(companies()).getByRole("button", { name: "Introduce us" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/owner-token/introductions", expect.objectContaining({ method: "POST",
      body: JSON.stringify({ alias: "A" }) }));
  });

  it.each([
    ["not_listed", "Your job is not in front of deployment companies right now, so we cannot make an introduction."],
    ["not_interested", "This company has not answered Interested, so we cannot introduce you."],
    ["consent_missing", "This company needs to answer again before we can introduce you."],
    ["limit_reached", "You have used your three introductions."],
    ["already_introduced", "You have already been introduced to this company. Their details are on this page and in your email."],
    ["company_not_approved", "This company can no longer be introduced."],
  ])("says a refusal (%s) in one plain sentence and keeps the button", async (reason, sentence) => {
    fetchMock.mockResolvedValue(response({ ok: false, reason, error: "server words" }, 409));
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: activity }} />);
    fireEvent.click(within(companies()).getByRole("button", { name: "Introduce us" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
    expect(screen.getByRole("button", { name: "Introduce us" })).toBeEnabled();
  });

  it("after an introduction shows that company's name and contact details, and only that company's", () => {
    const introduced = { ...activity, introductions: { used: 1, max: 3 }, entries: [
      { ...activity.entries[0], canIntroduce: false },
      { ...activity.entries[1], canIntroduce: false, introducedAtIso: "2026-11-14T09:00:00.000Z",
        company: { name: "Northwind Robotics", contactName: "Ada Contact", email: "ada@northwind.example", website: "https://northwind.example" } },
    ] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: introduced }} />);
    expect(within(companies()).getByText("You were introduced to Northwind Robotics on November 14, 2026.")).toBeVisible();
    expect(within(companies()).getByRole("link", { name: "ada@northwind.example" })).toHaveAttribute("href", "mailto:ada@northwind.example");
    expect(within(companies()).getByText("Ada Contact")).toBeVisible();
    expect(within(companies()).getByRole("link", { name: "https://northwind.example" })).toBeVisible();
    expect(within(companies()).queryAllByRole("button")).toHaveLength(0);
    // Company B, not introduced, stays an alias.
    expect(lines()[0]).toBe("Company B answered on November 12, 2026: Would need something.");
  });

  it("says the three introductions are used, with no button, once the limit is reached", () => {
    const full = { ...activity, introductions: { used: 3, max: 3 } };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: full }} />);
    expect(within(companies()).getByText("You have used your three introductions.")).toBeVisible();
    expect(within(companies()).queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps the entries while not visible, and shows nothing once the job is withdrawn", () => {
    const { unmount } = render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...HIDDEN, companies: activity }} />);
    expect(within(companies()).getByRole("status")).toHaveTextContent(NOT_VISIBLE_LINE);
    expect(lines()).toHaveLength(2);
    unmount();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...HIDDEN, companies: activity }} proof={null}
      outlook={{ phase: "ended_by_site", reason: "permission_withdrawn", sentence: "Permission to use your video was withdrawn, so this job has stopped." }} />);
    expect(within(companies()).getByText(NOTHING_IS_SHARED)).toBeVisible();
    expect(within(companies()).queryByRole("list")).toBeNull();
  });

  it("shows no entry, and no list, when there is none or the shape is wrong", () => {
    const { unmount } = render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: { interested: false, entries: [] } }} />);
    expect(within(companies()).queryByRole("list")).toBeNull();
    unmount();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE,
      companies: { interested: true, entries: [{ kind: "answered", alias: "Company A", atIso: "x", state: "maybe" }] } as never }} />);
    expect(within(companies()).queryByRole("list")).toBeNull();
  });
});

// The Pipeline's first-look table (third worker's `firstLookWords`): when the status carries it, its rows replace the
// robot rows, each robot then its sentence, then "And N more." when the list was cut.
describe("the first look from the published table", () => {
  it("lists each robot with its sentence, a conditional row said plainly, and how many more", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} firstLookTable={{ rows: [
      { verdict: "fits", text: "Fits.", robot: "Universal Robots UR10e" },
      { verdict: "conditional", text: "Fits if the item weighs under 11.6 kg.", robot: "FANUC CRX-10iA" },
    ], more: "And 24 more." }} />);
    const rows = within(firstLook()).getAllByRole("listitem").map(item => item.textContent);
    expect(rows).toEqual(["Universal Robots UR10e Fits.", "FANUC CRX-10iA Fits if the item weighs under 11.6 kg."]);
    expect(within(firstLook()).getByText("And 24 more.")).toBeVisible();
    expect(within(firstLook()).queryByText(FIRST_LOOK)).toBeNull();
  });

  it("keeps today's first look when there is no table", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} firstLookTable={null} />);
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
  });
});
