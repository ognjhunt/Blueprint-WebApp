/**
 * The link a site uses to hand us a walkthrough.
 *
 * Self-capture means the person uploading has no account, no app, and no
 * reason to make one — they are a warehouse manager who filmed one aisle
 * because we asked. So the link itself has to be the credential.
 *
 * Deliberately the same construction as `request-review-auth.ts`: same secret
 * resolution, same base64url payload plus HMAC, same shape. What differs is the
 * `kind`, and that difference is load-bearing — it means a review link can
 * never be replayed as an upload link, or the reverse, even though both are
 * signed with the same secret and both name a request id.
 *
 * The TTL is short by comparison (seven days, against fourteen for review)
 * because an upload link is an invitation to write to our storage, and the
 * window in which a site actually films is days rather than weeks.
 */

import crypto from "node:crypto";

/**
 * What a capture link is allowed to do.
 *
 * The security gap this closes: the same signed link opened the camera *and*
 * confirmed the brief -- and confirming the brief is the attestation that
 * writes gate answers as `operator_stated`. So an owner who forwarded the QR to
 * a colleague meant only to film handed them the authority to attest to
 * operating facts they may have no standing over. Least privilege: filming and
 * attesting are different acts and get different links.
 *
 * - `owner`   -- the submitter's own link: film, confirm the brief, see status.
 * - `film`    -- a colleague's link: film, upload, see status. Cannot attest.
 */
export type CaptureTokenScope = "owner" | "film";

interface CaptureUploadTokenPayload {
  kind: "capture_upload";
  requestId: string;
  /** Where the video lands, fixed at issue time so the link cannot redirect it. */
  captureId: string;
  sceneId: string;
  /**
   * The link's capability. Absent on tokens minted before the split, which were
   * all the submitter's own link -- so absent reads as `owner`, and no
   * already-issued link loses a capability it had.
   */
  scope?: CaptureTokenScope;
  exp: number;
}

export const CAPTURE_UPLOAD_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  return (
    process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET ||
    process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET ||
    process.env.PIPELINE_SYNC_TOKEN ||
    "blueprint-request-review-dev-secret"
  );
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function signPayload(serializedPayload: string) {
  return crypto.createHmac("sha256", getSecret()).update(serializedPayload).digest("base64url");
}

/**
 * The site's link to its own submission.
 *
 * One definition, because two callers now build it: the email that goes out
 * when a capture is dispatched, and the submit response that hands it over
 * immediately. A second spelling of this URL would mean a site could be sent
 * two links to the same capture that differ by a slash.
 *
 * The ids are derived from the request rather than generated, so calling this
 * twice points at the same storage prefix instead of scattering a second empty
 * capture beside the first.
 */
export function captureUploadUrlFor(
  requestId: string,
  scope: CaptureTokenScope = "owner",
): string {
  const origin = (
    process.env.VITE_PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || "https://tryblueprint.io"
  ).replace(/\/+$/, "");

  const token = createCaptureUploadToken({
    requestId,
    sceneId: `site-${requestId}`,
    captureId: `walkthrough-${requestId}`,
    scope,
  });
  return `${origin}/capture-upload/${token}`;
}

export function createCaptureUploadToken(params: {
  requestId: string;
  captureId: string;
  sceneId: string;
  scope?: CaptureTokenScope;
  ttlSeconds?: number;
}) {
  const payload: CaptureUploadTokenPayload = {
    kind: "capture_upload",
    requestId: params.requestId,
    captureId: params.captureId,
    sceneId: params.sceneId,
    scope: params.scope ?? "owner",
    exp: Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? CAPTURE_UPLOAD_TOKEN_TTL_SECONDS),
  };
  const serialized = JSON.stringify(payload);
  return `${toBase64Url(serialized)}.${signPayload(serialized)}`;
}

/**
 * Verify a link and return where its upload is allowed to land.
 *
 * Returns null for anything wrong rather than distinguishing the failures: a
 * caller holding a bad link learns only that it does not work, which is all
 * they are entitled to know.
 */
export function verifyCaptureUploadToken(token: string): CaptureUploadTokenPayload | null {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  let serialized: string;
  try {
    serialized = fromBase64Url(encodedPayload);
  } catch {
    return null;
  }

  const expected = signPayload(serialized);
  const provided = Buffer.from(signature, "utf-8");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  if (
    provided.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(provided, expectedBuffer)
  ) {
    return null;
  }

  let payload: CaptureUploadTokenPayload;
  try {
    payload = JSON.parse(serialized) as CaptureUploadTokenPayload;
  } catch {
    return null;
  }

  // Domain separation. A `request_review` token carries a valid signature for
  // this secret, so the kind check is what stops it opening an upload.
  if (payload.kind !== "capture_upload") {
    return null;
  }
  if (!payload.requestId || !payload.captureId || !payload.sceneId) {
    return null;
  }
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 < Date.now()) {
    return null;
  }

  // Absent or unrecognised scope reads as `owner`, because every link minted
  // before this field existed was the submitter's own. A `film` link is only
  // ever one we deliberately narrowed.
  return { ...payload, scope: payload.scope === "film" ? "film" : "owner" };
}

/**
 * Where a self-captured walkthrough is written.
 *
 * This is the canonical path the `extractFrames` Cloud Function already
 * watches, which is the whole point: a video a site uploaded from a browser
 * enters exactly the same pipeline as one a capturer recorded in the app.
 * Frames, reconstruction and the Pipeline handoff are all downstream of this
 * object existing, and none of them need to know which way it arrived.
 */
export function selfCaptureObjectPath(params: {
  sceneId: string;
  captureId: string;
  extension: string;
}) {
  const extension = params.extension.replace(/^\./, "").toLowerCase();
  return `scenes/${params.sceneId}/captures/${params.captureId}/raw/walkthrough.${extension}`;
}
