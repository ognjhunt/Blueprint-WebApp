import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { analyseAgenticVideo, openVideo, runGeminiVideoTask } from "../agents/adapters/gemini-video";
import { captureVideoPrivacyTask } from "../agents/tasks/capture-video-privacy";

const bytes = Buffer.from("fixture-video");
const input = { apiKey: "test-key", model: "gemini-3.8-flash", prompt: "Inspect the task.",
  video: { body: bytes, byteLength: bytes.byteLength, contentType: "video/mp4" } };
const trace = [
  { tool_call: { tool_type: "MEDIA_PROCESSING" } },
  { tool_response: { tool_type: "MEDIA_PROCESSING" } },
];
const reply = (parts: unknown[], finishReason = "STOP") => new Response(JSON.stringify({
  candidates: [{ finishReason, content: { parts } }],
  modelVersion: "gemini-3.8-flash-test", usageMetadata: { totalTokenCount: 17 },
}), { status: 200 });
const UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=u1";
const file = (state: string) => ({ name: "files/abc", uri: "https://generativelanguage.googleapis.com/v1beta/files/abc",
  mimeType: "video/mp4", state });

/** A Files API that is PROCESSING for `processingPolls` status reads, then answers `generate`. */
function gemini(generate: () => Response, processingPolls = 0) {
  let polls = 0;
  return vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith("/upload/v1beta/files")) {
      return new Response("{}", { status: 200, headers: { "x-goog-upload-url": UPLOAD_URL } });
    }
    if (url === UPLOAD_URL) {
      return new Response(JSON.stringify({ file: file(processingPolls ? "PROCESSING" : "ACTIVE") }), { status: 200 });
    }
    if (url.endsWith("/v1beta/files/abc") && (init.method ?? "GET") === "GET") {
      polls += 1;
      return new Response(JSON.stringify(file(polls >= processingPolls ? "ACTIVE" : "PROCESSING")), { status: 200 });
    }
    if (url.endsWith("/v1beta/files/abc") && init.method === "DELETE") return new Response("{}", { status: 200 });
    if (url.includes(":generateContent")) return generate();
    throw new Error(`unexpected ${url}`);
  });
}
const noSleep = async () => undefined;
const callsTo = (fetcher: ReturnType<typeof gemini>, match: (url: string, init: RequestInit) => boolean) =>
  fetcher.mock.calls.filter(([url, init]) => match(url as string, (init ?? {}) as RequestInit));

