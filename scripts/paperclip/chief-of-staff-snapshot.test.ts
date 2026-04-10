import { afterEach, describe, expect, it, vi } from "vitest";

describe("chief of staff snapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("prefers board-safe manager-state for assigned-open scans", async () => {
    const originalArgv = process.argv;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/companies")) {
        return new Response(
          JSON.stringify([
            { id: "company-1", name: "Blueprint Autonomous Operations" },
          ]),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (url.endsWith("/api/plugins/blueprint.automation/actions/manager-state")) {
        const headers = new Headers(init?.headers);
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get("X-Paperclip-Run-Id")).toBe("run-123");

        return new Response(
          JSON.stringify({
            data: {
              summary: {
                openIssueCount: 2,
                blockedIssueCount: 1,
                staleIssueCount: 0,
                recentlyCompletedCount: 4,
                unassignedIssueCount: 1,
                routineAlertCount: 0,
                managedOpenIssueCount: 2,
                activeAgentCount: 7,
                openHandoffCount: 0,
                stuckHandoffCount: 0,
              },
              openIssues: [
                {
                  id: "issue-1",
                  identifier: "BLU-1",
                  title: "Assigned issue",
                  status: "todo",
                  priority: "high",
                  assigneeAgentId: "agent-1",
                  updatedAt: "2026-04-10T20:00:00.000Z",
                },
                {
                  id: "issue-2",
                  identifier: "BLU-2",
                  title: "Unassigned issue",
                  status: "blocked",
                  priority: "medium",
                  assigneeAgentId: null,
                  updatedAt: "2026-04-10T19:00:00.000Z",
                },
              ],
              blockedIssues: [],
              staleIssues: [],
              recentlyCompletedIssues: [],
              unassignedIssues: [],
              managedOpenIssues: [],
              nextActionHints: ["Check assigned issue"],
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (url.endsWith("/api/companies/company-1/issues")) {
        throw new Error("company issue list should not be fetched when manager-state is available");
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PAPERCLIP_API_URL", "http://127.0.0.1:3100");
    vi.stubEnv("PAPERCLIP_AGENT_ID", "agent-1");
    vi.stubEnv("PAPERCLIP_RUN_ID", "run-123");

    process.argv = ["node", "chief-of-staff-snapshot.ts", "--assigned-open", "--json"];

    try {
      await import("./chief-of-staff-snapshot.ts");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenCalledTimes(1);

      const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}")) as {
        kind: string;
        agentId: string | null;
        count: number;
        summary: { openIssueCount: number };
        issues: Array<{ identifier: string | null }>;
        nextActionHints: string[];
      };

      expect(payload.kind).toBe("assigned_open");
      expect(payload.agentId).toBe("agent-1");
      expect(payload.count).toBe(1);
      expect(payload.summary.openIssueCount).toBe(2);
      expect(payload.issues).toEqual([
        expect.objectContaining({ identifier: "BLU-1" }),
      ]);
      expect(payload.nextActionHints).toEqual(["Check assigned issue"]);
    } finally {
      process.argv = originalArgv;
    }
  });
});
