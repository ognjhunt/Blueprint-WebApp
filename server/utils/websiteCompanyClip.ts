/**
 * The job's video for an approved deployment company (package E, E3; Pipeline contract
 * `scratchpad/e2e/COMPANY_CLIP_CONTRACT.md`, `website_company_clip.v1`).
 *
 * The Pipeline makes one silent, re-encoded, metadata-free copy of the capture's video and names it to the website on
 * the signed control channel; only its identity is stored, at `captureUploadSessions/{captureId}.company_clip`. The
 * bytes stay with the Pipeline. A company's browser plays it through `GET /api/company-media/jobs/:jobId/video.mp4`
 * behind a 15-minute ticket bound to the viewer, the job and the capture; every request (every byte range) re-reads
 * `teamJobAccess` and the viewer's approval before anything is fetched. The raw upload is never served, and nothing is
 * cached on the website's disk, so a withdrawal or a hold stops serving at once with nothing to clean up.
 */
import { Readable } from "node:stream";
import { z } from "zod";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { WEBSITE_ATLAS_CAPTURE_ID, WEBSITE_ATLAS_REQUEST_ID } from "./websiteAtlasPreview";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { RECORDING_VERSIONS_THAT_SHARE } from "./teamJobAccess";

export const COMPANY_CLIP_FIELD = "company_clip";
export const MAX_COMPANY_CLIP_BYTES = 64 * 1024 * 1024;
const VIEW_TICKET_DOMAIN = "website_company_clip_view";
export const COMPANY_CLIP_ROUTE = "/api/company-media/jobs";

const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const evenSide = z.number().int().positive().max(1280).refine(value => value % 2 === 0);

export const websiteCompanyClipSchema = z.object({
  schema_version: z.literal("website_company_clip.v1"),
  capture_id: z.string().regex(WEBSITE_ATLAS_CAPTURE_ID),
  clip_revision: sha,
  state: z.literal("ready"),
  format: z.literal("mp4_h264_faststart_video_only"),
  content_type: z.literal("video/mp4"),
  digest: sha,
  size_bytes: z.number().int().min(1).max(MAX_COMPANY_CLIP_BYTES),
  width: evenSide,
  height: evenSide,
  fps: z.number().finite().gt(0).max(30.0001),
  duration_seconds: z.number().finite().min(0).max(86400).nullable(),
  has_audio: z.literal(false),
  permission_basis: z.enum(["site_sharing_statement", "blueprint_owned_capture"]),
  statement_version: z.string().max(64).nullable(),
  updated_at_epoch: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  clip_digest: sha,
}).strict();
export type WebsiteCompanyClip = z.infer<typeof websiteCompanyClipSchema>;

export function websiteCompanyClipDigestValid(clip: WebsiteCompanyClip): boolean {
  try { return crossRuntimeArtifactDigest(clip, "clip_digest") === clip.clip_digest; }
  catch { return false; }
}

/** The stored clip of this capture, verified on every read; an invalid entry is never shown or served. */
export function storedCompanyClip(session: Record<string, any> | undefined, captureId: string): WebsiteCompanyClip | null {
  const parsed = websiteCompanyClipSchema.safeParse(session?.[COMPANY_CLIP_FIELD]);
  return parsed.success && parsed.data.capture_id === captureId && websiteCompanyClipDigestValid(parsed.data) ? parsed.data : null;
}

/**
 * Accept the Pipeline's clip reference (contract section 1). Only while the site's grant stands and its recorded
 * statement shares the job; idempotent on revision and digest; never older than the stored one.
 */
export async function recordWebsiteCompanyClip(requestId: string, sceneId: string, captureId: string, clip: WebsiteCompanyClip) {
  if (!db) throw new Error("website_company_clip_store_unavailable");
  const store = db;
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || sceneId !== `site-${requestId}` || clip.capture_id !== captureId)
    throw new Error("task_context_capture_mismatch");
  if (!websiteCompanyClipDigestValid(clip)) throw new Error("website_company_clip_digest_invalid");
  const binding = await resolveWebsiteCaptureBinding(requestId, sceneId, captureId);
  return store.runTransaction(async transaction => {
    const requestRef = store.collection("inboundRequests").doc(requestId);
    const sessionRef = store.collection("captureUploadSessions").doc(captureId);
    const request = await transaction.get(requestRef);
    const session = await transaction.get(sessionRef);
    await assertWebsiteCaptureBindingInTransaction(transaction, requestId, binding);
    const record = request.data();
    if (!request.exists || !record) throw new Error("website_company_clip_request_missing");
    const rights = projectWebsiteCaptureRights(record);
    if (rights.consent_revoked || !rights.derived_scene_generation_allowed) throw new Error("source_revoked");
    if (!RECORDING_VERSIONS_THAT_SHARE.includes(String(rights.statement_version))) throw new Error("website_company_clip_not_permitted");
    if (!session.exists) throw new Error("website_company_clip_capture_missing");
    const prior = storedCompanyClip(session.data(), captureId);
    if (prior && prior.clip_revision === clip.clip_revision) {
      if (prior.clip_digest !== clip.clip_digest) throw new Error("idempotency_conflict");
    } else if (prior && clip.updated_at_epoch < prior.updated_at_epoch) {
      throw new Error("website_company_clip_stale");
    } else {
      transaction.set(sessionRef, { [COMPANY_CLIP_FIELD]: clip, updated_at_iso: new Date().toISOString() }, { merge: true });
    }
    return { schema_version: "website_company_clip_acceptance.v1", accepted: true as const,
      clip_revision: clip.clip_revision, clip_digest: clip.clip_digest };
  });
}

