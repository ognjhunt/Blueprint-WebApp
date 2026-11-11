import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobCardAnswerSummary, TaskBrowseCard } from "@/types/taskBrowse";

const auth = vi.hoisted(() => ({ currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async () => ({}) }));

const { TaskBrowse } = await import("@/components/site/TaskBrowse");
const { JobCardAnswer, JOB_CARD_ANSWER_TITLE } = await import("@/components/site/JobCardAnswer");
const { JOB_CARD_NOTE_SHORT, SITE_ANSWER_NOTE } = await import("@/lib/siteAnswer");

const ANSWER: JobCardAnswerSummary = {
  headline: "Most likely to fit: Universal Robots UR20.",
  familyLabel: "palletizing",
  facts: [{ label: "How far the object moves", display: "about 1.6 m", basis: "video_estimate" }],
  pick: { manufacturer: "Universal Robots", name: "UR20", verdictLabel: "Fits on paper",
    specs: [{ label: "Reach", display: "1.75 m", sourceUrl: "https://example.com/ur20" }],
    checks: [{ key: "reach", outcome: "pass", need: "about 1–1.3 m", has: "1.75 m" }, { key: "payload", outcome: "pass", need: "about 9–12 kg", has: "20 kg" }],
    evidence: [{ level: "production", scope: "model", family: null, summary: "A named mill palletizes with it.", quote: "The UR20 palletizes here.",
      sourceUrl: "https://example.com/case", sourceTitle: "Case", publisher: "Universal Robots", publishedOn: null }] },
  runnerUp: { manufacturer: "Yaskawa", name: "HC20DTP", verdictLabel: "Fits on paper", specs: [],
    evidence: [{ level: "offered", scope: "family", family: "Motoman HC", summary: "The maker offers the family for palletizing.",
      quote: "Motoman HC arms palletize.", sourceUrl: "https://example.com/hc", sourceTitle: "HC", publisher: "Yaskawa", publishedOn: null }] },
  confidence: { level: "fair", reason: "The weight and distances are estimated from the site's video." },
  unknowns: ["Which gripper or tool the object needs."],
  simulation: null,
  note: SITE_ANSWER_NOTE.replace("at your site", "at the site"),
};
const card = (overrides: Partial<TaskBrowseCard> = {}): TaskBrowseCard => ({
  id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling", siteType: "", region: "", objects: "Cartons",
  cycleTarget: "", pilotTiming: "", pilotBudget: "", opportunity: "open", stage: "capture", evaluationAvailable: false, costUsd: null,
  publishedAtIso: "2026-11-11T10:00:00.000Z", thumbnailUrl: null, ...overrides });
