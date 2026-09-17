// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";

import {
  CAPTURE_UPLOAD_TOKEN_TTL_SECONDS,
  createCaptureUploadToken,
  selfCaptureObjectPath,
  verifyCaptureUploadToken,
} from "../utils/captureUploadToken";
import { createRequestReviewToken } from "../utils/request-review-auth";

const SUBJECT = { requestId: "req-1", captureId: "cap-1", sceneId: "scene-1" };

afterEach(() => {
  vi.useRealTimers();
});

describe("the upload link is the credential", () => {
  it("round-trips the destination it was issued for", () => {
    const payload = verifyCaptureUploadToken(createCaptureUploadToken(SUBJECT));

    expect(payload).toMatchObject({
      kind: "capture_upload",
      requestId: "req-1",
      captureId: "cap-1",
      sceneId: "scene-1",
    });
  });

  it("rejects a token whose payload was edited", () => {
    // Re-point the capture at someone else's prefix and the signature no longer
    // matches, which is the only thing standing between a forwarded link and
    // another customer's storage.
    const token = createCaptureUploadToken(SUBJECT);
    const [, signature] = token.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ ...SUBJECT, kind: "capture_upload", captureId: "cap-2", exp: 9_999_999_999 }),
      "utf-8",
    ).toString("base64url");

    expect(verifyCaptureUploadToken(`${tampered}.${signature}`)).toBeNull();
  });

  it("rejects a request-review token signed with the same secret", () => {
    // Domain separation. Both tokens name a request id and both verify against
    // the same HMAC secret; only the kind stops one opening the other's door.
    const reviewToken = createRequestReviewToken("req-1");

    expect(verifyCaptureUploadToken(reviewToken)).toBeNull();
  });

  it("rejects an expired link", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createCaptureUploadToken({ ...SUBJECT, ttlSeconds: 60 });

    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"));
    expect(verifyCaptureUploadToken(token)).toBeNull();
  });

  it("expires in days, not weeks", () => {
    expect(CAPTURE_UPLOAD_TOKEN_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });

  it.each(["", "not-a-token", "a.b.c", "....", "onlyonepart"])(
    "rejects malformed input %j without throwing",
    (value) => {
      expect(verifyCaptureUploadToken(value)).toBeNull();
    },
  );
});

describe("the link's scope is a capability, not decoration", () => {
  it("defaults a freshly minted link to owner", () => {
    const payload = verifyCaptureUploadToken(createCaptureUploadToken(SUBJECT));
    expect(payload?.scope).toBe("owner");
  });

  it("carries a film scope when one is asked for", () => {
    const payload = verifyCaptureUploadToken(
      createCaptureUploadToken({ ...SUBJECT, scope: "film" }),
    );
    expect(payload?.scope).toBe("film");
  });

  it("reads a token with no scope as owner, so no already-issued link loses a capability", () => {
    // Simulate a pre-split token: same signing, no scope field. Verification
    // must normalise it to owner rather than to undefined or film.
    const legacy = createCaptureUploadToken(SUBJECT);
    // The payload is base64url(JSON).signature; strip scope from the JSON and
    // re-sign the way the signer does, to model a token minted before scope.
    const [encoded] = legacy.split(".");
    const json = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    delete json.scope;
    const serialized = JSON.stringify(json);
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const secret =
      process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET ||
      process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET ||
      process.env.PIPELINE_SYNC_TOKEN ||
      "blueprint-request-review-dev-secret";
    const sig = crypto.createHmac("sha256", secret).update(serialized).digest("base64url");
    const token = `${Buffer.from(serialized, "utf-8").toString("base64url")}.${sig}`;

    expect(verifyCaptureUploadToken(token)?.scope).toBe("owner");
  });

  it("normalises an unrecognised scope to owner rather than trusting it", () => {
    const payload = verifyCaptureUploadToken(
      createCaptureUploadToken({ ...SUBJECT, scope: "superuser" as never }),
    );
    // A minted "superuser" is not a real capability; the reader collapses
    // anything that is not "film" to owner, which is the safe existing default
    // and never a wider capability than owner.
    expect(payload?.scope).toBe("owner");
  });
});

describe("where a self-captured video lands", () => {
  it("writes to the exact prefix extractFrames already watches", () => {
    // The reason self-capture costs almost nothing: a browser upload enters the
    // same pipeline as an app capture because it lands in the same place.
    expect(
      selfCaptureObjectPath({ sceneId: "scene-1", captureId: "cap-1", extension: "mov" }),
    ).toBe("scenes/scene-1/captures/cap-1/raw/walkthrough.mov");
  });

  it("normalises the extension", () => {
    expect(
      selfCaptureObjectPath({ sceneId: "s", captureId: "c", extension: ".MP4" }),
    ).toBe("scenes/s/captures/c/raw/walkthrough.mp4");
  });
});