/** Withdrawal deletion: remove the stored clip and simulation package references from each named capture session of this job. */
export async function deleteWebsiteCompanyClips(requestId: string, captureIds: string[]): Promise<string[]> {
  if (!db) throw new Error("website_company_clip_store_unavailable");
  const store = db;
  const cleared: string[] = [];
  for (const captureId of [...new Set(captureIds)].filter(id => WEBSITE_ATLAS_CAPTURE_ID.test(id))) {
    const removed = await store.runTransaction(async transaction => {
      const ref = store.collection("captureUploadSessions").doc(captureId);
      const session = await transaction.get(ref);
      // The company clip and the simulation package (E9), each a stored reference only.
      const data = session.data();
      if (!session.exists || (data?.[COMPANY_CLIP_FIELD] === undefined && data?.company_simulation === undefined)) return false;
      transaction.set(ref, { [COMPANY_CLIP_FIELD]: admin.firestore.FieldValue.delete(),
        company_simulation: admin.firestore.FieldValue.delete() }, { merge: true });
      return true;
    });
    if (removed) cleared.push(captureId);
  }
  void requestId;
  return cleared;
}

/** The player's address for one viewer: a 15-minute ticket bound to the viewer, the job and the capture. */
export function companyClipUrl(requestId: string, captureId: string, companyId: string, nowSeconds?: number): string | null {
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId) || !/^[a-f0-9]{64}$/.test(companyId)) return null;
  const ticket = createSignedDownloadTicket([VIEW_TICKET_DOMAIN, requestId, captureId, companyId], nowSeconds);
  if (!ticket) return null;
  const query = new URLSearchParams({ capture: captureId, viewer: companyId, expires: String(ticket.expires), signature: ticket.signature });
  return `${COMPANY_CLIP_ROUTE}/${encodeURIComponent(requestId)}/video.mp4?${query}`;
}

export function verifyCompanyClipTicket(requestId: string, captureId: string, companyId: string, expires: unknown,
  signature: unknown, nowSeconds?: number): boolean {
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId) || !/^[a-f0-9]{64}$/.test(companyId)) return false;
  return Boolean(verifySignedDownloadTicket([VIEW_TICKET_DOMAIN, requestId, captureId, companyId], expires, signature, nowSeconds));
}

/** A browser's one-range header as the Pipeline accepts it, or null (no range, or one it would ignore). */
export function forwardableRange(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^bytes=(\d+-\d*|-\d+)$/.test(text) ? text : null;
}

export type CompanyClipFetch =
  | { ok: true; status: 200 | 206; headers: Record<string, string>; body: Readable }
  | { ok: false; status: 404 | 416 | 503; contentRange?: string | null };

/**
 * One read of the clip through the signed Pipeline route (contract section 2), the browser's range forwarded as is.
 * The answer is checked against the stored identity: the digest header, and the total size of a range read.
 */
export async function fetchCompanyClip(requestId: string, clip: WebsiteCompanyClip, range: string | null,
  fetcher: typeof fetch = fetch): Promise<CompanyClipFetch> {
  const origin = signedWebsitePipelineRequest(`/api/live-pipeline/website-company-clips/${encodeURIComponent(clip.capture_id)}/clip.mp4`,
    "", { request_id: requestId, digest: clip.digest });
  if (!origin) return { ok: false, status: 503 };
  const response = await fetcher(origin.url, { headers: { ...origin.headers, ...(range ? { Range: range } : {}) }, redirect: "error" });
  if (response.status === 416) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, status: 416, contentRange: response.headers.get("content-range") };
  }
  if ((response.status !== 200 && response.status !== 206) || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, status: response.status === 404 ? 404 : 503 };
  }
  const digestHeader = response.headers.get("x-blueprint-artifact-sha256");
  const contentRange = response.headers.get("content-range");
  const total = contentRange ? Number(/\/(\d+)$/.exec(contentRange)?.[1]) : Number(response.headers.get("content-length"));
  if ((digestHeader && digestHeader !== clip.digest) || total !== clip.size_bytes) {
    await response.body.cancel().catch(() => undefined);
    return { ok: false, status: 503 };
  }
  const headers: Record<string, string> = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes" };
  const length = response.headers.get("content-length");
  if (length) headers["Content-Length"] = length;
  if (response.status === 206 && contentRange) headers["Content-Range"] = contentRange;
  return { ok: true, status: response.status as 200 | 206, headers,
    body: Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>) };
}