describe("agentic video provider contract", () => {
  it("uploads through the Files API, waits for it, reads it by reference and deletes it", async () => {
    const fetcher = gemini(() => reply([...trace,
      { thought: true, text: "private reasoning" }, { text: '{"objects":[]}' }]), 2);
    const result = await analyseAgenticVideo(input, fetcher, noSleep);

    const [start] = callsTo(fetcher, (url) => url.endsWith("/upload/v1beta/files"));
    expect(start[1]).toMatchObject({ method: "POST", headers: expect.objectContaining({
      "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": "video/mp4" }) });
    const [upload] = callsTo(fetcher, (url) => url === UPLOAD_URL);
    expect(upload[1]).toMatchObject({ headers: expect.objectContaining({ "X-Goog-Upload-Command": "upload, finalize" }) });
    expect((upload[1] as RequestInit).body).toBe(bytes);
    expect(upload[1]).toMatchObject({ duplex: "half",
      headers: expect.objectContaining({ "Content-Length": String(bytes.byteLength) }) });
    expect(callsTo(fetcher, (url, init) => url.endsWith("/files/abc") && (init.method ?? "GET") === "GET")).toHaveLength(2);

    const [generate] = callsTo(fetcher, (url) => url.includes(":generateContent"));
    expect(generate[0]).toContain("gemini-3.8-flash:generateContent");
    for (const [url] of fetcher.mock.calls) expect(url).not.toContain(input.apiKey);
    const body = JSON.parse((generate[1] as RequestInit).body as string);
    expect(body.contents[0].parts[1]).toEqual({
      file_data: { mime_type: "video/mp4", file_uri: file("ACTIVE").uri },
      media_processing: "AGENTIC",
    });
    expect(JSON.stringify(body)).not.toContain(bytes.toString("base64"));
    expect(callsTo(fetcher, (url, init) => url.endsWith("/files/abc") && init.method === "DELETE")).toHaveLength(1);

    expect(result.text).toBe('{"objects":[]}');
    expect(result.processing).toEqual({ mode: "agentic", media_tool_calls: 1,
      media_tool_responses: 1, model_version: "gemini-3.8-flash-test" });
    expect(result.usage?.totalTokenCount).toBe(17);
  });

  it("accepts the camelCase JSON wire representation of media tool parts", async () => {
    const fetcher = gemini(() => reply([
      { toolCall: { toolType: "MEDIA_PROCESSING" } },
      { toolResponse: { toolType: "MEDIA_PROCESSING" } }, { text: "{}" },
    ]));
    expect((await analyseAgenticVideo(input, fetcher, noSleep)).processing.media_tool_calls).toBe(1);
  });

  it("runs the narrow privacy question in static mode without requiring navigation tools", async () => {
    const fetcher = gemini(() => reply([{ text: '{"decision":"clear","evidence_seconds":[]}' }]));
    const result = await analyseAgenticVideo({ ...input, processingMode: "STATIC", maxOutputTokens: 8_192 }, fetcher, noSleep);
    const [generate] = callsTo(fetcher, (url) => url.includes(":generateContent"));
    const body = JSON.parse((generate[1] as RequestInit).body as string);
    expect(body.contents[0].parts[1].media_processing).toBe("STATIC");
    expect(body.generationConfig.maxOutputTokens).toBe(8_192);
    expect(result.processing).toMatchObject({ mode: "static", media_tool_calls: 0, media_tool_responses: 0 });
    expect(callsTo(fetcher, (url, init) => url.endsWith("/files/abc") && init.method === "DELETE")).toHaveLength(1);
  });

  it("passes the documented fixed frame rate for a static full review", async () => {
    const fetcher = gemini(() => reply([{ text: "{}" }]));
    await analyseAgenticVideo({ ...input, processingMode: "STATIC", samplingFps: 2 }, fetcher, noSleep);
    const [generate] = callsTo(fetcher, (url) => url.includes(":generateContent"));
    const body = JSON.parse((generate[1] as RequestInit).body as string);
    expect(body.contents[0].parts[1]).toMatchObject({
      media_processing: "STATIC", video_metadata: { fps: 2 },
    });
  });

  it("still rejects an incomplete static privacy answer", async () => {
    const fetcher = gemini(() => reply([{ text: '{"decision":"clear"}' }], "MAX_TOKENS"));
    await expect(analyseAgenticVideo({ ...input, processingMode: "STATIC" }, fetcher, noSleep))
      .rejects.toMatchObject({ code: "gemini_video_incomplete" });
  });

  it("keeps a legacy privacy observation informational", async () => {
    const google = gemini(() => reply([{ text: '{"decision":"hold","evidence_seconds":[2]}' }]));
    const fetcher = vi.fn(async (url: string, init: RequestInit = {}) =>
      url === "https://example.com/clip.mp4"
        ? new Response(bytes, { status: 200, headers: { "content-type": "video/mp4",
          "content-length": String(bytes.byteLength) } })
        : google(url, init));
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    try {
      const result = await runGeminiVideoTask({
        kind: "capture_video_privacy", model: "gemini-3.8-flash",
        input: { taskVideoUrl: "https://example.com/clip.mp4" },
        definition: captureVideoPrivacyTask, tool_policy: { mode: "api" },
      } as never);
      expect(result).toMatchObject({ status: "completed", requires_human_review: false,
        output: { decision: "hold", evidence_seconds: [2] },
        artifacts: { video_processing: { mode: "static", media_tool_calls: 0 } } });
      const [generate] = callsTo(google, (url) => url.includes(":generateContent"));
      const body = JSON.parse((generate[1] as RequestInit).body as string);
      expect(body.contents[0].parts[1].media_processing).toBe("STATIC");
      expect(body.generationConfig.maxOutputTokens).toBe(8_192);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it("rejects a plausible answer without observed agentic processing, and still deletes the file", async () => {
    const fetcher = gemini(() => reply([{ text: '{"objects":["box"]}' }]));
    await expect(analyseAgenticVideo(input, fetcher, noSleep)).rejects.toMatchObject({ code: "gemini_video_agentic_trace_missing" });
    expect(callsTo(fetcher, (url) => url.includes(":generateContent"))).toHaveLength(1);
    expect(callsTo(fetcher, (url, init) => url.endsWith("/files/abc") && init.method === "DELETE")).toHaveLength(1);
  });

  it("rejects incomplete answers even when they contain valid JSON and navigation", async () => {
    const fetcher = gemini(() => reply([...trace, { text: "{}" }], "MAX_TOKENS"));
    await expect(analyseAgenticVideo(input, fetcher, noSleep)).rejects.toMatchObject({ code: "gemini_video_incomplete" });
  });

  it("says why an answer was incomplete, without its content", async () => {
    const fetcher = gemini(() => reply([...trace, { text: "private-partial-answer" }], "MAX_TOKENS"));
    const error = await analyseAgenticVideo(input, fetcher, noSleep).catch((caught) => caught as Error);
    expect(error.message).toContain("finishReason=MAX_TOKENS");
    expect(error.message).toContain("totalTokens=17");
    expect(error.message).not.toContain("private-partial-answer");
  });

  it("gives the reasoning and media trace room before the answer", async () => {
    const fetcher = gemini(() => reply([...trace, { text: "{}" }]));
    await analyseAgenticVideo(input, fetcher, noSleep);
    const [generate] = callsTo(fetcher, (url) => url.includes(":generateContent"));
    expect(JSON.parse((generate[1] as RequestInit).body as string).generationConfig.maxOutputTokens).toBe(32_768);
  });

  it("does not retry a provider rejection or expose its potentially sensitive body", async () => {
    const fetcher = gemini(() => new Response("signed-source-url-and-api-key", { status: 400 }));
    await expect(analyseAgenticVideo(input, fetcher, noSleep)).rejects.toThrow("Gemini returned HTTP 400");
    expect(callsTo(fetcher, (url) => url.includes(":generateContent"))).toHaveLength(1);
  });

  it("fails closed when the uploaded file never becomes readable", async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith("/upload/v1beta/files")
      ? new Response("{}", { status: 200, headers: { "x-goog-upload-url": UPLOAD_URL } })
      : new Response(JSON.stringify(url === UPLOAD_URL ? { file: file("PROCESSING") } : file("FAILED")), { status: 200 }));
    await expect(analyseAgenticVideo(input, fetcher, noSleep)).rejects.toMatchObject({ code: "gemini_video_file_failed" });
    expect(fetcher.mock.calls.some(([url]) => String(url).includes(":generateContent"))).toBe(false);
  });

  it("reports an upload the API refused rather than analysing nothing", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 403 }));
    await expect(analyseAgenticVideo(input, fetcher, noSleep)).rejects.toMatchObject({ code: "gemini_video_upload_failed" });
  });
});

