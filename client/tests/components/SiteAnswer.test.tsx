import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SHARED_WITHOUT_ANSWER, SiteAnswer, SiteAnswerDetail, SiteAnswerDetails, detailScreens, evidenceTick, sureReason, ticksOf, type DetailScreen } from "@/components/site/SiteAnswer";
import { projectSimulationProof } from "@/lib/simulationProof";
import { REASON_UNSIZED, UNKNOWN_JOB_KIND, UNKNOWN_MULTI_STEP, type AnswerRobot } from "@/lib/siteAnswer";
import { allZeroEvaluation, cannotAssessAnswer, noPickAnswer, preparingEvaluation, readingAnswer, readyAnswer, winnerEvaluation } from "../fixtures/siteAnswer";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

/** Words a site manager should never meet, and anything that looks like a raw code. */
const BANNED = /episode|candidate|screening|embodiment|checkpoint|payload|anonymi[sz]ed|deployment compan|[a-z]_[a-z]|sha256/i;
const FIND = "Find a company to set it up";
const CONSENT = "Shares a summary of your job and your answer, including later test results, without saying who you are, with companies we've approved. Your video, address and contacts stay private.";
/** The limits line, by what the headline is: the paper check, a test result, or a test still running. */
const LIMITS = "A paper check, not a test at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
const LIMITS_TESTED = "Tested in a simulation, not at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
const LIMITS_TESTING = "Being tested in a simulation, not at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
const winnerProof = projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick });
const words = (text: string | null) => (text?.match(/[^\s]+/g) ?? []).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

