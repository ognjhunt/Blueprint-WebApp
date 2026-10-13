import { createHmac, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import type { Request, Response } from "express";
import { artifactResponseIntegrity, parseResultArtifactRange, ResultArtifactIntegrityStream,
  type ResultArtifactMetadata } from "./taskEvaluationArtifactIntegrity";
import { resolveTaskEvaluationLaunchUrl } from "./taskEvaluationLaunchContract";
import { logger } from "../logger";

export const ARTIFACT_ORIGIN_HEADER_TIMEOUT_MS = 15_000;
export const ARTIFACT_ORIGIN_IDLE_TIMEOUT_MS = 30_000;

async function cancelBody(response: globalThis.Response) {
  try { await response.body?.cancel(); } catch { /* The origin may already have disconnected. */ }
}

/** The exact reasons a registry read can be unavailable. Names, never secrets. */
export type ArtifactRegistryUnavailableReason =
  | "artifact_registry_template_invalid"
  | "artifact_registry_endpoint_not_configured"
  | "artifact_registry_signing_token_not_configured"
  | "artifact_registry_timeout"
  | "artifact_registry_redirect_refused"
  | "artifact_registry_unreachable"
  | "artifact_registry_credentials_rejected"
  | "artifact_registry_origin_error"
  | "artifact_registry_empty_response"
  | "artifact_registry_digest_header_missing"
  | "artifact_registry_digest_mismatch"
  | "artifact_registry_range_or_size_mismatch";

type EndpointSource = "artifact_url_template" | "run_execute_url" | "launch_url" | "job_request_forward_url";

/**
 * Where the per-run artifact registry lives, in precedence order:
 * TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE (must name both {run_id} and
 * {artifact_id}); TASK_EVALUATION_RUN_EXECUTE_URL ending in /execute; the
 * canonical launch URL, which, exactly as launches resolve it, falls back to
 * the canonical ROBOT_EVAL_JOB_REQUEST_FORWARD_URL. Previously only an
 * explicit TASK_EVALUATION_LAUNCH_URL counted, so a deployment that launched
 * through the job-request URL (the documented production default) could
 * launch runs but never read their artifacts, and every ticket probe answered
 * 503 "Result artifact registry is unavailable".
 */
function resolveArtifactEndpoint(runId: string, artifactId: string): {
  endpoint: string; source: EndpointSource | null; issue: ArtifactRegistryUnavailableReason | null;
} {
  const run = encodeURIComponent(runId), artifact = encodeURIComponent(artifactId);
  const template = String(process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE || "").trim();
  if (template) {
    // A template without both placeholders would send every artifact to one URL.
    if (!template.includes("{run_id}") || !template.includes("{artifact_id}")) {
      return { endpoint: "", source: null, issue: "artifact_registry_template_invalid" };
    }
    return { endpoint: template.replace("{run_id}", run).replace("{artifact_id}", artifact),
      source: "artifact_url_template", issue: null };
  }
  const executeUrl = String(process.env.TASK_EVALUATION_RUN_EXECUTE_URL || "").trim().replace("{run_id}", run);
  if (/\/execute\/?$/.test(executeUrl)) {
    return { endpoint: executeUrl.replace(/\/execute\/?$/, `/artifacts/${artifact}`), source: "run_execute_url", issue: null };
  }
  const explicitLaunch = String(process.env.TASK_EVALUATION_LAUNCH_URL || "").trim();
  const launchUrl = resolveTaskEvaluationLaunchUrl();
  if (/\/task-evaluation-launches\/?$/.test(launchUrl)) {
    return { endpoint: launchUrl.replace(/\/task-evaluation-launches\/?$/, `/task-evaluation-runs/${run}/artifacts/${artifact}`),
      source: explicitLaunch ? "launch_url" : "job_request_forward_url", issue: null };
  }
  return { endpoint: "", source: null, issue: "artifact_registry_endpoint_not_configured" };
}

export function configuredArtifactEndpoint(runId: string, artifactId: string) {
  return resolveArtifactEndpoint(runId, artifactId).endpoint;
}

function signingToken() {
  return String(
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN
      || process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN
      || "",
  ).trim();
}

const MISSING_CONFIG: Partial<Record<ArtifactRegistryUnavailableReason, string>> = {
  artifact_registry_template_invalid:
    "TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE (must contain {run_id} and {artifact_id})",
  artifact_registry_endpoint_not_configured:
    "TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE, or TASK_EVALUATION_LAUNCH_URL ending in /task-evaluation-launches, or ROBOT_EVAL_JOB_REQUEST_FORWARD_URL ending in /api/live-pipeline/job-requests",
  artifact_registry_signing_token_not_configured:
    "ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN (or TASK_EVALUATION_RUN_FORWARD_TOKEN)",
};

/** What the running service is configured to use for result artifacts. */
export function describeResultArtifactRegistryConfig() {
  const endpoint = resolveArtifactEndpoint("{run_id}", "{artifact_id}");
  const issues: ArtifactRegistryUnavailableReason[] = [];
  if (endpoint.issue) issues.push(endpoint.issue);
  if (!signingToken()) issues.push("artifact_registry_signing_token_not_configured");
  const ticketSecretConfigured = Boolean(String(process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET || "").trim());
  const missing = [...issues.map(issue => MISSING_CONFIG[issue]!).filter(Boolean),
    ...(ticketSecretConfigured ? [] : ["TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET"])];
  let host: string | null = null;
  try { host = endpoint.endpoint ? new URL(endpoint.endpoint).host : null; } catch { host = null; }
  return {
    ready: missing.length === 0,
    endpointSource: endpoint.source,
    endpointHost: host,
    issues,
    ticketSecretConfigured,
    missing,
    detail: missing.length === 0
      ? `Result artifact registry endpoint (${endpoint.source}), signing token and download ticket secret are configured. Reachability is checked per request.`
      : `Result videos and downloads cannot be served: missing ${missing.join("; ")}.`,
  };
}

export function artifactRegistryMissingConfig(reason: ArtifactRegistryUnavailableReason) {
  return MISSING_CONFIG[reason] ?? null;
}

export function signedPipelineHeaders(body = "") {
  const token = signingToken();
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

type ArtifactProbeParameters = {
  runId: string;
  artifactId: string;
  expected?: ResultArtifactMetadata;
  signal?: AbortSignal;
};
type ArtifactProbeResult = { status: "admitted"; metadata: ResultArtifactMetadata | null }
  | { status: "not_found" }
  | { status: "unavailable"; reason?: ArtifactRegistryUnavailableReason; httpStatus?: number; missingConfig?: string };

function unavailable(params: ArtifactProbeParameters, reason: ArtifactRegistryUnavailableReason, httpStatus?: number): ArtifactProbeResult {
  // Name the exact missing item or origin behaviour; never the URL or token.
  const missingConfig = artifactRegistryMissingConfig(reason);
  logger.warn({ runId: params.runId, artifactId: params.artifactId, code: reason, httpStatus: httpStatus ?? null,
    missingConfig }, "Result artifact registry is unavailable");
  return { status: "unavailable", reason, ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(missingConfig ? { missingConfig } : {}) };
}

function integrityFailure(response: Pick<globalThis.Response, "headers">, expected?: ResultArtifactMetadata): ArtifactRegistryUnavailableReason {
  const digest = response.headers.get("x-blueprint-artifact-sha256") || "";
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) return "artifact_registry_digest_header_missing";
  if (expected && expected.sha256 !== digest) return "artifact_registry_digest_mismatch";
  return "artifact_registry_range_or_size_mismatch";
}

function fetchFailure(error: unknown, timedOut: boolean): ArtifactRegistryUnavailableReason {
  if (timedOut) return "artifact_registry_timeout";
  const cause = (error as { cause?: { message?: unknown } })?.cause;
  const text = `${(error as Error)?.message ?? ""} ${cause?.message ?? ""}`.toLowerCase();
  return text.includes("redirect") ? "artifact_registry_redirect_refused" : "artifact_registry_unreachable";
}

export async function probeTaskEvaluationResultArtifactMetadata(params: ArtifactProbeParameters): Promise<ArtifactProbeResult> {
  const resolved = resolveArtifactEndpoint(params.runId, params.artifactId);
  const signed = signedPipelineHeaders();
  if (!resolved.endpoint) return unavailable(params, resolved.issue ?? "artifact_registry_endpoint_not_configured");
  if (!signed) return unavailable(params, "artifact_registry_signing_token_not_configured");
  const endpoint = resolved.endpoint;
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  const timer = setTimeout(() => { timedOut = true; abort(); }, ARTIFACT_ORIGIN_HEADER_TIMEOUT_MS);
  params.signal?.addEventListener("abort", abort, { once: true });
  if (params.signal?.aborted) abort();
  let response: globalThis.Response | undefined;
  try {
    // A sealed zero-byte telemetry file has no satisfiable first-byte range.
    const range = params.expected?.size_bytes === 0 ? undefined : "bytes=0-0";
    response = await fetch(endpoint, {
      method: "GET", redirect: "error", signal: controller.signal,
      headers: { ...signed, ...(range ? { range } : {}), "accept-encoding": "identity" },
    });
    if (response.status === 404) return { status: "not_found" };
    if (response.status === 401 || response.status === 403) return unavailable(params, "artifact_registry_credentials_rejected", response.status);
    if (!response.ok) return unavailable(params, "artifact_registry_origin_error", response.status);
    if (!response.body) return unavailable(params, "artifact_registry_empty_response", response.status);
    const integrity = artifactResponseIntegrity(response, range, params.expected);
    if (!integrity) return unavailable(params, integrityFailure(response, params.expected), response.status);
    return { status: "admitted", metadata: integrity.totalSize !== null
      ? { sha256: integrity.sourceDigest, size_bytes: integrity.totalSize } : null };
  } catch (error) { return unavailable(params, fetchFailure(error, timedOut)); }
  finally {
    if (response) await cancelBody(response);
    clearTimeout(timer);
    params.signal?.removeEventListener("abort", abort);
  }
}

export async function probeTaskEvaluationResultArtifact(params: ArtifactProbeParameters): Promise<"admitted" | "not_found" | "unavailable"> {
  return (await probeTaskEvaluationResultArtifactMetadata(params)).status;
}

export async function streamTaskEvaluationResultArtifact(params: {
  runId: string;
  artifactId: string;
  req: Request;
  res: Response;
  expected?: ResultArtifactMetadata;
}) {
  const { req, res } = params;
  const resolved = resolveArtifactEndpoint(params.runId, params.artifactId);
  const endpoint = resolved.endpoint;
  const headers = signedPipelineHeaders();
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (!endpoint || !headers) {
    const code = !endpoint ? resolved.issue ?? "artifact_registry_endpoint_not_configured" : "artifact_registry_signing_token_not_configured";
    logger.warn({ runId: params.runId, artifactId: params.artifactId, code, missingConfig: artifactRegistryMissingConfig(code) },
      "Result artifact delivery is not configured");
    res.status(503).json({ error: "Result artifact delivery is not configured", code });
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
