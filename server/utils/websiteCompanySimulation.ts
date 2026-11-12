/**
 * "Download the simulation" for an approved deployment company (package E, E9 A), against the Pipeline's contract
 * `scratchpad/e2e/COMPANY_SIMULATION_CONTRACT.md` (`website_company_simulation.v1`).
 *
 * One zip per job: `scene.usda` (the file to open), the room, its collision mesh, the object, `success_rule.json` and a
 * README. The Pipeline names it to the website on the signed control channel; only its identity is stored, at
 * `captureUploadSessions/{captureId}.company_simulation`. The bytes stay with the Pipeline and reach a company through
 * `GET /api/company-media/jobs/:jobId/simulation.zip`, behind a 15-minute signed URL bound to the job, the capture and
 * the viewer. Every request (every range) re-reads `teamJobAccess`, the viewer's approval as a deployment company and
 * the stored reference, then proxies straight through: no copy on the website's disk, so a withdrawal or a hold stops
 * serving at once. Before a reference exists the page says "The simulation is not finished yet." and offers neither the
 * button nor the two tested answers.
 */
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { WEBSITE_ATLAS_CAPTURE_ID, WEBSITE_ATLAS_REQUEST_ID } from "./websiteAtlasPreview";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { RECORDING_VERSIONS_THAT_SHARE } from "./teamJobAccess";
import { forwardableRange } from "./websiteCompanyClip";

export const COMPANY_SIMULATION_FIELD = "company_simulation";
/** The contract's `MAX_PACKAGE_BYTES`. */
export const MAX_COMPANY_SIMULATION_BYTES = 536_870_912;
/** The name the company's browser saves it under (contract section 2): neutral, names nothing. */
export const COMPANY_SIMULATION_FILENAME = "simulation.zip";
const TICKET_DOMAIN = "website_company_simulation_download";

const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
/** A zip member name: relative, neutral, no traversal. */
const memberName = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/);

export const websiteCompanySimulationSchema = z.object({
  schema_version: z.literal("website_company_simulation.v1"),
  capture_id: z.string().regex(WEBSITE_ATLAS_CAPTURE_ID),
  simulation_revision: sha,
  state: z.literal("ready"),
  format: z.literal("zip_usd_scene_object_success_rule"),
  content_type: z.literal("application/zip"),
  digest: sha,
  size_bytes: z.number().int().min(1).max(MAX_COMPANY_SIMULATION_BYTES),
  files: z.array(memberName).min(1).max(10_000),
  permission_basis: z.enum(["site_sharing_statement", "blueprint_owned_capture"]),
  statement_version: z.string().max(64).nullable(),
  updated_at_epoch: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  simulation_digest: sha,
}).strict();
export type WebsiteCompanySimulation = z.infer<typeof websiteCompanySimulationSchema>;

export function websiteCompanySimulationDigestValid(record: WebsiteCompanySimulation): boolean {
  try { return crossRuntimeArtifactDigest(record, "simulation_digest") === record.simulation_digest; }
  catch { return false; }
}

/** The stored package of this capture, verified on every read; anything else reads as "not finished yet". */
export function storedCompanySimulation(session: Record<string, any> | undefined, captureId: string): WebsiteCompanySimulation | null {
  const parsed = websiteCompanySimulationSchema.safeParse(session?.[COMPANY_SIMULATION_FIELD]);
  return parsed.success && parsed.data.capture_id === captureId && websiteCompanySimulationDigestValid(parsed.data) ? parsed.data : null;
}

/**
 * Accept the Pipeline's reference (contract section 1), mirroring the company clip: ids and capture binding match, the
 * digest verifies, the site's grant stands and its recorded statement shares the job (the website keeps no record of
 * a Blueprint-owned capture, so that basis alone is not enough here); idempotent on revision and digest; never older.
 */
export async function recordWebsiteCompanySimulation(requestId: string, sceneId: string, captureId: string,
  record: WebsiteCompanySimulation) {
  if (!db) throw new Error("website_company_simulation_store_unavailable");
  const store = db;
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || sceneId !== `site-${requestId}` || record.capture_id !== captureId)
    throw new Error("task_context_capture_mismatch");
  if (!websiteCompanySimulationDigestValid(record)) throw new Error("website_company_simulation_digest_invalid");
  const binding = await resolveWebsiteCaptureBinding(requestId, sceneId, captureId);
  return store.runTransaction(async transaction => {
    const requestRef = store.collection("inboundRequests").doc(requestId);
    const sessionRef = store.collection("captureUploadSessions").doc(captureId);
    const request = await transaction.get(requestRef);
    const session = await transaction.get(sessionRef);
    await assertWebsiteCaptureBindingInTransaction(transaction, requestId, binding);
    const job = request.data();
    if (!request.exists || !job) throw new Error("website_company_simulation_request_missing");
    const rights = projectWebsiteCaptureRights(job);
    if (rights.consent_revoked || job.capture_withdrawal || !rights.derived_scene_generation_allowed) throw new Error("source_revoked");
    if (!RECORDING_VERSIONS_THAT_SHARE.includes(String(rights.statement_version))) throw new Error("website_company_simulation_not_permitted");
    if (!session.exists) throw new Error("website_company_simulation_capture_missing");
    const prior = storedCompanySimulation(session.data(), captureId);
    if (prior && prior.simulation_revision === record.simulation_revision) {
      if (prior.simulation_digest !== record.simulation_digest) throw new Error("idempotency_conflict");
    } else if (prior && record.updated_at_epoch < prior.updated_at_epoch) {
      throw new Error("website_company_simulation_stale");
    } else {
      transaction.set(sessionRef, { [COMPANY_SIMULATION_FIELD]: record, updated_at_iso: new Date().toISOString() }, { merge: true });
    }
    return { schema_version: "website_company_simulation_acceptance.v1", accepted: true as const,
      simulation_revision: record.simulation_revision, simulation_digest: record.simulation_digest };
  });
}

