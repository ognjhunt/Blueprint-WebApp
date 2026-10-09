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

describe("current source recheck before video generation", () => {
  it.each(["STATIC", "AGENTIC"] as const)("rechecks %s source without a token-count budget prerequisite and freezes generation", async processingMode => {
    const request: any = { ...input, processingMode, samplingFps: 2 };
    const beforeGenerate = vi.fn(async () => { request.prompt = "changed"; request.model = "changed-model"; });
    request.beforeGenerate = beforeGenerate;
    const underlying = gemini(() => reply([...trace, { text: "{}" }]));
    const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes(":countTokens")) throw new Error("unexpected_budget_prerequisite");
      if (url.includes(":generateContent")) expect(beforeGenerate).toHaveBeenCalledTimes(1);
      return underlying(url, init);
    });
    await analyseAgenticVideo(request, fetcher, noSleep);
    const generated = fetcher.mock.calls.find(([url]) => url.includes(":generateContent"))!;
    expect(generated[0]).toContain(`${input.model}:generateContent`);
    expect(JSON.parse(String(generated[1].body)).contents[0].parts[0].text).toBe(input.prompt);
    expect(callsTo(fetcher, url => url.includes(":countTokens"))).toHaveLength(0);
    expect(callsTo(fetcher, (url, init) => url.endsWith("/files/abc") && init.method === "DELETE")).toHaveLength(1);
  });
  it.each(["STATIC", "AGENTIC"] as const)("refuses withdrawn %s evidence before generation and cleans up", async processingMode => {
    const beforeGenerate = vi.fn(async () => { throw new Error("source_withdrawn"); });
    const fetcher = gemini(() => reply([...trace, { text: "{}" }]));
    await expect(analyseAgenticVideo({ ...input, processingMode, beforeGenerate }, fetcher, noSleep)).rejects.toThrow("source_withdrawn");
    expect(beforeGenerate).toHaveBeenCalledTimes(1);
    expect(callsTo(fetcher, url => url.includes(":generateContent"))).toHaveLength(0);
    expect(callsTo(fetcher, (url, init) => url.endsWith("/files/abc") && init.method === "DELETE")).toHaveLength(1);
  });
});

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
    const uploadBody = (upload[1] as RequestInit).body;
    expect(uploadBody).toBeInstanceOf(ReadableStream);
    // Construct the request without sending it: stream extraction retains the
    // same body, whereas fetch copies a Buffer body before any network I/O.
    const uploadRequest = new Request(UPLOAD_URL, upload[1] as RequestInit);
    expect(uploadRequest.body).toBe(uploadBody);
    const reader = uploadRequest.body!.getReader();
    const uploadedHash = createHash("sha256");
    let uploadedBytes = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      expect(value.byteLength).toBeLessThanOrEqual(64 * 1024);
      expect(value.buffer).toBe(bytes.buffer);
      expect(value.byteOffset).toBe(bytes.byteOffset + uploadedBytes);
      uploadedHash.update(value);
      uploadedBytes += value.byteLength;
    }
    expect(uploadedBytes).toBe(bytes.byteLength);
    expect(uploadedHash.digest("hex")).toBe(createHash("sha256").update(bytes).digest("hex"));
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

  it("cancels an undeclared clip at the first overflowing chunk without reading later data", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let pulls = 0, cancellations = 0, reachedEof = false, readLaterSentinel = false;
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls === 66) { reachedEof = true; controller.close(); return; }
        pulls++;
        if (pulls === 66) readLaterSentinel = true;
        controller.enqueue(chunk);
      },
      cancel() { cancellations++; },
    }, { highWaterMark: 0 }), { headers: { "content-type": "video/mp4" } });
    const arrayBuffer = vi.spyOn(response, "arrayBuffer");
    const fetcher = vi.fn(async () => response);
    await expect(openVideo("https://example.com/clip.mp4", fetcher)).rejects.toMatchObject({ code: "video_too_large" });
    expect({ pulls, cancellations, reachedEof, readLaterSentinel, arrayBufferCalls: arrayBuffer.mock.calls.length })
      .toEqual({ pulls: 65, cancellations: 1, reachedEof: false, readLaterSentinel: false, arrayBufferCalls: 0 });
  });

  it("admits exactly 64MiB without a declared length and preserves its bytes and hash", async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(7);
    const expectedHash = createHash("sha256");
    for (let count = 0; count < 64; count++) expectedHash.update(chunk);
    let pulls = 0, cancellations = 0;
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls === 64) { controller.close(); return; }
        pulls++; controller.enqueue(chunk);
      },
      cancel() { cancellations++; },
    }, { highWaterMark: 0 }), { headers: { "content-type": "video/mp4" } });
    const video = await openVideo("https://example.com/clip.mp4", vi.fn(async () => response));
    expect(Buffer.isBuffer(video.body)).toBe(true);
    expect(video.byteLength).toBe(64 * 1024 * 1024);
    expect(createHash("sha256").update(video.body as Buffer).digest("hex")).toBe(expectedHash.copy().digest("hex"));
    expect(video.receipt()).toEqual({ bytes: 64 * 1024 * 1024, sha256: expectedHash.digest("hex") });
    expect(pulls).toBe(64); expect(cancellations).toBe(0);
  });

  it("reports an empty undeclared body without a grant of usable evidence", async () => {
    await expect(openVideo("https://example.com/clip.mp4", vi.fn(async () => new Response(null, {
      headers: { "content-type": "video/mp4" },
    })))).rejects.toMatchObject({ code: "video_empty" });
  });

  it("preserves admitted bytes when an undeclared source reuses its chunk buffer", async () => {
    const chunk = new Uint8Array([1, 2, 3, 4]);
    let pulls = 0;
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(chunk);
        else { chunk.fill(9); controller.close(); }
      },
    }, { highWaterMark: 0 }), { headers: { "content-type": "video/mp4" } });
    const video = await openVideo("https://example.com/clip.mp4", vi.fn(async () => response));
    expect(video.body).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(video.receipt().sha256).toBe(createHash("sha256").update(video.body as Buffer).digest("hex"));
  });

  it("returns the oversized error and aborts transport when cancellation never settles", async () => {
    let signal: AbortSignal | null | undefined;
    let cancellations = 0;
    let pulls = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls === 66) { controller.close(); return; }
        pulls++; controller.enqueue(chunk);
      },
      cancel() { cancellations++; return new Promise<void>(() => {}); },
    }, { highWaterMark: 0 }), { headers: { "content-type": "video/mp4" } });
    const fetcher = vi.fn(async (_url: string, init: RequestInit = {}) => { signal = init.signal; return response; });
    const outcome = openVideo("https://example.com/clip.mp4", fetcher).then(
      () => ({ code: "unexpected_success" }),
      (error: { code: string }) => ({ code: error.code }),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([outcome, new Promise<{ code: string }>(resolve => {
        timer = setTimeout(() => resolve({ code: "cancellation_stalled" }), 500);
      })]);
      expect(result).toEqual({ code: "video_too_large" });
      expect(cancellations).toBe(1);
      expect(pulls).toBe(65);
      expect(signal?.aborted).toBe(true);
    } finally { clearTimeout(timer); }
  });

  it.each(["Error", "AbortError"])("preserves an undeclared body %s diagnosis", async name => {
    const error = new Error("fixture source read failed"); error.name = name;
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.error(error); },
    }, { highWaterMark: 0 }), { headers: { "content-type": "video/mp4" } });
    await expect(openVideo("https://example.com/clip.mp4", vi.fn(async () => response)))
      .rejects.toMatchObject({ code: name === "AbortError" ? "video_fetch_timeout" : "video_fetch_failed" });
  });

  it("preserves the oversized error when source cancellation also fails", async () => {
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(64 * 1024 * 1024 + 1)); },
      cancel() { throw new Error("fixture cancellation failed"); },
    }, { highWaterMark: 0 }), { headers: { "content-type": "video/mp4" } });
    await expect(openVideo("https://example.com/clip.mp4", vi.fn(async () => response)))
      .rejects.toMatchObject({ code: "video_too_large" });
  });

  it("retains the original 60-second fetch timeout while an undeclared body stalls", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn(async (_url: string, init: RequestInit = {}) => new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          init.signal!.addEventListener("abort", () => {
            const error = new Error("fixture aborted"); error.name = "AbortError"; controller.error(error);
          }, { once: true });
        },
      }, { highWaterMark: 0 }), { headers: { "content-type": "video/mp4" } }));
      const rejected = expect(openVideo("https://example.com/clip.mp4", fetcher)).rejects.toMatchObject({ code: "video_fetch_timeout" });
      await vi.advanceTimersByTimeAsync(60_000);
      await rejected;
    } finally { vi.useRealTimers(); }
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
