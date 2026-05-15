// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import {
  createCaptureHandoffToken,
  verifyCaptureHandoffToken,
} from "../utils/capture-handoff-token";

describe("capture handoff tokens", () => {
  beforeEach(() => {
    process.env.BLUEPRINT_CAPTURE_HANDOFF_TOKEN_SECRET = "test-capture-handoff-secret";
  });

  it("signs request and capture job ids without target details in the token payload", () => {
    const token = createCaptureHandoffToken({
      requestId: "req-123",
      captureJobId: "job_req-123",
    });

    const payload = verifyCaptureHandoffToken(token);

    expect(payload).toMatchObject({
      kind: "capture_handoff",
      requestId: "req-123",
      captureJobId: "job_req-123",
    });
    expect(token).not.toContain("Dock");
    expect(token).not.toContain("Warehouse");
    expect(token).not.toContain("11%20Warehouse");
  });

  it("rejects handoff tokens with a mismatched signature", () => {
    const token = createCaptureHandoffToken({
      requestId: "req-123",
      captureJobId: "job_req-123",
    });
    const [payload] = token.split(".");

    expect(verifyCaptureHandoffToken(`${payload}.bad-signature`)).toBeNull();
  });
});