describe("the site's answer, bare bones", () => {
  it("says the robot in large type with its maker, why in plain ticks, how sure, one button with its line, two links and the limits", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} onShowDetails={vi.fn()} onShowSettings={vi.fn()} />);
    const answer = screen.getByRole("region", { name: "Your answer" });
    // No simulation test result: the paper check leads, and says it is the paper check.
    expect(within(answer).getByRole("heading", { level: 2, name: "On paper, the robot most likely to fit" })).toBeVisible();
    expect(within(answer).getByText("UR10e")).toHaveClass("bare-big");
    expect(within(answer).getByText("by Universal Robots")).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Why" })).getAllByRole("listitem").map(item => item.textContent))
      .toEqual(["✓Reaches far enough", "✓Strong enough", "✓Already used for jobs like this"]);
    expect(answer).toHaveTextContent("How sure are we? Fairly sure");
    // The reason line is the server's own first reason for its sureness, whatever it is.
    expect(within(answer).getByText(readyAnswer.confidence.reasons[0])).toBeVisible();
    const button = within(answer).getByRole("button", { name: FIND });
    expect(button).toHaveClass("bare-button");
    // The line a site agrees to sits directly under the button and describes it.
    expect(within(answer).getByText(CONSENT)).toHaveAttribute("id", button.getAttribute("aria-describedby"));
    expect(within(answer).getByRole("navigation", { name: "More" })).toHaveTextContent("See details ›Job settings ›");
    expect(within(answer).getByText(LIMITS)).toBeVisible();
    // Nothing else: no figures, quotes, sources or other robots on this screen.
    expect(container.textContent).not.toMatch(/1\.3 m|12\.5 kg|Yaskawa|source/);
    expect(container.textContent).not.toMatch(BANNED);
    expect(container.querySelectorAll(".bare-button")).toHaveLength(1);
  });

  it("calls a robot that only may fit the closest robot, and says none clearly fits yet", () => {
    const possible = { ...readyAnswer, headline: "No robot clearly fits yet. The closest is Universal Robots UR10e.",
      pick: { ...readyAnswer.pick!, verdict: "possible" as const, checks: [{ ...readyAnswer.pick!.checks[0], outcome: "unknown" as const }, readyAnswer.pick!.checks[1]] } };
    render(<SiteAnswer token="owner-token" answer={possible} />);
    expect(screen.getByRole("heading", { level: 2, name: "On paper, the closest robot" })).toBeVisible();
    expect(screen.getByText("by Universal Robots. No robot clearly fits yet.")).toBeVisible();
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

  it("keeps every line that changes what the answer covers in view, in plain words", () => {
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

  it("leads with the simulation test's result when there is one: the option, its count, how sure, and the paper check one tap away", () => {
    const onShowPaper = vi.fn();
    // 7 of 10 against 3 of 10 and 2 of 10 is about 0.96 against the next: ahead, fairly sure, and it could still be chance.
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={winnerProof} onShowPaper={onShowPaper} />);
    const answer = screen.getByRole("region", { name: "Your answer" });
    expect(within(answer).getByRole("heading", { level: 2, name: "Was ahead on your job" })).toBeVisible();
    expect(answer.querySelector(".bare-big")).toHaveTextContent(/^Franka arm \+ π0\.5$/);
    // The option breaks on purpose: the robot, then "+ its AI software", each its own part.
    expect([...answer.querySelectorAll(".bare-big .bare-part")].map(part => part.textContent?.trim())).toEqual(["Franka arm", "+ π0.5"]);
    expect(within(answer).getByText("AI software by Physical Intelligence")).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Why" })).getAllByRole("listitem").map(item => item.textContent))
      .toEqual(["✓Did your job in 7 of 10 tries", "✓Ahead of the 2 other AI robots we tested"]);
    expect(answer).toHaveTextContent("How sure are we? Fairly sure");
    expect(within(answer).getByText("With this few tries the gap could still be chance.")).toBeVisible();
    fireEvent.click(within(answer).getByRole("button", { name: "On paper: UR10e ›" }));
    expect(onShowPaper).toHaveBeenCalledTimes(1);
    // The paper ticks are not on this screen; the one button and its line are.
    expect(within(answer).queryByText("Reaches far enough")).toBeNull();
    expect(within(answer).getByRole("button", { name: FIND })).toBeVisible();
    expect(within(answer).getByText(CONSENT)).toBeVisible();
    // The limits line says it was tested in a simulation, never that it is only a paper check.
    expect(within(answer).getByText(LIMITS_TESTED)).toBeVisible();
    expect(within(answer).queryByText(LIMITS)).toBeNull();
  });

  it("says did best only by the probability rule, and lowers how sure by one step when a set-up flag is raised", () => {
    const clear = projectSimulationProof({ evaluation: [{ ...winnerEvaluation, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
      index === 0 ? { ...row, succeeded: 10, failed: 0 } : row) } }], pick: readyAnswer.pick });
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={clear} />);
    expect(screen.getByRole("heading", { level: 2, name: "Did best on your job" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Your answer" })).toHaveTextContent("How sure are we? Sure");
    unmount();
    const flagged = projectSimulationProof({ evaluation: [{ ...winnerEvaluation, outcomeCaveat: "scene_setup" as const, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
      index === 0 ? { ...row, succeeded: 10, failed: 0 } : row) } }], pick: readyAnswer.pick });
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={flagged} />);
    expect(screen.getByRole("region", { name: "Your answer" })).toHaveTextContent("How sure are we? Fairly sure");
    expect(screen.getByText("Our simulation set-up may have affected this result.")).toBeVisible();
  });

  it("says none finished, with the closest by how far it got, and the set-up notice", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={projectSimulationProof({ evaluation: [allZeroEvaluation], pick: readyAnswer.pick })} />);
    expect(screen.getByRole("heading", { level: 2, name: "Tested on your job" })).toBeVisible();
    expect(screen.getByText("None finished yet")).toHaveClass("bare-big");
    // The fixture carries no progress, so nothing is called closest.
    expect(screen.getByText("4 AI robots tried; none finished your job.")).toBeVisible();
    expect(screen.getByText("This result may come from how we set up the simulation of your site, not from the robots.")).toBeVisible();
    expect(screen.queryByText(/Did best|Was ahead/)).toBeNull();
    expect(screen.getByText(LIMITS_TESTED)).toBeVisible();
  });

  it("says the set-up notice under no clear winner when a set-up flag is raised, as the email and the card do", () => {
    const tie = projectSimulationProof({ evaluation: [{ ...winnerEvaluation, outcomeCaveat: "scene_setup" as const, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
      index < 2 ? { ...row, scored: 2, succeeded: 1, failed: 1 } : row) } }], pick: readyAnswer.pick });
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={tie} />);
    expect(screen.getByText("No clear winner yet")).toBeVisible();
    expect(screen.getByText("This result may come from how we set up the simulation of your site, not from the robots.")).toBeVisible();
  });

  it("offers to share the test result when the card was shared under an older sentence that shares the paper check only", () => {
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, introductionRequestedAtIso: "2026-11-11T15:00:00.000Z", jobCardListed: true }}
      proof={winnerProof} card="with_paper_answer" />);
    expect(screen.getByText("Your shared job shows the paper check. Press the button to share the test result too.")).toBeVisible();
    expect(screen.getByRole("button", { name: FIND })).toBeVisible();
    cleanup();
    // With no test result, the paper check is all there is to share: shared.
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, introductionRequestedAtIso: "2026-11-11T15:00:00.000Z", jobCardListed: true }}
      card="with_paper_answer" />);
    expect(screen.getByText("✓ Shared. We'll email you when a company replies.")).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  it("says no clear winner yet with the top option's count, and testing now while it runs", () => {
    const tie = projectSimulationProof({ evaluation: [{ ...winnerEvaluation, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
      index < 2 ? { ...row, scored: 2, succeeded: 1, failed: 1 } : row) } }], pick: readyAnswer.pick });
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={tie} />);
    expect(screen.getByText("No clear winner yet")).toHaveClass("bare-big");
    expect(screen.getByText(/^Top: Franka arm \+ /)).toBeVisible();
    unmount();
    const running = projectSimulationProof({ evaluation: [{ ...preparingEvaluation, state: "running", screening: { candidates: preparingEvaluation.screening!.candidates.map(row => ({ ...row, state: "running" })) } }], pick: readyAnswer.pick });
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={running} />);
    expect(screen.getByRole("heading", { level: 2, name: "Testing now" })).toBeVisible();
    expect(screen.getByText("2 AI robots")).toHaveClass("bare-big");
    expect(screen.getByText("on your job, in a simulation of your site. We'll email you.")).toBeVisible();
    // Nothing is tested yet while it runs.
    expect(screen.getByText(LIMITS_TESTING)).toBeVisible();
    expect(screen.queryByText(LIMITS_TESTED)).toBeNull();
  });

  it("falls back to the paper check with why the test did not run, when that is known", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={projectSimulationProof({ evaluation: [{ ...winnerEvaluation, outcome: "held_budget" as const }], pick: readyAnswer.pick })} />);
    expect(screen.getByRole("heading", { level: 2, name: "On paper, the robot most likely to fit" })).toBeVisible();
    expect(screen.getByText("The simulation test did not finish. It reached the most the free beta can run for one job.")).toBeVisible();
    expect(screen.getByText(LIMITS)).toBeVisible();
  });

  it("says nothing about the simulation test before it starts", () => {
    const notStarted = projectSimulationProof({ evaluation: [], pick: readyAnswer.pick });
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={notStarted} />);
    expect(container.textContent).not.toMatch(/simulation test|testing now|tested on your job/i);
  });

  it("while reading, says only that it is watching the video and will email", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readingAnswer} onShowDetails={vi.fn()} onShowSettings={vi.fn()} />);
    expect(screen.getByText("We're watching your video.")).toBeVisible();
    expect(screen.getByText("We'll email you when it's ready.")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "More" })).toHaveTextContent("Job settings ›");
    expect(screen.queryByText(/See details/)).toBeNull();
    expect(container.textContent).not.toMatch(/minute|second|hour/i);
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  it("offers the one thing the site can do about an answer that cannot be checked, for the reason it gives", () => {
    const onEditJob = vi.fn(), onUpdateVideo = vi.fn();
    const { unmount } = render(<SiteAnswer token="owner-token" answer={cannotAssessAnswer} onEditJob={onEditJob} onUpdateVideo={onUpdateVideo} />);
    expect(cannotAssessAnswer.reason).toBe(REASON_UNSIZED);
    expect(screen.getByText(cannotAssessAnswer.headline)).toBeVisible();
    expect(screen.getByText("Your video didn't show the job clearly enough for us to measure it.")).toBeVisible();
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
    expect(screen.getByText(noPickAnswer.headline)).toBeVisible();
    expect(screen.getByText(noPickAnswer.reason!)).toBeVisible();
    expect(screen.getByText(noPickAnswer.formNote!)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never shows a site a banned word or a raw code, in any state or on the details screen", () => {
    for (const answer of [readyAnswer, noPickAnswer, cannotAssessAnswer, readingAnswer]) {
      const { container, unmount } = render(<><SiteAnswer token="owner-token" answer={answer} proof={winnerProof} />
        <SiteAnswerDetails answer={answer} proof={winnerProof} onBack={vi.fn()} /></>);
      expect(container.textContent).not.toMatch(BANNED);
      unmount();
    }
  });

  it("stays near the bare-bones word count", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} onShowDetails={vi.fn()} onShowSettings={vi.fn()} />);
    // The consent (25 words) and the limits line (19) may not be dropped; the rest is about 40 words.
    expect(words(container.textContent)).toBeLessThanOrEqual(90);
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
      "The simulation test", "How far to trust it", "On paper: why this robot", "Other robots", "Robots that don't fit", "What we estimated", "What we couldn't see"]);
    fireEvent.click(screen.getByRole("button", { name: "What we estimated" }));
    expect(onOpen).toHaveBeenCalledWith("estimated");
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    // No simulation yet: neither of its screens.
    expect(detailScreens(withFigures, projectSimulationProof({ evaluation: [], pick: withFigures.pick }))).not.toContain("test");
  });

  it("says why this robot in short rows: the figures, the sources, the record, how it is run, and that it is about the robot", () => {
    detail("why");
    expect(screen.getByRole("heading", { level: 1, name: "On paper: why this robot" })).toBeVisible();
    expect(screen.getByText(/^needs about 0\.9–1\.2 m · reaches 1\.3 m · only just enough/)).toBeVisible();
    expect(screen.getByText(/^needs to lift up to 12 kg · lifts up to 12\.5 kg/)).toBeVisible();
    expect(screen.getAllByRole("link", { name: "source" }).map(link => link.getAttribute("href"))).toEqual(readyAnswer.pick!.specs.map(spec => spec.sourceUrl));
    expect(screen.getByRole("link", { name: "Example Test News" })).toHaveAttribute("href", readyAnswer.pick!.evidence[0].sourceUrl);
    expect(screen.getByText("The objects vary, so it needs a camera to pick each one. Ask the company that sets it up how it handles each item.")).toBeVisible();
    expect(screen.getByText("This is the paper check: it looks at the robot's reach, strength and track record, not its AI software.")).toBeVisible();
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
    expect(ranked).toHaveTextContent("We ran 3 AI robots on your job, about 10 tries each, in a simulation of your site.");
    expect([...ranked.querySelectorAll("dt")].map(node => node.textContent)).toEqual([
      "1. Franka arm + π0.5 · Physical Intelligence", "2. Franka arm + GR00T N1.7 · NVIDIA", "3. Franka arm + MolmoAct 2 · Ai2"]);
    expect(ranked).toHaveTextContent("Finished 7 of 10 tries");
    expect(ranked).toHaveTextContent("· Ahead");
    expect(ranked).toHaveTextContent("With this few tries the gap could still be chance.");
    expect(ranked).toHaveTextContent("1 more AI robot was planned but did not run.");
    test.unmount();
    detail("trust");
    expect(screen.getByRole("heading", { level: 1, name: "How far to trust it" })).toBeVisible();
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

describe("the answer and the simulation of the site never disagree", () => {
  const robotFit = (verdict: "fits" | "fits_spec" | "doesnt_fit" | "unknown", openChecks: string[]) =>
    ({ models: [{ name: "UR10e", manufacturer: "Universal Robots", verdict, openChecks }] });

  it("says the robot does not fit only on a check the scene decides, and then says so on the answer screen", () => {
    // The scene's "doesn't fit" rests only on weight, which the answer checks from published figures: the scene line
    // says what the scene did check, and the answer stands.
    const weightOnly = projectSimulationProof({ evaluation: [], robotFit: robotFit("doesnt_fit", ["payload"]), pick: readyAnswer.pick });
    expect(weightOnly.robotCheck).toMatchObject({ line: "In the scene rebuilt from your video, the Universal Robots UR10e was not ruled out on reach or where it can stand.", doesNotFit: false });
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={weightOnly} />);
    expect(screen.getByRole("heading", { level: 2, name: "On paper, the robot most likely to fit" })).toBeVisible();
    unmount();
    // On reach: the answer calls it the closest robot and says why, in view.
    const reach = projectSimulationProof({ evaluation: [], robotFit: robotFit("doesnt_fit", ["reach"]), pick: readyAnswer.pick });
    expect(reach.robotCheck).toMatchObject({ doesNotFit: true });
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={reach} />);
    expect(screen.getByRole("heading", { level: 2, name: "On paper, the closest robot" })).toBeVisible();
    expect(screen.getByText("In a simulation of your site, the UR10e does not fit.")).toBeVisible();
  });

  it("holds over many generated answers and scene rows", () => {
    let seed = 20261111;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pickOf = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)];
    const CHECKS = ["reach", "payload", "stance", "access", "cycle_time"];
    let negatives = 0;
    for (let index = 0; index < 300; index++) {
      const verdict = pickOf(["fits", "fits_on_paper", "possible"] as const);
      const answer = { ...readyAnswer, pick: { ...readyAnswer.pick!, verdict } };
      const open = CHECKS.filter(() => random() < 0.3);
      const proof = projectSimulationProof({ evaluation: [], robotFit: robotFit(pickOf(["fits", "fits_spec", "doesnt_fit", "unknown"] as const), open), pick: answer.pick });
      const { container, unmount } = render(<SiteAnswer token="owner-token" answer={answer} proof={proof} />);
      const saysFits = container.textContent!.includes("The robot most likely to fit");
      const sceneSaysNo = /does not fit\./.test(proof.robotCheck!.line);
      if (sceneSaysNo) negatives++;
      expect(saysFits && sceneSaysNo, `${verdict} / ${proof.robotCheck!.line}`).toBe(false);
      if (sceneSaysNo) expect(container.textContent).toContain("In a simulation of your site, the UR10e does not fit.");
      unmount();
    }
    expect(negatives).toBeGreaterThan(20);
  });
});

