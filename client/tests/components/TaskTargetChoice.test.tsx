import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskTargetChoice } from "@/components/site/TaskTargetChoice";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));
const question = { questionDigest: `sha256:${"1".repeat(64)}`, semanticLabel: "Tote", candidates: [
  { id: "c0123456789abcdef", label: "Tote 1: left side, center of the view", referenceTimeMs: 4000 },
  { id: "cfedcba9876543210", label: "Tote 2: right side, center of the view", referenceTimeMs: null }] };

describe("TaskTargetChoice", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("asks one question with the found objects and None of these, and posts the bound answer", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, choice: "candidate" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onAnswered = vi.fn();
    render(<TaskTargetChoice token="tok" question={question} onAnswered={onAnswered} />);
    expect(screen.getByRole("heading", { name: "Which object should the robot move?" })).toBeTruthy();
    expect(screen.getByLabelText(/Tote 1: left side, center of the view · at 0:04 in your video/)).toBeTruthy();
    expect(screen.getByLabelText(/None of these/)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    const save = screen.getByRole("button", { name: "Save answer" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Tote 2/));
    fireEvent.click(save);
    await waitFor(() => expect(onAnswered).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/site-task-brief/tok/task-target-choice");
    expect(JSON.parse(String(init.body))).toEqual({ questionDigest: question.questionDigest,
      choice: { kind: "candidate", candidate_id: "cfedcba9876543210" } });
  });
  it("sends None of these as its own answer and shows a refusal without losing the page", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "This question has changed. Refresh your job to see the current one." }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const onAnswered = vi.fn();
    render(<TaskTargetChoice token="tok" question={question} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByLabelText(/None of these/));
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/question has changed/);
    expect(onAnswered).not.toHaveBeenCalled();
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)).choice).toEqual({ kind: "none_of_these" });
  });
});
