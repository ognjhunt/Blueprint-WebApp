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
    evidence: [{ level: "production", scope: "model", summary: "A named mill palletizes with it.", quote: "The UR20 palletizes here.",
      sourceUrl: "https://example.com/case", sourceTitle: "Case", publisher: "Universal Robots", publishedOn: null }] },
  runnerUp: { manufacturer: "Yaskawa", name: "HC20DTP", verdictLabel: "Fits on paper", specs: [], evidence: [] },
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
    expect(fetchMock).toHaveBeenLastCalledWith("/api/site-worlds/tasks/job-1", expect.anything());
  });
});
