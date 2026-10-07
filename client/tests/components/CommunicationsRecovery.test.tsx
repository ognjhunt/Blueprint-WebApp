import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommunicationsRecovery } from "@/components/admin/CommunicationsRecovery";
const auth = vi.hoisted(() => ({ useAuth: vi.fn(), getIdToken: vi.fn(), csrf: vi.fn() }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: auth.csrf }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: auth.useAuth }));
const job = { jobId: "a".repeat(64), prospectId: "canonical-prospect", briefDigest: "b".repeat(64), attempts: 1, reason: "founder_gmail_binding_missing", leaseUntil: 0 };
beforeEach(() => {
  auth.csrf.mockReset().mockImplementation(async (headers: object) => ({ ...headers, "X-CSRF-Token": "mock-csrf" }));
  auth.getIdToken.mockResolvedValue("mock-firebase-token");
  auth.useAuth.mockReturnValue({ currentUser: { uid: "ops-user", getIdToken: auth.getIdToken } });
});

const savedJob = { ...job, state: "blocked", sessionId: "synthetic-original-session", expectedJobDigest: "c".repeat(64), expectedCheckpointDigest: "d".repeat(64) };
const runtime = { sourceCommit: "e".repeat(40), existingProcess: true, providerKeyConfigured: true, headroomAvailable: true,
  outreachControlsOff: true, headroomReserveBytes: 24 * 1024 * 1024,
  memory: { observedAt: "2026-10-07T20:00:00.000Z", rss: 150 * 1024 * 1024, cgroup: { current: 200 * 1024 * 1024, limit: 512 * 1024 * 1024 } } };
