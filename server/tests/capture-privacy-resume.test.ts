// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
    dbAdmin: sharedFakeFirestore,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { resumeHeldPrivacyScreen } = await import("../utils/capturePrivacyResume");
const capture = { requestId: "req-1", captureId: "cap-1", sceneId: "scene-1" };

function seed(eligibility: string, captureId = capture.captureId) {
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    capture_privacy_screen: { capture_id: captureId, eligibility, attempts: 3 },
  });
}

beforeEach(() => sharedFakeFirestoreState.docs.clear());

describe("legacy upload privacy holds", () => {
  it.each(["pending", "rejected"])("releases a %s hold without another person review", async (eligibility) => {
    seed(eligibility);
    const outcome = await resumeHeldPrivacyScreen(capture);
    expect(outcome).toMatchObject({ action: "cleared", result: {
      proceed: true, eligibility: "unscreened", outcome: "not_reviewed",
    } });
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, Record<string, unknown>>;
    expect(stored.capture_privacy_screen).toMatchObject({
      capture_id: "cap-1", eligibility: "unscreened", proceeded: true, attempts: 3,
    });
  });

  it("does not alter an unrelated or already admitted capture", async () => {
    seed("rejected", "different-capture");
    expect(await resumeHeldPrivacyScreen(capture)).toEqual({ action: "nothing_held" });
    seed("approved");
    expect(await resumeHeldPrivacyScreen(capture)).toEqual({ action: "nothing_held" });
  });
});
