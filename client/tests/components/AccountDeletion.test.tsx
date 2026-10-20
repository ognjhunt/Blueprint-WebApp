import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountDeletion from "@/components/AccountDeletion";
const state = vi.hoisted(() => ({ user: { uid: "account-1", email: "owner@example.com", providerData: [{ providerId: "password" }],
  getIdToken: vi.fn(), getIdTokenResult: vi.fn() }, reauthenticate: vi.fn(), popup: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: state.user }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "proof" }) }));
vi.mock("firebase/auth", () => ({ EmailAuthProvider: { credential: vi.fn(() => "credential") }, GoogleAuthProvider: class {}, reauthenticateWithCredential: state.reauthenticate, reauthenticateWithPopup: state.popup }));
function renderFlow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AccountDeletion /></QueryClientProvider>);
  return client;
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const receipt = { id: "deletion_reference", status: "requested", requestedAtIso: "2026-10-19T12:00:00Z", updatedAtIso: "2026-10-19T12:00:00Z", message: "Your request is recorded. This receipt does not confirm deletion." };
beforeEach(() => {
  vi.clearAllMocks(); state.user.getIdToken.mockResolvedValue("auth-token");
  state.user.providerData = [{ providerId: "password" }];
  state.user.getIdTokenResult.mockResolvedValue({ authTime: new Date().toISOString() }); state.reauthenticate.mockResolvedValue({}); state.popup.mockResolvedValue({});
});
afterEach(() => vi.unstubAllGlobals());
describe("account deletion request", () => {
  it("requires confirmation, uses CSRF and auth, and shows a request receipt rather than claiming erasure", async () => {
    const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => json(init?.method === "POST" ? { request: receipt } : { request: null }));
    vi.stubGlobal("fetch", fetch); const client = renderFlow();
    const submit = await screen.findByRole("button", { name: "Request account and data deletion" }); expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm the request"), { target: { value: "DELETE" } });
    fireEvent.click(submit);
    expect(await screen.findByRole("heading", { name: "Deletion requested" })).toBeInTheDocument();
    expect(screen.getByText(/This receipt does not confirm deletion/)).toBeInTheDocument();
    const call = fetch.mock.calls.find(([, init]) => init?.method === "POST");
    expect(call?.[1]).toMatchObject({ body: JSON.stringify({ confirmation: "DELETE" }), headers: { Authorization: "Bearer auth-token", "X-CSRF-Token": "proof" } });
    expect(state.reauthenticate).not.toHaveBeenCalled(); client.clear();
  });
  it("reauthenticates an older password session without sending the password to the app API", async () => {
    state.user.getIdTokenResult.mockResolvedValue({ authTime: "2020-01-01T00:00:00Z" });
    const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => json(init?.method === "POST" ? { request: receipt } : { request: null }));
    vi.stubGlobal("fetch", fetch); const client = renderFlow();
    const submit = await screen.findByRole("button", { name: "Request account and data deletion" });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm the request"), { target: { value: "DELETE" } });
    fireEvent.click(submit); expect(await screen.findByRole("alert")).toHaveTextContent("Enter your current password");
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/Current password/), { target: { value: "test-local-password" } }); fireEvent.click(submit);
    await screen.findByRole("heading", { name: "Deletion requested" });
    expect(state.reauthenticate).toHaveBeenCalledWith(state.user, "credential");
    expect(JSON.stringify(fetch.mock.calls)).not.toContain("test-local-password"); client.clear();
  });
  it("does not submit when sign-in confirmation fails or portray a storage error as success", async () => {
    state.user.getIdTokenResult.mockResolvedValue({ authTime: "2020-01-01T00:00:00Z" });
    state.reauthenticate.mockRejectedValue({ code: "auth/wrong-password" });
    const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => json(init?.method === "POST" ? { error: "Privacy requests are temporarily unavailable." } : { request: null }, init?.method === "POST" ? 503 : 200));
    vi.stubGlobal("fetch", fetch); const client = renderFlow();
    const submit = await screen.findByRole("button", { name: "Request account and data deletion" });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm the request"), { target: { value: "DELETE" } });
    fireEvent.change(screen.getByLabelText(/Current password/), { target: { value: "wrong" } }); fireEvent.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in confirmation did not finish");
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    state.user.getIdTokenResult.mockResolvedValue({ authTime: new Date().toISOString() }); fireEvent.click(submit);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Privacy requests are temporarily unavailable."));
    expect(screen.queryByRole("heading", { name: "Deletion requested" })).not.toBeInTheDocument(); client.clear();
  });
  it("confirms an older Google session through Firebase before submitting", async () => {
    state.user.providerData = [{ providerId: "google.com" }];
    state.user.getIdTokenResult.mockResolvedValue({ authTime: "2020-01-01T00:00:00Z" });
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => json(init?.method === "POST" ? { request: receipt } : { request: null })));
    const client = renderFlow(); const submit = await screen.findByRole("button", { name: "Request account and data deletion" });
    expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm the request"), { target: { value: "DELETE" } }); fireEvent.click(submit);
    await screen.findByRole("heading", { name: "Deletion requested" });
    expect(state.popup).toHaveBeenCalledOnce(); expect(state.user.getIdToken).toHaveBeenCalledWith(true); client.clear();
  });
});
