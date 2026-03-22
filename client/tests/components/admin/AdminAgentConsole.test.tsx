import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminAgentConsole from "@/components/admin/AdminAgentConsole";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

function renderConsole() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminAgentConsole />
    </QueryClientProvider>,
  );
}

describe("AdminAgentConsole", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/admin/agent/sessions" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              sessions: [
                {
                  id: "session-1",
                  task_kind: "operator_thread",
                  provider: "openai_responses",
                  runtime: "openai_responses",
                  status: "idle",
                  title: "Ops thread",
                  session_key: "session:1",
                  created_at: "2026-03-21T10:00:00.000Z",
                  updated_at: "2026-03-21T10:00:00.000Z",
                  metadata: {
                    startupContext: {
                      repoDocPaths: ["docs/ops-automation-analysis-2026.md"],
                      blueprintIds: ["bp-1"],
                      documentIds: ["doc-1"],
                      externalSources: [],
                      operatorNotes: "Key launch checklist attached.",
                    },
                  },
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/agent/context/options") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              repoDocs: ["docs/ops-automation-analysis-2026.md"],
              blueprints: [{ id: "bp-1", name: "Demo Blueprint" }],
              opsDocuments: [
                {
                  id: "doc-1",
                  title: "Launch SOP",
                  sourceFileUri: "gs://docs/launch-sop.pdf",
                  blueprintIds: ["bp-1"],
                  startupPackIds: [],
                  extractionStatus: "completed",
                  indexingStatus: "completed",
                  createdAt: "2026-03-21T09:00:00.000Z",
                  updatedAt: "2026-03-21T09:00:00.000Z",
                },
              ],
              startupPacks: [],
              externalSourceTypes: ["manual_url_reference"],
            }),
          ),
        );
      }
      if (url === "/api/admin/agent/runtime/connectivity") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              connectivity: {
                provider: "openai_responses",
                configured: true,
                auth_configured: true,
                timeout_ms: 20000,
                default_model: "gpt-5.4",
                task_models: {},
              },
            }),
          ),
        );
      }
      if (url === "/api/admin/agent/runtime/smoke-test") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              smokeTest: {
                ok: true,
                duration_ms: 842,
                final: {
                  status: "completed",
                  provider: "openai_responses",
                  result: {
                    reply: "Agent runtime smoke test passed.",
                  },
                },
              },
            }),
          ),
        );
      }
      if (url === "/api/admin/agent/sessions/session-1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              session: {
                id: "session-1",
                task_kind: "operator_thread",
                provider: "openai_responses",
                runtime: "openai_responses",
                status: "idle",
                title: "Ops thread",
                session_key: "session:1",
                created_at: "2026-03-21T10:00:00.000Z",
                updated_at: "2026-03-21T10:00:00.000Z",
                metadata: {
                  startupContext: {
                      repoDocPaths: ["docs/ops-automation-analysis-2026.md"],
                      blueprintIds: ["bp-1"],
                      documentIds: ["doc-1"],
                      externalSources: [],
                      operatorNotes: "Key launch checklist attached.",
                    },
                },
              },
            }),
          ),
        );
      }
      if (url === "/api/admin/agent/sessions/session-1/runs") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              runs: [
                {
                  id: "run-1",
                  session_id: "session-1",
                  task_kind: "operator_thread",
                  provider: "openai_responses",
                  runtime: "openai_responses",
                  model: "openai/gpt-5.4",
                  status: "pending_approval",
                  dispatch_mode: "collect",
                  input: {},
                  output: { reply: "Need approval." },
                  approval_reason: "Sensitive actions require approval: payout",
                  requires_human_review: true,
                  created_at: "2026-03-21T10:02:00.000Z",
                  updated_at: "2026-03-21T10:02:00.000Z",
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/agent/runs/run-1/approve") {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, run: { id: "run-1" } })));
      }
      if (url === "/api/admin/agent/sessions/session-1/messages") {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, queued: false })));
      }
      if (url === "/api/admin/agent/sessions" && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              session: {
                id: "session-2",
                task_kind: "operator_thread",
                provider: "openai_responses",
                runtime: "openai_responses",
                status: "idle",
                title: "New session",
                session_key: "session:2",
                created_at: "2026-03-21T11:00:00.000Z",
                updated_at: "2026-03-21T11:00:00.000Z",
              },
            }),
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders sessions, attached context, and can check runtime plus send/approve runs", async () => {
    renderConsole();

    expect((await screen.findAllByText(/Ops thread/i)).length).toBeGreaterThan(0);
    const selectedSessionCard = await screen.findByRole("heading", { name: /Selected session/i });
    const selectedSessionPanel = selectedSessionCard.parentElement;
    expect(selectedSessionPanel).not.toBeNull();
    expect(
      within(selectedSessionPanel as HTMLElement).getByText(
        /docs\/ops-automation-analysis-2026\.md/i,
      ),
    ).toBeInTheDocument();
    expect((await screen.findAllByText(/Provider: openai_responses/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Sensitive actions require approval/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Run smoke test/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/agent/runtime/smoke-test",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect((await screen.findAllByText(/Provider: openai_responses/i)).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText(/Send a message into this agent session/i), {
      target: { value: "Summarize the latest ops status." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/agent/sessions/session-1/messages",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Approve/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/agent/runs/run-1/approve",
        expect.objectContaining({ method: "POST" }),
      );
    });
  }, 15000);
});
