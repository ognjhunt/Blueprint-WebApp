import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

import { stableJson } from "./taskCandidateContract";

const MAX_COMPRESSED_PUBLICATION_BYTES = 850_000;
const MAX_UNCOMPRESSED_PUBLICATION_BYTES = 8_000_000;

export type TaskEvaluationRunPublicationStorage = {
  schema_version: "task_evaluation_run_publication_gzip.v1";
  encoding: "gzip+base64";
  payload_sha256: string;
  uncompressed_size_bytes: number;
  compressed_size_bytes: number;
  payload_base64: string;
};

function sha256(payload: Buffer) {
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

export function encodeTaskEvaluationRunPublication(
  publication: Record<string, unknown>,
): TaskEvaluationRunPublicationStorage {
  const serialized = Buffer.from(stableJson(publication), "utf8");
  if (serialized.length > MAX_UNCOMPRESSED_PUBLICATION_BYTES) {
    throw new Error("task_evaluation_run_publication_uncompressed_too_large");
  }
  const compressed = gzipSync(serialized, { level: 9 });
  if (compressed.length > MAX_COMPRESSED_PUBLICATION_BYTES) {
    throw new Error("task_evaluation_run_publication_compressed_too_large");
  }
  return {
    schema_version: "task_evaluation_run_publication_gzip.v1",
    encoding: "gzip+base64",
    payload_sha256: sha256(serialized),
    uncompressed_size_bytes: serialized.length,
    compressed_size_bytes: compressed.length,
    payload_base64: compressed.toString("base64"),
  };
}

export function decodeTaskEvaluationRunPublication(
  storage: unknown,
): Record<string, unknown> | null {
  if (!storage || typeof storage !== "object") return null;
  const value = storage as Partial<TaskEvaluationRunPublicationStorage>;
  if (
    value.schema_version !== "task_evaluation_run_publication_gzip.v1"
    || value.encoding !== "gzip+base64"
    || !/^sha256:[0-9a-f]{64}$/.test(String(value.payload_sha256 || ""))
    || !Number.isInteger(value.uncompressed_size_bytes)
    || !Number.isInteger(value.compressed_size_bytes)
    || typeof value.payload_base64 !== "string"
  ) return null;
  try {
    const compressed = Buffer.from(value.payload_base64, "base64");
    if (
      compressed.length !== value.compressed_size_bytes
      || compressed.length > MAX_COMPRESSED_PUBLICATION_BYTES
    ) return null;
    const serialized = gunzipSync(compressed, {
      maxOutputLength: MAX_UNCOMPRESSED_PUBLICATION_BYTES,
    });
    if (
      serialized.length !== value.uncompressed_size_bytes
      || sha256(serialized) !== value.payload_sha256
    ) return null;
    const publication = JSON.parse(serialized.toString("utf8"));
    return publication && typeof publication === "object" && !Array.isArray(publication)
      ? publication as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function publicationFromResultRecord(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  if (record.publication && typeof record.publication === "object") {
    return record.publication as Record<string, unknown>;
  }
  return decodeTaskEvaluationRunPublication(record.publication_storage);
}
