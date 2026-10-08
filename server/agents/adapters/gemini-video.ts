/**
 * Native video understanding, as an agent-runtime provider.
 *
 * ## Why an adapter and not a helper
 *
 * Because the safety value in this repo is not in the model call — it is in
 * everything `runAgentTask` wraps around one: the pre-run cost stop, the rolling
 * spend guardrail, run persistence, checkpoints, runtime events, dedupe
 * fingerprints and outcome grading. A standalone `analyseVideo()` utility would
 * sit outside all of it. Registering as a provider means video inference is
 * budgeted, logged and replayable exactly like every other lane.
 *
 * ## Why Gemini specifically
 *
 * It is the only provider in this stack whose API ingests video directly. The
 * others take pre-extracted frames, which loses the two things this lane is for:
 * the audio track, and real elapsed time between frames — and elapsed time is
 * the whole basis of the cycle measurement. Gemini returns timestamps that
 * refer to the actual clip. Agentic requests require a paired media-tool
 * trace; short website reviews use a fixed static frame sample.
 *
 * Gemini is already a provider in this repo. The explicit REST request retains
 * media-processing fields unsupported by the older text SDK dependency.
 *
 * ## Fetching the footage
 *
 * Sites give us a link and keep custody. That link is fetched here, in the
 * worker, bounded by size and content type, and the bytes are handed to the
 * model through its Files API, deleted there once read, and then dropped. Nothing is copied into Blueprint storage: the
 * site revokes by unsharing, exactly as `taskVideoField` promises, and that
 * promise stays true only if we never keep a second copy.
 */
import { reserveCaptureCoverageInference } from "../../utils/captureCoverageInferenceBudget";
import { createHash } from "node:crypto";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";
import { getCompanyHistoryAccess, openAiResponsesHistoryTools, runOperatorTool } from "../operator-tools";
import { digest } from "../../research-learning/contract";
import { outputCorrectionEvidence, outputCorrectionPrompt, usageCount } from "./output-correction";

/** Bounds what the worker holds in memory; the Files API itself takes far more. */
const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;
const ANALYSIS_TIMEOUT_MS = 5 * 60_000;
const MAX_OUTPUT_TOKENS = 32_768;

interface VideoResponsePart {
  text?: string;
  thought?: boolean;
  toolCall?: { toolType?: string };
  toolResponse?: { toolType?: string };
  tool_call?: { tool_type?: string };
  tool_response?: { tool_type?: string };
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
}

const GEMINI_API = "https://generativelanguage.googleapis.com";
const FILE_ACTIVE_TIMEOUT_MS = 3 * 60_000;
const FILE_POLL_INTERVAL_MS = 2_000;

type UploadedVideo = { name: string; uri: string; mimeType: string };

/**
 * Hand the clip to Gemini's Files API and wait until it can be read.
 *
 * The Pipeline's working Gemini video lanes all go this way; sending a phone
 * clip inline never completed in production (the 60MB dishwasher upload sat
 * until the analysis timeout). The file is deleted once the analysis is done,
 * so the only copy that outlives the call is the one the site uploaded to us.
 */
/**
 * The clip as it goes to Gemini. A body whose length the link declared is a
 * stream, piped from storage into the upload without ever being held: on the
 * website's 512MB instance a 60MB phone clip held twice (once read, once
 * copied by fetch for the upload) was enough to kill the process.
 */
export interface VideoSource {
  body: Buffer | ReadableStream<Uint8Array>;
  byteLength: number;
  contentType: string;
}

