import crypto from "node:crypto";

const REQUEST_REVIEW_COOKIE_NAME = "bp_request_review";

interface RequestReviewTokenPayload {
  kind: "request_review" | "site_claim";
  requestId: string;
  exp: number;
}

/** Claim links live longer than review links: they are the standing way back. */
const SITE_CLAIM_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret() {
  const secret = (
    process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET?.trim() ||
    process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET?.trim() ||
    process.env.PIPELINE_SYNC_TOKEN?.trim()
  );
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Capture and review signing secret is required");
  }
  return secret || "blueprint-request-review-dev-secret";
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

export interface AccountInvitationPayload {
  kind: "account_invitation";
  email: string;
  workspaceType: "site_operator" | "robot_team";
  sourceId: string;
  revision: string;
  exp: number;
}

/** A separate purpose prevents a review/claim link from authorizing signup. */
export function createAccountInvitationToken(
  invitation: Omit<AccountInvitationPayload, "kind" | "exp">,
  ttlSeconds = 60 * 60 * 24 * 7,
) {
  const serialized = JSON.stringify({ ...invitation, kind: "account_invitation", exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  return `${toBase64Url(serialized)}.${signPayload(serialized)}`;
}

export function verifyAccountInvitationToken(token: string): AccountInvitationPayload | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return null;
    const serialized = fromBase64Url(parts[0]);
    const actual = Buffer.from(parts[1]), expected = Buffer.from(signPayload(serialized));
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(serialized) as AccountInvitationPayload;
    if (payload.kind !== "account_invitation" || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()
      || !["site_operator", "robot_team"].includes(payload.workspaceType)
      || typeof payload.email !== "string" || !payload.email.includes("@")
      || typeof payload.sourceId !== "string" || !payload.sourceId || payload.sourceId.includes("/")
      || typeof payload.revision !== "string" || !payload.revision) return null;
    return payload;
  } catch { return null; }
}

export function createRequestReviewToken(requestId: string, ttlSeconds = 60 * 60 * 24 * 14) {
  const payload: RequestReviewTokenPayload = {
    kind: "request_review",
    requestId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const serialized = JSON.stringify(payload);
  return `${toBase64Url(serialized)}.${signPayload(serialized)}`;
}

export function createSiteClaimToken(requestId: string, ttlSeconds = SITE_CLAIM_TTL_SECONDS) {
  const payload: RequestReviewTokenPayload = {
    kind: "site_claim",
    requestId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const serialized = JSON.stringify(payload);
  return `${toBase64Url(serialized)}.${signPayload(serialized)}`;
}

export function verifySiteClaimToken(token: string) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const serializedPayload = fromBase64Url(encodedPayload);
    const expectedSignature = signPayload(serializedPayload);
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      return null;
    }

    const payload = JSON.parse(serializedPayload) as RequestReviewTokenPayload;
    if (payload.kind !== "site_claim" || payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyRequestReviewToken(token: string, requestId: string) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const serializedPayload = fromBase64Url(encodedPayload);
    const expectedSignature = signPayload(serializedPayload);
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      return null;
    }

    const payload = JSON.parse(serializedPayload) as RequestReviewTokenPayload;
    if (
      payload.kind !== "request_review" ||
      payload.requestId !== requestId ||
      payload.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getRequestReviewCookieName() {
  return REQUEST_REVIEW_COOKIE_NAME;
}
