/**
 * Automatic, consented Atlas 3D previews of website uploads (owner exception
 * 2026-10-22, AGENTS.md). The Pipeline owns the preview and its bytes; the
 * WebApp keeps the latest signed status per capture and lets the signed-in site
 * owner download a ready bundle. Development-only and unscaled: never a scene,
 * measurement, task or robot claim. Withdrawal ends serving at once.
 */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { AtlasPreviewView } from "../../client/src/types/workspace";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";
import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

export const WEBSITE_ATLAS_PREVIEW_LABEL = "3D preview (beta, unscaled)";
export const WEBSITE_ATLAS_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
export const WEBSITE_ATLAS_CAPTURE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,131}$/;
const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const websiteAtlasPreviewSchema = z.object({
  schema_version: z.literal("website_atlas_preview.v1"),
  capture_id: z.string().regex(WEBSITE_ATLAS_CAPTURE_ID),
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  state: z.enum(["processing", "ready", "needs_input", "failed", "withdrawn"]),
  reason: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/).nullable(),
  updated_at_epoch: z.number().finite().positive(),
  bundle: z.object({
    digest: sha, size_bytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    filename: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/),
  }).strict().nullable(),
  splat_available: z.boolean(), mesh_available: z.boolean(),
  claim_ceiling: z.literal("development_only"),
  scale_status: z.literal("unscaled_provider_world_units"),
  preview_digest: sha,
}).strict().refine(value => (value.bundle !== null) === (value.state === "ready"), "bundle is required exactly when ready");
export type WebsiteAtlasPreview = z.infer<typeof websiteAtlasPreviewSchema>;

/** `preview_digest` is the cross-runtime digest of every other field. */
export function websiteAtlasPreviewDigestValid(preview: WebsiteAtlasPreview) {
  try { return crossRuntimeArtifactDigest(preview, "preview_digest") === preview.preview_digest; }
  catch { return false; }
}

/** Every read re-verifies the stored entry; an invalid one is never shown or served. */
function verifiedPreview(value: unknown, captureId: string) {
  const parsed = websiteAtlasPreviewSchema.safeParse(value);
  return parsed.success && parsed.data.capture_id === captureId && websiteAtlasPreviewDigestValid(parsed.data)
    ? parsed.data : null;
}

function storedPreviews(record: Record<string, any> | undefined): Record<string, unknown> {
  const value = record?.website_atlas_previews;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** A withdrawal marker only hides a preview and must still land after the source
 * bytes are deleted, so it proves the capture's identity, not its stored bytes. */
async function assertCaptureOfRequest(requestId: string, captureId: string) {
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId)) throw new Error("task_context_capture_mismatch");
  if (captureId === `walkthrough-${requestId}`) return;
  const link = (await db!.collection("captureSupplements").doc(captureId).get()).data();
  if (!link || link.captureId !== captureId || link.requestId !== requestId || link.sceneId !== `site-${requestId}`)
    throw new Error("task_context_capture_mismatch");
}

/**
 * Store the Pipeline's signed status at `inboundRequests/{requestId}.website_atlas_previews[captureId]`.
 * Revisions only advance: the same revision and digest is an idempotent replay, the
 * same revision with another digest is `idempotency_conflict`, and a lower revision
 * is refused as `website_atlas_preview_stale` (409) so a late retry never regresses
 * the stored state. Once rights are revoked only `withdrawn` is accepted.
 */
export async function recordWebsiteAtlasPreview(requestId: string, captureId: string, preview: WebsiteAtlasPreview) {
  if (!db) throw new Error("website_atlas_preview_store_unavailable");
  const store = db;
  const withdrawn = preview.state === "withdrawn";
  const binding = withdrawn ? undefined : await resolveWebsiteCaptureBinding(requestId, `site-${requestId}`, captureId);
  if (withdrawn) await assertCaptureOfRequest(requestId, captureId);
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const snapshot = await transaction.get(ref);
    if (!withdrawn) await assertWebsiteCaptureBindingInTransaction(transaction, requestId, binding);
    const record = snapshot.data();
    if (!snapshot.exists || !record) throw new Error("website_atlas_preview_request_missing");
    if (!withdrawn && !projectWebsiteCaptureRights(record).derived_scene_generation_allowed) throw new Error("source_revoked");
    const previews = storedPreviews(record);
    const prior = verifiedPreview(previews[captureId], captureId);
    if (prior && preview.revision < prior.revision) throw new Error("website_atlas_preview_stale");
    if (prior && preview.revision === prior.revision) {
      if (prior.preview_digest !== preview.preview_digest) throw new Error("idempotency_conflict");
    } else transaction.update(ref, { website_atlas_previews: { ...previews, [captureId]: preview } });
    return { schema_version: "website_atlas_preview_acceptance.v1", accepted: true as const,
      revision: preview.revision, preview_digest: preview.preview_digest };
  }));
}

