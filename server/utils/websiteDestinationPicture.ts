/**
 * The place question's picture (2026-11-12): ONE frame of the site's own private video, with the object outlined where
 * it starts and the scored area drawn in green. It is delivered only to the job's own page, the way its scene preview
 * is: the owner's status read mints a 15-minute ticket for exactly this job, capture and picture; the image route
 * re-checks the ticket and the job's rights on every request and fetches the bytes through the signed Pipeline read,
 * checked against the question's digest. Never a public URL, never in an email, never logged.
 */
import { createHash } from "node:crypto";
import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { WEBSITE_ATLAS_CAPTURE_ID, WEBSITE_ATLAS_REQUEST_ID } from "./websiteAtlasPreview";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";

const TICKET_DOMAIN = "website_destination_picture";
export const WEBSITE_DESTINATION_PICTURE_ROUTE = "/api/website-destination-pictures";
/** The Pipeline's signed read of the picture (to be served beside `website-scene-previews`). */
export const PIPELINE_DESTINATION_PICTURE_PATH = (captureId: string) =>
  `/api/live-pipeline/website-destination-pictures/${encodeURIComponent(captureId)}/destination.place.png`;
export const MAX_DESTINATION_PICTURE_BYTES = 8 * 1024 * 1024;
const DIGEST = /^sha256:([a-f0-9]{64})$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The page's image address: this job, this capture, this picture, for 15 minutes. Null when it cannot be signed. */
export function destinationPictureUrl(requestId: string, captureId: string, digest: string, nowSeconds?: number): string | null {
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId) || !DIGEST.test(digest)) return null;
  const ticket = createSignedDownloadTicket([TICKET_DOMAIN, requestId, captureId, digest], nowSeconds);
  if (!ticket) return null;
  const query = new URLSearchParams({ digest, expires: String(ticket.expires), signature: ticket.signature });
  return `${WEBSITE_DESTINATION_PICTURE_ROUTE}/${encodeURIComponent(requestId)}/${encodeURIComponent(captureId)}/place.png?${query}`;
}

export function verifyDestinationPictureTicket(requestId: string, captureId: string, digest: unknown,
  expires: unknown, signature: unknown, nowSeconds?: number): digest is string {
  return typeof digest === "string" && DIGEST.test(digest) && WEBSITE_ATLAS_REQUEST_ID.test(requestId)
    && WEBSITE_ATLAS_CAPTURE_ID.test(captureId)
    && verifySignedDownloadTicket([TICKET_DOMAIN, requestId, captureId, digest], expires, signature, nowSeconds);
}

/** The picture's bytes through the signed Pipeline read: a PNG, bounded, and exactly the digest the question names. */
export async function fetchDestinationPicture(requestId: string, captureId: string, digest: string,
  fetcher: typeof fetch = fetch): Promise<Buffer> {
  const hex = DIGEST.exec(digest)?.[1];
  if (!hex) throw new Error("website_destination_picture_invalid");
  const origin = signedWebsitePipelineRequest(PIPELINE_DESTINATION_PICTURE_PATH(captureId), "", { request_id: requestId, digest });
  if (!origin) throw new Error("website_destination_picture_not_configured");
  const response = await fetcher(origin.url, { headers: origin.headers, redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > MAX_DESTINATION_PICTURE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("website_destination_picture_unavailable");
  }
  const reader = response.body.getReader(); const chunks: Buffer[] = []; let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      length += chunk.value.length;
      if (length > MAX_DESTINATION_PICTURE_BYTES) throw new Error("website_destination_picture_unavailable");
      chunks.push(Buffer.from(chunk.value));
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = Buffer.concat(chunks);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE) || createHash("sha256").update(bytes).digest("hex") !== hex)
    throw new Error("website_destination_picture_mismatch");
  return bytes;
}
