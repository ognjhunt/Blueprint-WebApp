import { createHash } from "node:crypto";
import { crossRuntimeCanonicalJson } from "./crossRuntimeCanonical";

/** Verify original producer bytes without changing an existing scientific digest. */
export function verifyProducerArtifact(
  value: Record<string, unknown>, digestField: string, canonicalJson: unknown,
): boolean {
  if (typeof canonicalJson !== "string" || !canonicalJson || Buffer.byteLength(canonicalJson) > 750_000) return false;
  try {
    const body = JSON.parse(canonicalJson);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.hasOwn(body, digestField)) return false;
    const expected = `sha256:${createHash("sha256").update(canonicalJson, "utf8").digest("hex")}`;
    const objectBody = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestField));
    return expected === value[digestField]
      && crossRuntimeCanonicalJson(body) === crossRuntimeCanonicalJson(objectBody);
  } catch {
    return false;
  }
}
