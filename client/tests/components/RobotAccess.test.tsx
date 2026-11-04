import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RobotAccess, isRobotAccess, type RobotAccessView } from "@/components/site/RobotAccess";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));
const view: RobotAccessView = {
  proposalDigest: `sha256:${"1".repeat(64)}`,
  question: "move",
  what: "1 chair",
  why: "In the simulation of your site, the robot arm can't stand close enough to reach the job. 1 chair is in the way.",
  ask: "To give the robot room, Blueprint would move 1 chair away from the wooden dining table in the simulation. Approve?",
  note: "Only the simulation changes; your site and your video stay as they are. The chair may still show in the simulation's pictures, but the robot is no longer blocked by it. Results stay estimates.",
  items: ["dining chair by the window"],
  approve: "Move it in the simulation",
  decline: "Keep it where it is",
  approved: "You approved this. Blueprint moves 1 chair in the simulation and checks again whether the robot can reach the job.",
  declined: "You chose to keep 1 chair where it is. The robot can't stand within reach, so this job is on hold. You can still approve if you change your mind.",
  decision: null,
};

function bodyOf(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
}

describe("RobotAccess", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("asks in plain words and approves this exact proposal", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, decision: "approved" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onDecided = vi.fn();
    render(<RobotAccess token="tok" view={view} onDecided={onDecided} />);
    expect(screen.getByRole("heading", { name: "Room for the robot" })).toBeTruthy();
    expect(screen.getByText(view.ask)).toBeTruthy();
    expect(screen.getByText("dining chair by the window")).toBeTruthy();
    expect(screen.getByText("Nothing changes until you answer.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Move it in the simulation" }));
    await waitFor(() => expect(onDecided).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/site-task-brief/tok/robot-access");
    expect(bodyOf(fetchMock)).toEqual({ proposalDigest: view.proposalDigest, decision: "approve" });
  });

  it("keeps the chair where it is on a decline", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, decision: "declined" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RobotAccess token="tok" view={view} onDecided={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep it where it is" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock)).toEqual({ proposalDigest: view.proposalDigest, decision: "decline" });
  });

  it("says where a decided job stands, and shows a refused answer without losing the page", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "This question has changed. Refresh your job to see the current one." }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<RobotAccess token="tok"
      view={{ ...view, decision: { kind: "declined", decidedAt: "2026-11-04T09:00:00.000Z" } }} onDecided={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe(view.declined);
    expect(screen.queryByRole("button", { name: "Keep it where it is" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Move it in the simulation" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/question has changed/);
    rerender(<RobotAccess token="tok"
      view={{ ...view, decision: { kind: "approved", decidedAt: "2026-11-04T09:00:00.000Z" } }} onDecided={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe(view.approved);
    expect(screen.queryByRole("button", { name: "Move it in the simulation" })).toBeNull();
  });

  it("asks first whether to measure, with Blueprint's own cost, and says nothing is measured unanswered", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, decision: "approved" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const measuring: RobotAccessView = { ...view, question: "measure", what: "chairs", items: ["dining chairs"],
      ask: "Blueprint would measure the chairs in your video (at most $0.40 of Blueprint's own processing; you are not charged) so it can propose moving one. Approve?",
      approve: "Measure the chairs", decline: "Not now" };
    render(<RobotAccess token="tok" view={measuring} onDecided={vi.fn()} />);
    expect(screen.getByText(measuring.ask)).toBeTruthy();
    expect(screen.getByText("Nothing is measured until you answer.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Measure the chairs" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock)).toEqual({ proposalDigest: view.proposalDigest, decision: "approve" });
  });

  it("accepts only a well-formed view", () => {
    expect(isRobotAccess(view)).toBe(true);
    expect(isRobotAccess({ ...view, proposalDigest: "x" })).toBe(false);
    expect(isRobotAccess({ ...view, items: [] })).toBe(false);
    expect(isRobotAccess({ ...view, ask: "" })).toBe(false);
    expect(isRobotAccess({ ...view, question: "spend" })).toBe(false);
    expect(isRobotAccess({ ...view, decision: { kind: "maybe", decidedAt: "x" } })).toBe(false);
  });
});
