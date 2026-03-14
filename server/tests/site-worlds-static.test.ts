// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (name: string) => {
      if (name !== "inboundRequests") {
        throw new Error(`Unexpected collection: ${name}`);
      }
      return {
        orderBy: () => {
          throw new Error("dynamic catalog lookup should not run for static site worlds");
        },
      };
    },
  },
  storageAdmin: null,
}));

import { getPublicSiteWorldById } from "../utils/site-worlds";

describe("getPublicSiteWorldById", () => {
  it("returns the static demo site without reading the live catalog", async () => {
    await expect(getPublicSiteWorldById("siteworld-f5fd54898cfb")).resolves.toMatchObject({
      id: "siteworld-f5fd54898cfb",
    });
  });
});
