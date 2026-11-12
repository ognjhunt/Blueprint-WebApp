/**
 * "Download the simulation" for an approved deployment company (package E, E9 A): one zip the Pipeline makes when the
 * job's simulation is published (scene files, the object, the success rule, a short README). Only its identity is
 * stored, at `captureUploadSessions/{captureId}.company_simulation`; the bytes stay with the Pipeline and reach a
 * company through `GET /api/company-media/jobs/:jobId/simulation.zip`, behind a 15-minute ticket bound to the viewer,
 * the job and the capture. Every request re-reads `teamJobAccess` and the viewer's approval.
 *
 * PROVISIONAL (2026-11-12): the Pipeline's contract (`scratchpad/e2e/COMPANY_SIMULATION_CONTRACT.md`) was not written
 * when this was built. Until a reference that this reader accepts is stored, the page says "The simulation is not
 * finished yet." and offers no button, and the two tested answers are not offered. Align the reference fields, the
 * acceptance route and the Pipeline read path with the contract when it lands.
 */
import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { WEBSITE_ATLAS_CAPTURE_ID, WEBSITE_ATLAS_REQUEST_ID } from "./websiteAtlasPreview";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";

export const COMPANY_SIMULATION_FIELD = "company_simulation";
export const MAX_COMPANY_SIMULATION_BYTES = 2 * 1024 * 1024 * 1024;
const TICKET_DOMAIN = "website_company_simulation_download";

export interface CompanySimulationReference { capture_id: string; digest: string; size_bytes: number }

/** The stored package of this capture, when it reads as ready; anything else is treated as "not finished yet". */
export function storedCompanySimulation(session: Record<string, any> | undefined, captureId: string): CompanySimulationReference | null {
  const value = session?.[COMPANY_SIMULATION_FIELD];
  if (!value || typeof value !== "object" || value.state !== "ready" || value.capture_id !== captureId
    || typeof value.schema_version !== "string" || !value.schema_version.startsWith("website_company_simulation.")
    || typeof value.digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.digest)
    || !Number.isInteger(value.size_bytes) || value.size_bytes < 1 || value.size_bytes > MAX_COMPANY_SIMULATION_BYTES) return null;
  return { capture_id: captureId, digest: value.digest, size_bytes: value.size_bytes };
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

/** The signed Pipeline read for the zip (provisional path, mirroring the company clip's). */
export function companySimulationPipelineRequest(requestId: string, reference: CompanySimulationReference) {
  return signedWebsitePipelineRequest(`/api/live-pipeline/website-company-simulations/${encodeURIComponent(reference.capture_id)}/simulation.zip`,
    "", { request_id: requestId, digest: reference.digest });
}