async function uploadVideoFile(input: {
  apiKey: string; video: VideoSource;
}, fetcher: typeof fetch, sleep: (ms: number) => Promise<void>): Promise<UploadedVideo> {
  const start = await fetcher(`${GEMINI_API}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": input.apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(input.video.byteLength),
      "X-Goog-Upload-Header-Content-Type": input.video.contentType,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    body: JSON.stringify({ file: { display_name: "blueprint-site-capture" } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) {
    throw new GeminiVideoError("gemini_video_upload_failed", `Gemini file upload start returned HTTP ${start.status}`);
  }
  const finish = await fetcher(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
      "Content-Type": input.video.contentType,
      // Declared so a streamed body goes out at a fixed length, not chunked.
      "Content-Length": String(input.video.byteLength),
    },
    signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
    body: input.video.body,
    duplex: "half",
  } as RequestInit);
  if (!finish.ok) {
    throw new GeminiVideoError("gemini_video_upload_failed", `Gemini file upload returned HTTP ${finish.status}`);
  }
  let file = ((await finish.json()) as { file?: { name?: string; uri?: string; mimeType?: string; state?: string } }).file;
  const deadline = Date.now() + FILE_ACTIVE_TIMEOUT_MS;
  while (file?.name && file.state !== "ACTIVE") {
    if (file.state === "FAILED") {
      throw new GeminiVideoError("gemini_video_file_failed", "Gemini could not process the uploaded video");
    }
    if (Date.now() >= deadline) {
      throw new GeminiVideoError("gemini_video_file_timeout", "Gemini did not finish processing the uploaded video");
    }
    await sleep(FILE_POLL_INTERVAL_MS);
    const poll = await fetcher(`${GEMINI_API}/v1beta/${file.name}`, {
      headers: { "x-goog-api-key": input.apiKey },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!poll.ok) {
      throw new GeminiVideoError("gemini_video_file_failed", `Gemini file status returned HTTP ${poll.status}`);
    }
    file = (await poll.json()) as typeof file;
  }
  if (!file?.name || !file.uri) {
    throw new GeminiVideoError("gemini_video_upload_failed", "Gemini did not return the uploaded file");
  }
  return { name: file.name, uri: file.uri, mimeType: file.mimeType || input.video.contentType };
}

async function deleteVideoFile(apiKey: string, name: string, fetcher: typeof fetch) {
  // Best effort: the Files API also expires uploads on its own after 48 hours.
  await fetcher(`${GEMINI_API}/v1beta/${name}`, {
    method: "DELETE",
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch(() => undefined);
}

/** Explicit REST fields avoid silently dropping new fields in the old SDK. */
export async function analyseAgenticVideo(input: {
  apiKey: string;
  model: string;
  prompt: string;
  video: VideoSource;
  processingMode?: "AGENTIC" | "STATIC";
  samplingFps?: number;
  maxOutputTokens?: number;
}, fetcher: typeof fetch = fetch, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const video = await uploadVideoFile(input, fetcher, sleep);
  try {
    return await generateFromVideo(input, video, fetcher);
  } finally {
    await deleteVideoFile(input.apiKey, video.name, fetcher);
  }
}

async function generateFromVideo(input: { apiKey: string; model: string; prompt: string;
  processingMode?: "AGENTIC" | "STATIC"; samplingFps?: number; maxOutputTokens?: number },
  video: UploadedVideo, fetcher: typeof fetch) {
  const processingMode = input.processingMode ?? "AGENTIC";
  const response = await fetcher(
    `${GEMINI_API}/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey },
      signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: input.prompt },
          { file_data: { mime_type: video.mimeType, file_uri: video.uri }, media_processing: processingMode,
            ...(processingMode === "STATIC" && input.samplingFps
              ? { video_metadata: { fps: input.samplingFps } } : {}) },
        ] }],
        // Agentic media processing and the model's reasoning spend this budget
        // before the answer does. At 8192 the first real review of a 30s phone
        // clip stopped short of its answer.
        generationConfig: { responseMimeType: "application/json", temperature: 0,
          maxOutputTokens: input.maxOutputTokens ?? MAX_OUTPUT_TOKENS },
      }),
    },
  );
  // Do not include upstream error bodies: they can echo source URLs or tokens.
  if (!response.ok) throw new GeminiVideoError("gemini_video_provider_failed", `Gemini returned HTTP ${response.status}`);
  const payload = await response.json() as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: VideoResponsePart[] } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
    modelVersion?: string;
  };
  const candidate = payload.candidates?.[0];
  const evidence = { text: (candidate?.content?.parts ?? []).filter(part => !part.thought && typeof part.text === "string").map(part => part.text).join("\n"), usage: payload.usageMetadata };
  if (candidate?.finishReason !== "STOP") {
    // The reason and token counts, never content: enough to tell a budget
    // from a safety stop without a second paid call to find out.
    const usage = payload.usageMetadata;
    throw new GeminiVideoError("gemini_video_incomplete",
      `Gemini did not finish the video analysis (finishReason=${candidate?.finishReason ?? "none"}, `
      + `candidatesTokens=${usage?.candidatesTokenCount ?? "?"}, totalTokens=${usage?.totalTokenCount ?? "?"})`, evidence);
  }
  const parts = candidate.content?.parts ?? [];
  const calls = parts.filter((part) =>
    (part.toolCall?.toolType ?? part.tool_call?.tool_type) === "MEDIA_PROCESSING").length;
  const responses = parts.filter((part) =>
    (part.toolResponse?.toolType ?? part.tool_response?.tool_type) === "MEDIA_PROCESSING").length;
  if (processingMode === "AGENTIC" && (!calls || !responses)) {
    throw new GeminiVideoError("gemini_video_agentic_trace_missing", "Video navigation was requested but not evidenced by the response", evidence);
  }
  return {
    text: parts.filter((part) => !part.thought && typeof part.text === "string").map((part) => part.text).join("\n"),
    usage: payload.usageMetadata,
    content: candidate.content,
    processing: { mode: processingMode.toLowerCase(), media_tool_calls: calls, media_tool_responses: responses,
      ...(processingMode === "STATIC" ? { sampling_fps_requested: input.samplingFps ?? null } : {}),
      model_version: payload.modelVersion ?? input.model },
  };
}

