import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = "blueprint.webapp.robot_eval_forwarding_readiness.v1";
const DEFAULT_FORWARD_TIMEOUT_MS = 10_000;
const DEFAULT_OUTPUT_PATH =
  "output/pipeline/robot_eval_job_requests/forwarding_preflight.json";

type Args = Record<string, string | true>;
type Env = Record<string, string | undefined>;

type ProbeStatus =
  | "not_requested"
  | "skipped"
  | "reachable"
  | "failed"
  | "unreachable";

export type RobotEvalForwardingReadinessStatus =
  | "not_configured"
  | "ready_for_optional_forwarding"
  | "ready_for_required_forwarding"
  | "ready_for_optional_forwarding_with_probe"
  | "ready_for_required_forwarding_with_probe"
  | "blocked";

type SanitizedUrl = {
  configured: boolean;
  valid: boolean;
  protocol?: string;
  origin?: string;
  pathname?: string;
  query_present?: boolean;
  credentials_present?: boolean;
  error?: string;
};

export type RobotEvalForwardingReadinessReport = {
  schema_version: typeof SCHEMA_VERSION;
  generated_at_iso: string;
  generated_by: string;
  status: RobotEvalForwardingReadinessStatus;
  forwarding_required: boolean;
  endpoint_configured: boolean;
  configured_env: {
    forward_url: SanitizedUrl;
    forward_token: {
      configured: boolean;
      redacted: true;
    };
    forward_timeout_ms: {
      configured: boolean;
      value: number;
      valid: boolean;
    };
    capture_root_by_site_json: {
      configured: boolean;
      valid: boolean;
      site_count: number;
      site_slugs: string[];
    };
    single_capture_root_override: {
      configured: boolean;
    };
  };
  probe: {
    requested: boolean;
    attempted: boolean;
    status: ProbeStatus;
    intake_audit_url?: SanitizedUrl;
    http_status?: number;
    audit_status?: string;
    input_blockers_count?: number;
    webapp_staging_performed?: boolean;
    error_name?: string;
    error_message?: string;
  };
  blockers: string[];
  warnings: string[];
  proof_boundary: {
    command_is_read_only: true;
    no_job_queued: true;
    no_pipeline_mutation_requested: true;
    no_gpu_allocated: true;
    no_simulator_execution_proven: true;
    no_rank_fidelity_result_proven: true;
    no_public_claim_upgrade_allowed: true;
  };
};

export type RobotEvalForwardingReadinessOptions = {
  env?: Env;
  warnings?: string[];
  nowIso?: string;
  requireForwarding?: boolean;
  probeIntakeAudit?: boolean;
  probeUrl?: string;
  fetchImpl?: typeof fetch;
};

