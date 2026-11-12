import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { JobFacts } from "@/components/site/JobFacts";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));

type Call = [string, RequestInit];
const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, index: number) =>
  JSON.parse(String((fetchMock.mock.calls[index] as unknown as Call)[1].body));

/** A server that stores what it is sent, as the route does. */
function savingServer() {
  const stored: Record<string, string> = {};
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { key, code } = JSON.parse(String(init.body));
    stored[key] = code;
    return new Response(JSON.stringify({ ok: true, jobFacts: { ...stored, updatedAtIso: "2026-11-12T10:00:00.000Z" } }), { status: 200 });
  });
}

describe("JobFacts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks five questions as radio groups with legends, each with Not sure, and no typing", () => {
    render(<JobFacts token="tok" facts={null} />);
    expect(screen.getByRole("heading", { name: "A few quick questions help companies answer" })).toBeTruthy();
    const groups = screen.getAllByRole("group");
    expect(groups.map(group => within(group).getByText(/\?$/).textContent)).toEqual([
      "How heavy is the item?", "How big is it, on its longest side?", "How many an hour?",
      "How many hours a day does this job run?", "When would you want this?"]);
    for (const group of groups) expect(within(group).getByRole("radio", { name: "Not sure" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("saves a tap at once and shows Saved; another tap changes it", async () => {
    const fetchMock = savingServer();
    vi.stubGlobal("fetch", fetchMock);
    const onSaved = vi.fn();
    render(<JobFacts token="tok/1" facts={null} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("radio", { name: "5 to 15 kg (11 to 33 lb)" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Saved"));
    expect((fetchMock.mock.calls[0] as unknown as Call)[0]).toBe("/api/job-facts/tok%2F1");
    expect((fetchMock.mock.calls[0] as unknown as Call)[1].method).toBe("POST");
    expect(bodyOf(fetchMock, 0)).toEqual({ key: "weight", code: "5_15kg" });
    expect(onSaved).toHaveBeenLastCalledWith({ weight: "5_15kg", updatedAtIso: "2026-11-12T10:00:00.000Z" });
    expect((screen.getByRole("radio", { name: "5 to 15 kg (11 to 33 lb)" }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "Under 5 kg (11 lb)" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchMock, 1)).toEqual({ key: "weight", code: "under_5kg" });
    await waitFor(() => expect((screen.getByRole("radio", { name: "Under 5 kg (11 lb)" }) as HTMLInputElement).checked).toBe(true));
    expect((screen.getByRole("radio", { name: "5 to 15 kg (11 to 33 lb)" }) as HTMLInputElement).checked).toBe(false);
  });

  it("shows the stored answers", () => {
    render(<JobFacts token="tok" facts={{ timing: "asap", hours: "unsure", updatedAtIso: "2026-11-12T10:00:00.000Z" }} />);
    expect((screen.getByRole("radio", { name: "As soon as possible" }) as HTMLInputElement).checked).toBe(true);
    const hours = screen.getAllByRole("group")[3];
    expect((within(hours).getByRole("radio", { name: "Not sure" }) as HTMLInputElement).checked).toBe(true);
  });

  it("says when a tap could not be saved and keeps the earlier answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "Your answer could not be saved. Try again shortly." }),
      { status: 503 })));
    render(<JobFacts token="tok" facts={{ size: "under_30cm", updatedAtIso: "2026-11-12T10:00:00.000Z" }} />);
    fireEvent.click(screen.getByRole("radio", { name: "Over 60 cm (2 ft)" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Your answer could not be saved. Try again shortly."));
    expect((screen.getByRole("radio", { name: "Under 30 cm (1 ft)" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Over 60 cm (2 ft)" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("says the withdrawal refusal when the route gives it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false,
      error: "Recording consent was withdrawn. Your job can no longer be changed." }), { status: 409 })));
    render(<JobFacts token="tok" facts={null} />);
    fireEvent.click(screen.getByRole("radio", { name: "One shift" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Recording consent was withdrawn. Your job can no longer be changed."));
  });
});
