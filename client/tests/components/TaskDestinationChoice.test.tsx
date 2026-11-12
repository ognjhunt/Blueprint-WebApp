import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskDestinationAnswered, TaskDestinationChoice, isDestinationChoice, type TaskDestinationChoiceView } from "@/components/site/TaskDestinationChoice";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));
const view: TaskDestinationChoiceView = {
  questionDigest: `sha256:${"3".repeat(64)}`, objectLabel: "Tote", guessedCandidateId: "p0123456789abcdef",
  // Two places of the same kind: told apart by the letter the picture draws beside each.
  candidates: [{ id: "p0123456789abcdef", place: "surface_end" }, { id: "pfedcba9876543210", place: "surface_end" },
    { id: "p1111111111111111", place: "farthest_spot" }],
  pictureUrl: "/api/website-destination-pictures/r1/walkthrough-r1/place.png?digest=x&expires=1&signature=y",
};
const sent = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
const loaded = () => fireEvent.load(screen.getByRole("img", { hidden: true }));

describe("TaskDestinationChoice", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("is shown only once its picture loads; This is right needs nothing more", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, choice: "confirm_guess" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onAnswered = vi.fn();
    render(<TaskDestinationChoice token="tok" question={view} onAnswered={onAnswered} />);
    expect(screen.getByRole("region", { hidden: true }).hidden).toBe(true);
    loaded();
    expect(screen.getByRole("region").hidden).toBe(false);
    expect(screen.getByText("We will test moving the tote from here to here.")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("src")).toBe(view.pictureUrl);
    expect(screen.getByText(/We will use Place A\. Nothing is needed from you/)).toBeTruthy();
    // As the Pipeline draws it: A, the guess, in green; the others in blue, each with its letter.
    expect(screen.getByText("Orange: where it starts. Each letter marks a place the object could go. A, in green, is our guess.")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "This is right" }));
    await waitFor(() => expect(onAnswered).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/site-task-brief/tok/task-target-choice");
    expect(sent(fetchMock)).toEqual({ questionDigest: view.questionDigest, choice: { kind: "confirm_guess" } });
  });
  it("names the places by their letters, never by the Pipeline's words, and sends the one picked", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, choice: "other_candidate" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TaskDestinationChoice token="tok" question={view} onAnswered={() => undefined} />);
    loaded();
    fireEvent.click(screen.getByRole("button", { name: "The place is wrong" }));
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    // The two places of the same kind read differently.
    expect(screen.getByLabelText("Place B")).toBeTruthy();
    expect(screen.getByLabelText("Place C")).toBeTruthy();
    expect(screen.getByText("Place A (our guess) is the one we use now.")).toBeTruthy();
    expect(screen.queryByText(/none of these|same surface/i)).toBeNull();
    fireEvent.click(screen.getByLabelText("Place C"));
    fireEvent.click(screen.getByRole("button", { name: "Use this place" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sent(fetchMock)).toEqual({ questionDigest: view.questionDigest, choice: { kind: "other_candidate", candidate_id: "p1111111111111111" } });
  });
  it("shows nothing without a picture, or when it fails to load, and refuses a view it cannot trust", () => {
    const { container, unmount } = render(<TaskDestinationChoice token="tok" question={{ ...view, pictureUrl: null }} onAnswered={() => undefined} />);
    expect(container.innerHTML).toBe("");
    unmount();
    const failed = render(<TaskDestinationChoice token="tok" question={view} onAnswered={() => undefined} />);
    fireEvent.error(screen.getByRole("img", { hidden: true }));
    expect(failed.container.innerHTML).toBe("");
    expect(isDestinationChoice(view)).toBe(true);
    expect(isDestinationChoice({ ...view, pictureUrl: null })).toBe(false);
    expect(isDestinationChoice({ ...view, pictureUrl: "https://example.com/x.png" })).toBe(false);
    expect(isDestinationChoice({ ...view, candidates: [view.candidates[0]] })).toBe(false);
  });
  it("once answered, says only that", () => {
    render(<TaskDestinationAnswered />);
    expect(screen.getByRole("status").textContent).toBe("We have your answer about where the object goes.");
  });
});
