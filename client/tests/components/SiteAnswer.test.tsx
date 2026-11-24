import { INTRODUCTION_CANCELLED } from "@/lib/siteIntroductions";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompaniesReadYourWords, NOTHING_IS_SHARED, NOT_SHARED_YET, NO_COMPANY_CAN_SEE_LINE, NOT_VISIBLE_LINE, OLDER_JOB_AGREE, OLDER_JOB_LINES, PREPARING_TO_SHARE_LINE, SHARED_LINE, SiteAnswer as SiteAnswerScreen, SiteAnswerDetail, SiteAnswerDetails, detailScreens, evidenceTick, sureReason, ticksOf, type DetailScreen } from "@/components/site/SiteAnswer";
import { projectSimulationProof, type SimulationProof } from "@/lib/simulationProof";
import { REASON_UNSIZED, UNKNOWN_JOB_KIND, UNKNOWN_MULTI_STEP, type AnswerRobot } from "@/lib/siteAnswer";
import { allZeroEvaluation, cannotAssessAnswer, noPickAnswer, preparingEvaluation, readingAnswer, readyAnswer, serverOutlookFor, winnerEvaluation } from "../fixtures/siteAnswer";
import type { ComponentProps } from "react";

/**
 * The answer screen as the job page renders it: with the outlook the server sends for that answer and proof. The
 * screen itself shows the working screen when no outlook came (review, 2026-11-11); a test about the phase passes its
 * own outlook, or null, and that is used as given.
 */
function SiteAnswer({ proof = null, ...props }: ComponentProps<typeof SiteAnswerScreen> & { proof?: SimulationProof | null }) {
  return <SiteAnswerScreen {...props} outlook={"outlook" in props ? props.outlook : serverOutlookFor(props.answer, proof)} />;
}

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); window.localStorage.clear(); });
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
/** The job page's one limits line, in every state: what the first look checks, never that only that kind of job is taken. */
const LIMITS = "Nothing here is a test at your site. The first look checks only picking up and putting down. It does not certify performance or safety.";
const FIRST_LOOK = "On paper, the robot most likely to fit: Universal Robots UR10e.";
const SOURCE = "From published specifications and where it has been used.";
const V6 = "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video, the simulation we build from it and the city and state it is in, with robot deployment companies we've approved.";
/** The server's sharing state (`jobSharingOf`), as the answer carries it. */
const VISIBLE = { sharing: { state: "visible" as const, sharedAtIso: "2026-11-10T09:00:00.000Z" }, jobCardListed: true };
const HIDDEN = { sharing: { state: "not_visible" as const, sharedAtIso: "2026-11-10T09:00:00.000Z" }, jobCardListed: true };
const region = (name: string) => screen.getByRole("region", { name });
const companies = () => region("Applicants");
const firstLook = () => region("First look");
const winnerProof = projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick });
const WORD_BUDGET = 110;
const words = (text: string | null) => (text?.match(/[^\s]+/g) ?? []).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

