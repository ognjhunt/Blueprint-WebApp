import { createHash } from "node:crypto";

// Shared with Pipeline's RFC 8785 boundary: ECMAScript numbers and UTF-16
// property ordering. Keep the existing safe-number restrictions from scene intake.
export function crossRuntimeCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(crossRuntimeCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${crossRuntimeCanonicalJson((value as Record<string, unknown>)[key])}`
    )).join(",")}}`;
  }
  if (typeof value === "number" && (!Number.isFinite(value)
    || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    throw new Error("unsafe_json_number");
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("invalid_json_value");
  return serialized;
}

export const crossRuntimeDigest = (value: unknown) => (
  `sha256:${createHash("sha256").update(crossRuntimeCanonicalJson(value)).digest("hex")}`
);

export function crossRuntimeArtifactDigest(value: Record<string, unknown>, digestField: string) {
  return crossRuntimeDigest(Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== digestField),
  ));
}

export function matchesCrossRuntimeArtifactDigest(value: Record<string, unknown>, digestField: string) {
  try {
    return crossRuntimeArtifactDigest(value, digestField) === value[digestField];
  } catch {
    return false;
  }
}
