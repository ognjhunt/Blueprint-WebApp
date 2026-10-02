import { createHash } from "node:crypto";
import { ZodError } from "zod";

/** Pure diagnostics: never put provider exception prose or private values in
 * correction instructions. Originals remain private run evidence. */
export function outputCorrectionEvidence(rawOutput: string, error: unknown) {
  const issues = error instanceof ZodError ? error.issues.map(issue => {
    const detail = issue as unknown as Record<string, unknown>;
    const expectations: Record<string, unknown> = {};
    const types = new Set(["string", "number", "boolean", "undefined", "null", "object", "array", "integer", "date", "nan", "bigint"]);
    for (const key of ["expected", "received", "type"]) if (typeof detail[key] === "string" && types.has(detail[key] as string)) expectations[key] = detail[key];
    for (const key of ["minimum", "maximum"]) if (typeof detail[key] === "number" && Number.isFinite(detail[key])) expectations[key] = detail[key];
    for (const key of ["inclusive", "exact"]) if (typeof detail[key] === "boolean") expectations[key] = detail[key];
    return { path: "/" + issue.path.map(part => String(part).replace(/~/g, "~0").replace(/\//g, "~1")).join("/"), code: issue.code, expectations };
  }) : [{ path: "/", code: "invalid_json" }];
  return { rawOutput, rawOutputSha256: createHash("sha256").update(rawOutput).digest("hex"), issues };
}

export function outputCorrectionPrompt(issues: unknown) {
  return `Correct only the JSON output using the original task and retained analysis. Return valid JSON satisfying the identified fields. Preserve supported facts; do not invent evidence or perform external actions. Validation issues: ${JSON.stringify(issues)}`;
}

export function usageCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