describe("opening the clip", () => {
  const clip = Buffer.alloc(300_000, 7);
  const served = (body: Buffer, headers: Record<string, string>) =>
    vi.fn(async () => new Response(new Blob([body]).stream(), { status: 200, headers }));
  const drain = async (body: Buffer | ReadableStream<Uint8Array>) =>
    Buffer.isBuffer(body) ? body : Buffer.from(await new Response(body).arrayBuffer());

  it("streams a clip whose length the link declares, measuring and hashing it on the way", async () => {
    const video = await openVideo("https://storage.googleapis.com/b/walkthrough.mov",
      served(clip, { "content-type": "video/quicktime", "content-length": String(clip.length) }));
    expect(video.body).toBeInstanceOf(ReadableStream);
    expect(video).toMatchObject({ byteLength: clip.length, contentType: "video/quicktime" });
    expect(await drain(video.body)).toEqual(clip);
    expect(video.receipt()).toEqual({ bytes: clip.length,
      sha256: createHash("sha256").update(clip).digest("hex") });
  });

  it("fails the stream when the body is not the length the link declared", async () => {
    const video = await openVideo("https://storage.googleapis.com/b/walkthrough.mov",
      served(clip, { "content-type": "video/quicktime", "content-length": String(clip.length + 10) }));
    await expect(drain(video.body)).rejects.toThrow("shorter than its link declared");
  });

  it("holds a clip of undeclared length in memory, bounded, as before", async () => {
    const video = await openVideo("https://example.com/clip.mp4", served(clip, { "content-type": "video/mp4" }));
    expect(Buffer.isBuffer(video.body)).toBe(true);
    expect(video.byteLength).toBe(clip.length);
    expect(video.receipt().sha256).toBe(createHash("sha256").update(clip).digest("hex"));
  });

  it("reads a stored upload served as generic bytes by its extension, and still refuses a web page", async () => {
    const video = await openVideo("https://storage.googleapis.com/b/scenes/s/captures/c/raw/walkthrough.mov?X-Goog-Signature=x",
      served(clip, { "content-type": "application/octet-stream", "content-length": String(clip.length) }));
    expect(video.contentType).toBe("video/quicktime");
    await drain(video.body);
    await expect(openVideo("https://example.com/share/clip.mov", served(clip, { "content-type": "text/html" })))
      .rejects.toMatchObject({ code: "video_not_directly_readable" });
    await expect(openVideo("https://example.com/download", served(clip, { "content-type": "application/octet-stream" })))
      .rejects.toMatchObject({ code: "video_not_directly_readable" });
  });
});
