import { describe, expect, it } from "vitest";
import { privateWorkLogPath } from "../utils/blueprintWorkLogPrivacy";
describe("Blueprint Work request-log privacy", () => {
  it("removes connection handles and all OAuth query parameters", () => {
    expect(privateWorkLogPath("/api/blueprint-work/consent/private-flow?token=secret")).toBe("/api/blueprint-work/consent/[flow]");
    expect(privateWorkLogPath("/api/blueprint-work/oauth/authorize?state=secret&code_challenge=private")).toBe("/api/blueprint-work/oauth/authorize");
    expect(privateWorkLogPath("/app/connect/chatgpt?flow=private")).toBe("/app/connect/chatgpt");
    expect(privateWorkLogPath("/api/unrelated?filter=public")).toBe("/api/unrelated?filter=public");
  });
});
