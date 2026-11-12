import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskDestinationChoice, isDestinationChoice, type TaskDestinationChoiceView } from "@/components/site/TaskDestinationChoice";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));
const view: TaskDestinationChoiceView = {
  questionDigest: `sha256:${"3".repeat(64)}`, objectLabel: "Tote", guessedCandidateId: "p0123456789abcdef",
  candidates: [{ id: "p0123456789abcdef", place: "named_place" }, { id: "pfedcba9876543210", place: "surface_end" },
    { id: "p1111111111111111", place: "farthest_spot" }],
  pictureUrl: "/api/website-destination-pictures/r1/walkthrough-r1/place.png?digest=x&expires=1&signature=y",
};
const sent = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));

describe("TaskDestinationChoice", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("shows the picture and the sentence; This is right needs nothing more", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, choice: "confirm_guess" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onAnswered = vi.fn();
    render(<TaskDestinationChoice token="tok" question={view} onAnswered={onAnswered} />);
    expect(screen.getByText("We will test moving the tote from here to here.")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("src")).toBe(view.pictureUrl);
    expect(screen.getByText("Orange: where it starts. Green: where it goes.")).toBeTruthy();
    expect(screen.getByText("Nothing is needed from you: your job keeps going either way.")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "This is right" }));
    await waitFor(() => expect(onAnswered).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/site-task-brief/tok/task-target-choice");
    expect(sent(fetchMock)).toEqual({ questionDigest: view.questionDigest, choice: { kind: "confirm_guess" } });
  });
  it("The place is wrong opens the other places, in the page's own words, and sends the one picked", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, choice: "other_candidate" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TaskDestinationChoice token="tok" question={view} onAnswered={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "The place is wrong" }));
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByText("The other end of the same surface")).toBeTruthy();
    expect(screen.queryByText(/none of these/i)).toBeNull();
    fireEvent.click(screen.getByLabelText("The spot on the same surface farthest from where it starts"));
    fireEvent.click(screen.getByRole("button", { name: "Use this place" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sent(fetchMock)).toEqual({ questionDigest: view.questionDigest, choice: { kind: "other_candidate", candidate_id: "p1111111111111111" } });
  });
  it("says where it goes in words when there is no picture, and refuses a view it cannot trust", () => {
    render(<TaskDestinationChoice token="tok" question={{ ...view, pictureUrl: null, objectLabel: "<b>x</b>" }} onAnswered={() => undefined} />);
    expect(screen.getByText("We will test moving the object to the place your job names.")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(isDestinationChoice(view)).toBe(true);
    expect(isDestinationChoice({ ...view, pictureUrl: "https://example.com/x.png" })).toBe(false);
    expect(isDestinationChoice({ ...view, candidates: [view.candidates[0]] })).toBe(false);
    expect(isDestinationChoice({ ...view, candidates: [{ id: "p0123456789abcdef", place: "made_up" }, view.candidates[1]] })).toBe(false);
  });
});
