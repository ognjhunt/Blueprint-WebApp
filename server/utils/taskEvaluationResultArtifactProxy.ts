import { createHmac, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import type { Request, Response } from "express";
import { artifactResponseIntegrity, parseResultArtifactRange, ResultArtifactIntegrityStream,
  type ResultArtifactMetadata } from "./taskEvaluationArtifactIntegrity";

export const ARTIFACT_ORIGIN_HEADER_TIMEOUT_MS = 15_000;
export const ARTIFACT_ORIGIN_IDLE_TIMEOUT_MS = 30_000;

async function cancelBody(response: globalThis.Response) {
  try { await response.body?.cancel(); } catch { /* The origin may already have disconnected. */ }
}

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
  expected?: ResultArtifactMetadata;
  signal?: AbortSignal;
}): Promise<"admitted" | "not_found" | "unavailable"> {
  const endpoint = configuredArtifactEndpoint(params.runId, params.artifactId);
  const signed = signedPipelineHeaders();
  if (!endpoint || !signed) return "unavailable";
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, ARTIFACT_ORIGIN_HEADER_TIMEOUT_MS);
  params.signal?.addEventListener("abort", abort, { once: true });
  if (params.signal?.aborted) abort();
  let response: globalThis.Response | undefined;
  try {
    response = await fetch(endpoint, {
      method: "GET", redirect: "error", signal: controller.signal,
      headers: { ...signed, range: "bytes=0-0", "accept-encoding": "identity" },
    });
    if (response.status === 404) return "not_found";
    if (!response.ok || !response.body
      || !artifactResponseIntegrity(response, "bytes=0-0", params.expected)) return "unavailable";
    return "admitted";
  } catch { return "unavailable"; }
  finally {
    if (response) await cancelBody(response);
    clearTimeout(timer);
    params.signal?.removeEventListener("abort", abort);
  }
}

export async function streamTaskEvaluationResultArtifact(params: {
  runId: string;
  artifactId: string;
  req: Request;
  res: Response;
  expected?: ResultArtifactMetadata;
}) {
  const { req, res } = params;
  const endpoint = configuredArtifactEndpoint(params.runId, params.artifactId);
  const headers = signedPipelineHeaders();
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (!endpoint || !headers) {
    res.status(503).json({ error: "Result artifact delivery is not configured" });
    return;
  }
  if (parseResultArtifactRange(req.headers.range) === "invalid") {
    res.status(416).json({ error: "Requested artifact range is not available" });
    return;
  }
  const controller = new AbortController();
  let source: Readable | undefined;
  let verifier: ResultArtifactIntegrityStream | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let failed = false;
  const cleanup = () => {
    clearTimeout(timer);
    res.off("close", disconnect);
    res.off("error", disconnect);
  };
  const disconnect = () => {
    controller.abort(); source?.destroy(); verifier?.destroy(); cleanup();
  };
  const fail = () => {
    if (failed) return;
    failed = true;
    controller.abort(); source?.unpipe(); source?.destroy(); verifier?.unpipe(); verifier?.destroy();
    cleanup();
    if (res.destroyed) return;
    if (res.headersSent) { res.destroy(); return; }
    for (const header of ["content-length", "content-range", "content-disposition", "x-blueprint-artifact-sha256", "x-blueprint-artifact-verification"]) res.removeHeader(header);
    res.status(502).json({ error: "Result artifact stream was interrupted or failed integrity verification; retry the download" });
  };
  const armTimeout = (duration: number) => { clearTimeout(timer); timer = setTimeout(fail, duration); };
  res.once("close", disconnect);
  res.once("error", disconnect);
  armTimeout(ARTIFACT_ORIGIN_HEADER_TIMEOUT_MS);
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(endpoint, { method: "GET", redirect: "error", signal: controller.signal,
      headers: { ...headers, "accept-encoding": "identity", ...(req.headers.range ? { range: req.headers.range } : {}) } });
  } catch {
    fail(); return;
  }
  if (res.destroyed || failed) { await cancelBody(upstream); cleanup(); return; }
  if (!upstream.ok || !upstream.body) {
    await cancelBody(upstream); cleanup();
    const status = [404, 416, 429].includes(upstream.status) ? upstream.status : 502;
    for (const header of status === 429 ? ["retry-after"] : status === 416 ? ["content-range"] : []) {
      const value = upstream.headers.get(header);
      if (value) res.set(header, value);
    }
    res.status(status).json({ error: status === 404 ? "Result artifact not found"
      : status === 416 ? "Requested artifact range is not available"
      : status === 429 ? "Result artifact delivery is busy; retry later"
      : "Result artifact origin rejected the request" });
    return;
  }
  const integrity = artifactResponseIntegrity(upstream, req.headers.range, params.expected);
  if (!integrity) { await cancelBody(upstream); fail(); return; }
  res.status(upstream.status);
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition", "x-blueprint-artifact-sha256"]) {
    const value = upstream.headers.get(header);
    if (value) res.set(header, value);
  }
  if (integrity.contentLength !== null) res.set("Content-Length", String(integrity.contentLength));
  res.set("X-Blueprint-Artifact-Verification", integrity.mode);
  source = Readable.fromWeb(upstream.body as never);
  verifier = new ResultArtifactIntegrityStream(integrity);
  source.once("error", fail);
  verifier.once("error", fail);
  verifier.once("end", cleanup);
  source.on("data", () => armTimeout(ARTIFACT_ORIGIN_IDLE_TIMEOUT_MS));
  armTimeout(ARTIFACT_ORIGIN_IDLE_TIMEOUT_MS);
  source.pipe(verifier).pipe(res);
}
