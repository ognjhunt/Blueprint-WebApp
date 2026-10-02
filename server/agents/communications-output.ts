import { createHash } from "node:crypto";
import { communicationsOutputSchema, type CommunicationsOutput } from "./communications-contract";

/** Server-created provenance from a verified saved root turn. Raw text and its
 * metadata remain evidence, never instructions, source verification or approval. */
export type CommunicationsOutputSource = {
  schema_version: "blueprint.communications-output-source.v1";
  jobId: string; budgetAdmissionId: string; requestDigest: string;
  sessionId: string; turnId: string; finalItemId: string;
  definitionVersion: string; instructionsDigest: string;
  rawOutput: string; rawOutputSha256: string; rawOutputBytes: number;
  usageDigest: string; normalizedMetadataPaths: string[];
  formatNormalizations?: string[];
  validationIssues?: { path: string; code: string; message: string }[];
};
export function outputTextDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const pointer = (path: (string | number)[]) => "/" + path.map(segment => String(segment).replace(/~/g, "~0").replace(/\//g, "~1")).join("/");
export class CommunicationsOutputValidationError extends Error {
  constructor(public validationIssues: NonNullable<CommunicationsOutputSource["validationIssues"]>,
    public normalizedMetadataPaths: string[] = [], public formatNormalizations: string[] = []) {
    super("communications_output_invalid");
  }
}

/** Canonical fields keep their meanings. Extra metadata is inert evidence,
 * never approval or source verification; raw text remains in outputSource.
 * Harmless wrappers/metadata need no operator approval. An optional expected
 * hash still binds explicit saved-output recovery to the selected artifact. */
export function parseCommunicationsOutput(raw: string, expectedSavedOutputDigest?: string): {
  output: CommunicationsOutput; normalizedMetadataPaths: string[]; formatNormalizations: string[];
} {
  if (expectedSavedOutputDigest && outputTextDigest(raw) !== expectedSavedOutputDigest) throw Error("communications_saved_output_changed");
  const fence = raw.match(/^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/i), formatNormalizations = fence ? ["complete_json_code_fence"] : [];
  let core;
  try { core = JSON.parse(fence ? fence[1] : raw); }
  catch { throw new CommunicationsOutputValidationError([{ path: "/", code: "invalid_json",
    message: "Return one JSON object using the supplied canonical fields; a complete JSON code fence is accepted." }], [], formatNormalizations); }
  const parsed = communicationsOutputSchema.safeParse(core), normalizedMetadataPaths: string[] = [];
  for (const issue of parsed.success ? [] : parsed.error.issues) {
    if (issue.code !== "unrecognized_keys") continue;
    let target = core;
    for (const segment of issue.path) target = target[segment];
    for (const key of issue.keys) {
      normalizedMetadataPaths.push(pointer([...issue.path, key]));
      delete target[key];
    }
  }
  normalizedMetadataPaths.sort();
  const canonical = communicationsOutputSchema.safeParse(core);
  if (!canonical.success) throw new CommunicationsOutputValidationError(canonical.error.issues.map(issue => ({
    path: pointer(issue.path), code: issue.code, message: issue.message })), normalizedMetadataPaths, formatNormalizations);
  return { output: canonical.data, normalizedMetadataPaths, formatNormalizations };
}
