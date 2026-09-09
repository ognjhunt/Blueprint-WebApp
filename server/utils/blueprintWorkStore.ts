import { dbAdmin, authAdmin } from "../../client/src/lib/firebaseAdmin";
import { withTaskEvaluationLaunchStoreTimeout } from "./taskEvaluationLaunchStore";
import type { CheckOperator, WorkStore } from "./blueprintWorkOAuth";

export const WORK_AUTH_COLLECTION = "blueprintWorkOAuth";
export const firestoreWorkStore: WorkStore = {
  async get(key) {
    if (!dbAdmin) throw new Error("work_store_unavailable");
    const row = await withTaskEvaluationLaunchStoreTimeout(dbAdmin.collection(WORK_AUTH_COLLECTION).doc(key).get());
    return row.exists ? row.data() : undefined;
  },
  async set(key, value) {
    if (!dbAdmin) throw new Error("work_store_unavailable");
    await withTaskEvaluationLaunchStoreTimeout(dbAdmin.collection(WORK_AUTH_COLLECTION).doc(key).set(value));
  },
  async transaction(action) {
    if (!dbAdmin) throw new Error("work_store_unavailable");
    const collection = dbAdmin.collection(WORK_AUTH_COLLECTION);
    return withTaskEvaluationLaunchStoreTimeout(dbAdmin.runTransaction(async tx => action({
      async get(key) { const row = await tx.get(collection.doc(key)); return row.exists ? row.data() : undefined; },
      set(key, value) { tx.set(collection.doc(key), value); },
      delete(key) { tx.delete(collection.doc(key)); },
    })));
  },
};

// Re-read server-managed claims on every tool call and refresh. Browser-writable
// profile roles, old token claims, disabled users and revoked logins confer no access.
export const checkWorkOperator: CheckOperator = async identity => {
  if (!authAdmin || !identity?.uid || !Number.isFinite(identity.authTime)) return false;
  try {
    const auth = identity.tenantId ? authAdmin.tenantManager().authForTenant(identity.tenantId) : authAdmin;
    const user = await withTaskEvaluationLaunchStoreTimeout(auth.getUser(identity.uid));
    if (user.disabled || Date.parse(user.tokensValidAfterTime || "1970-01-01") / 1000 > identity.authTime) return false;
    const c = user.customClaims || {};
    return c.admin === true || c.ops === true || ["admin", "ops"].includes(String(c.role))
      || (Array.isArray(c.roles) && c.roles.some((r: unknown) => r === "admin" || r === "ops"));
  } catch { return false; }
};
