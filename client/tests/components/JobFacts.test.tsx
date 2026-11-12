import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { JobFacts } from "@/components/site/JobFacts";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));

type Call = [string, RequestInit];
const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, index: number) =>
  JSON.parse(String((fetchMock.mock.calls[index] as unknown as Call)[1].body));

/** A server that stores what it is sent, as the route does. */
function savingServer(initial: Record<string, string> = {}) {
  const stored: Record<string, string> = { ...initial };
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { key, code } = JSON.parse(String(init.body));
    stored[key] = code;
    return new Response(JSON.stringify({ ok: true, jobFacts: { ...stored, updatedAtIso: "2026-11-12T10:00:00.000Z" } }), { status: 200 });
  });
}

describe("JobFacts", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Planner, 2026-11-12: one question at a time, "1 of 5", then one line and a Change link.
  it("asks one question at a time, as a radio group with a legend and Not sure, and no typing", () => {
    render(<JobFacts token="tok" facts={null} />);
    expect(screen.getByRole("heading", { name: "A few quick questions help companies answer" })).toBeTruthy();
    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(1);
    expect(within(groups[0]).getByText("How heavy is the item?")).toBeTruthy();
    expect(within(groups[0]).getByRole("button", { name: "Not sure" })).toBeTruthy();
    expect(screen.getByText("1 of 5")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("saves a tap at once and shows the next unanswered question, until all five are answered", async () => {
    const fetchMock = savingServer();
    vi.stubGlobal("fetch", fetchMock);
    const onSaved = vi.fn();
    render(<JobFacts token="tok/1" facts={null} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "5 to 15 kg (11 to 33 lb)" }));
    await waitFor(() => expect(screen.getByText("How big is it, on its longest side?")).toBeTruthy());
    expect(screen.getByText("2 of 5")).toBeTruthy();
    expect((fetchMock.mock.calls[0] as unknown as Call)[0]).toBe("/api/job-facts/tok%2F1");
    expect((fetchMock.mock.calls[0] as unknown as Call)[1].method).toBe("POST");
    expect(bodyOf(fetchMock, 0)).toEqual({ key: "weight", code: "5_15kg" });
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith({ weight: "5_15kg", updatedAtIso: "2026-11-12T10:00:00.000Z" }));
    for (const label of ["Not sure", "60 to 300", "One shift", "Just looking"]) {
      fireEvent.click(screen.getAllByRole("button", { name: label })[0]);
      await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));
    }
    expect(await screen.findByText(/Thanks\. Your answers help companies decide\./)).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("walks every question again from Change, showing the stored answers, and a tap changes one", async () => {
    const all = { weight: "under_5kg", size: "unsure", perHour: "under_60", hours: "unsure", timing: "asap", updatedAtIso: "2026-11-12T10:00:00.000Z" };
    const { updatedAtIso: _at, ...stored } = all;
    const fetchMock = savingServer(stored);
    vi.stubGlobal("fetch", fetchMock);
    render(<JobFacts token="tok" facts={all} />);
    expect(screen.getByText(/Thanks\. Your answers help companies decide\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("button", { name: "Under 5 kg (11 lb)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 of 5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Over 30 kg (66 lb)" }));
    await waitFor(() => expect(screen.getByText("2 of 5")).toBeTruthy());
    expect(bodyOf(fetchMock, 0)).toEqual({ key: "weight", code: "over_30kg" });
    // Keeping an answer: tap it again and the walk moves on, nothing is sent.
    expect(screen.getByRole("button", { name: "Not sure" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Not sure" }));
    expect(screen.getByText("3 of 5")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says when a tap could not be saved and keeps the earlier answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "Your answer could not be saved. Try again shortly." }),
      { status: 503 })));
    render(<JobFacts token="tok" facts={{ weight: "under_5kg", size: "under_30cm", updatedAtIso: "2026-11-12T10:00:00.000Z" }} />);
    // The first unanswered question shows, and stays shown after a failed save.
    fireEvent.click(screen.getByRole("button", { name: "Fewer than 60" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Your answer could not be saved. Try again shortly."));
    expect(screen.getByText("How many an hour?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fewer than 60" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("says the withdrawal refusal when the route gives it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false,
      error: "Recording consent was withdrawn. Your job can no longer be changed." }), { status: 409 })));
    render(<JobFacts token="tok" facts={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Under 5 kg (11 lb)" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Recording consent was withdrawn. Your job can no longer be changed."));
  });

  // Review S5: keyboard use. Buttons, not radios: an arrow key never saves; focus stays in the block after each step;
  // a failed save in Change mode stays on the question and says so.
  it("never saves on an arrow key, and moves focus to the next question after a save", async () => {
    const fetchMock = savingServer();
    vi.stubGlobal("fetch", fetchMock);
    render(<JobFacts token="tok" facts={null} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    const first = screen.getByRole("button", { name: "Under 5 kg (11 lb)" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(first);
    await waitFor(() => expect(screen.getByText("How big is it, on its longest side?")).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByText("How big is it, on its longest side?"));
  });

  it("stays on the question when a save fails while changing an answer, and says so", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 503 })));
    const all = { weight: "under_5kg", size: "unsure", perHour: "under_60", hours: "unsure", timing: "asap", updatedAtIso: "2026-11-12T10:00:00.000Z" };
    render(<JobFacts token="tok" facts={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Over 30 kg (66 lb)" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Your answer could not be saved. Try again shortly."));
    expect(screen.getByText("How heavy is the item?")).toBeTruthy();
    expect(screen.getByText("1 of 5")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Under 5 kg (11 lb)" })).toHaveAttribute("aria-pressed", "true");
  });
});
