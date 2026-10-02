import { createHash } from "node:crypto";
import { ZodError } from "zod";

/** Tool failures are data for the current authorized loop. Never reflect
 * private exception prose, imply permission, or retry an uncertain mutation. */
// verify_growth_integrations writes an analytics event and a Firestore receipt.
export const readOnlyOperatorTools = new Set(["list_growth_campaigns", "search_company_history", "fetch_company_history_record"]);

export function validationIssue(issue: ZodError["issues"][number]) {
  const detail = issue as unknown as Record<string, unknown>, expectations: Record<string, unknown> = {};
  const types = new Set(["string", "number", "boolean", "undefined", "null", "object", "array", "function",
    "date", "bigint", "nan", "integer", "symbol", "void", "promise", "never", "map", "set"]);
  for (const key of ["expected", "received", "type", "validation"]) {
    const value = detail[key];
    if (typeof value === "string" && (key === "validation"
      ? ["email", "url", "uuid", "regex", "datetime", "ip"].includes(value) : types.has(value))) expectations[key] = value;
  }
  for (const key of ["minimum", "maximum"]) if (typeof detail[key] === "number" && Number.isFinite(detail[key])) expectations[key] = detail[key];
  for (const key of ["inclusive", "exact"]) if (typeof detail[key] === "boolean") expectations[key] = detail[key];
  return { path: "/" + issue.path.map(part => String(part).replace(/~/g, "~0").replace(/\//g, "~1")).join("/"),
    code: issue.code, ...(Object.keys(expectations).length ? { expectations } : {}) };
}

export function toolFailure(error: unknown, name: string) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const grpcCodes: Record<number, string> = { 3: "invalid-argument", 4: "deadline-exceeded", 5: "not-found",
    7: "permission-denied", 8: "resource-exhausted", 14: "unavailable", 16: "unauthenticated" };
  const errorCode = typeof value.code === "number" ? grpcCodes[value.code] : value.code;
  const controlCodes = new Set(["permission_denied", "permission-denied", "unauthenticated", "EACCES", "not_authorized", "recipient_suppressed",
    "approval_required", "budget_exceeded", "spending_not_authorized"]);
  const controlCode = typeof errorCode === "string" && controlCodes.has(errorCode) ? errorCode : null;
  if (value.status === 401 || value.status === 403 || controlCode) {
    return { status: "control_denied", code: controlCode ?? "tool_access_denied", retryAllowed: false,
      allowedRepair: "Use existing authorized scope; this result grants no additional permission." };
  }
  if (error instanceof ZodError) {
    return { status: "recoverable_issue", code: "tool_arguments_invalid", retryAllowed: true,
      issues: error.issues.map(validationIssue),
      allowedRepair: "Correct the identified argument fields using the declared tool schema and existing evidence." };
  }
  const readOnly = readOnlyOperatorTools.has(name);
  const diagnosticCodes = new Set(["ENOENT", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN",
    "unavailable", "deadline-exceeded", "not-found", "invalid-argument", "resource-exhausted"]);
  const diagnosticCode = typeof errorCode === "string" && diagnosticCodes.has(errorCode) ? errorCode
    : error instanceof Error && error.message === "Database not available" ? "database_unavailable" : null;
  return { status: readOnly ? "recoverable_issue" : "reconciliation_required", code: "tool_execution_failed",
    retryAllowed: readOnly,
    ...(diagnosticCode ? { diagnosticCode } : {}),
    ...(typeof value.status === "number" && Number.isInteger(value.status) && value.status >= 100 && value.status <= 599
      ? { httpStatus: value.status } : {}),
    errorDigest: createHash("sha256").update(error instanceof Error ? error.message : String(error)).digest("hex"),
    allowedRepair: readOnly ? "Inspect authorized state and correct the request; retry within existing limits."
      : "The operation may have taken effect. Reconcile existing state before any further mutation; do not repeat it blindly." };
}

