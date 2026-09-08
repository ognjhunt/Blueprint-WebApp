import type { User as FirebaseUser } from "firebase/auth";
import { createTaskEvaluationResultArtifactTicket } from "./taskEvaluationResults";
import { boundedResultArtifactRequest } from "./resultArtifactRequest";

export type VerifiableResultArtifact = { artifact_id: string; sha256?: string; digest?: string; size_bytes: number };
export const MAX_RESULT_SCORE_RECEIPT_BYTES = 256_000;

export function verifiedArtifactMetadata(artifact: VerifiableResultArtifact, maximumBytes: number) {
  const digest = artifact.sha256 || artifact.digest || "";
  if ((artifact.sha256 && artifact.digest && artifact.sha256 !== artifact.digest)
    || !/^sha256:[0-9a-f]{64}$/.test(digest) || !Number.isSafeInteger(artifact.size_bytes)
    || artifact.size_bytes < 1 || artifact.size_bytes > maximumBytes) {
    throw new Error("Artifact metadata is missing, invalid, or exceeds the bounded reader");
  }
  return { digest, size: artifact.size_bytes };
}

export async function readVerifiedResultArtifactJson(
  response: Response,
  artifact: VerifiableResultArtifact,
  signal?: AbortSignal,
  maximumBytes = MAX_RESULT_SCORE_RECEIPT_BYTES,
): Promise<Record<string, unknown>> {
  const expected = verifiedArtifactMetadata(artifact, maximumBytes);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Artifact body is unavailable");
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", cancel, { once: true });
  let complete = false;
  try {
    signal?.throwIfAborted();
    const length = response.headers.get("content-length");
    const digest = response.headers.get("x-blueprint-artifact-sha256");
    if (response.status !== 200 || (length !== null && Number(length) !== expected.size)
      || (digest !== null && digest !== expected.digest)) throw new Error("Artifact response does not match its receipt");
    // Allocate only after the descriptor's bound has passed; never read text first.
    const bytes = new Uint8Array(expected.size);
    let received = 0;
    while (true) {
      const next = await reader.read();
      signal?.throwIfAborted();
      if (next.done) break;
      received += next.value.byteLength;
      if (received > expected.size) throw new Error("Artifact exceeds its declared size");
      bytes.set(next.value, received - next.value.byteLength);
    }
    if (received !== expected.size) throw new Error("Artifact was truncated");
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    signal?.throwIfAborted();
    const digestHex = Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
    if (`sha256:${digestHex}` !== expected.digest) throw new Error("Artifact digest verification failed");
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Artifact JSON is not an object");
    complete = true;
    return parsed as Record<string, unknown>;
  } finally {
    signal?.removeEventListener("abort", cancel);
    if (!complete) { try { await reader.cancel(); } catch { /* Disconnected body. */ } }
    reader.releaseLock();
  }
}

export function fetchVerifiedResultArtifactJson(
  user: FirebaseUser | null,
  recordId: string,
  artifact: VerifiableResultArtifact,
  options: { signal?: AbortSignal; maximumBytes?: number } = {},
) {
  const maximumBytes = options.maximumBytes ?? MAX_RESULT_SCORE_RECEIPT_BYTES;
  // Invalid descriptors must not even issue an authorization request.
  verifiedArtifactMetadata(artifact, maximumBytes);
  return boundedResultArtifactRequest(async (signal) => {
    const url = await createTaskEvaluationResultArtifactTicket(user, recordId, artifact.artifact_id, { signal });
    signal.throwIfAborted();
    const response = await fetch(url, { credentials: "include", signal, redirect: "error" });
    return readVerifiedResultArtifactJson(response, artifact, signal, maximumBytes);
  }, options.signal);
}
