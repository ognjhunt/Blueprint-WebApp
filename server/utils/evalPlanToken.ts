/**
 * The plan a team saw, pinned to the spend it confirms.
 *
 * ## The gap this closes
 *
 * `POST /runs` is two calls: a dry run that shows a selection, then a confirm
 * that reserves. Each recomputes the selection independently from live supply,
 * so a team could see plan X in the dry run and reserve plan Y on confirm if a
 * site was added, pulled, or reconstructed in between. Within one confirm call
 * it reserves what it selected -- but the team approved a different list than
 * the one that ran.
 *
 * So the dry run signs the plan it showed, and confirm honours that token: it
 * reserves exactly the scenes the token names, and refuses one that is no
 * longer runnable rather than silently substituting another. A team spends on
 * what it approved or is told plainly why a line could not run.
 *
 * ## Signed, short, and bound to the caller
 *
 * Same construction as the capture and review tokens: base64url payload plus an
 * HMAC. The payload carries the team and checkpoint it was issued for, so a
 * plan cannot be replayed against a different team's balance, and a short TTL,
 * because a plan is a snapshot of supply and supply moves.
 */

import crypto from "node:crypto";

/** A plan is a snapshot of supply, and supply moves. Minutes, not days. */
export const EVAL_PLAN_TOKEN_TTL_SECONDS = 60 * 15;

export interface EvalPlanLine {
  sceneId: string;
  costUsd: number;
}

interface EvalPlanTokenPayload {
  kind: "eval_plan";
  teamId: string;
  checkpointId: string;
  lines: EvalPlanLine[];
  exp: number;
}

function getSecret() {
  return (
    process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET ||
    process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET ||
    process.env.PIPELINE_SYNC_TOKEN ||
    "blueprint-request-review-dev-secret"
  );
}

function sign(serialized: string) {
  return crypto.createHmac("sha256", getSecret()).update(serialized).digest("base64url");
}

export function createEvalPlanToken(params: {
  teamId: string;
  checkpointId: string;
  lines: readonly EvalPlanLine[];
  ttlSeconds?: number;
}): string {
  const payload: EvalPlanTokenPayload = {
    kind: "eval_plan",
    teamId: params.teamId,
    checkpointId: params.checkpointId,
    lines: params.lines.map((line) => ({ sceneId: line.sceneId, costUsd: line.costUsd })),
    exp: Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? EVAL_PLAN_TOKEN_TTL_SECONDS),
  };
  const serialized = JSON.stringify(payload);
  return `${Buffer.from(serialized, "utf-8").toString("base64url")}.${sign(serialized)}`;
}

/**
 * Verify a plan token for a specific team and checkpoint.
 *
 * Returns null for anything wrong -- a bad signature, an expired plan, or a
 * plan issued for a different team or checkpoint. The team/checkpoint binding
 * is checked here rather than left to the caller, so a plan can never be
 * replayed across either boundary.
 */
export function verifyEvalPlanToken(
  token: string,
  expected: { teamId: string; checkpointId: string },
): EvalPlanLine[] | null {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return null;

  let serialized: string;
  try {
    serialized = Buffer.from(encoded, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const expectedSig = Buffer.from(sign(serialized), "utf-8");
  const providedSig = Buffer.from(signature, "utf-8");
  if (providedSig.length !== expectedSig.length || !crypto.timingSafeEqual(providedSig, expectedSig)) {
    return null;
  }

  let payload: EvalPlanTokenPayload;
  try {
    payload = JSON.parse(serialized) as EvalPlanTokenPayload;
  } catch {
    return null;
  }

  if (payload.kind !== "eval_plan") return null;
  if (payload.teamId !== expected.teamId || payload.checkpointId !== expected.checkpointId) return null;
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 < Date.now()) return null;
  if (!Array.isArray(payload.lines)) return null;

  return payload.lines
    .filter(
      (line): line is EvalPlanLine =>
        typeof line?.sceneId === "string" && typeof line?.costUsd === "number",
    )
    .map((line) => ({ sceneId: line.sceneId, costUsd: line.costUsd }));
}
