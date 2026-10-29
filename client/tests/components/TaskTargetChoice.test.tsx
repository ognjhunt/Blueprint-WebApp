import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskTargetChoice } from "@/components/site/TaskTargetChoice";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));
const question = { questionDigest: `sha256:${"1".repeat(64)}`, semanticLabel: "Tote", guessedCandidateId: "cfedcba9876543210",
  candidates: [
    { id: "c0123456789abcdef", label: "Tote 1: left side, center of the view", referenceTimeMs: 4000 },
    { id: "cfedcba9876543210", label: "Tote 2: right side, center of the view", referenceTimeMs: null }] };

function bodyOf(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
}

describe("TaskTargetChoice", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("continues automatically and reveals a bound optional confirmation only when requested", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, choice: "confirm_guess" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onAnswered = vi.fn();
    render(<TaskTargetChoice token="tok" question={question} onAnswered={onAnswered} />);
    expect(screen.getByText(/Preparation continues automatically/)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save answer" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review or correct object selection" }));
    expect(screen.getByLabelText(/No, it is Tote 1: left side, center of the view · at 0:04 in your video/)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    const save = screen.getByRole("button", { name: "Save answer" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Yes, that is the one"));
    fireEvent.click(save);
    await waitFor(() => expect(onAnswered).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/site-task-brief/tok/task-target-choice");
    expect(bodyOf(fetchMock)).toEqual({ questionDigest: question.questionDigest, choice: { kind: "confirm_guess" } });
  });
  it("sends another object as a correction", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, choice: "other_candidate" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TaskTargetChoice token="tok" question={question} onAnswered={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Review or correct object selection" }));
    fireEvent.click(screen.getByLabelText(/No, it is Tote 1/));
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock).choice).toEqual({ kind: "other_candidate", candidate_id: "c0123456789abcdef" });
  });
  it("sends None of these and shows a refusal without losing the page", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "This question has changed. Refresh your job to see the current one." }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const onAnswered = vi.fn();
    render(<TaskTargetChoice token="tok" question={question} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole("button", { name: "Review or correct object selection" }));
    fireEvent.click(screen.getByLabelText(/None of these/));
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/question has changed/);
    expect(onAnswered).not.toHaveBeenCalled();
    expect(bodyOf(fetchMock).choice).toEqual({ kind: "none_of_these" });
  });
});
