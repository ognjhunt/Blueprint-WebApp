import crypto from "crypto";
import type { Request } from "express";
import rateLimit from "express-rate-limit";

import { createRateLimitRedisStore } from "./rate-limit-redis";

export const TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID = "blueprint-production-runner";
const DEFAULT_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 30;
const NONCE_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/i;

export interface TaskEvaluationLaunchSubmissionAuthResult {
  ok: boolean;
  status: number;
  code: string;
  message: string;
  clientId?: string;
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function positiveNumberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function buildTaskEvaluationLaunchSubmissionSignature(args: {
  secret: string;
  timestamp: string;
  clientId: string;
  nonce: string;
  body: string;
}): string {
  const canonical = `${args.timestamp}.${args.clientId}.${args.nonce}.${args.body}`;
  return `sha256=${crypto.createHmac("sha256", args.secret).update(canonical).digest("hex")}`;
}

export function verifyTaskEvaluationLaunchSubmissionRequest(
  req: Request,
  options: {
    expectedSecret?: string;
    expectedClientId?: string;
    nowMs?: number;
    maxClockSkewMs?: number;
    allowEmptyRawBody?: boolean;
  } = {},
): TaskEvaluationLaunchSubmissionAuthResult {
  const expectedSecret = String(
    options.expectedSecret === undefined
      ? process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_SECRET || ""
      : options.expectedSecret,
  ).trim();
  if (expectedSecret.length < 32) return {
    ok: false,
    status: 503,
    code: "task_evaluation_launch_submit_secret_not_configured",
    message: "Task Evaluation launch submission secret is not configured.",
  };

  const timestamp = String(req.header("X-Blueprint-Launch-Timestamp") || "").trim();
  const clientId = String(req.header("X-Blueprint-Launch-Client-Id") || "").trim();
  const nonce = String(req.header("X-Blueprint-Launch-Nonce") || "").trim();
  const signature = String(req.header("X-Blueprint-Launch-Signature") || "").trim();
  if (!timestamp || !clientId || !nonce || !signature) return {
    ok: false,
    status: 401,
    code: "task_evaluation_launch_submit_signature_missing",
    message: "Task Evaluation launch submission signature headers are required.",
  };

  const expectedClientId = options.expectedClientId || TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID;
  if (!timingSafeEqualString(clientId, expectedClientId)) return {
    ok: false,
    status: 403,
    code: "task_evaluation_launch_submit_client_forbidden",
    message: "Task Evaluation launch submission client is not admitted.",
  };

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return {
    ok: false,
    status: 401,
    code: "task_evaluation_launch_submit_timestamp_invalid",
    message: "Task Evaluation launch submission timestamp is invalid.",
  };
  const maxClockSkewMs = options.maxClockSkewMs
    ?? positiveNumberFromEnv(
      "BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_MAX_CLOCK_SKEW_MS",
      DEFAULT_MAX_CLOCK_SKEW_MS,
    );
  if (Math.abs((options.nowMs ?? Date.now()) - timestampMs) > maxClockSkewMs) return {
    ok: false,
    status: 401,
    code: "task_evaluation_launch_submit_timestamp_stale",
    message: "Task Evaluation launch submission timestamp is outside the replay window.",
  };
  if (!NONCE_PATTERN.test(nonce)) return {
    ok: false,
    status: 401,
    code: "task_evaluation_launch_submit_nonce_invalid",
    message: "Task Evaluation launch submission nonce is invalid.",
  };
  const signatureMatch = SIGNATURE_PATTERN.exec(signature);
  if (!signatureMatch) return {
    ok: false,
    status: 401,
    code: "task_evaluation_launch_submit_signature_invalid",
    message: "Task Evaluation launch submission signature is invalid.",
  };
  const capturedRawBody = (req as Request & { rawBody?: string }).rawBody;
  const rawBody = typeof capturedRawBody === "string"
    ? capturedRawBody
    : options.allowEmptyRawBody
      ? ""
      : undefined;
  if (typeof rawBody !== "string" || (!options.allowEmptyRawBody && rawBody.length === 0)) return {
    ok: false,
    status: 400,
    code: "task_evaluation_launch_submit_raw_body_unavailable",
    message: "Task Evaluation launch submission raw body is unavailable.",
  };
  const expectedSignature = buildTaskEvaluationLaunchSubmissionSignature({
    secret: expectedSecret,
    timestamp,
    clientId,
    nonce,
    body: rawBody,
  });
  if (!timingSafeEqualString(signature, expectedSignature)) return {
    ok: false,
    status: 401,
    code: "task_evaluation_launch_submit_signature_invalid",
    message: "Task Evaluation launch submission signature is invalid.",
  };
  return {
    ok: true,
    status: 200,
    code: "ok",
    message: "ok",
    clientId,
  };
}

export function createTaskEvaluationLaunchSubmissionRateLimiter() {
  return rateLimit({
    windowMs: positiveNumberFromEnv(
      "BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_RATE_LIMIT_WINDOW_MS",
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
    limit: positiveNumberFromEnv(
      "BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_RATE_LIMIT_MAX",
      DEFAULT_RATE_LIMIT_MAX,
    ),
    standardHeaders: true,
    legacyHeaders: false,
    store: createRateLimitRedisStore("rl:task-evaluation-launch-submit:"),
    skip: (req) => req.method === "OPTIONS",
    handler: (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.status(429).json({
        error: "Too many Task Evaluation launch submission requests.",
        code: "task_evaluation_launch_submit_rate_limited",
      });
    },
  });
}
