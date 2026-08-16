// @vitest-environment node
import type { Request } from "express";
import { describe, expect, it } from "vitest";

import {
  buildTaskEvaluationLaunchSubmissionSignature,
  TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
  verifyTaskEvaluationLaunchSubmissionRequest,
} from "../utils/taskEvaluationLaunchSubmissionAuth";

const SECRET = "task-evaluation-launch-submit-secret-0123456789abcdef";
const NOW = Date.parse("2026-08-16T20:30:00.000Z");
const BODY = JSON.stringify({ launch_id: "launch-001" });

function request(headers: Record<string, string>, body = BODY): Request {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    rawBody: body,
    body: JSON.parse(body),
    header: (name: string) => normalized[name.toLowerCase()],
  } as unknown as Request;
}

function signedHeaders(overrides: Record<string, string> = {}, body = BODY) {
  const timestamp = "2026-08-16T20:30:00.000Z";
  const nonce = "nonce-0123456789abcdef";
  const base = {
    "X-Blueprint-Launch-Timestamp": timestamp,
    "X-Blueprint-Launch-Client-Id": TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
    "X-Blueprint-Launch-Nonce": nonce,
  };
  return {
    ...base,
    "X-Blueprint-Launch-Signature": buildTaskEvaluationLaunchSubmissionSignature({
      secret: SECRET,
      timestamp,
      clientId: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
      nonce,
      body,
    }),
    ...overrides,
  };
}

describe("Task Evaluation launch submission authentication", () => {
  it("accepts the exact client, timestamp, nonce, and raw-body HMAC", () => {
    expect(verifyTaskEvaluationLaunchSubmissionRequest(request(signedHeaders()), {
      expectedSecret: SECRET,
      nowMs: NOW,
    })).toEqual({
      ok: true,
      status: 200,
      code: "ok",
      message: "ok",
      clientId: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
    });
  });

  it.each([
    ["missing secret", "secret", "", 503, "task_evaluation_launch_submit_secret_not_configured"],
    ["missing signature", "signature", "", 401, "task_evaluation_launch_submit_signature_missing"],
    ["wrong client", "client", "different-runner", 403, "task_evaluation_launch_submit_client_forbidden"],
    ["stale timestamp", "timestamp", "2026-08-16T20:20:00.000Z", 401, "task_evaluation_launch_submit_timestamp_stale"],
    ["invalid nonce", "nonce", "short", 401, "task_evaluation_launch_submit_nonce_invalid"],
    ["invalid signature", "signature", `sha256=${"0".repeat(64)}`, 401, "task_evaluation_launch_submit_signature_invalid"],
  ])("fails closed for %s", (_label, kind, value, status, code) => {
    const overrides: Record<string, string> = {};
    let expectedSecret = SECRET;
    if (kind === "secret") expectedSecret = value;
    if (kind === "signature") overrides["X-Blueprint-Launch-Signature"] = value;
    if (kind === "client") overrides["X-Blueprint-Launch-Client-Id"] = value;
    if (kind === "timestamp") overrides["X-Blueprint-Launch-Timestamp"] = value;
    if (kind === "nonce") overrides["X-Blueprint-Launch-Nonce"] = value;
    const result = verifyTaskEvaluationLaunchSubmissionRequest(
      request(signedHeaders(overrides)),
      { expectedSecret, nowMs: NOW },
    );
    expect(result).toMatchObject({ ok: false, status, code });
  });

  it("rejects a signature if the raw body changes after signing", () => {
    const result = verifyTaskEvaluationLaunchSubmissionRequest(
      request(signedHeaders(), JSON.stringify({ launch_id: "launch-002" })),
      { expectedSecret: SECRET, nowMs: NOW },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      code: "task_evaluation_launch_submit_signature_invalid",
    });
  });
});
