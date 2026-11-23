/**
 * The address an approved company's browser loads a job's thumbnail from (`jobThumbnail.ts`). An `<img>` or a video
 * poster sends no sign-in token, so the address carries a short ticket bound to the job and the company, as the
 * company's video does (`companyClipUrl`). The route still checks, on every read, that the company may see jobs and
 * that the job is listed (`companyMediaRefusal`).
 */
import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";

const TICKET_DOMAIN = "job-thumbnail-view.v1";
const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const COMPANY_ID = /^[a-f0-9]{64}$/;

export function jobThumbnailViewUrl(jobId: string, companyId: string, nowSeconds?: number): string | null {
  if (!JOB_ID.test(jobId) || !COMPANY_ID.test(companyId)) return null;
  const ticket = createSignedDownloadTicket([TICKET_DOMAIN, jobId, companyId], nowSeconds);
  if (!ticket) return null;
  const query = new URLSearchParams({ viewer: companyId, expires: String(ticket.expires), signature: ticket.signature });
  return `/api/site-worlds/tasks/${encodeURIComponent(jobId)}/thumbnail?${query}`;
}

export function verifyJobThumbnailTicket(jobId: string, companyId: string, expires: unknown, signature: unknown,
  nowSeconds?: number): boolean {
  if (!JOB_ID.test(jobId) || !COMPANY_ID.test(companyId)) return false;
  return Boolean(verifySignedDownloadTicket([TICKET_DOMAIN, jobId, companyId], expires, signature, nowSeconds));
}
