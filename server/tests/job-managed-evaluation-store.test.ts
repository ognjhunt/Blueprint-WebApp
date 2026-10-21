// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ queryError: null as unknown, sourceReadError: null as unknown }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: {
  collection: (name: string) => ({
    doc: () => ({ get: async () => {
      if (name === "captureUploadSessions" && state.sourceReadError) throw state.sourceReadError;
      const source = state.sourceReadError && name === "inboundRequests" ? { job_evidence_source: {
        schema_version: "job_evidence_source_binding.v1", job_id: "job-one", capture_session_id: "source-one", intake_id: "intake-one",
        source_capture_digest: `sha256:${"b".repeat(64)}`, brief_digest: `sha256:${"a".repeat(64)}`,
        task_inventory_digest: `sha256:${"c".repeat(64)}`, command_request_id: "command-one", approved_task_digest: `sha256:${"d".repeat(64)}`,
      } } : undefined;
      return { exists: Boolean(source), data: () => source };
    } }),
    where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => {
      if (state.queryError) throw state.queryError;
      return { docs: [] };
    } }) }) }),
  }),
} }));

const { loadManagedJobEvidenceForWorkspace } = await import("../utils/jobManagedEvaluation");
beforeEach(() => { state.queryError = null; state.sourceReadError = null; });

describe("managed evidence workspace availability", () => {
  it("distinguishes a genuine empty history from a temporarily unavailable index", async () => {
    expect(await loadManagedJobEvidenceForWorkspace("job-one", `sha256:${"a".repeat(64)}`)).toEqual({ managedEvidence: [] });
    state.queryError = { code: 9, message: "The query requires an index." };
    expect(await loadManagedJobEvidenceForWorkspace("job-one", `sha256:${"a".repeat(64)}`))
      .toEqual({ managedEvidence: [], managedEvidenceUnavailable: true });
    state.queryError = { code: "FAILED_PRECONDITION", details: "Composite index is still building" };
    expect(await loadManagedJobEvidenceForWorkspace("job-one", `sha256:${"a".repeat(64)}`))
      .toEqual({ managedEvidence: [], managedEvidenceUnavailable: true });
  });

  it("does not hide unrelated store errors or preconditions", async () => {
    for (const error of [{ code: 13, message: "Internal query failure" }, { code: 9, message: "Unrelated precondition" },
      { code: 7, message: "Index read permission denied" }]) {
      state.queryError = error;
      await expect(loadManagedJobEvidenceForWorkspace("job-one", `sha256:${"a".repeat(64)}`)).rejects.toBe(error);
    }
    state.queryError = null;
    state.sourceReadError = { code: 13, message: "Source store unavailable" };
    await expect(loadManagedJobEvidenceForWorkspace("job-one", `sha256:${"a".repeat(64)}`)).rejects.toBe(state.sourceReadError);
  });
});
