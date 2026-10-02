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
};
export function outputTextDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** After an authenticated operator selects the exact reviewed artifact, the API
 * adapter recognizes extensions only in the two metadata objects affected by
 * the legacy prompt. Ordinary parsing remains strict. Unknown control fields,
 * other paths, missing/invalid core values, or a changed artifact still fail.
 * Every removed metadata path is named, and raw bytes remain in outputSource. */
export function parseCommunicationsOutput(raw: string, expectedSavedOutputDigest?: string): { output: CommunicationsOutput; normalizedMetadataPaths: string[] } {
  if (expectedSavedOutputDigest && outputTextDigest(raw) !== expectedSavedOutputDigest) throw Error("communications_saved_output_changed");
  const value = JSON.parse(raw), parsed = communicationsOutputSchema.safeParse(value);
  if (parsed.success) return { output: parsed.data, normalizedMetadataPaths: [] };
  if (!expectedSavedOutputDigest) throw parsed.error;
  const core = structuredClone(value), normalizedMetadataPaths: string[] = [];
  const controlField = /^(?:proto|prototype|constructor|status|disposition|to|from|replyto|headers|(?:approved|approval|authority|permission|consent|send|transport|instructions|requireshumanreview|suppressed|optout|donotcontact).*|(?:source|contact|claim|evidence)verified)$/i;
  for (const issue of parsed.error.issues) {
    const location = JSON.stringify(issue.path);
    if (issue.code !== "unrecognized_keys" || ![JSON.stringify(["outreachContract"]),
      JSON.stringify(["outreachContract", "opening", "publicDetail"])].includes(location)) throw parsed.error;
    let target = core;
    for (const segment of issue.path) target = target[segment];
    for (const key of issue.keys) {
      if (controlField.test(key.replace(/[^a-z0-9]/gi, ""))) throw parsed.error;
      normalizedMetadataPaths.push("/" + [...issue.path, key].map(segment => String(segment).replace(/~/g, "~0").replace(/\//g, "~1")).join("/"));
      delete target[key];
    }
  }
  return { output: communicationsOutputSchema.parse(core), normalizedMetadataPaths: normalizedMetadataPaths.sort() };
}
