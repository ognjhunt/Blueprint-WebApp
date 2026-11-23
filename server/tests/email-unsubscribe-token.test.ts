// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin.js", () => ({ default: {}, dbAdmin: null }));

const { buildUnsubscribeUrl, createUnsubscribeToken, verifyUnsubscribeToken } = await import("../utils/email-suppression");
const { privateWorkLogPath } = await import("../utils/blueprintWorkLogPrivacy");

describe("the unsubscribe link's sealed token", () => {
  it("carries no address, and opens to the address and scope it was made for", () => {
    const url = new URL(buildUnsubscribeUrl({ email: "Person@Example.com", scope: "optional_updates" }));
    expect(url.pathname).toBe("/api/growth/email/unsubscribe");
    expect([...url.searchParams.keys()]).toEqual(["token"]);
    expect(url.toString()).not.toMatch(/person|example|%40|@/i);
    expect(verifyUnsubscribeToken(url.searchParams.get("token"))).toEqual({ email: "person@example.com", scope: "optional_updates" });
  });

  it("does not open when changed, cut short or made up", () => {
    const token = createUnsubscribeToken({ email: "person@example.com", scope: "optional_updates" });
    const flipped = `${token.slice(0, -2)}${token.endsWith("AA") ? "BB" : "AA"}`;
    for (const value of [flipped, token.slice(0, 20), "not-a-token", "", null, `${token}.x`]) {
      expect(verifyUnsubscribeToken(value)).toBeNull();
    }
  });

  it("keeps an unsubscribe link's query out of the request log, old address links included", () => {
    expect(privateWorkLogPath("/api/growth/email/unsubscribe?email=person%40example.com&scope=optional_updates"))
      .toBe("/api/growth/email/unsubscribe");
    expect(privateWorkLogPath(`/api/growth/email/unsubscribe?token=${createUnsubscribeToken({ email: "person@example.com" })}`))
      .toBe("/api/growth/email/unsubscribe");
  });
});
