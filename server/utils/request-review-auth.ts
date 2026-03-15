import crypto from "node:crypto";

const REQUEST_REVIEW_COOKIE_NAME = "bp_request_review";

interface RequestReviewTokenPayload {
  kind: "request_review";
  requestId: string;
  exp: number;
}

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

export function createRequestReviewToken(requestId: string, ttlSeconds = 60 * 60 * 24 * 14) {
  const payload: RequestReviewTokenPayload = {
    kind: "request_review",
    requestId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const serialized = JSON.stringify(payload);
  return `${toBase64Url(serialized)}.${signPayload(serialized)}`;
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