describe("the job page's sections, bare bones", () => {
  it("leads with deployment companies, then the first look: the robot, its source, why in plain ticks, how sure, two links and the limits", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} onShowDetails={vi.fn()} onShowSettings={vi.fn()} />);
    const page = screen.getByRole("region", { name: "Your job" });
    // The sections in order; with nothing to say about the simulation or a trial, neither section is shown.
    expect([...page.querySelectorAll("h2")].map(node => node.textContent)).toEqual(["Applicants", "First look"]);
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

  it("has three sections and no early trial, even where an early trial result was stored", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} outlook={serverOutlookFor(readyAnswer, winnerProof)} onShowDetails={() => {}} />);
    const page = screen.getByRole("region", { name: "Your job" });
    expect([...page.querySelectorAll("h2, summary")].map(node => node.textContent)).toEqual(["Applicants", "First look", "Simulation of your site"]);
    expect(within(firstLook()).getByText(FIRST_LOOK)).toBeVisible();
    expect(within(region("Simulation of your site")).getByText("The simulation of your site is ready.")).toBeVisible();
    expect(page.textContent).not.toMatch(/early trial|our trial|openly available|running now/i);
    expect(within(page).getByText(LIMITS)).toBeVisible();
    expect(page.textContent).not.toMatch(BANNED);
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
    const { unmount } = render(<SiteAnswerScreen token="owner-token" answer={readyAnswer} outlook={null} />);
    expect(within(companies()).getByText(NOT_SHARED_YET)).toBeVisible();
    expect(screen.getByText("We're building the simulation of your site.")).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
    unmount();
  });

  it("does not say posted while no approved company can see the job (L1-N1)", () => {
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, sharing: { ...VISIBLE.sharing, noCompanyCanSee: true } }} />);
    expect(within(companies()).getByText(NO_COMPANY_CAN_SEE_LINE)).toBeVisible();
    expect(within(companies()).queryByText(SHARED_LINE)).toBeNull();
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
    ["another kind, no grant", { answer: cannotAssessAnswer, proof: null, outlook: { phase: "no_test" as const, reason: "no_grant" as const,
      sentence: "We have not built a simulation for this job." } }, false],
    ["with a first look", { answer: readyAnswer, proof: null, outlook: { phase: "no_test" as const, reason: "window_expired" as const,
      sentence: "The time for this job ran out." } }, false],
    ["with a trial result", { answer: readyAnswer, proof: projectSimulationProof({ evaluation: [winnerEvaluation], pick: readyAnswer.pick }),
      outlook: { phase: "simulation_ready" as const, reason: null, sentence: null } }, false],
    ["closed by its owner", { answer: readyAnswer, proof: null, outlook: { phase: "ended_by_site" as const, reason: "closed_by_owner" as const,
      sentence: "You closed this job." } }, "closed"],
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
      expect(within(companies()).getByText(V6)).toBeVisible();
      expect(companies().textContent).not.toContain("Company A");
    });
  });
  it("says a failed step while building, and the ending's reason with the first look after an ending", () => {
    const { unmount } = render(<SiteAnswer token="owner-token" answer={readyAnswer} proof={null}
      outlook={{ phase: "building", reason: "step_failed", sentence: "A step on our side failed. Nothing is needed from you." }} />);
    expect(within(region("Simulation of your site")).getByText("A step on our side failed. Nothing is needed from you.")).toBeVisible();
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
      outlook={{ phase: "ended_by_site", reason: "closed_by_owner", sentence: "You closed this job." }} />);
    expect(screen.getByText("You closed this job.")).toBeVisible();
    expect(within(companies()).getByText(NOTHING_IS_SHARED)).toBeVisible();
    expect(screen.queryByRole("button", { name: FIND })).toBeNull();
  });

  it("says nothing about the early trial before it starts", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
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

  it("says plainly that a video it could not read has no first look, stops saying it is watching, and offers no button", () => {
    const onEditJob = vi.fn(), onUpdateVideo = vi.fn();
    const unread = { ...cannotAssessAnswer, reason: "We couldn't read your video, so this job has no first look." };
    render(<SiteAnswer token="owner-token" answer={unread} outlook={{ phase: "building", reason: null, sentence: null }}
      onEditJob={onEditJob} onUpdateVideo={onUpdateVideo} />);
    expect(within(firstLook()).getByText(cannotAssessAnswer.headline)).toBeVisible();
    expect(within(firstLook()).getByText("We couldn't read your video, so this job has no first look.")).toBeVisible();
    expect(screen.queryByText("We're watching your video.")).toBeNull();
    // The job goes on: its simulation is still being built.
    expect(screen.getByText("We're building the simulation of your site.")).toBeVisible();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
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
          <SiteAnswerDetails answer={answer} onBack={vi.fn()} /></>);
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
  const detail = (screen: DetailScreen, answer = withFigures, robotCheck: Parameters<typeof SiteAnswerDetail>[0]["robotCheck"] = winnerProof.robotCheck) =>
    render(<SiteAnswerDetail answer={answer} robotCheck={robotCheck} screen={screen} onBack={vi.fn()} />);

  it("is a short menu of small screens, each only when it has something to say", () => {
    const onOpen = vi.fn(), onBack = vi.fn();
    render(<SiteAnswerDetails answer={withFigures} onBack={onBack} onOpen={onOpen} />);
    expect(screen.getByRole("heading", { level: 1, name: "Details" })).toHaveAttribute("tabindex", "-1");
    expect(within(screen.getByRole("list", { name: "Details" })).getAllByRole("button").map(button => button.textContent)).toEqual([
      "First look: why this robot", "Other robots", "Robots that don't fit", "What we estimated", "What we couldn't see"]);
    fireEvent.click(screen.getByRole("button", { name: "What we estimated" }));
    expect(onOpen).toHaveBeenCalledWith("estimated");
    fireEvent.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(detailScreens(withFigures)).toEqual(["why", "others", "ruled-out", "estimated", "unseen"]);
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
    for (const name of ["why", "others", "ruled-out", "estimated", "unseen"] as const) {
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
  it("records recording statement v6 and tells the site what needs to be ready before sharing", async () => {
    fetchMock.mockResolvedValue(response({ ok: true }));
    const changed = vi.fn();
    render(<SiteAnswer token="owner token" answer={older} onIntroductionRequested={changed} />);
    const button = within(companies()).getByRole("button", { name: OLDER_JOB_AGREE });
    expect(within(companies()).getByText(V6)).toHaveAttribute("id", button.getAttribute("aria-describedby"));
    fireEvent.click(button);
    expect(await within(companies()).findByText(PREPARING_TO_SHARE_LINE)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/self-capture/uploads/owner%20token/recording-consent", expect.objectContaining({ method: "POST",
      body: JSON.stringify({ granted: true, statementVersion: "2026-11-23.v6" }) }));
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
// company that can be introduced "Accept"; after an introduction, that company's details and only that company's.
describe("the deployment companies section, with sends, answers and introductions", () => {
  const activity = { interested: true, views: 3, sent: { count: 4, firstAtIso: "2026-11-11T10:00:00.000Z" }, introductions: { used: 0 }, entries: [
    { kind: "answered" as const, alias: "Company B", atIso: "2026-11-12T09:00:00.000Z", state: "needs_something" as const, canIntroduce: false },
    { kind: "answered" as const, alias: "Company A", atIso: "2026-11-13T09:00:00.000Z", state: "interested" as const, canIntroduce: true },
  ] };
  // The company responses only: the tracker above them is a list of its own (owner, 2026-11-23).
  const responses = () => within(companies()).queryByRole("list", { name: "Company responses" });
  const lines = () => within(responses()!).getAllByRole("listitem").map(item => item.textContent);

  it("shows views and replies separately and offers Introduce us only to eligible companies", () => {
    const stray = { ...activity, entries: activity.entries.map(entry => ({ ...entry, noteForSite: "NOTE-PLANT never shown.", words: "WORDS-PLANT" })) };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: stray as never }} />);
    expect(within(companies()).getByText(SHARED_LINE)).toBeVisible();
    expect(within(companies()).getByText("Viewed by 3 companies")).toBeVisible();
    expect(within(companies()).getByText("2 responses")).toBeVisible();
    expect(lines()[0]).toContain("Company BNeed more detailsAnswered November 12, 2026");
    expect(lines()[0]).toContain("No reason shared.You can accept Company B if it applies or changes its answer to Tested it: can do.");
    expect(lines()[1]).toContain("Company AAppliedAnswered November 13, 2026");
    expect(lines()[1]).not.toContain("No reason shared.");
    const buttons = within(companies()).getAllByRole("button", { name: "Accept" });
    expect(buttons).toHaveLength(1);
    expect(within(companies()).getByText("We give Company A your email address and the place you gave us, and give you theirs."))
      .toHaveAttribute("id", buttons[0].getAttribute("aria-describedby"));
    expect(companies().textContent).not.toMatch(/NOTE-PLANT|WORDS-PLANT|We will write to you/);
    expect(companies().textContent).not.toMatch(BANNED);
  });

  // 2026-11-20: the site reads why each company answered as it did, in the company's words as the server gives them (its
  // identity already taken out); an answer that is not a yes with no words says that no reason can be shown.
  it("shows each company's reason, and says plainly when none can be shown", () => {
    const reasons = { ...activity, entries: [
      { ...activity.entries[0], reason: "The company would need a video of the far end; see [removed]." },
      { ...activity.entries[1], reason: "We stack cartons like these every day." },
      { kind: "answered" as const, alias: "Company C", atIso: "2026-11-14T09:00:00.000Z", state: "declined" as const, canIntroduce: false },
    ] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: reasons }} />);
    expect(within(companies()).getByText("In their words: “The company would need a video of the far end; see [removed].”")).toBeVisible();
    expect(within(companies()).getByText("In their words: “We stack cartons like these every day.”")).toBeVisible();
    expect(lines()[2]).toContain("Company CNot a fitAnswered November 14, 2026No reason shared.");
    // Need more details: no Introduce us (the company agreed to be introduced only after Interested or Tested it: can
    // do), and the site is told what would make one possible.
    expect(within(companies()).getAllByRole("button", { name: "Accept" })).toHaveLength(1);
    expect(within(companies()).getByText("You can accept Company B if it applies or changes its answer to Tested it: can do.")).toBeVisible();
  });

  // A company that tested the simulation and cannot yet may change its answer to "Tested it: can do", not only to
  // "Interested": the line names both answers an introduction may follow.
  it("tells the site both answers an introduction may follow, for a company that tested it and cannot yet", () => {
    const tested = { ...activity, entries: [{ kind: "answered" as const, alias: "Company D", atIso: "2026-11-14T09:00:00.000Z",
      state: "tested_cannot_yet" as const, canIntroduce: false }] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: tested }} />);
    expect(within(companies()).getByText("Tested it: cannot yet", { exact: true })).toBeVisible();
    expect(within(companies()).getByText("You can accept Company D if it applies or changes its answer to Tested it: can do."))
      .toBeVisible();
    expect(within(companies()).queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("shows a posted job even if nobody viewed or replied yet", () => {
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE,
      companies: { interested: false, sent: null, entries: [] } }} />);
    expect(within(companies()).getByText(SHARED_LINE)).toBeVisible();
    expect(within(companies()).getByText("Viewed by 0 companies")).toBeVisible();
    expect(within(companies()).getByText("0 responses")).toBeVisible();
  });

  it.each([
    [true, "Video received. We're preparing your job for posting."],
    [false, "Send a video to post your job."],
    [undefined, PREPARING_TO_SHARE_LINE],
  ])("shows the next posting state when videoReceived is %s", (videoReceived, label) => {
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, sharing: { state: "preparing",
      sharedAtIso: null, videoReceived }, companies: { interested: false, entries: [] } }} />);
    expect(within(companies()).getByText(label)).toBeVisible();
    expect(within(companies()).queryByText(SHARED_LINE)).toBeNull();
    expect(within(companies()).queryByText("0 responses")).toBeNull();
  });

  it("says nothing about sends without a company read, or for a withdrawn or older job", () => {
    const { unmount } = render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE }} />);
    expect(within(companies()).getByText(SHARED_LINE)).toBeVisible();
    expect(companies().textContent).not.toMatch(/Not sent|Sent to/);
    unmount();
    const unsent = { interested: false, sent: null, entries: [] };
    const second = render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...HIDDEN, companies: unsent }} proof={null}
      outlook={{ phase: "ended_by_site", reason: "permission_withdrawn", sentence: "Permission to use your video was withdrawn, so this job has stopped." }} />);
    expect(within(companies()).getByText(NOTHING_IS_SHARED)).toBeVisible();
    expect(within(companies()).queryByText("Viewed by 0 companies")).toBeNull();
    second.unmount();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, sharing: { state: "not_shared", sharedAtIso: null, olderStatement: true },
      companies: unsent }} />);
    expect(within(companies()).getByText(OLDER_JOB_LINES)).toBeVisible();
    expect(within(companies()).queryByText("Viewed by 0 companies")).toBeNull();
  });

  it("asks for the introduction by alias, then shows what the server reads back", async () => {
    fetchMock.mockResolvedValue(response({ ok: true, introducedAtIso: "2026-11-14T09:00:00.000Z" }));
    const changed = vi.fn();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: activity }} onIntroductionRequested={changed} />);
    fireEvent.click(within(companies()).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    // One plain sentence says both sides are being emailed (ledger EL19).
    expect(await within(companies()).findByText("We are emailing you and Company A each other's contact details.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/owner-token/introductions", expect.objectContaining({ method: "POST",
      body: JSON.stringify({ alias: "A", statementVersion: "introduction-request-2026-11-24" }) }));
  });

  // 2026-11-24: a job whose record holds a name the site gave keeps the sentence of 2026-11-12, true for it, and the
  // press records that version.
  it("shows and records the sentence the server says is true for this job", async () => {
    fetchMock.mockResolvedValue(response({ ok: true, introducedAtIso: "2026-11-14T09:00:00.000Z" }));
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE,
      companies: { ...activity, introductionStatementVersion: "introduction-request-2026-11-12" } }} />);
    expect(within(companies()).getByText("We give Company A your name, address and contact details, and give you theirs.")).toBeVisible();
    fireEvent.click(within(companies()).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/owner-token/introductions", expect.objectContaining({
      body: JSON.stringify({ alias: "A", statementVersion: "introduction-request-2026-11-12" }) })));
  });

  it("offers Introduce us again on the open page when an introduction it requested is later cancelled and may be asked again", async () => {
    fetchMock.mockResolvedValue(response({ ok: true, introducedAtIso: "2026-11-14T09:00:00.000Z" }));
    const page = (companies: typeof activity) => <SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies }} />;
    const { rerender } = render(page(activity));
    fireEvent.click(within(companies()).getByRole("button", { name: "Accept" }));
    expect(await within(companies()).findByText("We are emailing you and Company A each other's contact details.")).toBeVisible();
    // The server reads the introduction back, then Blueprint's own email to the company fails (F-03).
    rerender(page({ ...activity, entries: [activity.entries[0], { ...activity.entries[1], canIntroduce: false }] }));
    rerender(page({ ...activity, entries: [activity.entries[0], { ...activity.entries[1], canIntroduce: true, introductionCancelled: true } as never] }));
    expect(within(companies()).getByRole("button", { name: "Accept" })).toBeEnabled();
    expect(within(companies()).queryByText("We are emailing you and Company A each other's contact details.")).toBeNull();
  });

  it.each([
    ["not_listed", "Your job is not in front of deployment companies right now, so you cannot accept a company."],
    ["not_interested", "This company has not applied, or has changed its answer since, so you cannot accept it now."],
    ["consent_missing", "This company needs to apply again before you can accept it."],
    ["already_introduced", "You have already accepted this company."],
    ["company_not_approved", "This company can no longer be accepted."],
    ["withdrawn", "You withdrew this job, so you cannot accept a company."],
  ])("says a refusal (%s) in one plain sentence and keeps the button", async (reason, sentence) => {
    fetchMock.mockResolvedValue(response({ ok: false, reason, error: "server words" }, 409));
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: activity }} />);
    fireEvent.click(within(companies()).getByRole("button", { name: "Accept" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
    expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
  });

  it("says an introduction asked for but not made yet is in progress, with no company details and no button", () => {
    const pending = { ...activity, introductions: { used: 1 }, entries: [activity.entries[0],
      { ...activity.entries[1], canIntroduce: false, introductionPending: true } as never] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: pending }} />);
    expect(within(companies()).getByText("We are emailing you and Company A each other's contact details.")).toBeVisible();
    expect(within(companies()).queryByText(/You accepted/)).toBeNull();
    expect(within(companies()).queryAllByRole("link")).toHaveLength(0);
    expect(within(companies()).queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("after an introduction shows that company's name and contact details, and only that company's", () => {
    const introduced = { ...activity, introductions: { used: 1 }, entries: [
      { ...activity.entries[0], canIntroduce: false },
      { ...activity.entries[1], canIntroduce: false, introducedAtIso: "2026-11-14T09:00:00.000Z",
        company: { name: "Northwind Robotics", contactName: "Ada Contact", email: "ada@northwind.example", website: "https://northwind.example" } },
    ] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: introduced }} />);
    expect(within(companies()).getByText("You accepted Northwind Robotics on November 14, 2026.")).toBeVisible();
    expect(within(companies()).getByRole("link", { name: "ada@northwind.example" })).toHaveAttribute("href", "mailto:ada@northwind.example");
    expect(within(companies()).getByText("Ada Contact")).toBeVisible();
    expect(within(companies()).getByRole("link", { name: "https://northwind.example" })).toBeVisible();
    // After the introduction, only the site's own marks of how it went (owner, 2026-11-23): never another introduction.
    expect(within(companies()).queryAllByRole("button").map(button => button.textContent)).toEqual(["We had a site visit", "We agreed a pilot"]);
    // Company B, not introduced, stays an alias.
    expect(lines()[0]).toMatch(/^Company BNeed more detailsAnswered November 12, 2026/);
    expect(lines()[0]).not.toMatch(/Northwind|Ada/);
  });

  // Owner, 2026-11-23: a company's question carries a reply date; past it, the site is told it can still reply.
  it("shows the reply date beside a company's question, and says plainly when it has passed", () => {
    const asking = (replyByIso: string) => ({ ...activity, entries: [{ ...activity.entries[0],
      question: { id: "q".repeat(64), text: "How many cartons arrive per minute?", replyByIso } }] });
    const { unmount } = render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: asking("2999-01-04T10:00:00.000Z") }} />);
    expect(within(companies()).getByText("Please reply by January 4, 2999.")).toBeVisible();
    unmount();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: asking("2026-11-15T10:00:00.000Z") }} />);
    expect(within(companies()).getByText("The reply date, November 15, 2026, has passed. You can still reply.")).toBeVisible();
    expect(within(companies()).getByText("Reply")).toBeVisible();
  });

  it("compares applicants side by side, with each estimate labelled as before a site visit and not a quote", () => {
    const applied = { ...activity, entries: [
      { kind: "answered" as const, alias: "Company A", atIso: "2026-11-13T09:00:00.000Z", state: "interested" as const, canIntroduce: true,
        applicant: { name: "Northwind Robotics", website: "https://northwind.example" },
        details: { chargeModel: "subscription" as const, estimate: { lowUsd: 12000, highUsd: 18000 }, similarJobs: "6_20" as const,
          startWindow: "within_month" as const, visitMustConfirm: "Conveyor height." } },
      { kind: "answered" as const, alias: "Company B", atIso: "2026-11-14T09:00:00.000Z", state: "interested" as const, canIntroduce: true },
    ] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: applied }} />);
    const table = within(companies()).getByRole("table", { name: "Compare applicants" });
    expect(within(table).getAllByRole("row").map(row => row.textContent)).toEqual([
      "ApplicantChargesEstimateSimilar jobs doneEarliest start",
      "Northwind RoboticsMonthly subscription$12,000 to $18,000 a month6 to 20Within a month",
      "Company BNot givenNot givenNot givenNot given"]);
    expect(within(companies()).getByText(/Estimates are each company's own, before a site visit\. They are not quotes/)).toBeVisible();
    // The card says the same, the estimate with its label.
    expect(lines()[0]).toContain("Estimate$12,000 to $18,000 a month Estimate before a site visit. Not a quote.");
    expect(lines()[0]).toContain("A visit must confirmConveyor height.");
  });

  // Stress test, 2026-11-24: the table kept a company whose introduction was cancelled and that can no longer be accepted.
  it("leaves out of the comparison a company that can no longer be accepted, marks one already accepted, and labels each cell", () => {
    const glance = { chargeModel: "per_hour" as const, estimate: { lowUsd: 45.5, highUsd: 60 } };
    const entries = [
      { kind: "answered" as const, alias: "Company A", atIso: "2026-11-13T09:00:00.000Z", state: "interested" as const, canIntroduce: false,
        introductionCancelled: true, applicant: { name: "Dropped Robotics", website: null }, details: glance },
      { kind: "answered" as const, alias: "Company B", atIso: "2026-11-14T09:00:00.000Z", state: "interested" as const, canIntroduce: false,
        introductionPending: true, applicant: { name: "Chosen Robotics", website: null } },
      { kind: "answered" as const, alias: "Company C", atIso: "2026-11-15T09:00:00.000Z", state: "interested" as const, canIntroduce: true,
        applicant: { name: "Open Robotics", website: null }, details: glance },
    ];
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: { ...activity, entries } }} />);
    const table = within(companies()).getByRole("table", { name: "Compare applicants" });
    expect(within(table).getAllByRole("row").map(row => row.textContent)).toEqual([
      "ApplicantChargesEstimateSimilar jobs doneEarliest start",
      "Chosen RoboticsAcceptedNot givenNot givenNot givenNot given",
      "Open RoboticsPer hour of work$45.50 to $60.00 an hourNot givenNot given"]);
    // The company that can no longer be accepted stays in the list, with its answer, and no Accept.
    expect(lines()[0]).toMatch(/^Dropped RoboticsApplied/);
    expect(within(companies()).getAllByRole("button", { name: "Accept" })).toHaveLength(1);
    // Each cell carries its column's name, which the phone layout shows beside the value.
    expect([...table.querySelectorAll("tbody tr:last-child td")].map(cell => cell.getAttribute("data-label")))
      .toEqual(["Charges", "Estimate", "Similar jobs done", "Earliest start"]);
  });

  // Stress test, 2026-11-24: an estimate raised after the introduction updated silently.
  it("says when an estimate changed since the site last looked, and after it accepted", async () => {
    const applicant = (estimate: { lowUsd: number; highUsd: number }, extra: Record<string, unknown> = {}) => ({ ...activity, entries: [
      { kind: "answered" as const, alias: "Company A", atIso: "2026-11-13T09:00:00.000Z", state: "interested" as const, canIntroduce: true,
        applicant: { name: "Northwind Robotics", website: null }, details: { chargeModel: "subscription" as const, estimate }, ...extra },
      { kind: "answered" as const, alias: "Company B", atIso: "2026-11-14T09:00:00.000Z", state: "interested" as const, canIntroduce: true },
    ] });
    const page = (companies: ReturnType<typeof applicant>) => <SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies }} />;
    const first = render(page(applicant({ lowUsd: 4000, highUsd: 6000 })));
    expect(within(companies()).queryByText(/^Changed /)).toBeNull();
    first.unmount();
    // A later visit: the estimate went up.
    const second = render(page(applicant({ lowUsd: 9000, highUsd: 12000 })));
    expect(within(companies()).getAllByText("Changed since you last looked. It was $4,000 to $6,000 a month.")).toHaveLength(2);
    second.unmount();
    // Seen now: the next visit says nothing. The site accepts; the company then changes its estimate again.
    fetchMock.mockResolvedValue(response({ ok: true }));
    const { rerender } = render(page(applicant({ lowUsd: 9000, highUsd: 12000 })));
    expect(within(companies()).queryByText(/^Changed /)).toBeNull();
    fireEvent.click(within(companies()).getAllByRole("button", { name: "Accept" })[0]);
    await within(companies()).findByText("We are emailing you and Northwind Robotics each other's contact details.");
    rerender(page(applicant({ lowUsd: 15000, highUsd: 15000 }, { canIntroduce: false, introductionPending: true })));
    expect(within(companies()).getAllByText("Changed after you accepted. It was $9,000 to $12,000 a month.")).toHaveLength(2);
  });

  // The server records the estimate the site read beside Accept (`estimateAtAccept`): a new browser says the change too.
  it("says an estimate changed after Accept from the server's record, with nothing in this browser", () => {
    window.localStorage.clear();
    const introduced = { ...activity, entries: [
      { kind: "answered" as const, alias: "Company A", atIso: "2026-11-20T09:00:00.000Z", state: "interested" as const, canIntroduce: false,
        introductionPending: true, applicant: { name: "Northwind Robotics", website: null },
        details: { chargeModel: "subscription" as const, estimate: { lowUsd: 15000, highUsd: 15000 } },
        acceptedEstimate: { chargeModel: "subscription" as const, estimate: { lowUsd: 9000, highUsd: 12000 } } },
    ] };
    render(<SiteAnswer token="fresh-browser-token" answer={{ ...readyAnswer, ...VISIBLE, companies: introduced }} />);
    expect(within(companies()).getAllByText("Changed after you accepted. It was $9,000 to $12,000 a month.").length).toBeGreaterThan(0);
  });

  it("says an answer was updated after the introduction, from the server's own times, when this browser holds no earlier one", () => {
    const introduced = { ...activity, introductions: { used: 1 }, entries: [
      { kind: "answered" as const, alias: "Company A", atIso: "2026-11-20T09:00:00.000Z", state: "interested" as const, canIntroduce: false,
        introducedAtIso: "2026-11-14T09:00:00.000Z", details: { chargeModel: "subscription" as const, estimate: { lowUsd: 9000, highUsd: 12000 } },
        company: { name: "Northwind Robotics", contactName: null, email: "ada@northwind.example", website: null } },
    ] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: introduced }} />);
    expect(within(companies()).getByText("They updated their answer on November 20, 2026, after you accepted.")).toBeVisible();
  });

  // Stress test, 2026-11-24: a stale page kept offering Accept after the company changed to "Not a fit".
  it("reads the job again when Accept is refused, and keeps the refusal beside the company's answer as it is now", async () => {
    fetchMock.mockResolvedValue(response({ ok: false, reason: "not_interested" }, 409));
    const changed = vi.fn();
    const page = (companies: typeof activity) => <SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies }}
      onIntroductionRequested={changed} />;
    const { rerender } = render(page(activity));
    fireEvent.click(within(companies()).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    rerender(page({ ...activity, entries: [activity.entries[0],
      { ...activity.entries[1], atIso: "2026-11-15T09:00:00.000Z", state: "declined" as never, canIntroduce: false }] }));
    expect(within(companies()).queryByRole("button", { name: "Accept" })).toBeNull();
    expect(lines()[1]).toMatch(/^Company ANot a fit/);
    expect(within(companies()).getByRole("alert")).toHaveTextContent("This company has not applied, or has changed its answer since, so you cannot accept it now.");
    // The company applies again: the old refusal goes, and Accept is offered on the new answer.
    rerender(page({ ...activity, entries: [activity.entries[0], { ...activity.entries[1], atIso: "2026-11-16T09:00:00.000Z" }] }));
    expect(within(companies()).queryByRole("alert")).toBeNull();
    expect(within(companies()).getByRole("button", { name: "Accept" })).toBeEnabled();
  });

  // Stress test, 2026-11-24: the reply box named an alias the site never sees.
  it("names the company as the site reads it beside the reply box, and replies by its letter", async () => {
    const asking = { ...activity, entries: [{ kind: "answered" as const, alias: "Company C", atIso: "2026-11-14T09:00:00.000Z",
      state: "needs_something" as const, canIntroduce: false, applicant: { name: "Northwind Robotics", website: null },
      question: { id: "q".repeat(64), text: "How many cartons arrive per minute?", replyByIso: "2999-01-04T10:00:00.000Z" } }] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: asking }} />);
    fireEvent.click(within(companies()).getByText("Reply"));
    expect(within(companies()).getByText("Blueprint shares this reply with Northwind Robotics and keeps your contact details private.")).toBeVisible();
    expect(companies().textContent).not.toContain("Company C");
    fetchMock.mockResolvedValue(response({ answer: "About 12 a minute." }));
    fireEvent.change(within(companies()).getByLabelText("Your reply"), { target: { value: "About 12 a minute." } });
    fireEvent.click(within(companies()).getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/owner-token/clarifications", expect.objectContaining({
      body: JSON.stringify({ alias: "C", questionId: "q".repeat(64), answer: "About 12 a minute." }) })));
  });

  // A review of PR #1437: words held at a limit are said to be held, never "being prepared".
  it("says plainly when a company's words or the site's reply are held at a limit", () => {
    const held = { ...activity, entries: [{ kind: "answered" as const, alias: "Company C", atIso: "2026-11-14T09:00:00.000Z",
      state: "declined" as const, canIntroduce: false, wordsLimit: true as const },
    { kind: "answered" as const, alias: "Company D", atIso: "2026-11-14T10:00:00.000Z", state: "needs_something" as const, canIntroduce: false,
      question: { id: "q".repeat(64), text: "How many cartons arrive per minute?", answerPending: true as const, answerLimit: true as const } }] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: held }} />);
    expect(within(companies()).getByText("Their words are not shown: we reached a limit on checking words for names and contact details.")).toBeVisible();
    expect(within(companies()).queryByText("Their words show here once we have taken names and contact details out of them.")).toBeNull();
    expect(within(companies()).queryByText("No reason shared.")).toBeNull();
    expect(within(companies()).getByText("Company D does not see your reply: we reached a limit on checking words for names and contact details."))
      .toBeInTheDocument();
    expect(within(companies()).queryByText(/sees your reply once/)).toBeNull();
  });

  it("shows the site what companies read of its words: the words, being prepared, or held at a limit", () => {
    render(<CompaniesReadYourWords view={{ sentence: { text: "Stack cartons on cart 2." }, successRule: { limit: true } }} />);
    const read = screen.getByRole("region", { name: "What companies read" });
    expect(within(read).getByText("“Stack cartons on cart 2.”")).toBeVisible();
    expect(within(read).getByText("Companies do not see these words: we reached a limit on checking words for names and contact details."))
      .toBeVisible();
    cleanup();
    render(<CompaniesReadYourWords view={{ sentence: { pending: true } }} />);
    expect(screen.getByText(/^Companies do not see these words yet\./)).toBeVisible();
  });

  it("shows no comparison for a single applicant", () => {
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: activity }} />);
    expect(within(companies()).queryByRole("table")).toBeNull();
  });

  it("lets the site mark a visit after an introduction, shows the date with Undo, and moves the tracker on", async () => {
    const introduced = { ...activity, introductions: { used: 1 }, entries: [
      { ...activity.entries[1], canIntroduce: false, introducedAtIso: "2026-11-14T09:00:00.000Z",
        company: { name: "Northwind Robotics", contactName: null, email: "ada@northwind.example", website: null } },
    ] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: introduced }} />);
    const tracker = within(companies()).getByRole("list", { name: "Where your job stands" });
    expect(within(tracker).getAllByRole("listitem").map(item => item.className)).toEqual(["site-job-tracker-done",
      "site-job-tracker-done", "site-job-tracker-done", "site-job-tracker-done", "site-job-tracker-current", "site-job-tracker-upcoming"]);
    expect(within(tracker).getByText("Mark it below when a company visits")).toBeVisible();
    fetchMock.mockResolvedValueOnce(response({ ok: true, progress: { visitAtIso: "2026-11-20T10:00:00.000Z" } }));
    fireEvent.click(within(companies()).getByRole("button", { name: "We had a site visit" }));
    expect(await within(companies()).findByText("Site visit on November 20, 2026")).toBeVisible();
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/site-task-brief/owner-token/introductions/progress");
    expect(JSON.parse(String(init.body))).toEqual({ alias: "Company A", step: "visit", done: true });
    expect(within(companies()).getByRole("button", { name: "Undo: Site visit on November 20, 2026" })).toBeVisible();
  });

  // Planner, 20:35Z, H2: an introduction cancelled before the company's email went says so, beside that answer only.
  it("says beside a cancelled introduction that it could not go ahead and nothing was given, with no button and no company", () => {
    const cancelled = { ...activity, entries: [activity.entries[0],
      { ...activity.entries[1], canIntroduce: false, introductionCancelled: true }] };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: cancelled }} />);
    expect(lines()[1]).toContain("Company AAppliedAnswered November 13, 2026");
    expect(lines()[1]).toContain(INTRODUCTION_CANCELLED);
    expect(INTRODUCTION_CANCELLED).toBe("This could not go ahead. We did not give them your details.");
    expect(lines()[0]).not.toContain(INTRODUCTION_CANCELLED);
    expect(within(companies()).queryAllByRole("button")).toHaveLength(0);
    expect(within(companies()).queryByRole("link")).toBeNull();
  });

  // Owner, 2026-11-12: no limit per job. However many introductions were made, "Accept" stays beside every answer
  // the server says can be introduced, and nothing on the page speaks of a limit.
  it("keeps Introduce us beside each introducible answer however many introductions were made, and names no limit", () => {
    const many = { ...activity, introductions: { used: 8 } };
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE, companies: many }} />);
    expect(within(companies()).getAllByRole("button", { name: "Accept" })).toHaveLength(1);
    expect(companies().textContent).not.toMatch(/three|limit|used your/i);
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
    expect(responses()).toBeNull();
    unmount();
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, ...VISIBLE,
      companies: { interested: true, entries: [{ kind: "answered", alias: "Company A", atIso: "x", state: "maybe" }] } as never }} />);
    expect(responses()).toBeNull();
    // A read of the wrong shape holds no fact about sends, so nothing is said about them.
    expect(within(companies()).queryByText("Viewed by 0 companies")).toBeNull();
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
