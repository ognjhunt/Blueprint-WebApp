import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FounderMailboxConnection } from "@/components/admin/FounderMailboxConnection";
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: object) => headers }));
const auth = vi.hoisted(() => ({ useAuth: vi.fn(), getIdToken: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: auth.useAuth }));
beforeEach(() => {
  vi.spyOn(window.location, "origin", "get").mockReturnValue("https://tryblueprint.io");
  auth.getIdToken.mockResolvedValue("mock-firebase-token");
  auth.useAuth.mockReturnValue({ currentUser: { uid: "ops-user", getIdToken: auth.getIdToken } });
});
afterEach(() => vi.restoreAllMocks());
function page() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FounderMailboxConnection /></QueryClientProvider>);
}
describe("founder connection preparation in Blueprint review", () => {
  it("loads on owner request using only GET and offers no credential entry or OAuth grant", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url) => String(url).endsWith("/status") ? Response.json({ enabled: false, state: "disabled_or_unconfigured" }) : Response.json({ connection: {
      account: "nijel@tryblueprint.io", binding: { state: "missing" }, oauth: {
        ownerAction: "Inspect the existing registered callback and audience.", initialScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        sendScopeAfterSeparateApproval: "https://www.googleapis.com/auth/gmail.send", dataAccess: "Read access permits mailbox messages and settings.",
      }, secretDestination: { provider: "Render", services: ["Blueprint-WebApp", "blueprint-webapp-worker"], keys: ["BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN"] },
    } }));
    const view = page();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    expect(await screen.findByText(/separate founder binding is missing/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/outbound-prospects/communications/connection", {
      headers: { Authorization: "Bearer mock-firebase-token" },
    });
    expect(screen.getByText(/OAuth initiation is blocked/)).toBeInTheDocument();
    expect(view.container.querySelectorAll("input,textarea,form")).toHaveLength(0);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://console.cloud.google.com/auth/clients");
  });
  it("shows a failed preparation request without offering an alternate connection", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 403 }));
    page(); fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Founder connection preparation is unavailable.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("requires an owner click to prepare the admitted Google consent link", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      if (String(url).endsWith("/status")) return Response.json({ enabled: true, state: "idle", sendsEnabled: false });
      if (String(url).endsWith("/start")) return Response.json({ authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?scope=readonly&state=mock" });
      return Response.json({ connection: { account: "nijel@tryblueprint.io", binding: { state: "missing" }, oauth: {
        ownerAction: "Owner-approved setup", initialScopes: ["gmail.readonly"], sendScopeAfterSeparateApproval: "gmail.send", dataAccess: "Mailbox messages/settings" }, secretDestination: { services: ["Blueprint web", "worker"] } } });
    });
    const view = page(); fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    const start = await screen.findByRole("button", { name: "Prepare Google read-only consent" });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    fireEvent.click(start);
    expect(await screen.findByRole("link", { name: "Continue to Google as founder" })).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(fetchMock).toHaveBeenCalledWith("/api/communications/gmail/oauth/start", expect.objectContaining({ method: "POST", body: "{}", headers: { Authorization: "Bearer mock-firebase-token", "Content-Type": "application/json" } }));
    expect(view.container.querySelectorAll("input,textarea,form")).toHaveLength(0);
  });
  it.each(["idle", "awaiting_owner"])("moves www to the fixed apex preparation page before %s consent actions", async state => {
    vi.spyOn(window.location, "origin", "get").mockReturnValue("https://www.tryblueprint.io");
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async url => String(url).endsWith("/status")
      ? Response.json({ enabled: true, state, sendsEnabled: false })
      : Response.json({ connection: { account: "nijel@tryblueprint.io", binding: { state: "missing" }, oauth: {
        ownerAction: "Owner-approved setup", initialScopes: ["gmail.readonly"], sendScopeAfterSeparateApproval: "gmail.send", dataAccess: "Mailbox messages/settings" }, secretDestination: { services: ["Blueprint web", "worker"] } } }));
    page(); fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    const link = await screen.findByRole("link", { name: "Continue on tryblueprint.io for founder consent" });
    expect(link).toHaveAttribute("href", "https://tryblueprint.io/admin/leads?founder_gmail=prepare");
    expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.queryByRole("button", { name: "Prepare Google read-only consent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify and save founder read-only connection" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
  it("never saves a returned code automatically and confirms read-only persistence separately", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async url => {
      if (String(url).endsWith("/status")) return Response.json({ enabled: true, state: "awaiting_owner", sendsEnabled: false });
      if (String(url).endsWith("/complete")) return Response.json({ state: "connected_readonly", sendsEnabled: false });
      return Response.json({ connection: { account: "nijel@tryblueprint.io", binding: { state: "private_storage_selected_unverified" }, oauth: {
        ownerAction: "Owner-approved setup", initialScopes: ["gmail.readonly"], sendScopeAfterSeparateApproval: "gmail.send", dataAccess: "Mailbox messages/settings" }, secretDestination: { services: ["Blueprint web", "worker"] } } });
    });
    page(); fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    const save = await screen.findByRole("button", { name: "Verify and save founder read-only connection" });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    fireEvent.click(save);
    expect(await screen.findByText(/read-only connection is saved; sending remains disabled/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/communications/gmail/oauth/complete", expect.objectContaining({ method: "POST", body: "{}" }));
  });
  it("does not request private preparation while signed out", () => {
    auth.useAuth.mockReturnValue({ currentUser: null });
    const fetchMock = vi.spyOn(global, "fetch");
    page(); fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["failed", "stale", "unavailable"])("refetches status after failed completion and removes stale Verify and save when status is %s", async refreshed => {
    let statusReads = 0;
    let finishResponse!: (response: Response) => void;
    const pendingCompletion = new Promise<Response>(resolve => { finishResponse = resolve; });
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async url => {
      if (String(url).endsWith("/status")) {
        statusReads++;
        if (statusReads > 1 && refreshed === "unavailable") return new Response(null, { status: 503 });
        return Response.json({ enabled: true, state: statusReads > 1 && refreshed === "failed" ? "failed_requires_new_owner_consent" : "awaiting_owner",
          sendsEnabled: false, ...(statusReads > 1 ? { failureStage: "mailbox_verification" } : {}) });
      }
      if (String(url).endsWith("/complete")) return pendingCompletion;
      return Response.json({ connection: { account: "nijel@tryblueprint.io", binding: { state: "private_storage_selected_unverified" }, oauth: {
        ownerAction: "Owner-approved setup", initialScopes: ["gmail.readonly"], sendScopeAfterSeparateApproval: "gmail.send", dataAccess: "Mailbox messages/settings" }, secretDestination: { services: ["Blueprint web", "worker"] } } });
    });
    page(); fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    const save = await screen.findByRole("button", { name: "Verify and save founder read-only connection" });
    fireEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    fireEvent.click(save);
    finishResponse(Response.json({ error: "founder_oauth_exchange_failed_requires_new_owner_consent", failureStage: "mailbox_verification" }, { status: 503 }));
    expect(await screen.findByText(/This connection attempt failed and cannot be retried/)).toBeInTheDocument();
    await waitFor(() => expect(statusReads).toBe(2));
    expect(screen.queryByRole("button", { name: "Verify and save founder read-only connection" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prepare Google read-only consent" })).not.toBeInTheDocument();
    expect(screen.queryByText(/connection is saved; sending remains disabled/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    expect(screen.queryByRole("button", { name: "Verify and save founder read-only connection" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/complete"))).toHaveLength(1);
    if (refreshed === "failed") expect(screen.getByText(/Failed step: founder mailbox and sender verification/)).toBeInTheDocument();
  });
  it("shows a retained failure on reload without exposing unallowlisted metadata or retrying", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async url => String(url).endsWith("/status")
      ? Response.json({ enabled: true, state: "failed_requires_new_owner_consent", sendsEnabled: false, failureStage: "PRIVATE_REFRESH" })
      : Response.json({ connection: { account: "nijel@tryblueprint.io", binding: { state: "missing" }, oauth: {
        ownerAction: "Owner-approved setup", initialScopes: ["gmail.readonly"], sendScopeAfterSeparateApproval: "gmail.send", dataAccess: "Mailbox messages/settings" }, secretDestination: { services: ["Blueprint web", "worker"] } } }));
    page(); fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    expect(await screen.findByText(/This connection attempt failed and cannot be retried/)).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE_REFRESH/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify and save founder read-only connection" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});
