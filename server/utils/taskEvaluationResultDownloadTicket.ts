import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_TTL_SECONDS = 15 * 60;

function ticketSecret() {
  return String(process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET || "").trim();
}

/** NUL-separated fields, then the expiry. Identifiers never contain NUL, so a
 * different field count (a domain prefix) can never sign another domain's URL. */
function payload(fields: readonly string[], expires: number) {
  return [...fields, String(expires)].join("\0");
}

export function createSignedDownloadTicket(
  fields: readonly string[],
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const secret = ticketSecret();
  if (!secret) return null;
  const expires = nowSeconds + MAX_TTL_SECONDS;
  const signature = createHmac("sha256", secret)
    .update(payload(fields, expires))
    .digest("hex");
  return { expires, signature };
}

export function verifySignedDownloadTicket(
  fields: readonly string[],
  expiresValue: unknown,
  signatureValue: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const secret = ticketSecret();
  const expires = Number(expiresValue);
  const signature = String(signatureValue || "");
  if (
    !secret
    || !Number.isInteger(expires)
    || expires < nowSeconds
    || expires > nowSeconds + MAX_TTL_SECONDS
    || !/^[0-9a-f]{64}$/.test(signature)
  ) return false;
  const expected = createHmac("sha256", secret)
    .update(payload(fields, expires))
    .digest("hex");
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

export function createTaskEvaluationResultDownloadTicket(
  recordId: string,
  artifactId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  return createSignedDownloadTicket([recordId, artifactId], nowSeconds);
}

export function verifyTaskEvaluationResultDownloadTicket(
  recordId: string,
  artifactId: string,
  expiresValue: unknown,
  signatureValue: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  return verifySignedDownloadTicket([recordId, artifactId], expiresValue, signatureValue, nowSeconds);
}
