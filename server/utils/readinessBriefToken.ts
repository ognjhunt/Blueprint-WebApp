/**
 * A read-only link to one job's printable robot readiness brief.
 *
 * The brief is made to be printed or saved as a PDF and handed to whoever has
 * to agree, and browsers print a page's address on it. The owner's job link
 * cannot be that address: it confirms the brief, books the pilot and withdraws
 * recording consent. This link only reads the brief, so the printout can carry
 * it safely.
 *
 * Same construction as the capture link (`captureUploadToken.ts`): one secret,
 * a base64url payload plus an HMAC. The `kind` is what keeps them apart, so a
 * brief link never opens anything a capture or review link opens, nor the
 * reverse.
 */
import crypto from "node:crypto";

/** Long enough to sit in someone's inbox while they decide, and it only ever reads. */
export const READINESS_BRIEF_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

interface ReadinessBriefTokenPayload {
  kind: "readiness_brief";
  requestId: string;
  exp: number;
}

function getSecret() {
  const secret = (
    process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET?.trim() ||
    process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET?.trim() ||
    process.env.PIPELINE_SYNC_TOKEN?.trim()
  );
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Readiness brief signing secret is required");
  }
  return secret || "blueprint-request-review-dev-secret";
}

function sign(serialized: string) {
  return crypto.createHmac("sha256", getSecret()).update(serialized).digest("base64url");
}

export function createReadinessBriefToken(requestId: string, ttlSeconds = READINESS_BRIEF_TOKEN_TTL_SECONDS) {
  const payload: ReadinessBriefTokenPayload = {
    kind: "readiness_brief",
    requestId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const serialized = JSON.stringify(payload);
  return `${Buffer.from(serialized, "utf-8").toString("base64url")}.${sign(serialized)}`;
}

/** The job a genuine, unexpired brief link was minted for; null for anything else. */
export function verifyReadinessBriefToken(token: string): string | null {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) return null;
  let serialized: string;
  try {
    serialized = Buffer.from(encodedPayload, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const expected = Buffer.from(sign(serialized), "utf-8");
  const provided = Buffer.from(signature, "utf-8");
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  let payload: ReadinessBriefTokenPayload;
  try {
    payload = JSON.parse(serialized) as ReadinessBriefTokenPayload;
  } catch {
    return null;
  }
  if (payload?.kind !== "readiness_brief" || typeof payload.requestId !== "string" || !payload.requestId) return null;
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 < Date.now()) return null;
  return payload.requestId;
}

/** The brief's page, relative to the site's origin. */
export function readinessBriefPathFor(requestId: string) {
  return `/capture-upload/brief/${createReadinessBriefToken(requestId)}`;
}
