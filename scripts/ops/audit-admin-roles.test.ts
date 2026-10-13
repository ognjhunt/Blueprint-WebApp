// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildAuditRow, rolesFromRecord } from "./audit-admin-roles";

describe("admin role audit", () => {
  it("normalises every elevation field the server honours", () => {
    expect(rolesFromRecord({ admin: true })).toEqual(["admin"]);
    expect(rolesFromRecord({ ops: true, role: "Admin" })).toEqual(["admin", "ops"]);
    expect(rolesFromRecord({ roles: ["capturer", "OPS"], accessRoles: ["admin"] })).toEqual(["admin", "ops"]);
    expect(rolesFromRecord({ role: "site_operator" })).toEqual([]);
  });

  it("flags doc-only grants and credits claims and the verified-email allowlist", () => {
    const env = { BLUEPRINT_ADMIN_EMAIL_ALLOWLIST: "founder@example.com" } as NodeJS.ProcessEnv;
    expect(buildAuditRow({ uid: "a", doc: { admin: true, ops: true }, claims: { admin: true }, email: null, emailVerified: false, authAccount: "found", env }))
      .toMatchObject({ claimRoles: ["admin"], docOnlyRoles: ["ops"] });
    expect(buildAuditRow({ uid: "f", doc: { role: "admin" }, claims: null, email: "Founder@example.com", emailVerified: true, authAccount: "found", env }))
      .toMatchObject({ allowlistRoles: ["admin"], docOnlyRoles: [] });
    expect(buildAuditRow({ uid: "u", doc: { role: "admin" }, claims: null, email: "founder@example.com", emailVerified: false, authAccount: "found", env }))
      .toMatchObject({ allowlistRoles: [], docOnlyRoles: ["admin"] });
  });
});
