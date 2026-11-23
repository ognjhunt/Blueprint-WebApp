// @vitest-environment node
/**
 * What one video reading reports when it ends without a finding, as the queue needs to tell it apart: a wait for
 * something not there yet, a provider outage, or a read that was tried and failed. Before, every reading that ended
 * without telling the queue why was written `waiting_prerequisite` and counted as a failed attempt, so three in a few
 * minutes parked the job for a person although nothing had been read; and the video adapter returns its own errors
 * (the budget's "a call for this capture is in flight" among them) as a failed result, never thrown, so the wait
 * handling for that refusal never ran.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const seams = vi.hoisted(() => ({ run: vi.fn(), brief: vi.fn() }));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const fake = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } }, dbAdmin: fake.sharedFakeFirestore,
    storageAdmin: { bucket: () => ({ file: (name: string) => ({
      exists: async () => [name.endsWith(".mp4")],
      getSignedUrl: async () => [`https://storage.example/${name}`],
    }) }) } };
});
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../agents/runtime", () => ({ runAgentTask: seams.run }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: seams.brief, isPlaceholderSummary: () => false, nameUnnamedTask: vi.fn() }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { reviewCaptureCoverage } from "../utils/captureCoverageReview";

const BRIEF = { requestId: "req-1", summary: "Move the tray to the other end of the table", proposed: [] };
const failedRun = (error: string, artifacts: Record<string, unknown> = {}) => ({ status: "failed", output: null, error, artifacts });

async function readOnce(params: Partial<Parameters<typeof reviewCaptureCoverage>[0]> = {}) {
  const told = { waited: [] as string[], outage: [] as unknown[], failed: [] as string[] };
  const finding = await reviewCaptureCoverage({ requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1",
    onWaiting: reason => told.waited.push(reason), onProviderOutage: found => told.outage.push(found),
    onFailed: reason => told.failed.push(reason), ...params });
  return { finding, ...told };
}

beforeEach(() => {
  state.docs.clear();
  seams.run.mockReset();
  seams.brief.mockReset();
  seams.brief.mockResolvedValue(BRIEF);
});

describe("a reading that ends without a finding says why", () => {
  it("waits, and is not a failed read, when the budget refuses because a call for this capture is in flight", async () => {
    seams.run.mockResolvedValue(failedRun("gemini_video_failed: coverage_budget_call_in_flight"));
    expect(await readOnce()).toEqual({ finding: null, waited: ["coverage_budget_call_in_flight"], outage: [], failed: [] });
  });

  it("waits while the job's brief is not on file yet, before any model call", async () => {
    seams.brief.mockResolvedValue(null);
    expect(await readOnce()).toEqual({ finding: null, waited: ["coverage_brief_missing"], outage: [], failed: [] });
    expect(seams.run).not.toHaveBeenCalled();
  });

  it("waits while the walkthrough is not in storage yet, before any model call", async () => {
    const { storageAdmin } = await import("../../client/src/lib/firebaseAdmin");
    const bucket = vi.spyOn(storageAdmin as any, "bucket").mockReturnValue({ file: () => ({ exists: async () => [false] }) });
    expect(await readOnce()).toEqual({ finding: null, waited: ["coverage_video_not_stored"], outage: [], failed: [] });
    expect(seams.run).not.toHaveBeenCalled();
    bucket.mockRestore();
  });

  it("is an outage when the provider refused before answering anything", async () => {
    seams.run.mockResolvedValue(failedRun("gemini_video_provider_failed: Gemini returned HTTP 429"));
    expect(await readOnce()).toEqual({ finding: null, waited: [], outage: [{ provider: "gemini", cause: "rate_limited" }], failed: [] });
  });

  it("is a failed read, not a free retry, when the provider refused after it answered the paid video analysis", async () => {
    seams.run.mockResolvedValue(failedRun("gemini_output_correction_provider_failed: Gemini returned HTTP 429",
      { usage_samples: [{ promptTokenCount: 100, candidatesTokenCount: 10 }] }));
    expect(await readOnce()).toEqual({ finding: null, waited: [], outage: [], failed: ["provider_failed_after_paid_answer"] });
  });

  it("names the job's spending cap when it leaves no room for a paid read", async () => {
    seams.run.mockResolvedValue(failedRun("gemini_video_failed: coverage_budget_job_cap_reached"));
    expect(await readOnce()).toEqual({ finding: null, waited: [], outage: [], failed: ["coverage_budget_job_cap_reached"] });
  });

  it("is a failed read with the adapter's own code when the read itself went wrong", async () => {
    seams.run.mockResolvedValue(failedRun("video_fetch_failed: Task video link returned HTTP 403"));
    expect(await readOnce()).toEqual({ finding: null, waited: [], outage: [], failed: ["video_fetch_failed"] });
    seams.run.mockResolvedValue(failedRun("audio_strip_unavailable: no ffmpeg"));
    expect((await readOnce()).failed).toEqual(["audio_strip_unavailable"]);
  });
});
