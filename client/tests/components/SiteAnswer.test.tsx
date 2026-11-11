import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteAnswer, SiteAnswerDetails, evidenceTick, sureReason, ticksOf } from "@/components/site/SiteAnswer";
import { projectSimulationProof } from "@/lib/simulationProof";
import { REASON_UNSIZED, UNKNOWN_JOB_KIND, UNKNOWN_MULTI_STEP, type AnswerRobot } from "@/lib/siteAnswer";
import { allZeroEvaluation, cannotAssessAnswer, noPickAnswer, readingAnswer, readyAnswer, winnerEvaluation } from "../fixtures/siteAnswer";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

/** Words a site manager should never meet, and anything that looks like a raw code. */
const BANNED = /episode|candidate|screening|embodiment|checkpoint|payload|anonymi[sz]ed|deployment compan|[a-z]_[a-z]|sha256/i;
const FIND = "Find a company to set it up";
const CONSENT = "Shares a summary of your job and this answer, without saying who you are, with companies we've approved. Your video, address and contacts stay private.";
const LIMITS = "Checks picking up and putting down only. Not a test at your site; it does not certify performance or safety.";
const winnerProof = projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick });
const words = (text: string | null) => (text?.match(/[^\s]+/g) ?? []).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

describe("the site's answer, bare bones", () => {
  it("says the robot in large type with its maker, why in plain ticks, how sure, one button with its line, two links and the limits", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} onShowDetails={vi.fn()} onShowSettings={vi.fn()} />);
    const answer = screen.getByRole("region", { name: "Your answer" });
    expect(within(answer).getByRole("heading", { level: 2, name: "The robot most likely to fit" })).toBeVisible();
    expect(within(answer).getByText("UR10e")).toHaveClass("bare-big");
    expect(within(answer).getByText("by Universal Robots")).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Why" })).getAllByRole("listitem").map(item => item.textContent))
      .toEqual(["✓Reaches far enough", "✓Strong enough", "✓Already used for jobs like this"]);
    expect(answer).toHaveTextContent("How sure are we? Fairly sure");
    expect(within(answer).getByText("We estimated the sizes and weight from your video.")).toBeVisible();
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
    expect(screen.getByRole("heading", { level: 2, name: "The closest robot" })).toBeVisible();
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
    // The reason under "How sure" names only what the estimated checks rest on.
    const robot = (keys: string[], sceneChecked = false) => ({ ...readyAnswer.pick!, sceneChecked,
      checks: readyAnswer.pick!.checks.map(entry => ({ ...entry, estimated: keys.includes(entry.key) })) }) as AnswerRobot;
    expect(sureReason(robot(["reach", "payload"]))).toBe("We estimated the sizes and weight from your video.");
    expect(sureReason(robot(["reach"]))).toBe("We estimated the sizes from your video.");
    expect(sureReason(robot(["payload"]))).toBe("We estimated the weight from your video.");
    expect(sureReason(robot([], true))).toBe("We checked its reach in a computer copy of your site.");
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

  it("says the computer test in one line, naming the robot it ran on and that it is not the pick", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={winnerProof} />);
    expect(screen.getByText("Computer test: π0.5 was ahead, finishing the job in 7 of 10 tries, on a Franka research arm, not the UR10e. It could still be chance."))
      .toBeVisible();
    expect(screen.queryByRole("list", { name: "Control policies tried" })).toBeNull();
  });

  it("says nothing about the computer test before it starts", () => {
    const notStarted = projectSimulationProof({ evaluation: [], pick: readyAnswer.pick });
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={notStarted} />);
    expect(container.textContent).not.toMatch(/computer test|simulation/i);
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

describe("the details screen", () => {
  it("has every true and sourced thing the answer rests on, in short labelled rows, and a way back", () => {
    const onBack = vi.fn();
    const withFigures = { ...readyAnswer, pick: { ...readyAnswer.pick!, checks: [
      { ...readyAnswer.pick!.checks[0], need: "about 0.9–1.2 m", has: "1.3 m" }, { ...readyAnswer.pick!.checks[1], need: "about 9–12 kg", has: "12.5 kg" }] } };
    render(<SiteAnswerDetails answer={withFigures} proof={winnerProof} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 1, name: "Details" })).toBeVisible();
    const why = screen.getByRole("region", { name: "Why this robot" });
    expect(within(why).getByText(/^needs about 0\.9–1\.2 m · reaches 1\.3 m/)).toBeVisible();
    expect(within(why).getByText(/^needs to lift up to 12 kg · lifts up to 12\.5 kg/)).toBeVisible();
    expect(within(why).getAllByRole("link", { name: "source" }).map(link => link.getAttribute("href")))
      .toEqual(readyAnswer.pick!.specs.map(spec => spec.sourceUrl));
    expect(within(why).getByRole("link", { name: /TEST case study: carton palletizing with the UR10e/ }))
      .toHaveAttribute("href", readyAnswer.pick!.evidence[0].sourceUrl);
    // How it would be run, by the server's kind, in plain words.
    expect(within(why).getByText("The objects vary, so it needs a camera to pick each one. Ask the company that sets it up how it handles each item.")).toBeVisible();
    expect(within(why).getByText("This answer is about the robot itself, not the software that runs it. The software is set up when the robot is installed.")).toBeVisible();
    // The catalog's own names, never invented short ones.
    expect(within(screen.getByRole("region", { name: "Other robots that fit" })).getAllByRole("definition").map(row => row.textContent))
      .toEqual(["Yaskawa HC20DTP", "Universal Robots UR20", "Universal Robots UR30", "ABB GoFa CRB 15000-12/1.27"]);
    expect(screen.getByRole("region", { name: "Robots that don't fit (11)" })).toHaveTextContent("And 9 more.");
    // The fixture's numbers mix estimates and the site's own: each says where it came from.
    const numbers = screen.getByRole("region", { name: "The numbers we used" });
    expect(numbers).toHaveTextContent("Height of the pallet stackup to 1.2 m (you told us)");
    for (const line of readyAnswer.unknowns) expect(within(screen.getByRole("region", { name: "What we couldn't see" })).getByText(line)).toBeVisible();
    for (const line of readyAnswer.confidence.raiseIt) expect(within(screen.getByRole("region", { name: "To be surer" })).getByText(line)).toBeVisible();
    expect(screen.getByRole("region", { name: "Computer test" })).toHaveTextContent(winnerProof.policyComparison!.line);
    expect(screen.getByRole("region", { name: "How far to trust a computer test" })).toBeVisible();
    expect(screen.getByText("We checked 22 robots from 13 makers, using their published figures from November 11, 2026.")).toBeVisible();
  });

  it("calls the numbers estimates only when every one of them is, and the others robots that fit only when they all do", () => {
    const estimated = { ...readyAnswer, facts: readyAnswer.facts.filter(fact => fact.basis === "video_estimate"),
      runnerUp: { ...readyAnswer.runnerUp!, verdict: "possible" as const } };
    render(<SiteAnswerDetails answer={estimated} onBack={vi.fn()} />);
    expect(screen.getByRole("region", { name: "What we estimated from your video" })).not.toHaveTextContent("(");
    expect(screen.getByRole("region", { name: "Other robots" })).toHaveTextContent("Yaskawa HC20DTP · may fit");
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
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: JSON.stringify({ statementVersion: "public-task-card-with-answer-v2" }) });
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

  it("keeps the button, quiet, with its line, when the site has a step to take first", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} quietAction />);
    expect(screen.getByRole("button", { name: FIND })).toHaveClass("bare-quiet-button");
    expect(screen.getByText(CONSENT)).toBeVisible();
  });

  it("carries the computer test on an answer with no pick too", () => {
    const proof = projectSimulationProof({ evaluation: [allZeroEvaluation], pick: null });
    render(<SiteAnswer token="owner-token" answer={cannotAssessAnswer} proof={proof} />);
    expect(screen.getByText(/^Computer test: None of the robot programs finished the job, on /)).toBeVisible();
  });
});
