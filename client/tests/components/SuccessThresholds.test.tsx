import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SuccessThresholds, isSuccessThresholds, type SuccessThresholdsView } from "@/components/site/SuccessThresholds";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));
const view: SuccessThresholdsView = {
  proposalDigest: `sha256:${"1".repeat(64)}`,
  rows: [{ label: "Goal area", value: "The green spot: a circle 30 cm across. The whole object has to end up inside it." },
    { label: "Drops", value: "The object is never dropped." }],
  otherValues: [{ label: "authority", value: "deterministic_simulator_state" }],
  decision: null,
};

function bodyOf(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
}

describe("SuccessThresholds", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("shows the goals in plain words and confirms this exact proposal", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, decision: "confirmed" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onDecided = vi.fn();
    render(<SuccessThresholds token="tok" view={view} onDecided={onDecided} />);
    expect(screen.getByRole("heading", { name: "How success is judged" })).toBeTruthy();
    expect(screen.getByText(/a circle 30 cm across/)).toBeTruthy();
    expect(screen.getByText(/Nothing was measured at your site/)).toBeTruthy();
    expect(screen.getByText("You can confirm these goals, or tell us what is wrong.")).toBeTruthy();
    // Nothing to edit: no number inputs, and the technical values stay folded.
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("All values Blueprint checks").closest("details")?.open).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Use these goals" }));
    await waitFor(() => expect(onDecided).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/site-task-brief/tok/success-thresholds");
    expect(bodyOf(fetchMock)).toEqual({ proposalDigest: view.proposalDigest, decision: "confirm" });
  });

  it("holds the job with a typed reason, and never sends a number", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, decision: "held" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SuccessThresholds token="tok" view={view} onDecided={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Something is wrong" }));
    const hold = screen.getByRole("button", { name: "Send this reason" }) as HTMLButtonElement;
    expect(hold.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("These limits are stricter than the job needs"));
    fireEvent.click(hold);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock)).toEqual({ proposalDigest: view.proposalDigest, decision: "wrong", reason: "too_strict" });
  });

  it("says where a decided job stands, and shows a refused answer without losing the page", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "These goals have changed. Refresh your job to see the current ones." }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<SuccessThresholds token="tok"
      view={{ ...view, decision: { kind: "held", reason: "wrong_goal", decidedAt: "2026-11-03T18:00:00.000Z" } }} onDecided={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toMatch(/the goal area is in the wrong place\. Blueprint’s team is alerted with\s+your reason\. Blueprint will review it and contact you\./);
    fireEvent.click(screen.getByRole("button", { name: "Use these goals" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/goals have changed/);
    rerender(<SuccessThresholds token="tok"
      view={{ ...view, decision: { kind: "confirmed", reason: null, decidedAt: "2026-11-03T18:00:00.000Z" } }} onDecided={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("You confirmed these goals. Blueprint scores robot candidates against them.");
    expect(screen.queryByRole("button", { name: "Use these goals" })).toBeNull();
  });

  it("accepts only a well-formed view", () => {
    expect(isSuccessThresholds(view)).toBe(true);
    expect(isSuccessThresholds({ ...view, proposalDigest: "x" })).toBe(false);
    expect(isSuccessThresholds({ ...view, rows: [], otherValues: [] })).toBe(false);
    expect(isSuccessThresholds({ ...view, decision: { kind: "held", reason: "free text", decidedAt: "x" } })).toBe(false);
    expect(isSuccessThresholds({ ...view, decision: { kind: "confirmed", reason: "too_strict", decidedAt: "x" } })).toBe(false);
  });
});
