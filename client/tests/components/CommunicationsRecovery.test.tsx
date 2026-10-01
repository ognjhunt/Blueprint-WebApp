import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommunicationsRecovery } from "@/components/admin/CommunicationsRecovery";
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: object) => ({ ...headers, "X-CSRF-Token": "mock-csrf" }) }));
afterEach(() => vi.restoreAllMocks());
const job = { jobId: "a".repeat(64), prospectId: "canonical-prospect", briefDigest: "b".repeat(64), attempts: 1, reason: "founder_gmail_binding_missing", leaseUntil: 0 };
function page() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CommunicationsRecovery /></QueryClientProvider>); }
describe("communications recovery in Blueprint", () => {
  it("requires an explicit operator action and posts only canonical identity/digest with CSRF", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (_url, init) => init?.method === "POST"
      ? Response.json({ ok: true, sent: false, sessionCreated: false }) : Response.json({ jobs: [job] }));
    page(); expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review blocked communications jobs" }));
    const button = await screen.findByRole("button", { name: "Retry job" });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/admin/outbound-prospects/${job.prospectId}/communications/${job.jobId}/retry`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": "mock-csrf" }, body: JSON.stringify({ briefDigest: job.briefDigest }),
    }));
  });
  it("does not offer retry while the lease is active or the attempt budget is exhausted", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(Response.json({ jobs: [{ ...job, leaseUntil: Date.now() + 60000 }, { ...job, jobId: "c".repeat(64), attempts: 3 }] }));
    page(); fireEvent.click(screen.getByRole("button", { name: "Review blocked communications jobs" }));
    for (const button of await screen.findAllByRole("button", { name: "Retry job" })) expect(button).toBeDisabled();
  });
});
