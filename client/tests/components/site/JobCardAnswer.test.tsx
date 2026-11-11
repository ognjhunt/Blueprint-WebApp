import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobCardAnswerSummary, TaskBrowseCard } from "@/types/taskBrowse";

const auth = vi.hoisted(() => ({ currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async () => ({}) }));

const { TaskBrowse } = await import("@/components/site/TaskBrowse");
const { JobCardAnswer, JOB_CARD_ANSWER_TITLE } = await import("@/components/site/JobCardAnswer");
const { SITE_ANSWER_NOTE } = await import("@/lib/siteAnswer");

const ANSWER: JobCardAnswerSummary = {
  headline: "Most likely to fit: Universal Robots UR20.",
  familyLabel: "palletizing",
  facts: [{ label: "How far the object moves", display: "about 1.6 m", basis: "video_estimate" }],
  pick: { manufacturer: "Universal Robots", name: "UR20", verdictLabel: "Fits on paper",
    specs: [{ label: "Reach", display: "1.75 m", sourceUrl: "https://example.com/ur20" }],
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
  it("renders the pick, the runner-up, how sure, the numbers, the unknowns and the standing note", () => {
    render(<JobCardAnswer answer={ANSWER} />);
    const block = screen.getByRole("region", { name: JOB_CARD_ANSWER_TITLE });
    expect(within(block).getByText(ANSWER.headline)).toBeInTheDocument();
    expect(within(block).getByRole("heading", { name: "Universal Robots UR20" })).toBeInTheDocument();
    expect(within(block).getByRole("heading", { name: "Yaskawa HC20DTP" })).toBeInTheDocument();
    expect(within(block).getByRole("link", { name: "source" })).toHaveAttribute("href", "https://example.com/ur20");
    expect(within(block).getByText(/How sure: Fair/)).toBeInTheDocument();
    expect(within(block).getByText(/estimated from the site's video\)/)).toBeInTheDocument();
    expect(within(block).getByText(ANSWER.note)).toBeInTheDocument();
    // Each source says what it names: the model itself, or the robot family it belongs to.
    expect(within(block).getByText("In production use · The source names this model")).toBeInTheDocument();
    expect(within(block).getByText("Offered for this kind of job · The source names this robot family (Motoman HC)")).toBeInTheDocument();
  });

  it("states the kind of job only when the answer carries one", () => {
    const { unmount } = render(<JobCardAnswer answer={ANSWER} />);
    expect(screen.getByText("Kind of job: palletizing")).toBeInTheDocument();
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