function parseArgs(argv: string[]) {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${item}`);
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function stringArg(args: Args, key: string, fallback = "") {
  const value = args[key];
  if (value === true || value === undefined) {
    return fallback;
  }
  return String(value).trim() || fallback;
}

function truthy(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function stripCopiedLineNumberPrefixes(value: string) {
  let body = value.trim();
  while (/^\d+\s*\|\s*/.test(body)) {
    body = body.replace(/^\d+\s*\|\s*/, "").trim();
  }
  return body;
}

export function parseRobotEvalForwardingEnvFile(
  text: string,
  source = "env-file",
): { env: Env; warnings: string[] } {
  const env: Env = {};
  const warnings: string[] = [];
  const keyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = stripCopiedLineNumberPrefixes(line);
    if (!trimmed || trimmed.startsWith("#")) return;

    const exportPrefix = "export ";
    const body = trimmed.startsWith(exportPrefix) ? trimmed.slice(exportPrefix.length).trim() : trimmed;
    const equalsIndex = body.indexOf("=");
    if (equalsIndex <= 0) {
      warnings.push(`${source}:${index + 1}:ignored_malformed_env_line`);
      return;
    }

    const key = body.slice(0, equalsIndex).trim();
    if (!keyPattern.test(key)) {
      warnings.push(`${source}:${index + 1}:ignored_invalid_env_key`);
      return;
    }

    let value = body.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });

  return { env, warnings };
}

async function loadRobotEvalForwardingEnvFiles(paths: string[]): Promise<{
  env: Env;
  warnings: string[];
}> {
  const env: Env = {};
  const warnings: string[] = [];
  for (const rawPath of paths) {
    const envPath = path.resolve(rawPath);
    try {
      const parsed = parseRobotEvalForwardingEnvFile(
        await fs.readFile(envPath, "utf8"),
        envPath,
      );
      Object.assign(env, parsed.env);
      warnings.push(...parsed.warnings);
    } catch (error) {
      warnings.push(
        `${envPath}:unreadable_env_file:${error instanceof Error ? error.name : "UnknownError"}`,
      );
    }
  }
  return { env, warnings };
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      configured: false,
      value: fallback,
      valid: true,
    };
  }
  const parsed = Number.parseInt(raw, 10);
  return {
    configured: true,
    value: Number.isFinite(parsed) ? parsed : fallback,
    valid: Number.isFinite(parsed) && parsed > 0 && String(parsed) === raw,
  };
}

function sanitizeUrl(raw: string | undefined): SanitizedUrl {
  const value = String(raw || "").trim();
  if (!value) {
    return {
      configured: false,
      valid: false,
    };
  }
  try {
    const url = new URL(value);
    return {
      configured: true,
      valid: true,
      protocol: url.protocol.replace(/:$/, ""),
      origin: url.origin,
      pathname: url.pathname,
      query_present: Boolean(url.search),
      credentials_present: Boolean(url.username || url.password),
    };
  } catch (error) {
    return {
      configured: true,
      valid: false,
      error: error instanceof Error ? error.message : "invalid URL",
    };
  }
}

function deriveIntakeAuditUrl(forwardUrl: string, explicitProbeUrl?: string) {
  if (explicitProbeUrl?.trim()) {
    return explicitProbeUrl.trim();
  }
  if (!forwardUrl.trim()) {
    return "";
  }
  const url = new URL(forwardUrl);
  if (!url.pathname.endsWith("/job-requests")) {
    return "";
  }
  url.pathname = `${url.pathname.slice(0, -"/job-requests".length)}/intake-audit`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function parseCaptureRootBySite(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      configured: false,
      valid: true,
      site_count: 0,
      site_slugs: [] as string[],
    };
  }
  try {
    const parsed = JSON.parse(raw);
    const valid =
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.values(parsed).every((item) => typeof item === "string" && item.trim());
    const siteSlugs = valid ? Object.keys(parsed).sort() : [];
    return {
      configured: true,
      valid,
      site_count: siteSlugs.length,
      site_slugs: siteSlugs,
    };
  } catch {
    return {
      configured: true,
      valid: false,
      site_count: 0,
      site_slugs: [] as string[],
    };
  }
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function nestedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function probeIntakeAudit(params: {
  auditUrl: string;
  token: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const response = await params.fetchImpl(params.auditUrl, {
      method: "GET",
      headers: {
        authorization: `Bearer ${params.token}`,
      },
      signal: controller.signal,
    });
    let payload: Record<string, unknown> = {};
    try {
      const parsed = await response.json();
      payload = nestedRecord(parsed);
    } catch {
      payload = {};
    }
    const webappStaging = nestedRecord(payload.webapp_staging);
    return {
      status: response.ok ? ("reachable" as const) : ("failed" as const),
      http_status: response.status,
      audit_status: safeString(payload.status),
      input_blockers_count: Array.isArray(payload.input_blockers)
        ? payload.input_blockers.length
        : undefined,
      webapp_staging_performed:
        typeof webappStaging.performed === "boolean"
          ? webappStaging.performed
          : undefined,
    };
  } catch (error) {
    return {
      status: "unreachable" as const,
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : "Unknown intake audit probe error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function auditRobotEvalForwardingReadiness(
  options: RobotEvalForwardingReadinessOptions = {},
): Promise<RobotEvalForwardingReadinessReport> {
  const env = options.env || process.env;
  const warnings: string[] = [...(options.warnings || [])];
  const blockers: string[] = [];
  const forwardUrl = String(env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL || "").trim();
  const token = String(env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "");
  const endpointConfigured = Boolean(forwardUrl);
  const forwardingRequired =
    options.requireForwarding ?? truthy(env.ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED);
  const forwardUrlReport = sanitizeUrl(forwardUrl);
  const timeout = parsePositiveInt(
    env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TIMEOUT_MS,
    DEFAULT_FORWARD_TIMEOUT_MS,
  );
  const captureRootBySite = parseCaptureRootBySite(
    env.ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON,
  );
  const singleCaptureRootOverrideConfigured = Boolean(
    String(env.ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT || "").trim(),
  );

  if (forwardingRequired && !endpointConfigured) {
    blockers.push("missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_URL");
  }
  if (endpointConfigured && !forwardUrlReport.valid) {
    blockers.push("invalid_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_URL");
  }
  if (
    forwardUrlReport.valid &&
    forwardUrlReport.protocol &&
    !["http", "https"].includes(forwardUrlReport.protocol)
  ) {
    blockers.push("unsupported_ROBOT_EVAL_JOB_REQUEST_FORWARD_URL_protocol");
  }
  if (forwardUrlReport.credentials_present) {
    blockers.push("ROBOT_EVAL_JOB_REQUEST_FORWARD_URL_must_not_include_credentials");
  }
  if (forwardUrlReport.query_present) {
    warnings.push("ROBOT_EVAL_JOB_REQUEST_FORWARD_URL_query_parameters_redacted");
  }
  if ((forwardingRequired || endpointConfigured || options.probeIntakeAudit) && !token.trim()) {
    blockers.push("missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN");
  }
  if (!timeout.valid) {
    blockers.push("invalid_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_TIMEOUT_MS");
  }
  if (!captureRootBySite.valid) {
    blockers.push("invalid_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON");
  }
  if (
    endpointConfigured &&
    !captureRootBySite.configured &&
    !singleCaptureRootOverrideConfigured
  ) {
    warnings.push("capture_root_override_not_configured");
  }

  const probeRequested = Boolean(options.probeIntakeAudit);
  const probe = {
    requested: probeRequested,
    attempted: false,
    status: (probeRequested ? "skipped" : "not_requested") as ProbeStatus,
  } as RobotEvalForwardingReadinessReport["probe"];

  if (probeRequested && blockers.length === 0) {
    const auditUrl = deriveIntakeAuditUrl(forwardUrl, options.probeUrl);
    const auditUrlReport = sanitizeUrl(auditUrl);
    probe.intake_audit_url = auditUrlReport;
    if (!auditUrl || !auditUrlReport.valid) {
      blockers.push("probe_intake_audit_url_not_derivable");
    } else if (
      auditUrlReport.protocol &&
      !["http", "https"].includes(auditUrlReport.protocol)
    ) {
      blockers.push("unsupported_probe_intake_audit_url_protocol");
    } else if (auditUrlReport.credentials_present) {
      blockers.push("probe_intake_audit_url_must_not_include_credentials");
    } else {
      probe.attempted = true;
      const probeResult = await probeIntakeAudit({
        auditUrl,
        token,
        timeoutMs: timeout.value,
        fetchImpl: options.fetchImpl || fetch,
      });
      Object.assign(probe, probeResult);
      if (probeResult.status === "failed") {
        blockers.push("probe_intake_audit_failed");
      }
      if (probeResult.status === "unreachable") {
        blockers.push("probe_intake_audit_unreachable");
      }
    }
  }

  let status: RobotEvalForwardingReadinessStatus;
  if (blockers.length > 0) {
    status = "blocked";
  } else if (!endpointConfigured) {
    status = "not_configured";
  } else if (probeRequested && probe.status === "reachable") {
    status = forwardingRequired
      ? "ready_for_required_forwarding_with_probe"
      : "ready_for_optional_forwarding_with_probe";
  } else {
    status = forwardingRequired
      ? "ready_for_required_forwarding"
      : "ready_for_optional_forwarding";
  }

  return {
    schema_version: SCHEMA_VERSION,
    generated_at_iso: options.nowIso || new Date().toISOString(),
    generated_by:
      "Blueprint-WebApp/scripts/pipeline/audit-robot-eval-forwarding-readiness.ts",
    status,
    forwarding_required: forwardingRequired,
    endpoint_configured: endpointConfigured,
    configured_env: {
      forward_url: forwardUrlReport,
      forward_token: {
        configured: Boolean(token.trim()),
        redacted: true,
      },
      forward_timeout_ms: timeout,
      capture_root_by_site_json: captureRootBySite,
      single_capture_root_override: {
        configured: singleCaptureRootOverrideConfigured,
      },
    },
    probe,
    blockers,
    warnings,
    proof_boundary: {
      command_is_read_only: true,
      no_job_queued: true,
      no_pipeline_mutation_requested: true,
      no_gpu_allocated: true,
      no_simulator_execution_proven: true,
      no_rank_fidelity_result_proven: true,
      no_public_claim_upgrade_allowed: true,
    },
  };
}

export async function writeRobotEvalForwardingReadinessReport(
  report: RobotEvalForwardingReadinessReport,
  outputPath: string,
) {
  const resolved = path.resolve(outputPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return resolved;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(
      [
        "Usage: npm run pipeline:forwarding:preflight -- [--require-forwarding] [--probe-intake-audit] [--probe-url <url>] [--forwarding-env-file <path[,path...]>] [--output <path>]",
        "",
        "Reads ROBOT_EVAL_JOB_REQUEST_FORWARD_* env vars or dotenv-style --env-file entries, writes a redacted JSON readiness report,",
        "and only performs a read-only GET probe when --probe-intake-audit is supplied.",
        "The CLI treats forwarding as required by default for launch preflight; pass --allow-optional-forwarding for local optional checks.",
      ].join("\n"),
    );
    return;
  }
  const outputPath = stringArg(args, "output", DEFAULT_OUTPUT_PATH);
  const envFileArg = stringArg(args, "forwarding-env-file");
  const envFilePaths = envFileArg
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const envFiles = await loadRobotEvalForwardingEnvFiles(envFilePaths);
  const report = await auditRobotEvalForwardingReadiness({
    env: { ...process.env, ...envFiles.env },
    warnings: envFiles.warnings,
    requireForwarding: args["allow-optional-forwarding"]
      ? false
      : args["require-forwarding"]
        ? true
        : true,
    probeIntakeAudit: Boolean(args["probe-intake-audit"] || args.probe),
    probeUrl: stringArg(args, "probe-url"),
  });
  const resolvedOutput = await writeRobotEvalForwardingReadinessReport(report, outputPath);
  console.log(`[robot-eval-forwarding-preflight] status=${report.status}`);
  console.log(`[robot-eval-forwarding-preflight] blockers=${report.blockers.length}`);
  console.log(`[robot-eval-forwarding-preflight] output=${resolvedOutput}`);
  if (report.blockers.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