describe("finding a company", () => {
  it("asks once and then says it is shared, only when the card is listed", async () => {
    const onRequested = vi.fn();
    fetchMock.mockResolvedValue(response({ ok: true, requestedAtIso: "2026-11-11T15:00:00.000Z", listed: true }));
    render(<SiteAnswer token="owner token" answer={readyAnswer} onIntroductionRequested={onRequested} />);
    const button = screen.getByRole("button", { name: FIND });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent("✓ Shared. We'll email you when a company replies.");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: JSON.stringify({ statementVersion: "public-task-card-with-answer-v3" }) });
    expect(screen.queryByText(CONSENT)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/owner%20token/introduction-request", expect.objectContaining({
      method: "POST", referrerPolicy: "no-referrer", headers: expect.objectContaining({ "X-CSRF-Token": "local-test" }) }));
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    expect(onRequested).toHaveBeenCalledTimes(1);
  });

  it("says Blueprint will set up the job card when it is not listed", async () => {
    fetchMock.mockResolvedValue(response({ ok: true, requestedAtIso: "2026-11-11T15:00:00.000Z", listed: false }));
    render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: FIND }));
    expect(await screen.findByRole("status")).toHaveTextContent("You asked on November 11, 2026. Blueprint will set up your job card and email you.");
    expect(screen.queryByText(/Shared\./)).toBeNull();
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

  it("shows a stored request instead of the button, by whether the card is on", () => {
    const { unmount } = render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, introductionRequestedAtIso: "2026-11-10T09:00:00.000Z", jobCardListed: true }} />);
    expect(screen.getByRole("status")).toHaveTextContent("✓ Shared. We'll email you when a company replies.");
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    unmount();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, introductionRequestedAtIso: "2026-11-10T09:00:00.000Z", jobCardListed: false }} />);
    expect(screen.getByRole("status")).toHaveTextContent("You asked on November 10, 2026. Blueprint will set up your job card and email you.");
  });

  it("says the job is shared without this answer when the card is on under the older box, and offers the button again", () => {
    const asked = { ...readyAnswer, introductionRequestedAtIso: "2026-11-10T09:00:00.000Z", jobCardListed: true };
    const { unmount } = render(<SiteAnswer token="owner-token" answer={asked} card="without_answer" />);
    expect(screen.getByRole("status")).toHaveTextContent(SHARED_WITHOUT_ANSWER);
    expect(screen.queryByText(/✓ Shared/)).toBeNull();
    expect(screen.getByRole("button", { name: FIND })).toBeVisible();
    expect(screen.getByText(CONSENT)).toBeVisible();
    unmount();
    const shared = render(<SiteAnswer token="owner-token" answer={asked} card="with_answer" />);
    expect(screen.getByRole("status")).toHaveTextContent("✓ Shared. We'll email you when a company replies.");
    shared.unmount();
    render(<SiteAnswer token="owner-token" answer={asked} card="off" />);
    expect(screen.getByRole("status")).toHaveTextContent("You asked on November 10, 2026. Blueprint will set up your job card and email you.");
  });

  it("keeps the button, quiet, with its line, when the site has a step to take first", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} quietAction />);
    expect(screen.getByRole("button", { name: FIND })).toHaveClass("bare-quiet-button");
    expect(screen.getByText(CONSENT)).toBeVisible();
  });

  it("keeps an answer that cannot be checked as it is, whatever the simulation test found", () => {
    const proof = projectSimulationProof({ evaluation: [allZeroEvaluation], pick: null });
    render(<SiteAnswer token="owner-token" answer={cannotAssessAnswer} proof={proof} />);
    expect(screen.getByText(cannotAssessAnswer.headline)).toBeVisible();
    expect(screen.queryByText(/None finished yet|Tested on your job/)).toBeNull();
  });
});
