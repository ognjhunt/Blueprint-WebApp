import { describe, expect, it } from "vitest";

import { taskEvaluationResultAccessAllowed } from "../utils/taskEvaluationResultAccess";

const teamRecord = {
  owner_user_id: "owner-1",
  organization_id: "team-1",
  access_visibility: "organization_members" as const,
};

describe("Task Evaluation Result tenant isolation", () => {
  it("admits the owner, same verified tenant, and Blueprint ops", () => {
    expect(taskEvaluationResultAccessAllowed(teamRecord, { uid: "owner-1", tenantId: "", isOps: false })).toBe(true);
    expect(taskEvaluationResultAccessAllowed(teamRecord, { uid: "member-2", tenantId: "team-1", isOps: false })).toBe(true);
    expect(taskEvaluationResultAccessAllowed(teamRecord, { uid: "operator", tenantId: "", isOps: true })).toBe(true);
  });

  it("hides results from other tenants and keeps owner-only records private", () => {
    expect(taskEvaluationResultAccessAllowed(teamRecord, { uid: "member-3", tenantId: "team-2", isOps: false })).toBe(false);
    expect(taskEvaluationResultAccessAllowed(teamRecord, { uid: "member-3", tenantId: "", isOps: false })).toBe(false);
    expect(taskEvaluationResultAccessAllowed(
      { ...teamRecord, access_visibility: "owner_only" },
      { uid: "member-2", tenantId: "team-1", isOps: false },
    )).toBe(false);
  });
});
