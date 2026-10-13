import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckpointRegistration, runtimesForDelivery } from "@/components/workspace/CheckpointRegistration";
import type { RobotSetup } from "@/types/workspace";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "team-user", getIdToken: async () => "token" }, loading: false }),
}));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }),
}));
vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer token" }),
}));

const setups: RobotSetup[] = [
  { id: "setup-1", name: "Arm", embodiment: "Arm", policyName: "Pack", version: "v2", delivery: "endpoint",
    reference: "https://policy.atlas.example/v2", notes: "", updatedAt: "2026-10-01T00:00:00.000Z" },
  { id: "setup-2", name: "Arm offline", embodiment: "Arm", policyName: "Pack", version: "v1", delivery: "checkpoint",
    reference: "https://weights.atlas.example/v1", notes: "", updatedAt: "2026-10-01T00:00:00.000Z" },
];

let fetchMock: ReturnType<typeof vi.fn>;
let registered: Array<Record<string, unknown>>;
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  registered = [];
  fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      const checkpoint = { checkpointId: "ckpt_1", teamId: "team-1", label: body.label, runtime: body.runtime,
        reference: "https://policy.atlas.example/v2", status: "registered", unrunnableReason: null, createdAtIso: "2026-10-13T00:00:00.000Z" };
      registered.push(checkpoint);
      return json({ ok: true, created: true, checkpoint, message: "Checkpoint registered. Registration does not start an evaluation; Blueprint admits free evaluations." }, 201);
    }
    return json({ teams: [{ teamId: "team-1", name: "Atlas" }], checkpoints: registered, runtimes: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderForm(list: RobotSetup[] = setups) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CheckpointRegistration setups={list} /></QueryClientProvider>);
}

describe("CheckpointRegistration", () => {
  it("maps setup delivery to the runtimes that can run its reference", () => {
    expect(runtimesForDelivery("endpoint")).toEqual(["policy_endpoint", "customer_hosted"]);
    expect(runtimesForDelivery("container")).toEqual(["container_image", "controller_adapter"]);
    expect(runtimesForDelivery("checkpoint")).toEqual([]);
  });

  it("registers a checkpoint for the chosen setup through the session route", async () => {
    renderForm();
    expect(await screen.findByText("No checkpoints registered yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Register policy checkpoint" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reference (from the setup)")).toHaveValue("https://policy.atlas.example/v2");
    expect(screen.getByLabelText("Checkpoint name")).toHaveValue("Pack v2");
    fireEvent.change(screen.getByLabelText("How Blueprint runs it"), { target: { value: "customer_hosted" } });
    fireEvent.submit(screen.getByRole("form", { name: "Register policy checkpoint" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Checkpoint registered.");
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")!;
    expect(post[0]).toBe("/api/workspace/checkpoints");
    expect((post[1] as RequestInit).headers).toMatchObject({ "X-CSRF-Token": "csrf", Authorization: "Bearer token" });
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ setupId: "setup-1", label: "Pack v2", runtime: "customer_hosted" });
    await waitFor(() => expect(screen.getByRole("table")).toHaveTextContent("ckpt_1"));
  });

  it("explains why a downloadable checkpoint setup cannot be registered here", async () => {
    renderForm();
    fireEvent.change(await screen.findByLabelText("Setup"), { target: { value: "setup-2" } });
    expect(screen.getByLabelText("How Blueprint runs it")).toBeDisabled();
    expect(screen.getByText(/Downloadable checkpoints need an uploaded model artifact/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register checkpoint" })).toBeDisabled();
  });

  it("asks for a saved setup first", () => {
    renderForm([]);
    expect(screen.getByText(/Save a setup first/)).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? json({ error: "Robot-team access requires Blueprint approval.", code: "account_invitation_required" }, 403)
      : json({ teams: [], checkpoints: [], runtimes: [] }));
    renderForm();
    fireEvent.submit(await screen.findByRole("form", { name: "Register policy checkpoint" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Robot-team access requires Blueprint approval.");
  });
});
