// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("runway utils", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "openrouter-test-key");
    vi.stubEnv("VITE_PUBLIC_APP_URL", "https://blueprint.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("submits OpenRouter image-to-video jobs with the Seedance default", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "video-job-1",
          status: "pending",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { startRunwayImageToVideoTask } = await import("../utils/runway");
    const task = await startRunwayImageToVideoTask({
      promptText: "Create a proof-led warehouse clip.",
      promptImage: "data:image/png;base64,AAA",
      ratio: "1280:720",
      duration: 6,
    });

    expect(task).toMatchObject({
      id: "video-job-1",
      status: "PENDING",
      model: "bytedance/seedance-2.0-fast",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/videos");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer openrouter-test-key",
      "Content-Type": "application/json",
      Accept: "application/json",
      "HTTP-Referer": "https://blueprint.test",
      "X-Title": "Blueprint-WebApp",
    });

    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "bytedance/seedance-2.0-fast",
      prompt: "Create a proof-led warehouse clip.",
      size: "1280x720",
      duration: 6,
      generate_audio: false,
    });
    expect(body.frame_images).toEqual([
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,AAA" },
        frame_type: "first_frame",
      },
    ]);
  });

  it("maps OpenRouter polling responses onto the existing task record shape", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "video-job-2",
          status: "completed",
          unsigned_urls: ["https://openrouter.ai/api/v1/videos/video-job-2/content?index=0"],
          progress: 1,
          model: "bytedance/seedance-2.0-fast",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { getRunwayTask } = await import("../utils/runway");
    const task = await getRunwayTask("video-job-2");

    expect(task).toMatchObject({
      id: "video-job-2",
      status: "SUCCEEDED",
      progress: 1,
      model: "bytedance/seedance-2.0-fast",
      output: ["https://openrouter.ai/api/v1/videos/video-job-2/content?index=0"],
    });
  });
});
