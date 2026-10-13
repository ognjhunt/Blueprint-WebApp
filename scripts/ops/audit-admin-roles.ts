#!/usr/bin/env tsx
/**
 * READ-ONLY audit of admin/ops authority.
 *
 * Lists every users/{uid} document that carries a role-elevation field
 * (admin, ops, accessRoles, role/roles containing admin|ops) and compares it to
 * that account's Firebase Auth custom claims. It never writes Firestore and
 * never changes claims.
 *
 * Why: server/utils/access-control.ts still honours legacy users-doc roles as
 * a fallback (BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK, default on) so nobody is
 * locked out. Once every legitimate operator shows `claims` or `allowlist`
 * coverage here, set BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK=0.
 *
 * Usage (needs Firebase Admin credentials, e.g. FIREBASE_SERVICE_ACCOUNT_JSON):
 *   npx tsx scripts/ops/audit-admin-roles.ts            # table
 *   npx tsx scripts/ops/audit-admin-roles.ts --json     # machine-readable
 *
 * Exit code 0 = no doc-only grants, 2 = at least one doc-only grant found,
 * 1 = could not run.
 */
import { pathToFileURL } from "node:url";

type Role = "admin" | "ops";

export type RoleAuditRow = {
  uid: string;
  email: string | null;
  docRoles: Role[];
  claimRoles: Role[];
  allowlistRoles: Role[];
  docOnlyRoles: Role[];
  authAccount: "found" | "missing" | "disabled";
};

function asRole(value: unknown): Role | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "ops" ? normalized : null;
}

export function rolesFromRecord(record: Record<string, unknown> | null | undefined): Role[] {
  if (!record) return [];
  const roles = new Set<Role>();
  for (const value of [record.roles, record.role, record.accessRoles]) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      const role = asRole(entry);
      if (role) roles.add(role);
    }
  }
  if (record.admin === true) roles.add("admin");
  if (record.ops === true) roles.add("ops");
  return [...roles].sort();
}

function allowlist(value: string | undefined) {
  return new Set(String(value || "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean));
}

export function buildAuditRow(params: {
  uid: string;
  doc: Record<string, unknown>;
  claims: Record<string, unknown> | null;
  email: string | null;
  emailVerified: boolean;
  authAccount: RoleAuditRow["authAccount"];
  env?: NodeJS.ProcessEnv;
}): RoleAuditRow {
  const env = params.env || process.env;
  const docRoles = rolesFromRecord(params.doc);
  const claimRoles = rolesFromRecord(params.claims);
  const email = params.email?.toLowerCase() || null;
  const allowlistRoles: Role[] = [];
  if (email && params.emailVerified) {
    if (allowlist(env.BLUEPRINT_ADMIN_EMAIL_ALLOWLIST).has(email)) allowlistRoles.push("admin");
    if (allowlist(env.BLUEPRINT_OPS_EMAIL_ALLOWLIST).has(email)) allowlistRoles.push("ops");
  }
  const covered = new Set<Role>([...claimRoles, ...allowlistRoles]);
  return {
    uid: params.uid,
    email,
    docRoles,
    claimRoles,
    allowlistRoles,
    docOnlyRoles: docRoles.filter((role) => !covered.has(role)),
    authAccount: params.authAccount,
  };
}

async function main() {
  const json = process.argv.includes("--json");
  const { dbAdmin, authAdmin } = await import("../../client/src/lib/firebaseAdmin");
  if (!dbAdmin || !authAdmin) {
    console.error("Firebase Admin is not configured (set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS).");
    process.exit(1);
  }
  const rows: RoleAuditRow[] = [];
  const seen = new Set<string>();
  // Firestore cannot OR across fields; query each elevation field separately.
  const queries = [
    dbAdmin.collection("users").where("admin", "==", true),
    dbAdmin.collection("users").where("ops", "==", true),
    dbAdmin.collection("users").where("role", "in", ["admin", "ops", "Admin", "Ops", "ADMIN", "OPS"]),
    dbAdmin.collection("users").where("roles", "array-contains-any", ["admin", "ops"]),
    dbAdmin.collection("users").where("accessRoles", "array-contains-any", ["admin", "ops"]),
  ];
  for (const query of queries) {
    const snapshot = await query.get();
    for (const doc of snapshot.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      const data = (doc.data() || {}) as Record<string, unknown>;
      let claims: Record<string, unknown> | null = null;
      let email: string | null = typeof data.email === "string" ? data.email : null;
      let emailVerified = false;
      let authAccount: RoleAuditRow["authAccount"] = "missing";
      try {
        const user = await authAdmin.getUser(doc.id);
        claims = (user.customClaims || null) as Record<string, unknown> | null;
        email = user.email || email;
        emailVerified = user.emailVerified === true;
        authAccount = user.disabled ? "disabled" : "found";
      } catch {
        authAccount = "missing";
      }
      rows.push(buildAuditRow({ uid: doc.id, doc: data, claims, email, emailVerified, authAccount }));
    }
  }
  const docOnly = rows.filter((row) => row.docOnlyRoles.length > 0);
  if (json) {
    console.log(JSON.stringify({ scanned: rows.length, doc_only_grants: docOnly.length, rows }, null, 2));
  } else {
    console.log(`Users docs with admin/ops elevation fields: ${rows.length}`);
    for (const row of rows) {
      console.log(
        [
          row.uid,
          row.email || "(no email)",
          `doc=[${row.docRoles.join(",")}]`,
          `claims=[${row.claimRoles.join(",")}]`,
          `allowlist=[${row.allowlistRoles.join(",")}]`,
          row.docOnlyRoles.length ? `DOC-ONLY=[${row.docOnlyRoles.join(",")}]` : "covered",
          `auth=${row.authAccount}`,
        ].join("  "),
      );
    }
    console.log(
      docOnly.length
        ? `\n${docOnly.length} account(s) hold admin/ops only through their users doc. Grant a custom claim (or add to BLUEPRINT_ADMIN_EMAIL_ALLOWLIST) for legitimate operators, remove the field for everyone else, then set BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK=0.`
        : "\nNo doc-only grants. BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK=0 is safe.",
    );
  }
  process.exit(docOnly.length ? 2 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