const rawOutputSha256 = "f".repeat(64);
function savedTransport(options: { runtime?: object; runtimeError?: number; sourceChanged?: boolean; jobChanged?: boolean; lostAck?: boolean; resultState?: string; compose?: boolean } = {}) {
  let runtimeReads = 0, inventories = 0;
  return vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
    const path = String(url);
    if (path.endsWith("recovery-runtime")) {
      runtimeReads++;
      if (options.runtimeError) return Response.json({ error: "communications_recovery_owner_required" }, { status: options.runtimeError });
      return Response.json({ ...runtime, ...options.runtime, ...(options.sourceChanged && runtimeReads > 1 ? { sourceCommit: "0".repeat(40) } : {}) });
    }
    if (path.endsWith("oauth/status")) return Response.json({ enabled: true, draftScopeGranted: options.compose ?? true, sendsEnabled: false });
    if (path.endsWith("blocked-jobs")) { inventories++; return Response.json({ jobs: [{ ...savedJob, ...(options.jobChanged && inventories > 1 ? { expectedJobDigest: "0".repeat(64) } : {}) }] }); }
    if (path.endsWith("/communications")) return Response.json({ jobs: [{ ...savedJob, state: "pending_approval", ledgerId: `communications_${job.jobId}`,
      outputSource: { rawOutputSha256 }, savedOutputRecovery: { ownerAction: { actorUid: "ops-user", originalJobDigest: savedJob.expectedJobDigest, sourceCommit: runtime.sourceCommit } } }] });
    if (path.endsWith("recover-saved-draft") && init?.method === "POST") {
      if (options.lostAck) throw new Error("synthetic lost acknowledgement");
      return Response.json({ ok: true, state: options.resultState ?? "pending_approval", ledgerId: `communications_${job.jobId}`,
        sent: false, gmailDraftCreated: false, sessionCreated: false, existingProcess: true });
    }
    throw new Error("Unexpected synthetic request " + path);
  });
}
async function prepareSavedRecovery() {
  page(); fireEvent.click(screen.getByRole("button", { name: "Review blocked communications jobs" }));
  fireEvent.click(await screen.findByRole("button", { name: "Check saved-output readiness" }));
  await screen.findByText(/Founder owner access: verified/);
  fireEvent.change(screen.getByRole("textbox", { name: "Original job digest" }), { target: { value: savedJob.expectedJobDigest } });
  fireEvent.change(screen.getByRole("textbox", { name: "Original checkpoint digest" }), { target: { value: savedJob.expectedCheckpointDigest } });
  fireEvent.change(screen.getByRole("textbox", { name: "Reviewed output SHA256" }), { target: { value: rawOutputSha256 } });
}
describe("existing blocked-job saved-output recovery UI", () => {
  it.each(["pending_approval", "no_op"])("uses owner readiness, original pins and refreshed CSRF through the guarded route (%s)", async resultState => {
    const fetchMock = savedTransport({ resultState });
    await prepareSavedRecovery();
    expect(screen.queryByRole("button", { name: "Retry job" })).not.toBeInTheDocument();
    expect(screen.getByText(/Full memory group: 200.0 \/ 512.0 MiB/)).toBeVisible();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
    expect(screen.getByRole("button", { name: "Recover saved output" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Recover saved output" }));
    expect(await screen.findByText(/Saved output for .* is in Approvals/)).toBeVisible();
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe(`/api/admin/outbound-prospects/${job.prospectId}/communications/${job.jobId}/recover-saved-draft`);
    expect(posts[0][1]).toMatchObject({ credentials: "include", redirect: "error", headers: { Authorization: "Bearer mock-firebase-token", "X-CSRF-Token": "mock-csrf", "Content-Type": "application/json" } });
    expect(JSON.parse(posts[0][1]!.body as string)).toEqual({ briefDigest: job.briefDigest, sessionId: savedJob.sessionId,
      expectedJobDigest: savedJob.expectedJobDigest, expectedCheckpointDigest: savedJob.expectedCheckpointDigest, rawOutputSha256, expectedSourceCommit: runtime.sourceCommit });
    expect(auth.csrf).toHaveBeenCalledWith(expect.anything(), { refresh: true });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("recovery-runtime"))).toHaveLength(2);
    expect(fetchMock.mock.calls.some(([url]) => /gmail-draft|\/retry$|\/approve$|\/send$|api.openai.com/.test(String(url)))).toBe(false);
  });
  it.each([{ headroomAvailable: false }, { providerKeyConfigured: false }, { outreachControlsOff: false }])("blocks unavailable runtime readiness without any POST: %j", async value => {
    const fetchMock = savedTransport({ runtime: value }); await prepareSavedRecovery();
    expect(screen.getByRole("checkbox")).toBeDisabled(); expect(screen.getByRole("button", { name: "Recover saved output" })).toBeDisabled();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });
  it("requires existing compose capability and never starts a consent or provider path", async () => {
    const fetchMock = savedTransport({ compose: false }); await prepareSavedRecovery();
    expect(screen.getByRole("checkbox")).toBeDisabled(); expect(screen.getByText(/Compose access: unavailable/)).toBeVisible();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });
  it("preserves an original pin mismatch and does not substitute current hashes", async () => {
    const fetchMock = savedTransport(); await prepareSavedRecovery();
    fireEvent.change(screen.getByRole("textbox", { name: "Original job digest" }), { target: { value: "0".repeat(64) } });
    expect(screen.getByText(/does not match the current record/)).toBeVisible(); expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Original job digest" })).toHaveValue("0".repeat(64));
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });
  it.each([{ sourceChanged: true }, { jobChanged: true }])("checks fresh source and job immediately before mutation: %j", async value => {
    const fetchMock = savedTransport(value); await prepareSavedRecovery();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Recover saved output" }));
    expect(await screen.findByText(/changed.*Check.*before|source changed.*check readiness again/i)).toBeVisible();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });
  it("honors owner denial without fallback or a grant", async () => {
    const fetchMock = savedTransport({ runtimeError: 403 }); page();
    fireEvent.click(screen.getByRole("button", { name: "Review blocked communications jobs" }));
    fireEvent.click(await screen.findByRole("button", { name: "Check saved-output readiness" }));
    expect(await screen.findByText(/communications_recovery_owner_required/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Recover saved output" })).toBeDisabled();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });
  it("reconciles a lost acknowledgement by ordinary read-only job inspection", async () => {
    const fetchMock = savedTransport({ lostAck: true }); await prepareSavedRecovery();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Recover saved output" }));
    expect(await screen.findByText(/synthetic lost acknowledgement/)).toBeVisible();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Check recovery status" }));
    expect(await screen.findByText(/Saved output for .* is in Approvals/)).toBeVisible();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
});
afterEach(() => vi.restoreAllMocks());
function page() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CommunicationsRecovery /></QueryClientProvider>); }
describe("communications recovery in Blueprint", () => {
  it("requires an explicit operator action and posts only canonical identity/digest with CSRF", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (_url, init) => init?.method === "POST"
      ? Response.json({ ok: true, sent: false, sessionCreated: false }) : Response.json({ jobs: [job] }));
    page(); expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review blocked communications jobs" }));
    const button = await screen.findByRole("button", { name: "Retry job" });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/outbound-prospects/communications/blocked-jobs", {
      headers: { Authorization: "Bearer mock-firebase-token", "X-CSRF-Token": "mock-csrf" },
    });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/admin/outbound-prospects/${job.prospectId}/communications/${job.jobId}/retry`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer mock-firebase-token", "X-CSRF-Token": "mock-csrf" }, body: JSON.stringify({ briefDigest: job.briefDigest }),
    }));
  });
  it("does not offer retry while the lease is active or the attempt budget is exhausted", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(Response.json({ jobs: [{ ...job, leaseUntil: Date.now() + 60000 }, { ...job, jobId: "c".repeat(64), attempts: 3 }] }));
    page(); fireEvent.click(screen.getByRole("button", { name: "Review blocked communications jobs" }));
    for (const button of await screen.findAllByRole("button", { name: "Retry job" })) expect(button).toBeDisabled();
  });
  it("does not request or retry private jobs while signed out", () => {
    auth.useAuth.mockReturnValue({ currentUser: null });
    const fetchMock = vi.spyOn(global, "fetch");
    page(); fireEvent.click(screen.getByRole("button", { name: "Review blocked communications jobs" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Retry job" })).not.toBeInTheDocument();
  });
});
