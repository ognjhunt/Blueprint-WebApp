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
