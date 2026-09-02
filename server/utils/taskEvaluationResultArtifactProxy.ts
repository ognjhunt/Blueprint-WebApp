import { createHmac, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import type { Request, Response } from "express";

export function configuredArtifactEndpoint(runId: string, artifactId: string) {
  const template = String(process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE || "").trim();
  if (template) {
    return template
      .replace("{run_id}", encodeURIComponent(runId))
      .replace("{artifact_id}", encodeURIComponent(artifactId));
  }
  const executeUrl = String(process.env.TASK_EVALUATION_RUN_EXECUTE_URL || "").trim();
  if (executeUrl) {
    return executeUrl
      .replace("{run_id}", encodeURIComponent(runId))
      .replace(/\/execute\/?$/, `/artifacts/${encodeURIComponent(artifactId)}`);
  }
  const launchUrl = String(process.env.TASK_EVALUATION_LAUNCH_URL || "").trim();
  if (!/\/task-evaluation-launches\/?$/.test(launchUrl)) return "";
  return launchUrl.replace(
    /\/task-evaluation-launches\/?$/,
    `/task-evaluation-runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}`,
  );
}

export function signedPipelineHeaders(body = "") {
  const token = String(
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN
      || process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN
      || "",
  ).trim();
  if (!token) return null;
  const clientId = String(
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_CLIENT_ID
      || process.env.TASK_EVALUATION_RUN_FORWARD_CLIENT_ID
      || "blueprint-webapp",
  ).trim();
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  return {
    "x-blueprint-pipeline-timestamp": timestamp,
    "x-blueprint-pipeline-client-id": clientId,
    "x-blueprint-pipeline-nonce": nonce,
    "x-blueprint-pipeline-signature": `sha256=${signature}`,
  };
}

export async function probeTaskEvaluationResultArtifact(params: {
  runId: string;
  artifactId: string;
}): Promise<"admitted" | "not_found" | "unavailable"> {
  const endpoint = configuredArtifactEndpoint(params.runId, params.artifactId);
  const signed = signedPipelineHeaders();
  if (!endpoint || !signed) return "unavailable";
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { ...signed, range: "bytes=0-0" },
    });
    if (response.status === 404) return "not_found";
    if (!response.ok) return "unavailable";
    await response.body?.cancel();
    return "admitted";
  } catch {
    return "unavailable";
  }
}

export async function streamTaskEvaluationResultArtifact(params: {
  runId: string;
  artifactId: string;
  req: Request;
  res: Response;
}) {
  const endpoint = configuredArtifactEndpoint(params.runId, params.artifactId);
  const headers = signedPipelineHeaders();
  if (!endpoint || !headers) {
    params.res.status(503).json({ error: "Result artifact delivery is not configured" });
    return;
  }
  const requestHeaders: Record<string, string> = { ...headers };
  if (params.req.headers.range) requestHeaders.range = params.req.headers.range;
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(endpoint, { method: "GET", headers: requestHeaders });
  } catch {
    params.res.status(502).json({ error: "Result artifact origin is unavailable" });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    params.res.status(upstream.status === 404 ? 404 : 502).json({
      error: "Result artifact origin rejected the request",
    });
    return;
  }
  params.res.status(upstream.status);
  for (const header of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "content-disposition",
    "x-blueprint-artifact-sha256",
  ]) {
    const value = upstream.headers.get(header);
    if (value) params.res.set(header, value);
  }
  params.res.set("Cache-Control", "private, no-store");
  params.res.set("X-Content-Type-Options", "nosniff");
  const stream = Readable.fromWeb(upstream.body as never);
  params.res.on("close", () => stream.destroy());
  stream.pipe(params.res);
}