/** The acceptance route's answer for a refusal: 409 with the code, or 503 for anything else (contract section 1). */
export function companySimulationRefusal(error: unknown): { status: 409 | 503; code: string } {
  const code = error instanceof Error ? error.message : "";
  return /^(source_revoked|idempotency_conflict|task_context_capture_mismatch|website_company_simulation_(stale|digest_invalid|capture_missing|request_missing|not_permitted)|website_capture_binding_)/.test(code)
    ? { status: 409, code } : { status: 503, code: "website_company_simulation_unavailable" };
}

export function companySimulationUrl(requestId: string, captureId: string, companyId: string, nowSeconds?: number): string | null {
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId) || !/^[a-f0-9]{64}$/.test(companyId)) return null;
  const ticket = createSignedDownloadTicket([TICKET_DOMAIN, requestId, captureId, companyId], nowSeconds);
  if (!ticket) return null;
  const query = new URLSearchParams({ capture: captureId, viewer: companyId, expires: String(ticket.expires), signature: ticket.signature });
  return `/api/company-media/jobs/${encodeURIComponent(requestId)}/simulation.zip?${query}`;
}

export function verifyCompanySimulationTicket(requestId: string, captureId: string, companyId: string, expires: unknown,
  signature: unknown, nowSeconds?: number): boolean {
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId) || !/^[a-f0-9]{64}$/.test(companyId)) return false;
  return Boolean(verifySignedDownloadTicket([TICKET_DOMAIN, requestId, captureId, companyId], expires, signature, nowSeconds));
}

export type CompanySimulationFetch =
  | { ok: true; status: 200 | 206; headers: Record<string, string>; body: Readable }
  | { ok: false; status: 404 | 416 | 503; contentRange?: string | null; issuerRefused?: boolean };

/**
 * One read through the signed Pipeline route (contract section 2), the browser's one range forwarded as is. The answer
 * must name the stored digest. A whole read must be the stored size, and its bytes are hashed on the way: when they do
 * not match the stored digest the stream errors before it ends, so the browser never gets a complete file. A range read
 * must state the stored size as its total.
 */
export async function fetchCompanySimulation(requestId: string, reference: WebsiteCompanySimulation, range: string | null,
  fetcher: typeof fetch = fetch): Promise<CompanySimulationFetch> {
  const origin = signedWebsitePipelineRequest(
    `/api/live-pipeline/website-company-simulations/${encodeURIComponent(reference.capture_id)}/simulation.zip`, "",
    { request_id: requestId, digest: reference.digest });
  if (!origin) return { ok: false, status: 503 };
  const response = await fetcher(origin.url, { headers: { ...origin.headers, ...(range ? { Range: range } : {}) }, redirect: "error" });
  if (response.status === 416) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, status: 416, contentRange: response.headers.get("content-range") };
  }
  if ((response.status !== 200 && response.status !== 206) || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, status: response.status === 404 ? 404 : 503, issuerRefused: response.status === 403 };
  }
  const contentRange = response.headers.get("content-range");
  const total = response.status === 206 ? Number(/\/(\d+)$/.exec(contentRange ?? "")?.[1]) : Number(response.headers.get("content-length"));
  if (response.headers.get("x-blueprint-artifact-sha256") !== reference.digest || total !== reference.size_bytes
    || (response.status === 206 && !contentRange)) {
    await response.body.cancel().catch(() => undefined);
    return { ok: false, status: 503 };
  }
  const headers: Record<string, string> = { "Content-Type": "application/zip", "Accept-Ranges": "bytes",
    "Content-Disposition": `attachment; filename="${COMPANY_SIMULATION_FILENAME}"` };
  const length = response.headers.get("content-length");
  if (length) headers["Content-Length"] = length;
  if (response.status === 206) headers["Content-Range"] = contentRange!;
  let body = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>);
  if (response.status === 200) {
    const expected = reference.digest.slice("sha256:".length);
    const hash = createHash("sha256");
    let received = 0;
    // The latest chunk is held back until the whole file has hashed: bytes that do not match never complete the file.
    let held: Buffer | null = null;
    body = body.pipe(new Transform({
      transform(chunk: Buffer, _encoding, done) {
        received += chunk.length;
        if (received > reference.size_bytes) return done(new Error("website_company_simulation_mismatch"));
        hash.update(chunk);
        const previous = held;
        held = chunk;
        done(null, previous ?? undefined);
      },
      flush(done) {
        if (received !== reference.size_bytes || hash.digest("hex") !== expected) return done(new Error("website_company_simulation_mismatch"));
        done(null, held ?? undefined);
      },
    }));
  }
  return { ok: true, status: response.status as 200 | 206, headers, body };
}

export { forwardableRange };
