import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FounderMailboxConnection } from "@/components/admin/FounderMailboxConnection";
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: object) => headers }));
afterEach(() => vi.restoreAllMocks());
function page() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FounderMailboxConnection /></QueryClientProvider>);
}
describe("founder connection preparation in Blueprint review", () => {
  it("loads on owner request using only GET and offers no credential entry or OAuth grant", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(Response.json({ connection: {
      account: "nijel@tryblueprint.io", binding: { state: "missing" }, oauth: {
        ownerAction: "Inspect the existing registered callback and audience.", initialScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        sendScopeAfterSeparateApproval: "https://www.googleapis.com/auth/gmail.send", dataAccess: "Read access permits mailbox messages and settings.",
      }, secretDestination: { provider: "Render", services: ["Blueprint-WebApp", "blueprint-webapp-worker"], keys: ["BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN"] },
    } }));
    const view = page();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Prepare founder mailbox" }));
    expect(await screen.findByText(/separate founder binding is missing/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/outbound-prospects/communications/connection", { headers: {} });
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
});