const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/mpeg",
] as const;

export class GeminiVideoError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly evidence?: { text: string; usage?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number } },
  ) {
    super(message);
  }
}

function resolveApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_STUDIO_API_KEY?.trim() ||
    null
  );
}

/**
 * Reject anything that is not a plain public https link before fetching it.
 *
 * The URL arrives from a public form, so it is attacker-controlled. Blocking
 * non-https, embedded credentials and loopback/private hosts keeps this from
 * becoming an SSRF primitive that reads the worker's own network.
 */
export function assertFetchableVideoUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new GeminiVideoError("video_url_invalid", "Task video URL is not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new GeminiVideoError("video_url_not_https", "Task video URL must be https");
  }
  if (url.username || url.password) {
    throw new GeminiVideoError(
      "video_url_has_credentials",
      "Task video URL must not embed credentials",
    );
  }

  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]" ||
    host === "0.0.0.0";
  if (isPrivate) {
    throw new GeminiVideoError(
      "video_url_private_host",
      "Task video URL must point at a public host",
    );
  }

  return url;
}

const GENERIC_CONTENT_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);
const VIDEO_TYPE_BY_EXTENSION: Record<string, string> = {
  mov: "video/quicktime", mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm", mpeg: "video/mpeg", mpg: "video/mpeg",
};

/**
 * The served type, or the file's own extension when the host only said
 * "bytes". Storage serves an object under whatever type it was saved with, and
 * a browser upload the browser could not classify was saved as
 * `application/octet-stream`. A share page still reports `text/html` and is
 * still refused.
 */
function videoContentType(served: string | null, url: URL): string {
  const type = (served || "").split(";")[0].trim().toLowerCase();
  if (!GENERIC_CONTENT_TYPES.has(type)) return type;
  const extension = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase() ?? "";
  return VIDEO_TYPE_BY_EXTENSION[extension] ?? type;
}

/**
 * Open the clip for reading, measured and hashed as it is read.
 *
 * Streamed when the link declares its length (storage signed URLs always do),
 * and bounded in memory otherwise. `receipt()` is complete once the body has
 * been read to the end.
 *
 * Many share links (Drive, Dropbox) return an HTML viewer page rather than
 * bytes. That is a normal and frequent outcome, and it is reported as its own
 * error code so the caller can tell "the site shared something we cannot read"
 * from "the model failed" — the first needs a note to the operator, the second
 * needs a retry.
 */
