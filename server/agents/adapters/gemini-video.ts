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
 * refer to the actual clip. This adapter explicitly
 * requests agentic navigation and verifies the returned media-tool trace.
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
import { createHash } from "node:crypto";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";

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
}, fetcher: typeof fetch = fetch, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const video = await uploadVideoFile(input, fetcher, sleep);
  try {
    return await generateFromVideo(input, video, fetcher);
  } finally {
    await deleteVideoFile(input.apiKey, video.name, fetcher);
  }
}

async function generateFromVideo(input: { apiKey: string; model: string; prompt: string },
  video: UploadedVideo, fetcher: typeof fetch) {
  const response = await fetcher(
    `${GEMINI_API}/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey },
      signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: input.prompt },
          { file_data: { mime_type: video.mimeType, file_uri: video.uri }, media_processing: "AGENTIC" },
        ] }],
        // Agentic media processing and the model's reasoning spend this budget
        // before the answer does. At 8192 the first real review of a 30s phone
        // clip stopped short of its answer.
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    },
  );
  // Do not include upstream error bodies: they can echo source URLs or tokens.
  if (!response.ok) throw new GeminiVideoError("gemini_video_provider_failed", `Gemini returned HTTP ${response.status}`);
  const payload = await response.json() as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: VideoResponsePart[] } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    modelVersion?: string;
  };
  const candidate = payload.candidates?.[0];
  if (candidate?.finishReason !== "STOP") {
    // The reason and token counts, never content: enough to tell a budget
    // from a safety stop without a second paid call to find out.
    const usage = payload.usageMetadata;
    throw new GeminiVideoError("gemini_video_incomplete",
      `Gemini did not finish the video analysis (finishReason=${candidate?.finishReason ?? "none"}, `
      + `candidatesTokens=${usage?.candidatesTokenCount ?? "?"}, totalTokens=${usage?.totalTokenCount ?? "?"})`);
  }
  const parts = candidate.content?.parts ?? [];
  const calls = parts.filter((part) =>
    (part.toolCall?.toolType ?? part.tool_call?.tool_type) === "MEDIA_PROCESSING").length;
  const responses = parts.filter((part) =>
    (part.toolResponse?.toolType ?? part.tool_response?.tool_type) === "MEDIA_PROCESSING").length;
  if (!calls || !responses) {
    throw new GeminiVideoError("gemini_video_agentic_trace_missing", "Video navigation was requested but not evidenced by the response");
  }
  return {
    text: parts.filter((part) => !part.thought && typeof part.text === "string").map((part) => part.text).join("\n"),
    usage: payload.usageMetadata,
    processing: { mode: "agentic", media_tool_calls: calls, media_tool_responses: responses,
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

  try {
    const videoUrl = readVideoUrl(task.input);
    const video = await openVideo(videoUrl);

    const response = await analyseAgenticVideo({ apiKey, model: task.model,
      prompt: task.definition.build_prompt(task.input), video });
    const { bytes: videoBytes, sha256: videoSha256 } = video.receipt();
    const rawText = response.text;
    const parsed = extractJsonPayload(rawText);
    const output = (task.definition.output_schema as ZodType<TOutput>).parse(parsed);

    // Footage that centres on identifiable people is a human's call, never an
    // automated one — `/governance` treats consent as failing closed.
    const privacyFlagged =
      Boolean(output) &&
      typeof output === "object" &&
      (output as Record<string, unknown>).privacy_flag === true;

    const usage = response.usage;

    return {
      ...base,
      status: "completed",
      output,
      raw_output_text: rawText,
      requires_human_review: privacyFlagged,
      requires_approval: false,
      error: null,
      artifacts: {
        video_bytes: videoBytes,
        video_content_type: video.contentType,
        video_sha256: videoSha256,
        video_processing: response.processing,
        usage: usage
          ? {
              prompt_tokens: usage.promptTokenCount ?? null,
              completion_tokens: usage.candidatesTokenCount ?? null,
              total_tokens: usage.totalTokenCount ?? null,
            }
          : null,
      },
      logs: [
        {
          event_type: "provider.video.analysed",
          status: "success",
          summary: `Read ${Math.round(videoBytes / 1024)}KB of ${video.contentType}`,
        },
      ],
    };
  } catch (error) {
    const code = error instanceof GeminiVideoError ? error.code : "gemini_video_failed";
    return {
      ...base,
      status: "failed",
      error: `${code}: ${error instanceof Error ? error.message : "Gemini video task failed"}`,
      // A link we cannot read is the site's to fix, so somebody has to say so.
      requires_human_review: true,
      requires_approval: false,
    };
  }
}
