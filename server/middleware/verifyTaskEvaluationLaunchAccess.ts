import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import verifyFirebaseToken from "./verifyFirebaseToken";

const TOKEN_HEADER = "x-blueprint-launch-lab-token";
const MIN_TOKEN_BYTES = 32;

function enabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function tokensMatch(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return receivedBytes.length === expectedBytes.length
    && timingSafeEqual(receivedBytes, expectedBytes);
}

/**
 * Temporary, deployment-gated access for the single Task Evaluation launch
 * surface. It replaces repeated Firebase sign-in while leaving CSRF, profile,
 * rights, spend, allocator, retry, teardown, and provider-zero controls intact.
 */
export default async function verifyTaskEvaluationLaunchAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const expected = String(
    process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_LAB_TOKEN || "",
  ).trim();
  const receivedHeader = req.headers[TOKEN_HEADER];
  const received = typeof receivedHeader === "string" ? receivedHeader.trim() : "";
  const launchLabEnabled = enabled(
    process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_LAB_ENABLED,
  );

  if (
    launchLabEnabled
    && Buffer.byteLength(expected, "utf8") >= MIN_TOKEN_BYTES
    && received
    && tokensMatch(received, expected)
  ) {
    const now = Math.floor(Date.now() / 1000);
    res.locals.firebaseUser = {
      uid: "temporary-task-evaluation-launch-lab",
      aud: "blueprint-task-evaluation-launch-lab",
      auth_time: now,
      exp: now + 300,
      firebase: { identities: {}, sign_in_provider: "custom" },
      iat: now,
      iss: "blueprint-task-evaluation-launch-lab",
      ops: true,
      role: "ops",
      roles: ["ops"],
      sub: "temporary-task-evaluation-launch-lab",
      temporaryLaunchLab: true,
    };
    res.set("Cache-Control", "no-store");
    res.set("X-Blueprint-Launch-Lab-Mode", "temporary");
    return next();
  }

  return verifyFirebaseToken(req, res, next);
}

