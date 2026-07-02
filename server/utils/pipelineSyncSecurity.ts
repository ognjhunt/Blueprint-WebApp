import crypto from "crypto";
import type { Request } from "express";

const DEFAULT_MAX_SKEW_MS = 5 * 60 * 1000;

export interface PipelineSyncAuthResult {
  ok: boolean;
  status: number;
  code: string;
  message: string;
}

function truthy(value: string | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function buildPipelineSyncSignature(args: {
  secret: string;
  timestamp: string;
  body: string;
}): string {
  return crypto
    .createHmac("sha256", args.secret)
    .update(`${args.timestamp}.${args.body}`)
    .digest("hex");
}

export function verifyPipelineSyncRequest(req: Request): PipelineSyncAuthResult {
  const expected = String(process.env.PIPELINE_SYNC_TOKEN || "").trim();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      code: "pipeline_sync_secret_not_configured",
      message: "Pipeline sync secret is not configured.",
    };
  }

  const timestamp = String(req.header("X-Blueprint-Pipeline-Timestamp") || "").trim();
  const signatureHeader = String(req.header("X-Blueprint-Pipeline-Signature") || "").trim();
  const rawBody =
    typeof (req as Request & { rawBody?: string }).rawBody === "string"
      ? (req as Request & { rawBody?: string }).rawBody || "{}"
      : JSON.stringify(req.body ?? {});

  if (timestamp && signatureHeader) {
    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs)) {
      return {
        ok: false,
        status: 401,
        code: "invalid_pipeline_sync_timestamp",
        message: "Invalid pipeline sync timestamp.",
      };
    }
    const maxSkewMs = Number(process.env.PIPELINE_SYNC_MAX_CLOCK_SKEW_MS || DEFAULT_MAX_SKEW_MS);
    if (Math.abs(Date.now() - timestampMs) > maxSkewMs) {
      return {
        ok: false,
        status: 401,
        code: "stale_pipeline_sync_timestamp",
        message: "Pipeline sync timestamp is outside the replay window.",
      };
    }

    const expectedSignature = buildPipelineSyncSignature({
      secret: expected,
      timestamp,
      body: rawBody,
    });
    const providedSignature = signatureHeader.replace(/^sha256=/i, "");
    if (!timingSafeEqualString(providedSignature, expectedSignature)) {
      return {
        ok: false,
        status: 401,
        code: "invalid_pipeline_sync_signature",
        message: "Invalid pipeline sync signature.",
      };
    }
    return { ok: true, status: 200, code: "ok", message: "ok" };
  }

  if (truthy(process.env.PIPELINE_SYNC_ALLOW_LEGACY_BEARER)) {
    const provided = String(req.header("X-Blueprint-Pipeline-Token") || "").trim();
    if (provided && timingSafeEqualString(provided, expected)) {
      return { ok: true, status: 200, code: "ok", message: "ok" };
    }
  }

  return {
    ok: false,
    status: 401,
    code: "missing_pipeline_sync_signature",
    message: "Pipeline sync requires HMAC signature and timestamp headers.",
  };
}

function defaultAllowedGcsPrefixes(): string[] {
  const configured = String(process.env.PIPELINE_SYNC_ALLOWED_GCS_PREFIXES || "").trim();
  if (configured) {
    return configured
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const bucket =
    String(process.env.PIPELINE_SYNC_GCS_BUCKET || "").trim() ||
    String(process.env.FIREBASE_STORAGE_BUCKET || "").trim() ||
    String(process.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim() ||
    "blueprint-8c1ca.appspot.com";
  return [`gs://${bucket}/`];
}

function isUriKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized === "uri" || normalized.endsWith("_uri") || normalized.endsWith("uris");
}

function inspectUriValues(
  value: unknown,
  path: string,
  allowedGcsPrefixes: string[],
  violations: string[],
): void {
  if (value == null) {
    return;
  }
  if (typeof value === "string") {
    if (!value.trim()) {
      return;
    }
    if (!value.startsWith("gs://")) {
      violations.push(`${path}: artifact URI must use gs://`);
      return;
    }
    if (!allowedGcsPrefixes.some((prefix) => value.startsWith(prefix))) {
      violations.push(`${path}: artifact URI is outside allowed GCS prefixes`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectUriValues(item, `${path}[${index}]`, allowedGcsPrefixes, violations),
    );
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      inspectArtifactUris(nested, `${path}.${key}`, allowedGcsPrefixes, violations, key);
    }
  }
}

function inspectArtifactUris(
  value: unknown,
  path: string,
  allowedGcsPrefixes: string[],
  violations: string[],
  key?: string,
): void {
  if (key && isUriKey(key)) {
    inspectUriValues(value, path, allowedGcsPrefixes, violations);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectArtifactUris(item, `${path}[${index}]`, allowedGcsPrefixes, violations),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [nestedKey, nested] of Object.entries(value as Record<string, unknown>)) {
      inspectArtifactUris(nested, `${path}.${nestedKey}`, allowedGcsPrefixes, violations, nestedKey);
    }
  }
}

export function validatePipelineArtifactUris(payload: Record<string, unknown>): string[] {
  const allowedGcsPrefixes = defaultAllowedGcsPrefixes();
  const violations: string[] = [];
  inspectArtifactUris(payload.artifacts, "artifacts", allowedGcsPrefixes, violations);
  inspectArtifactUris(payload.derived_assets, "derived_assets", allowedGcsPrefixes, violations);
  inspectArtifactUris(
    payload.evaluation_readiness,
    "evaluation_readiness",
    allowedGcsPrefixes,
    violations,
  );
  return violations;
}
