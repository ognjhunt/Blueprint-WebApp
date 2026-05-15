import crypto from "node:crypto";

export interface CaptureHandoffTokenPayload {
  kind: "capture_handoff";
  requestId: string;
  captureJobId: string;
  exp: number;
  nonce: string;
}

function getSecret() {
  return (
    process.env.BLUEPRINT_CAPTURE_HANDOFF_TOKEN_SECRET ||
    process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET ||
    process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET ||
    process.env.PIPELINE_SYNC_TOKEN ||
    "blueprint-capture-handoff-dev-secret"
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

export function createCaptureHandoffToken(
  params: { requestId: string; captureJobId: string },
  ttlSeconds = 60 * 60 * 24 * 7,
) {
  const payload: CaptureHandoffTokenPayload = {
    kind: "capture_handoff",
    requestId: params.requestId,
    captureJobId: params.captureJobId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomBytes(12).toString("base64url"),
  };
  const serialized = JSON.stringify(payload);
  return `${toBase64Url(serialized)}.${signPayload(serialized)}`;
}

export function verifyCaptureHandoffToken(token: string) {
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

    const payload = JSON.parse(serializedPayload) as CaptureHandoffTokenPayload;
    if (
      payload.kind !== "capture_handoff" ||
      !payload.requestId ||
      !payload.captureJobId ||
      payload.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
