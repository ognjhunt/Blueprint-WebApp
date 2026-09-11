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
 * the whole basis of the cycle measurement. Gemini samples at 1 FPS with audio
 * and returns timestamps that refer to the actual clip.
 *
 * `@google/generative-ai` and `GEMINI_API_KEY` are already dependencies of this
 * repo (`server/utils/geminiInteractions.ts`, `server/config/env.ts`), so this
 * introduces a new task, not a new service.
 *
 * ## Fetching the footage
 *
 * Sites give us a link and keep custody. That link is fetched here, in the
 * worker, bounded by size and content type, and the bytes are handed to the
 * model inline and then dropped. Nothing is copied into Blueprint storage: the
 * site revokes by unsharing, exactly as `taskVideoField` promises, and that
 * promise stays true only if we never keep a second copy.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";

/** Kept below Gemini's 100MB inline ceiling, and well below it on purpose. */
const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;

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

/**
 * Pull the clip into memory.
 *
 * Many share links (Drive, Dropbox) return an HTML viewer page rather than
 * bytes. That is a normal and frequent outcome, and it is reported as its own
 * error code so the caller can tell "the site shared something we cannot read"
 * from "the model failed" — the first needs a note to the operator, the second
 * needs a retry.
 */
export async function fetchVideoBytes(
  rawUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ bytes: Buffer; contentType: string }> {
  const url = assertFetchableVideoUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

    const contentType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
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

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new GeminiVideoError("video_empty", "Task video link returned no data");
    }
    if (bytes.byteLength > MAX_VIDEO_BYTES) {
      throw new GeminiVideoError(
        "video_too_large",
        `Task video exceeds the ${MAX_VIDEO_BYTES / 1024 / 1024}MB limit`,
      );
    }

    return { bytes, contentType };
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
    clearTimeout(timeout);
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
      ? (input as Record<string, unknown>).taskVideoUrl
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
    const { bytes, contentType } = await fetchVideoBytes(videoUrl);

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: task.model,
      generationConfig: {
        // The task's Zod schema is the real contract; asking for JSON here just
        // stops the model wrapping it in prose we would have to slice back out.
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    const response = await model.generateContent([
      { text: task.definition.build_prompt(task.input) },
      {
        inlineData: {
          mimeType: contentType,
          data: bytes.toString("base64"),
        },
      },
    ]);

    const rawText = response.response.text();
    const parsed = extractJsonPayload(rawText);
    const output = (task.definition.output_schema as ZodType<TOutput>).parse(parsed);

    // Footage that centres on identifiable people is a human's call, never an
    // automated one — `/governance` treats consent as failing closed.
    const privacyFlagged =
      Boolean(output) &&
      typeof output === "object" &&
      (output as Record<string, unknown>).privacy_flag === true;

    const usage = response.response.usageMetadata;

    return {
      ...base,
      status: "completed",
      output,
      raw_output_text: rawText,
      requires_human_review: privacyFlagged,
      requires_approval: false,
      error: null,
      artifacts: {
        video_bytes: bytes.byteLength,
        video_content_type: contentType,
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
          summary: `Read ${Math.round(bytes.byteLength / 1024)}KB of ${contentType}`,
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
