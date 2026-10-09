import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JobCommunications } from "../src/pages/AdminRobotTeamAccess";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: null }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: unknown) => headers }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: unknown) => headers }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("existing customer communications assessment handoff — offline", () => {
  it("shows the exact branded draft in a sandbox while delivery remains explicitly reviewed", async () => {
    const html = "<html><body>Blueprint branded question</body></html>";
    const loaded = { context: { recipient: "fixture@example.invalid", assessment: { unknowns: [] } }, contextDigest: "a".repeat(64),
      communications: [{ id: "draft-1", purpose: "question", state: "needs_review", output: { subject: "A question", body: "What final state defines success?" }, outputHtml: html, outputDigest: "b".repeat(64) }], draftingEnabled: true, deliveryEnabled: true };
    const request = vi.fn(async () => ({ ok: true, json: async () => loaded }));
    vi.stubGlobal("fetch", request);
    render(<JobCommunications user={null} requestId="fixture-job" />);
    fireEvent.click(screen.getByText("Load current customer context and drafts"));
    const preview = await screen.findByTitle("Branded customer email preview");
    expect(preview).toHaveAttribute("srcdoc", html);
    expect(preview).toHaveAttribute("sandbox", "");
    expect(screen.getByText("Send exact reviewed agent message")).toBeDisabled();
    expect(request).toHaveBeenCalledTimes(1);
  });
  async function loadFailureState(state: string, failureCode: string | null = "agents_existing_session_history_binding_mismatch") {
    const row = { id: "retained-communication", purpose: "question", state, failureCode,
      output: { subject: "A question", body: "What final state defines success?" },
      ...(state === "sent" ? { sendReceipt: { messageId: "synthetic-sent", threadId: "synthetic-thread", rfcMessageId: "<observed@example.invalid>" }, answerReceived: true } : {}) };
    const loaded = { context: { recipient: "fixture@example.invalid", assessment: { unknowns: [] } }, contextDigest: "a".repeat(64),
      communications: [row], draftingEnabled: false, deliveryEnabled: false };
    const request = vi.fn(async () => ({ ok: true, json: async () => loaded }));
    vi.stubGlobal("fetch", request);
    render(<JobCommunications user={null} requestId="fixture-job" />);
    fireEvent.click(screen.getByText("Load current customer context and drafts"));
    await screen.findByText(`question: ${state}`);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]).toEqual([expect.stringMatching(/\/communications$/), expect.objectContaining({ method: "GET" })]);
    return row;
  }
  it.each(["needs_review", "needs_context", "send_claimed", "send_ack_unknown", "sent"])("retains a previous draft error as history after advancing to %s", async state => {
    const row = await loadFailureState(state);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const disclosure = screen.getByText("Previous draft issue").closest("details")!;
    expect(disclosure).not.toHaveAttribute("open");
    expect(disclosure).toHaveTextContent(row.failureCode!);
    expect(screen.getByRole("heading", { name: `question: ${state}` })).toBeInTheDocument();
    expect(row.failureCode).toBe("agents_existing_session_history_binding_mismatch");
    if (state === "sent") expect(screen.getByText("Read customer replies into this job")).toBeEnabled();
    if (state === "needs_review") expect(screen.getByText("Send exact reviewed agent message")).toBeDisabled();
  });
  it.each(["draft_requires_recovery", "drafting", "unrecognized_state"])("keeps the retained failure visible as an alert in unresolved %s", async state => {
    await loadFailureState(state);
    expect(screen.getByRole("alert")).toHaveTextContent("agents_existing_session_history_binding_mismatch");
    expect(screen.queryByText("Previous draft issue")).not.toBeInTheDocument();
  });
  it("shows no failure disclosure or alert when no failure was retained", async () => {
    await loadFailureState("sent", null);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Previous draft issue")).not.toBeInTheDocument();
  });
  it("lets an operator use the current question without drafting or sending on load", async () => {
    const question = "Question to resolve: What final state defines success? Decision consequence remains unverified.";
    const loaded = { context: { recipient: "fixture@example.invalid", assessment: { unknowns: [question] } },
      contextDigest: "a".repeat(64), communications: [], draftingEnabled: true, deliveryEnabled: true };
    const request = vi.fn(async () => ({ ok: true, json: async () => loaded }));
    vi.stubGlobal("fetch", request);
    render(<JobCommunications user={null} requestId="fixture-job" />);
    fireEvent.click(screen.getByText("Load current customer context and drafts"));
    await screen.findByText("Use this question in the agent draft");
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "coordination" } });
    fireEvent.click(screen.getByText("Use this question in the agent draft"));
    expect(screen.getByLabelText("Purpose")).toHaveValue("question");
    expect((screen.getByLabelText("What the agent should communicate") as HTMLTextAreaElement).value).toContain(question);
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText(/I reviewed this bounded customer context/));
    fireEvent.click(screen.getByText("Prepare agent draft for review"));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    const [url, options] = request.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/communications\/draft$/);
    expect(JSON.parse(String(options.body))).toMatchObject({ purpose: "question", expectedContextDigest: loaded.contextDigest,
      reviewedCustomerContext: true, instruction: expect.stringContaining(question) });
    expect(request.mock.calls.some(([url]) => String(url).includes("approve-send"))).toBe(false);
  });
});
