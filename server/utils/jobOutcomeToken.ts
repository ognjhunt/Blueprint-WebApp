/**
 * The one-click links in the outcome questions (PACKAGE_E E8).
 *
 * The same construction as the project's other signed links (`captureUploadToken.ts`,
 * `request-review-auth.ts`): base64url JSON payload, a dot, base64url HMAC-SHA256 over the payload,
 * with the same secret resolution. Neither file exports its signer, so the three lines are repeated
 * here rather than widening those modules.
 *
 * Single purpose: the payload's `kind` is `job_outcome`, so a capture, review, claim or invitation
 * link (signed with the same secret) never verifies here, and a link names one introduction
 * (request and company), one side and one answer. It expires 30 days after it was issued. The
 * signature is compared in constant time. A caller holding a bad link learns only that it does not
 * work.
 */
import crypto from "node:crypto";
import { isOutcomeState, type OutcomeState } from "../../client/src/lib/jobOutcomeStates";

export const JOB_OUTCOME_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export type OutcomeSide = "site" | "company";

export interface JobOutcomeTokenPayload {
  kind: "job_outcome";
  /** The job. */
  r: string;
  /** The introduced company (the introduction's document id). */
  c: string;
  /** Whose answer this link records. */
  by: OutcomeSide;
  /** The one answer this link records. */
  state: OutcomeState;
  exp: number;
}

function getSecret() {
  const secret = (
    process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET?.trim() ||
    process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET?.trim() ||
    process.env.PIPELINE_SYNC_TOKEN?.trim()
  );
  if (!secret && process.env.NODE_ENV === "production") throw new Error("Capture and review signing secret is required");
  return secret || "blueprint-request-review-dev-secret";
}

const sign = (serialized: string) => crypto.createHmac("sha256", getSecret()).update(serialized).digest("base64url");

const safeId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200 && !value.includes("/");

/** A token's characters, checked before it is ever placed in a page. */
export const JOB_OUTCOME_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function createJobOutcomeToken(params: { requestId: string; companyId: string; by: OutcomeSide; state: OutcomeState;
  nowMs?: number; ttlSeconds?: number }): string {
  if (!safeId(params.requestId) || !safeId(params.companyId)) throw new Error("job_outcome_token_ids_invalid");
  const payload: JobOutcomeTokenPayload = { kind: "job_outcome", r: params.requestId, c: params.companyId, by: params.by,
    state: params.state, exp: Math.floor((params.nowMs ?? Date.now()) / 1000) + (params.ttlSeconds ?? JOB_OUTCOME_TOKEN_TTL_SECONDS) };
  const serialized = JSON.stringify(payload);
  return `${Buffer.from(serialized, "utf-8").toString("base64url")}.${sign(serialized)}`;
}

export function verifyJobOutcomeToken(token: string, nowMs = Date.now()): JobOutcomeTokenPayload | null {
  try {
    const value = String(token || "");
    if (value.length > 2048 || !JOB_OUTCOME_TOKEN_PATTERN.test(value)) return null;
    const [encoded, signature] = value.split(".");
    const serialized = Buffer.from(encoded, "base64url").toString("utf-8");
    const actual = Buffer.from(signature, "utf-8"), expected = Buffer.from(sign(serialized), "utf-8");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(serialized) as Partial<JobOutcomeTokenPayload>;
    if (payload.kind !== "job_outcome" || !safeId(payload.r) || !safeId(payload.c)
      || (payload.by !== "site" && payload.by !== "company") || !isOutcomeState(payload.state)
      || typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp * 1000 <= nowMs) return null;
    return payload as JobOutcomeTokenPayload;
  } catch { return null; }
}
