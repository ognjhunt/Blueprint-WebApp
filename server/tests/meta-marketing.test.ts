// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

function okJson(payload: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify(payload);
    },
  } satisfies Pick<Response, "ok" | "status" | "text">;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("meta marketing draft writer", () => {
  it("creates paused campaign, ad set, and ad payloads", async () => {
    vi.stubEnv("META_MARKETING_API_ACCESS_TOKEN", "meta-token");
    vi.stubEnv("META_PAGE_ID", "page_1");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okJson({ id: "cmp_1" }))
      .mockResolvedValueOnce(okJson({ id: "adset_1" }))
      .mockResolvedValueOnce(okJson({ id: "ad_1" }));

    const { createPausedMetaDraft } = await import("../utils/meta-marketing");
    const result = await createPausedMetaDraft(
      {
        accountId: "123",
        campaignName: "Blueprint Capturer Test",
        objective: "OUTCOME_TRAFFIC",
        dailyBudgetMinorUnits: 2500,
        primaryText: "Illustrative capturer concept ad.",
        headline: "Capture public indoor spaces",
        videoId: "vid_1",
        destinationUrl: "https://tryblueprint.io/capture",
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({
      campaignId: "cmp_1",
      adSetId: "adset_1",
      adId: "ad_1",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/campaigns");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/adsets");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/ads");

    const campaignBody = String((fetchMock.mock.calls[0]?.[1] as RequestInit)?.body || "");
    const adSetBody = String((fetchMock.mock.calls[1]?.[1] as RequestInit)?.body || "");
    const adBody = String((fetchMock.mock.calls[2]?.[1] as RequestInit)?.body || "");

    expect(campaignBody).toContain("status=PAUSED");
    expect(adSetBody).toContain("status=PAUSED");
    expect(adBody).toContain("status=PAUSED");
  });
});
