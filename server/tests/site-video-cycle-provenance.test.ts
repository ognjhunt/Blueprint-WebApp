// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("offline_only"); }) }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, storageAdmin: null, default: {} }));
import { siteVideoEvidenceOutputSchema } from "../agents/tasks/site-video-evidence";
import { summariseVideoEvidence } from "../utils/siteVideoEvidence";

function source(cycles: unknown[], median: number | null = 15, band: string | null = "under_30s") {
  return siteVideoEvidenceOutputSchema.parse({
    footage_status: "usable", footage_status_reason: null, summary: "Synthetic cycle contract case.", observations: [],
    cycle_measurement: { cycles, median_cycle_seconds: median, implied_band: band, note: "Synthetic model claim." },
    people_present: { max_visible_at_once: 0, relationship_to_work: "none_visible", note: "" },
    not_evidenced: [], privacy_flag: false,
  });
}

describe("cycle facts require a supporting complete interval", () => {
  it.each([
    ["no intervals", []],
    ["partial interval", [{ start_seconds: 0, end_seconds: 15, complete: false }]],
    ["reversed interval", [{ start_seconds: 15, end_seconds: 0, complete: true }]],
    ["zero-length interval", [{ start_seconds: 15, end_seconds: 15, complete: true }]],
  ])("keeps %s unmeasured instead of copying model numbers", (_name, cycles) => {
    const raw = source(cycles as unknown[]), copy = structuredClone(raw);
    const result = summariseVideoEvidence(raw, "offline");
    expect(result.measured_cycle_seconds).toBeNull();
    expect(result.measured_cycle_band).toBeNull();
    expect(raw).toEqual(copy);
  });

  it("does not call a number measured when it disagrees with the supplied complete intervals", () => {
    const result = summariseVideoEvidence(source([{ start_seconds: 0, end_seconds: 45, complete: true }]), "offline");
    expect(result.measured_cycle_seconds).not.toBe(15);
    expect(result.measured_cycle_band).not.toBe("under_30s");
  });

  it("preserves a consistent complete cycle", () => {
    const result = summariseVideoEvidence(source([{ start_seconds: 0, end_seconds: 15, complete: true }]), "offline");
    expect(result.measured_cycle_seconds).toBe(15);
    expect(result.measured_cycle_band).toBe("under_30s");
  });

  it("derives the median from distinct complete intervals and ignores a partial sibling", () => {
    const first = { start_seconds: 0, end_seconds: 10, complete: true };
    const raw = source([first, first, { start_seconds: 10, end_seconds: 40, complete: true },
      { start_seconds: 40, end_seconds: 41, complete: false }], 999, "over_ten_min");
    const copy = structuredClone(raw), result = summariseVideoEvidence(raw, "offline");
    expect(result.measured_cycle_seconds).toBe(20);
    expect(result.measured_cycle_band).toBe("under_30s");
    expect(raw).toEqual(copy);
  });

  it("abstains on overlapping claimed repetitions", () => {
    const result = summariseVideoEvidence(source([{ start_seconds: 0, end_seconds: 10, complete: true },
      { start_seconds: 5, end_seconds: 20, complete: true }]), "offline");
    expect(result.measured_cycle_seconds).toBeNull();
    expect(result.measured_cycle_band).toBeNull();
  });

  it("does not measure unusable footage even with complete intervals", () => {
    const raw = source([{ start_seconds: 0, end_seconds: 15, complete: true }]);
    raw.footage_status = "unusable";
    const result = summariseVideoEvidence(raw, "offline");
    expect(result.measured_cycle_seconds).toBeNull();
    expect(result.measured_cycle_band).toBeNull();
  });

  it.each([[29, "under_30s"], [30, "thirty_to_two_min"], [120, "thirty_to_two_min"],
    [121, "two_to_ten_min"], [600, "two_to_ten_min"], [601, "over_ten_min"]])(
    "classifies %s seconds using existing gate labels", (seconds, band) => {
      const result = summariseVideoEvidence(source([{ start_seconds: 0, end_seconds: seconds, complete: true }], null, null), "offline");
      expect(result.measured_cycle_seconds).toBe(seconds);
      expect(result.measured_cycle_band).toBe(band);
    });
});
