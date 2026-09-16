/**
 * Reading a capture's extracted frames into world-model input.
 *
 * The capture app uploads one walkthrough video. A Cloud Function in
 * BlueprintCapture (`cloud/extract-frames`) decodes it to JPEGs under a
 * `frames/` prefix and writes `frames/index.jsonl`, one row per frame. This
 * module is the only thing that needs to know that layout: it turns those rows
 * into the `FrameCandidate` shape the world-model adapter consumes.
 *
 * Every field beyond the frame id is optional on purpose. Sharpness is only
 * present when the capture carried per-frame quality data, and selection
 * degrades to even temporal spacing without it rather than failing.
 */

import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { parseGsUri } from "./pipeline-dashboard";
import type { FrameCandidate } from "./worldModelProfiles";

/** One row of `frames/index.jsonl`, as written by the extractor. */
interface FrameIndexRow {
  frame_id?: unknown;
  t_video_sec?: unknown;
  arkit_frame?: { sharpness_score?: unknown } | unknown;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse JSONL leniently: a truncated final line is a normal consequence of a
 * function being killed mid-write, and losing one frame is better than losing
 * the whole walkthrough. Rows that do not parse are skipped, not thrown on.
 */
export function parseFrameIndex(content: string): FrameIndexRow[] {
  const rows: FrameIndexRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        rows.push(parsed as FrameIndexRow);
      }
    } catch {
      // Ignore a malformed row rather than failing the capture.
    }
  }
  return rows;
}

/** Convert index rows into the candidates the adapter selects from. */
export function frameCandidatesFromIndex(params: {
  rows: readonly FrameIndexRow[];
  bucket: string;
  framesPrefix: string;
  /** Extension the extractor writes. */
  extension?: string;
}): FrameCandidate[] {
  const extension = (params.extension || "jpg").replace(/^\./, "");
  const prefix = params.framesPrefix.replace(/^\/+|\/+$/g, "");

  const candidates: FrameCandidate[] = [];
  for (const row of params.rows) {
    const frameId = String(row.frame_id || "").trim();
    if (!frameId) {
      continue;
    }
    const arkitFrame =
      row.arkit_frame && typeof row.arkit_frame === "object"
        ? (row.arkit_frame as { sharpness_score?: unknown })
        : null;

    const fileName = /\.[a-z0-9]+$/i.test(frameId) ? frameId : `${frameId}.${extension}`;
    candidates.push({
      uri: `gs://${params.bucket}/${prefix}/${fileName}`,
      timestampSeconds: finiteNumber(row.t_video_sec),
      sharpness: arkitFrame ? finiteNumber(arkitFrame.sharpness_score) : null,
    });
  }
  return candidates;
}

/**
 * Load a capture's frames straight from the `frames/` prefix.
 *
 * `framesPrefixUri` is the gs:// URI of the prefix itself, e.g.
 * `gs://bucket/scenes/<scene>/captures/<capture>/frames`.
 */
export async function loadCaptureFrames(framesPrefixUri: string): Promise<FrameCandidate[]> {
  if (!storageAdmin) {
    throw new Error("storage_unavailable_for_frame_index");
  }

  const normalized = framesPrefixUri.replace(/\/+$/, "");
  const { bucket, objectPath } = parseGsUri(`${normalized}/index.jsonl`);
  const framesPrefix = objectPath.replace(/\/index\.jsonl$/, "");

  const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
  const rows = parseFrameIndex(buffer.toString("utf-8"));

  return frameCandidatesFromIndex({ rows, bucket, framesPrefix });
}
