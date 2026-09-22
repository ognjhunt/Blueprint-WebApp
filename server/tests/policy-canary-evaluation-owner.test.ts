// @vitest-environment node
import { describe, expect, it } from "vitest";
import { policyCanaryEvaluationOwner } from "../utils/policyCanaryEvaluationOwner";
import { evaluationOwnerFixture } from "./fixtures/policy-canary-evaluation-owner";

function fixture() {
  const row = evaluationOwnerFixture("source-launch", `sha256:${"b".repeat(64)}`, "pick-place");
  const rows = [row];
  const db = { collection: () => ({ where: () => ({ limit: () => ({
    get: async () => ({ docs: rows.map(r => ({ id: r.id, data: () => r.record })) }),
  }) }) }) } as any;
  return { row, rows, db, params: { runId: row.runId, sourceLaunchId: "source-launch",
    setupDigest: row.setupDigest, revisionDigest: `sha256:${"b".repeat(64)}`, taskId: "pick-place" } };
}

describe("controller evaluation ownership", () => {
  it("locates the accepted browser owner without changing the controller actor", async () => {
    const { db, params } = fixture();
    expect(await policyCanaryEvaluationOwner(db, params)).toMatchObject({ owner_user_id: "buyer-1",
      evaluation_owner_binding: { intake_id: "scene-owned-evaluation", evaluation_run_id: "team-eval-browser-request" } });
  });
  it.each(["owner", "request", "receipt", "revision", "task", "duplicate", "missing", "setup"])(
    "refuses %s mismatch", async field => {
      const { db, params, row, rows } = fixture();
      if (field === "owner") row.record.owner_user_id = "other";
      if (field === "request") row.record.request.owner.user_id = "other";
      if (field === "receipt") row.record.receipt.status = "refused";
      if (field === "revision") params.revisionDigest = `sha256:${"e".repeat(64)}`;
      if (field === "task") params.taskId = "another-task";
      if (field === "duplicate") rows.push(structuredClone(row));
      if (field === "missing") rows.splice(0);
      if (field === "setup") params.setupDigest = `sha256:${"e".repeat(64)}`;
      await expect(policyCanaryEvaluationOwner(db, params)).rejects.toThrow(/owner/);
    });
  it("leaves historical non-team canaries alone", async () => {
    const { db, params } = fixture();
    expect(await policyCanaryEvaluationOwner(db, { ...params, runId: "internal-canary-1" })).toBeNull();
  });
});
