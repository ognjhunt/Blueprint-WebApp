// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("paperclip project resolution", () => {
  it("matches projects by urlKey when slug is absent", async () => {
    process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID = "company-1";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "project-1",
            name: "Blueprint WebApp",
            slug: null,
            urlKey: "blueprint-webapp",
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { resolvePaperclipProjectId } = await import("../utils/paperclip");
    const projectId = await resolvePaperclipProjectId("blueprint-webapp");

    expect(projectId).toBe("project-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3100/api/companies/company-1/projects",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("caches the agent directory across multiple agent lookups", async () => {
    process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID = "company-1";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "agent-1",
            name: "Growth Lead",
            title: null,
            metadata: { slug: "growth-lead" },
          },
          {
            id: "agent-2",
            name: "City Launch Agent",
            title: null,
            metadata: { slug: "city-launch-agent" },
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { resolvePaperclipAgentId } = await import("../utils/paperclip");
    await expect(resolvePaperclipAgentId("growth-lead")).resolves.toBe("agent-1");
    await expect(resolvePaperclipAgentId("city-launch-agent")).resolves.toBe("agent-2");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3100/api/companies/company-1/agents",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("patches an existing issue without resolving the project directory", async () => {
    process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID = "company-1";

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "http://127.0.0.1:3100/api/companies/company-1/agents") {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: "agent-1",
                name: "Growth Lead",
                title: null,
                metadata: { slug: "growth-lead" },
              },
            ]),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (url === "http://127.0.0.1:3100/api/issues/issue-1" && init?.method === "PATCH") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "issue-1",
              identifier: "BLU-1",
              title: "Launch Sacramento, CA as a bounded city program",
              status: "todo",
              priority: "high",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { upsertPaperclipIssue } = await import("../utils/paperclip");
    const result = await upsertPaperclipIssue({
      projectName: "blueprint-webapp",
      assigneeKey: "growth-lead",
      title: "Launch Sacramento, CA as a bounded city program",
      description: "timing probe",
      priority: "high",
      status: "todo",
      originKind: "city_launch_activation",
      originId: "sacramento-ca",
      existingIssueId: "issue-1",
    });

    expect(result.created).toBe(false);
    expect(result.issue.id).toBe("issue-1");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "http://127.0.0.1:3100/api/companies/company-1/projects",
      expect.anything(),
    );
  });
});
