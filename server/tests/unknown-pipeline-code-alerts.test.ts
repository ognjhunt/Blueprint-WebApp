// @vitest-environment node
/**
 * Review, 2026-11-12: an unknown Pipeline code is recorded where it is ingested: the first time per job, slot and code,
 * one marker and the real ops alert. At most `UNKNOWN_CODE_ALERTS_PER_INGEST` per ingest, one at a time, then one
 * summary line with the count.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const seam = vi.hoisted(() => ({ alert: vi.fn(), error: vi.fn(), inFlight: 0, maxInFlight: 0 }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: seam.error, debug: vi.fn() } }));
vi.mock("../utils/opsProcessAlerts", () => ({ sendRateLimitedOpsAlert: seam.alert }));
const { noteUnknownPipelineCode, noteUnknownPipelineCodes, UNKNOWN_CODE_ALERTS_PER_INGEST, UNKNOWN_PIPELINE_CODES_COLLECTION } =
  await import("../utils/unknownPipelineCode");

const markers = () => [...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith(`${UNKNOWN_PIPELINE_CODES_COLLECTION}/`));

describe("unknown Pipeline code alerts", () => {
  beforeEach(() => {
    sharedFakeFirestoreState.docs.clear();
    seam.alert.mockReset(); seam.error.mockReset(); seam.inFlight = 0; seam.maxInFlight = 0;
    seam.alert.mockImplementation(async () => { seam.inFlight++; seam.maxInFlight = Math.max(seam.maxInFlight, seam.inFlight);
      await new Promise(resolve => setTimeout(resolve, 1)); seam.inFlight--; });
  });
  it("sends the ops alert beside the marker once per job, slot and code", async () => {
    expect(await noteUnknownPipelineCode("job-1", "screening.flag", "brand_new")).toBe(true);
    expect(await noteUnknownPipelineCode("job-1", "screening.flag", "brand_new")).toBe(false);
    expect(markers()).toHaveLength(1);
    expect(seam.alert).toHaveBeenCalledTimes(1);
    expect(seam.alert.mock.calls[0][0]).toBe("pipeline_code_unknown:screening.flag:brand_new");
  });
  it("still records the marker when the ops alert fails", async () => {
    seam.alert.mockRejectedValueOnce(new Error("slack down"));
    expect(await noteUnknownPipelineCode("job-1", "screening.flag", "other")).toBe(true);
    expect(markers()).toHaveLength(1);
  });
  it(`alerts at most ${5} codes per ingest, one at a time, then one summary line with the count`, async () => {
    expect(UNKNOWN_CODE_ALERTS_PER_INGEST).toBe(5);
    const found = Array.from({ length: 12 }, (_, index) => ["screening.flag", `brand_new_${index}`] as [string, string]);
    await noteUnknownPipelineCodes("job-1", [...found, found[0]]);
    expect(seam.alert).toHaveBeenCalledTimes(5);
    expect(markers()).toHaveLength(5);
    expect(seam.maxInFlight).toBe(1);
    const summary = seam.error.mock.calls.filter(call => call[0]?.alert === "pipeline_code_unknown_summary");
    expect(summary).toHaveLength(1);
    expect(summary[0][0]).toMatchObject({ more: 7 });
  });
});
