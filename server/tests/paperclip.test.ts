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
});
