import { describe, expect, it, vi } from "vitest";
import { analyseAgenticVideo, streamedRequestBody } from "../agents/adapters/gemini-video";

const input = { apiKey: "test-key", model: "gemini-3.8-flash", prompt: "Inspect the task.",
  bytes: Buffer.from("fixture-video"), contentType: "video/mp4" };
const trace = [
  { tool_call: { tool_type: "MEDIA_PROCESSING" } },
  { tool_response: { tool_type: "MEDIA_PROCESSING" } },
];
const reply = (parts: unknown[], finishReason = "STOP") => new Response(JSON.stringify({
  candidates: [{ finishReason, content: { parts } }],
  modelVersion: "gemini-3.8-flash-test", usageMetadata: { totalTokenCount: 17 },
}), { status: 200 });

describe("agentic video provider contract", () => {
  it("requests agentic navigation and retains its evidence without thought text", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply([...trace,
      { thought: true, text: "private reasoning" }, { text: '{"objects":[]}' }]));
    const result = await analyseAgenticVideo(input, fetcher);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toContain("gemini-3.8-flash:generateContent");
    expect(url).not.toContain(input.apiKey);
    expect(request.body).toBeInstanceOf(ReadableStream);
    expect(request.duplex).toBe("half");
    const body = JSON.parse(await new Response(request.body).text());
    expect(body.contents[0].parts[1]).toEqual({
      inline_data: { mime_type: "video/mp4", data: input.bytes.toString("base64") },
      media_processing: "AGENTIC",
    });
    expect(result.text).toBe('{"objects":[]}');
    expect(result.processing).toEqual({ mode: "agentic", media_tool_calls: 1,
      media_tool_responses: 1, model_version: "gemini-3.8-flash-test" });
    expect(result.usage?.totalTokenCount).toBe(17);
  });

  it("accepts the camelCase JSON wire representation of media tool parts", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply([
      { toolCall: { toolType: "MEDIA_PROCESSING" } },
      { toolResponse: { toolType: "MEDIA_PROCESSING" } }, { text: "{}" },
    ]));
    expect((await analyseAgenticVideo(input, fetcher)).processing.media_tool_calls).toBe(1);
  });

  it("rejects a plausible answer without observed agentic processing", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply([{ text: '{"objects":["box"]}' }]));
    await expect(analyseAgenticVideo(input, fetcher)).rejects.toMatchObject({ code: "gemini_video_agentic_trace_missing" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects incomplete answers even when they contain valid JSON and navigation", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply([...trace, { text: "{}" }], "MAX_TOKENS"));
    await expect(analyseAgenticVideo(input, fetcher)).rejects.toMatchObject({ code: "gemini_video_incomplete" });
  });

  it("does not retry a provider rejection or expose its potentially sensitive body", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("signed-source-url-and-api-key", { status: 400 }));
    await expect(analyseAgenticVideo(input, fetcher)).rejects.toThrow("Gemini returned HTTP 400");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("streams a multi-chunk video as exactly the JSON a single string would have been", async () => {
    // Longer than one chunk and not a multiple of 3, so a padding bug at a
    // chunk boundary would corrupt the base64 the model receives.
    const bytes = Buffer.alloc(3 * 256 * 1024 * 2 + 7);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 31 + 7) % 256;
    const stream = streamedRequestBody("Inspect the task.", bytes, "video/quicktime");
    const chunks: Uint8Array[] = [];
    for (const reader = stream.getReader(); ;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    expect(chunks.length).toBeGreaterThan(3);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    expect(body.contents[0].parts[0]).toEqual({ text: "Inspect the task." });
    expect(body.contents[0].parts[1]).toEqual({
      inline_data: { mime_type: "video/quicktime", data: bytes.toString("base64") },
      media_processing: "AGENTIC",
    });
    expect(body.generationConfig).toEqual({ responseMimeType: "application/json", temperature: 0, maxOutputTokens: 8192 });
  });
});
