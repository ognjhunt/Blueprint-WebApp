import crypto from "node:crypto";

const UI_COOKIE_NAME = "bp_hosted_session_ui";

interface UiTokenPayload {
  kind: "hosted_session_ui";
  sessionId: string;
  exp: number;
}

function getSecret() {
  return (
    process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET ||
    process.env.PIPELINE_SYNC_TOKEN ||
    "blueprint-hosted-session-ui-dev-secret"
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

export function createHostedSessionUiToken(sessionId: string, ttlSeconds = 300) {
  const payload: UiTokenPayload = {
    kind: "hosted_session_ui",
    sessionId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const serialized = JSON.stringify(payload);
  return `${toBase64Url(serialized)}.${signPayload(serialized)}`;
}

export function verifyHostedSessionUiToken(token: string, sessionId: string): UiTokenPayload | null {
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
    const payload = JSON.parse(serializedPayload) as UiTokenPayload;
    if (payload.kind !== "hosted_session_ui" || payload.sessionId !== sessionId || payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader?: string) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, entry) => {
    const [rawKey, ...rest] = entry.trim().split("=");
    if (!rawKey) {
      return acc;
    }
    acc[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export function getHostedSessionUiCookieName() {
  return UI_COOKIE_NAME;
}