/** The preview a site owner sees: a ready one first, then the newest; never a withdrawn one. */
export function selectWebsiteAtlasPreview(record: Record<string, any> | undefined, captureId?: string) {
  return Object.entries(storedPreviews(record))
    .map(([id, value]) => verifiedPreview(value, id))
    .filter((preview): preview is WebsiteAtlasPreview => preview !== null && preview.state !== "withdrawn"
      && (captureId === undefined || preview.capture_id === captureId))
    .sort((a, b) => Number(b.state === "ready") - Number(a.state === "ready")
      || b.updated_at_epoch - a.updated_at_epoch || a.capture_id.localeCompare(b.capture_id))[0] ?? null;
}

/** Downloadable only while the recording's consent stands and the preview is ready. */
export function downloadableWebsiteAtlasPreview(record: Record<string, any> | undefined, captureId?: string) {
  if (!record || !projectWebsiteCaptureRights(record).derived_scene_generation_allowed) return null;
  const preview = selectWebsiteAtlasPreview(record, captureId);
  return preview?.state === "ready" && preview.bundle ? preview : null;
}

const STATUS_COPY = {
  processing: "Your 3D preview is being made from your recording.",
  ready: "Your 3D preview is ready to download.",
  needs_input: "A 3D preview could not be made from this recording.",
  failed: "A 3D preview could not be made from this recording.",
} as const;

/** Owner task view. Plain copy only: Pipeline reason codes never reach the customer. */
export function projectWebsiteAtlasPreview(record: Record<string, any> | undefined): AtlasPreviewView | null {
  if (!record || !projectWebsiteCaptureRights(record).derived_scene_generation_allowed) return null;
  const preview = selectWebsiteAtlasPreview(record);
  if (!preview || preview.state === "withdrawn") return null;
  const updated = new Date(preview.updated_at_epoch * 1000);
  return {
    captureId: preview.capture_id, label: WEBSITE_ATLAS_PREVIEW_LABEL, state: preview.state,
    statusText: STATUS_COPY[preview.state], developmentOnly: true,
    splatAvailable: preview.splat_available, meshAvailable: preview.mesh_available,
    sizeBytes: preview.bundle?.size_bytes ?? null,
    updatedAtIso: Number.isFinite(updated.getTime()) ? updated.toISOString() : null,
    downloadAvailable: preview.state === "ready" && preview.bundle !== null,
  };
}

/** Domain-separated from result tickets by its own leading field. 15-minute TTL. */
const TICKET_DOMAIN = "website_atlas_preview";
export function websiteAtlasPreviewDownloadUrl(requestId: string, captureId: string, nowSeconds?: number) {
  const ticket = createSignedDownloadTicket([TICKET_DOMAIN, requestId, captureId], nowSeconds);
  if (!ticket) return null;
  const query = new URLSearchParams({ expires: String(ticket.expires), signature: ticket.signature });
  return `/api/website-atlas-preview-downloads/${encodeURIComponent(requestId)}/${encodeURIComponent(captureId)}?${query}`;
}
export function verifyWebsiteAtlasPreviewDownloadTicket(requestId: string, captureId: string,
  expires: unknown, signature: unknown, nowSeconds?: number) {
  return verifySignedDownloadTicket([TICKET_DOMAIN, requestId, captureId], expires, signature, nowSeconds);
}

/** The Pipeline's bundle read, signed exactly like the preparation ledger read (body ""). */
export function websiteAtlasPreviewBundleRequest(requestId: string, captureId: string, digest: string) {
  try {
    return signedWebsitePipelineRequest(`/api/live-pipeline/website-atlas-previews/${encodeURIComponent(captureId)}/bundle`,
      "", { request_id: requestId, digest });
  } catch { return null; }
}