export async function openVideo(
  rawUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<VideoSource & { receipt: () => { bytes: number; sha256: string } }> {
  const url = assertFetchableVideoUrl(rawUrl);
  const controller = new AbortController();
  let timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let streaming = false;

  try {
    const response = await fetcher(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GeminiVideoError(
        "video_fetch_failed",
        `Task video link returned HTTP ${response.status}`,
      );
    }

    const contentType = videoContentType(response.headers.get("content-type"), url);
    if (!(SUPPORTED_VIDEO_TYPES as readonly string[]).includes(contentType)) {
      throw new GeminiVideoError(
        "video_not_directly_readable",
        `Task video link served ${contentType || "an unknown type"} rather than a video file. Share-page links need a direct-download URL.`,
      );
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_VIDEO_BYTES) {
      throw new GeminiVideoError(
        "video_too_large",
        `Task video is ${Math.round(declaredLength / 1024 / 1024)}MB; the limit is ${MAX_VIDEO_BYTES / 1024 / 1024}MB`,
      );
    }

    const hash = createHash("sha256");
    let read = 0;
    const receipt = () => ({ bytes: read, sha256: hash.copy().digest("hex") });

    if (declaredLength > 0 && response.body) {
      // The read now lasts as long as the upload it feeds, so it gets the
      // upload's bound rather than the header fetch's.
      clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
      const measured = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, sink) {
          read += chunk.byteLength;
          if (read > declaredLength) {
            sink.error(new GeminiVideoError("video_length_mismatch", "Task video is longer than its link declared"));
            return;
          }
          hash.update(chunk);
          sink.enqueue(chunk);
        },
        flush(sink) {
          clearTimeout(timeout);
          if (read !== declaredLength) {
            sink.error(new GeminiVideoError("video_length_mismatch", "Task video is shorter than its link declared"));
          }
        },
      }));
      streaming = true;
      return { body: measured, byteLength: declaredLength, contentType, receipt };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    read = bytes.byteLength;
    hash.update(bytes);
    if (bytes.byteLength === 0) {
      throw new GeminiVideoError("video_empty", "Task video link returned no data");
    }
    if (bytes.byteLength > MAX_VIDEO_BYTES) {
      throw new GeminiVideoError(
        "video_too_large",
        `Task video exceeds the ${MAX_VIDEO_BYTES / 1024 / 1024}MB limit`,
      );
    }

    return { body: bytes, byteLength: bytes.byteLength, contentType, receipt };
  } catch (error) {
    if (error instanceof GeminiVideoError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiVideoError("video_fetch_timeout", "Task video link timed out");
    }
    throw new GeminiVideoError(
      "video_fetch_failed",
      error instanceof Error ? error.message : "Task video link could not be read",
    );
  } finally {
    if (!streaming) clearTimeout(timeout);
  }
}

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new GeminiVideoError("empty_response", "Gemini returned an empty response");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new GeminiVideoError("non_json_response", "Gemini returned non-JSON output");
  }
}

/**
 * The video URL lives on the task input rather than in a dedicated field so the
 * adapter stays generic: any future task that needs footage supplies the same key.
 */
function readVideoUrl(input: unknown): string {
  const url =
    input && typeof input === "object"
      ? (input as Record<string, unknown>).taskVideoUrl ?? (input as Record<string, unknown>).videoUrl
      : null;
  if (typeof url !== "string" || !url.trim()) {
    throw new GeminiVideoError(
      "video_url_missing",
      "site_video_evidence requires taskVideoUrl on the task input",
    );
  }
  return url.trim();
}

