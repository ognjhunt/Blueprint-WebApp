import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWebSearchToolHandler,
  webSearch,
} from "./web-search.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web search providers", () => {
  it("supports unauthenticated Parallel Search MCP for web-search", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      result: {
        structuredContent: {
          search_id: "search_1",
          session_id: "blueprint-paperclip",
          results: [
            {
              url: "https://example.com/source",
              title: "Source",
              excerpts: ["Useful source excerpt."],
            },
          ],
        },
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await webSearch(
      { provider: "parallel_mcp" },
      "latest robotics simulation market signal",
    );

    expect(result.citations).toEqual(["https://example.com/source"]);
    expect(result.answer).toContain("Useful source excerpt.");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://search.parallel.ai/mcp",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json, text/event-stream",
        }),
      }),
    );
  });

  it("supports Parallel MCP web-fetch through the shared handler", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      result: {
        structuredContent: {
          extract_id: "extract_1",
          session_id: "blueprint-paperclip",
          results: [
            {
              url: "https://example.com/contact",
              title: "Contact",
              excerpts: ["Contact page excerpt."],
            },
          ],
          errors: [],
        },
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const tools = buildWebSearchToolHandler({ provider: "parallel_mcp" });
    const result = await tools["web-fetch"]({
      urls: ["https://example.com/contact"],
      objective: "Verify company contact page",
    });

    expect(result.citations).toEqual(["https://example.com/contact"]);
    expect(result.answer).toContain("Contact page excerpt.");
  });
});