const access = { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: false };

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("Blueprint's answer on a job card", () => {
  it("says the answer bare bones, the way the site sees it: the robot, plain ticks, how sure, one link and the note", () => {
    const { container } = render(<JobCardAnswer answer={ANSWER} />);
    const block = screen.getByRole("region", { name: JOB_CARD_ANSWER_TITLE });
    expect(within(block).getByText("The robot most likely to fit")).toBeVisible();
    expect(within(block).getByText("UR20")).toHaveClass("bare-big");
    expect(within(block).getByText("by Universal Robots · Kind of job: palletizing")).toBeVisible();
    expect(within(within(block).getByRole("list", { name: "Why" })).getAllByRole("listitem").map(item => item.textContent))
      .toEqual(["✓Reaches far enough", "✓Strong enough", "✓Already used for jobs like this"]);
    expect(block).toHaveTextContent("How sure are we? Fairly sure");
    expect(within(block).getByText(ANSWER.confidence.reason!)).toBeVisible();
    expect(within(block).getByText(JOB_CARD_NOTE_SHORT)).toBeVisible();
    expect(container.textContent).not.toMatch(/Yaskawa|1\.75 m|source|The UR20 palletizes here/);
  });

  it("has every figure, source and unknown on its details view, with a way back", () => {
    render(<JobCardAnswer answer={ANSWER} />);
    fireEvent.click(screen.getByRole("button", { name: "See details ›" }));
    const block = screen.getByRole("region", { name: JOB_CARD_ANSWER_TITLE });
    const pick = within(block).getByRole("region", { name: "Pick: Universal Robots UR20" });
    expect(within(pick).getByText("needs about 1–1.3 m · reaches 1.75 m")).toBeVisible();
    expect(within(pick).getByRole("link", { name: "source" })).toHaveAttribute("href", "https://example.com/ur20");
    // Each source says what it names: the model itself, or the robot family it belongs to.
    expect(within(pick).getByText(/In production use · The source names this model/)).toBeVisible();
    expect(within(block).getByRole("region", { name: "Runner-up: Yaskawa HC20DTP" })).toHaveTextContent(
      "Offered for this kind of job · The source names this robot family (Motoman HC)");
    expect(within(block).getByRole("region", { name: "Estimated from the site's video" })).toHaveTextContent("How far the object movesabout 1.6 m");
    expect(within(block).getByRole("region", { name: "What the video couldn't show" })).toHaveTextContent(ANSWER.unknowns[0]);
    expect(within(block).getByText(ANSWER.note)).toBeVisible();
    fireEvent.click(within(block).getByRole("button", { name: "‹ Back" }));
    expect(screen.getByText("UR20")).toBeVisible();
  });

  it("says where each number came from when they do not all come from the video's estimate", () => {
    render(<JobCardAnswer answer={{ ...ANSWER, facts: [...ANSWER.facts, { label: "Weight of each carton", display: "8 kg", basis: "site_stated" }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "See details ›" }));
    expect(screen.getByRole("region", { name: "The numbers" })).toHaveTextContent("about 1.6 m (estimated from the site's video)");
    expect(screen.getByRole("region", { name: "The numbers" })).toHaveTextContent("8 kg (stated by the site)");
  });

  it("states the kind of job only when the answer carries one", () => {
    const { unmount } = render(<JobCardAnswer answer={ANSWER} />);
    expect(screen.getByText(/Kind of job: palletizing/)).toBeInTheDocument();
    unmount();
    render(<JobCardAnswer answer={{ ...ANSWER, familyLabel: null }} />);
    expect(screen.queryByText(/Kind of job/)).toBeNull();
  });

  it("shows one line in the browse list only on a card that carries a headline, and the answer when opened", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access,
      items: [card({ answerHeadline: ANSWER.headline }), card({ id: "job-2", title: "Packing opportunity" })] }) });
    render(<TaskBrowse />);
    const items = await screen.findAllByRole("listitem");
    const shared = items.find(item => within(item).queryByText("Carton palletizing opportunity"))!;
    const plain = items.find(item => within(item).queryByText("Packing opportunity"))!;
    expect(within(plain).queryByText(new RegExp(JOB_CARD_ANSWER_TITLE))).toBeNull();
    // No evaluation is ready on either card: their meta lines say so, and neither offers its link.
    expect(within(plain).getByText("Evaluation not ready yet")).toBeVisible();
    expect(within(shared).queryByRole("link", { name: "Offer your system for this job" })).toBeNull();
    const summary = within(shared).getByText(`${JOB_CARD_ANSWER_TITLE}: ${ANSWER.headline}`);
    expect(within(shared).queryByRole("region", { name: JOB_CARD_ANSWER_TITLE })).toBeNull();

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ item: { ...card(), answerSummary: ANSWER } }) });
    const details = summary.closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(await within(shared).findByRole("region", { name: JOB_CARD_ANSWER_TITLE })).toBeInTheDocument();
    // The title and the headline are said once, in the summary line, not again under it.
    expect(within(shared).getAllByText(new RegExp(JOB_CARD_ANSWER_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toHaveLength(1);
    expect(within(shared).queryByRole("heading", { name: JOB_CARD_ANSWER_TITLE })).toBeNull();
    expect(within(shared).getAllByText(new RegExp(ANSWER.headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toHaveLength(1);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/site-worlds/tasks/job-1", expect.anything());
  });
});
