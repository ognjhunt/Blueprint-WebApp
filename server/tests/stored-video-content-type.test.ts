// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "t" } } },
  dbAdmin: null, storageAdmin: null, authAdmin: null,
}));

const { storedVideoContentType } = await import("../routes/self-capture-uploads");

describe("the type a walkthrough is stored under", () => {
  it("keeps a video type the browser named", () => {
    expect(storedVideoContentType("mov", "video/quicktime")).toBe("video/quicktime");
    expect(storedVideoContentType("mp4", "video/mp4")).toBe("video/mp4");
  });

  it("uses the checked extension when the browser sent a generic or no type", () => {
    // Chromium sends application/octet-stream for an uppercase .MOV.
    expect(storedVideoContentType("mov", "application/octet-stream")).toBe("video/quicktime");
    expect(storedVideoContentType("mp4", "")).toBe("video/mp4");
    expect(storedVideoContentType("mov", undefined)).toBe("video/quicktime");
  });
});