export async function runGeminiVideoTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  const base: Pick<AgentResult<TOutput>, "provider" | "runtime" | "model" | "tool_mode"> = {
    provider: "gemini_video",
    runtime: "gemini_video",
    model: task.model,
    tool_mode: task.tool_policy.mode,
  };

  const apiKey = resolveApiKey();
  if (!apiKey) {
    return {
      ...base,
      status: "failed",
      error: "gemini_video_not_configured",
      requires_human_review: true,
      requires_approval: false,
    };
  }

  let coverageAdmission: Awaited<ReturnType<typeof reserveCaptureCoverageInference>> | undefined;
  const coverageReservations: unknown[] = [];
  const authorizeCoverage = async () => {
    if (task.kind !== "capture_coverage") return;
    coverageAdmission = await reserveCaptureCoverageInference(task.model, task.metadata);
    coverageReservations.push(coverageAdmission.receipt);
  };
  const receipts: Array<Record<string, unknown>> = [], usageSamples: Array<Record<string, unknown>> = [];
  const historyCalls: Array<Record<string, unknown>> = [];
  const artifacts: Record<string, unknown> = { output_repairs: receipts, usage_samples: usageSamples, company_history_tool_calls: historyCalls, coverage_inference_reservations: coverageReservations };
  const historyAccess = await getCompanyHistoryAccess(task);
  const historyTools = historyAccess ? openAiResponsesHistoryTools : [];
  let retainedVideo: Awaited<ReturnType<typeof openVideo>> | undefined;
  let rawText = "", promptTokens = 0, completionTokens = 0, totalTokens = 0;
  let promptComplete = true, outputComplete = true, totalComplete = true, reasoningTokens = 0;
  const retainUsage = (usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number } | undefined) => {
    usageSamples.push({ ...(usage || {}) });
    const input = usageCount(usage?.promptTokenCount), visibleOutput = usageCount(usage?.candidatesTokenCount), thoughts = usage?.thoughtsTokenCount === undefined ? 0 : usageCount(usage.thoughtsTokenCount), total = usageCount(usage?.totalTokenCount);
    const output = visibleOutput !== null && thoughts !== null ? visibleOutput + thoughts : null;
    reasoningTokens += thoughts ?? 0;
    promptComplete &&= input !== null; outputComplete &&= output !== null; totalComplete &&= total !== null;
    promptTokens += input ?? 0; completionTokens += output ?? 0; totalTokens += total ?? 0;
    artifacts.usage = { prompt_tokens: promptComplete ? promptTokens : null,
      completion_tokens: outputComplete ? completionTokens : null, total_tokens: totalComplete ? totalTokens : null, reasoning_tokens: reasoningTokens };
  };
  try {
    const videoUrl = readVideoUrl(task.input);
    const video = await openVideo(videoUrl);
    retainedVideo = video;
    const prompt = task.definition.build_prompt(task.input);
    const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;
    let remainingOutput = task.definition.video_max_output_tokens ?? MAX_OUTPUT_TOKENS;
    await authorizeCoverage();
    const response = await analyseAgenticVideo({ apiKey, model: task.model,
      prompt, video,
      processingMode: task.definition.video_processing_mode ?? "AGENTIC",
      samplingFps: task.definition.video_sampling_fps,
      maxOutputTokens: task.definition.video_max_output_tokens });
    await coverageAdmission?.record(response.usage);
    coverageAdmission = undefined;
    const { bytes: videoBytes, sha256: videoSha256 } = video.receipt();
    Object.assign(artifacts, { video_bytes: videoBytes, video_content_type: video.contentType,
      video_sha256: videoSha256, video_processing: response.processing,
      initial_analysis_sha256: createHash("sha256").update(JSON.stringify({ content: response.content, processing: response.processing })).digest("hex") });
    if (historyTools.length) artifacts.initial_video_analysis = { text: response.text, usage: response.usage, processing: response.processing };
    rawText = response.text;
    retainUsage(response.usage);
    remainingOutput -= outputComplete ? completionTokens : remainingOutput;
    const contents: Array<{ role: string; parts: VideoResponsePart[] }> = [{ role: "user", parts: [{ text: prompt }] }];
    let responseParts: VideoResponsePart[] = [{ text: rawText || "(empty response)" }];
    let historyPending = historyTools.length > 0;
    const continueText = async () => {
      if (!promptComplete || !outputComplete || !totalComplete) throw new GeminiVideoError("output_correction_usage_unavailable", "Retained input and output usage must be known before another request");
      if (Date.now() >= deadline || remainingOutput <= 0) throw new GeminiVideoError("output_correction_budget_exhausted", "Original runtime or aggregate output budget exhausted");
      await authorizeCoverage();
      try {
        const continuation = await fetch(`${GEMINI_API}/v1beta/models/${encodeURIComponent(task.model)}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
          body: JSON.stringify({ contents,
            ...(historyTools.length ? { tools: [{ functionDeclarations: historyTools.map(tool => ({
              name: tool.name, description: tool.description, parametersJsonSchema: tool.parameters,
            })) }] } : {}),
            generationConfig: { ...(historyTools.length ? {} : { responseMimeType: "application/json" }), temperature: 0, maxOutputTokens: remainingOutput } }),
        });
        if (!continuation.ok) throw new GeminiVideoError("gemini_output_correction_provider_failed", `Gemini returned HTTP ${continuation.status}`);
        const payload = await continuation.json() as { candidates?: Array<{ finishReason?: string; content?: { parts?: VideoResponsePart[] } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number } };
        await coverageAdmission?.record(payload.usageMetadata);
        coverageAdmission = undefined;
        responseParts = payload.candidates?.[0]?.content?.parts ?? [];
        rawText = responseParts.filter(part => !part.thought && typeof part.text === "string").map(part => part.text).join("\n");
        retainUsage(payload.usageMetadata);
        remainingOutput = (task.definition.video_max_output_tokens ?? MAX_OUTPUT_TOKENS) - (outputComplete ? completionTokens : (task.definition.video_max_output_tokens ?? MAX_OUTPUT_TOKENS));
        if (payload.candidates?.[0]?.finishReason !== "STOP") throw new GeminiVideoError("gemini_output_correction_incomplete", "Text continuation did not finish");
      } catch (error) {
        if (error instanceof GeminiVideoError) throw error;
        throw new GeminiVideoError("gemini_output_correction_provider_failed", "Text continuation could not be read; retained analysis and paid usage remain available");
      }
    };
    let output: TOutput | undefined;
    let correctionAttempts = 0;
    while (true) {
      // Replay retained analysis after the single native video call. Never
      // replay the file or MEDIA_PROCESSING parts into the history-tool phase.
      if (historyPending) {
        historyPending = false;
        if (promptComplete && outputComplete && totalComplete && Date.now() < deadline && remainingOutput > 0) {
          contents.push({ role: "model", parts: responseParts }, { role: "user", parts: [{ text:
            `The video has already been analysed once (analysis sha256=${artifacts.initial_analysis_sha256}). Use the read-only company history tools when relevant, including further pages and record fetches, then return the task's final JSON. Preserve video observations; do not request another media analysis.` }] });
          await continueText();
          continue;
        }
      }
      const calls = responseParts.flatMap(part => part.functionCall ? [part.functionCall] : []);
      if (calls.length) {
        if (!promptComplete || !outputComplete || !totalComplete) throw new GeminiVideoError("output_correction_usage_unavailable", "Retained usage must be known before continuing history tools");
        if (Date.now() >= deadline || remainingOutput <= 0) throw new GeminiVideoError("output_correction_budget_exhausted", "Original runtime or aggregate output budget exhausted");
        contents.push({ role: "model", parts: responseParts });
        const results: VideoResponsePart[] = [];
        for (const call of calls) {
          let value: unknown, isError = false;
          try {
            if (!historyAccess || !historyTools.some(tool => tool.name === call.name)) throw new Error("company_history_tool_not_allowed");
            if (!call.args || typeof call.args !== "object" || Array.isArray(call.args)) throw new Error("company_history_tool_arguments_invalid");
            value = await runOperatorTool(call.name, call.args, historyAccess);
            isError = Boolean(value && typeof value === "object" && "ok" in value && value.ok === false);
          } catch {
            isError = true;
            value = { error: "company_history_tool_failed", repair: "Use an advertised read-only history tool and its query/filters/page_size/cursor or record_id schema; access is server-controlled." };
          }
          const retained = structuredClone({ args: call.args ?? null, result: value ?? null });
          historyCalls.push({ ...(call.id ? { tool_call_id: call.id } : {}), name: call.name, status: isError ? "error" : "completed",
            result_status: isError ? "error" : "completed", ...retained,
            args_sha256: digest(retained.args), result_sha256: digest(retained.result) });
          results.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: { result: value, is_error: isError } } });
        }
        contents.push({ role: "user", parts: results });
        await continueText();
        continue;
      }
      try { output = (task.definition.output_schema as ZodType<TOutput>).parse(extractJsonPayload(rawText)); break; }
      catch (error) {
        const receipt = outputCorrectionEvidence(rawText, error);
        receipts.push({ ...receipt, usage: usageSamples[usageSamples.length - 1] });
        if (correctionAttempts++ === 5) throw new GeminiVideoError("output_correction_limit", "Final output still fails validation after bounded correction");
        contents.push({ role: "model", parts: responseParts.length ? responseParts : [{ text: rawText || "(empty response)" }] },
          { role: "user", parts: [{ text: outputCorrectionPrompt(receipt.issues) }] });
        await continueText();
      }
    }

    return {
      ...base,
      status: "completed",
      output,
      raw_output_text: rawText,
      requires_human_review: false,
      requires_approval: false,
      error: null,
      artifacts,
      logs: [
        {
          event_type: "provider.video.analysed",
          status: "success",
          summary: `Read ${Math.round(videoBytes / 1024)}KB of ${video.contentType}`,
        },
      ],
    };
  } catch (error) {
    if (error instanceof GeminiVideoError && error.evidence) {
      await coverageAdmission?.record(error.evidence.usage).catch(() => undefined);
      rawText = error.evidence.text;
      retainUsage(error.evidence.usage);
    }
    if (retainedVideo && artifacts.video_sha256 === undefined) {
      const receipt = retainedVideo.receipt();
      const complete = receipt.bytes === retainedVideo.byteLength;
      Object.assign(artifacts, { video_read_complete: complete, video_content_type: retainedVideo.contentType,
        ...(complete ? { video_bytes: receipt.bytes, video_sha256: receipt.sha256 }
          : { video_partial_bytes: receipt.bytes, video_partial_sha256: receipt.sha256 }),
      });
    }
    const code = error instanceof GeminiVideoError ? error.code : "gemini_video_failed";
    return {
      ...base,
      status: "failed",
      error: `${code}: ${error instanceof Error ? error.message : "Gemini video task failed"}`,
      // A link we cannot read is the site's to fix, so somebody has to say so.
      requires_human_review: true,
      requires_approval: false,
      raw_output_text: rawText,
      artifacts,
    };
  }
}
