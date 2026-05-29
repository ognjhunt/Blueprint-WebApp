import type {
  HostedSessionFailureDiagnostic,
  HostedSessionFailureOperation,
  HostedSessionLaunchBlockerDetail,
  HostedSessionMode,
  HostedSessionRecord,
} from "../types/hosted-session";
import { HostedSessionRuntimeError, type HostedRuntimeResolution } from "./hosted-session-runtime";

const HOSTED_ACCESS_ERROR_CODES = new Set([
  "unauthorized",
  "forbidden",
  "entitlement_required",
  "session_access_denied",
]);

export function isHostedAccessError(error: unknown): error is HostedSessionRuntimeError {
  return error instanceof HostedSessionRuntimeError && HOSTED_ACCESS_ERROR_CODES.has(error.code);
}

export function hostedAccessStatus(error: Pick<HostedSessionRuntimeError, "code">) {
  return error.code === "unauthorized" ? 401 : 403;
}

export function hostedSessionEntitlementIds(
  session: Pick<HostedSessionRecord, "site" | "siteModel"> | null | undefined,
) {
  if (!session) {
    return [];
  }
  return [
    session.site.siteWorldId,
    session.site.scene_id,
    session.site.capture_id,
    session.site.site_submission_id,
    session.siteModel?.siteWorldId,
    session.siteModel?.sceneId,
    session.siteModel?.captureId,
  ];
}

export function hostedRuntimeEntitlementIds(
  runtime: Pick<HostedRuntimeResolution, "siteWorldId" | "scene_id" | "capture_id" | "site_submission_id">,
  requestedSiteWorldId?: string | null,
) {
  return [
    requestedSiteWorldId,
    runtime.siteWorldId,
    runtime.scene_id,
    runtime.capture_id,
    runtime.site_submission_id,
  ];
}

export function selectLaunchReadinessBlockerCode(params: {
  sessionMode: HostedSessionMode;
  blockerDetails: HostedSessionLaunchBlockerDetail[];
}) {
  return (
    params.blockerDetails.find((item) =>
      params.sessionMode === "runtime_only" ? item.code === "runtime_handle_missing" : true,
    )?.code || params.blockerDetails[0]?.code || "session_not_launchable"
  );
}

function summarizeDiagnosticText(detail: string) {
  const firstLine = detail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || detail.trim() || "Runtime request failed.";
}

function extractTraceback(detail?: string | null) {
  const text = String(detail || "").trim();
  const marker = text.indexOf("Traceback");
  return marker >= 0 ? text.slice(marker).trim() : null;
}

function extractExitCode(detail?: string | null) {
  const match = String(detail || "").match(/exit code\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function buildFailureDiagnostic(params: {
  source: HostedSessionFailureDiagnostic["source"];
  operation: HostedSessionFailureOperation;
  error: unknown;
  fallbackCode: string;
  fallbackSummary: string;
  statusCode?: number | null;
  occurredAt?: string | (() => string);
}): HostedSessionFailureDiagnostic {
  const knownError = params.error as
    | (Error & { code?: string; detail?: string | null; statusCode?: number | null })
    | undefined;
  const detail = String(knownError?.detail || knownError?.message || params.fallbackSummary).trim();
  const occurredAt =
    typeof params.occurredAt === "function"
      ? params.occurredAt()
      : params.occurredAt || new Date().toISOString();
  return {
    source: params.source,
    operation: params.operation,
    code: String(knownError?.code || params.fallbackCode),
    summary: summarizeDiagnosticText(detail) || params.fallbackSummary,
    detail,
    traceback: extractTraceback(detail),
    rawDetail: detail,
    exitCode: extractExitCode(detail),
    statusCode: knownError?.statusCode ?? params.statusCode ?? null,
    occurredAt,
  };
}

function buildCanonicalPackageMismatchDetail(
  session: Pick<HostedSessionRecord, "siteModel" | "launchContext"> | null | undefined,
) {
  const registered = String(
    session?.siteModel?.registeredCanonicalPackageUri
      || session?.launchContext.registeredCanonicalPackageUri
      || "",
  ).trim();
  const resolved = String(
    session?.siteModel?.resolvedArtifactCanonicalUri
      || session?.launchContext.resolvedArtifactCanonicalUri
      || "",
  ).trim();

  if (!registered || !resolved || registered === resolved) {
    return null;
  }

  return `Canonical package mismatch detected. runtime_registered=${registered} resolved_artifact=${resolved}`;
}

export function appendCanonicalPackageMismatch(
  diagnostic: HostedSessionFailureDiagnostic,
  session: Pick<HostedSessionRecord, "siteModel" | "launchContext"> | null | undefined,
) {
  const mismatchDetail = buildCanonicalPackageMismatchDetail(session);
  if (!mismatchDetail) {
    return diagnostic;
  }

  const detail = [diagnostic.detail, mismatchDetail].filter(Boolean).join("\n");
  return {
    ...diagnostic,
    detail,
    rawDetail: detail,
  };
}
