import { authAdmin, dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { isTruthyEnvValue } from "../config/env";
import { getCityLaunchSenderStatus, getEmailTransportStatus } from "./email";
import { getHostedSessionLiveStoreStatus } from "./hosted-session-live-store";
import { describeSiteVideoEvidenceConfig } from "./siteVideoEvidenceConfig";
import { readWorkerHeartbeat, type WorkerHeartbeatReading, type WorkerWithdrawalNoticeReport } from "./workerHeartbeat";

type LaunchCheck = {
  required: boolean;
  ready: boolean;
  detail: string;
};

export type ReadinessGapFinding = {
  stableId: string;
  checkKey: string;
  title: string;
  detail: string;
  severity: "blocker";
};

function launchBlockerMessage(label: string, check: LaunchCheck) {
  return `${label}: ${check.detail}`;
}

/**
 * Active launch blockers as stable gap records for the gap-closure registry.
 * Skips optional checks and the nested automationFlags object.
 */
export function listActiveReadinessFindings(
  snapshot: ReturnType<typeof buildLaunchReadinessSnapshot>,
): ReadinessGapFinding[] {
  const launchChecks = snapshot.dependencies.launchChecks as Record<
    string,
    LaunchCheck | Record<string, unknown>
  >;
  const out: ReadinessGapFinding[] = [];

  for (const [checkKey, raw] of Object.entries(launchChecks)) {
    if (checkKey === "automationFlags" || !raw || typeof raw !== "object") {
      continue;
    }
    if (!("required" in raw) || !("ready" in raw)) {
      continue;
    }
    const check = raw as LaunchCheck;
    if (check.required && !check.ready) {
      out.push({
        stableId: `readiness:${checkKey}`,
        checkKey,
        title: `Launch readiness: ${checkKey}`,
        detail: check.detail,
        severity: "blocker",
      });
    }
  }

  return out;
}

/**
 * The isolated local launch smoke (scripts/launch-smoke-local.mjs) boots the
 * production build with an allowlisted, credential-free environment. In that
 * profile Firebase Admin is intentionally absent, so readiness treats the
 * firestore-backed checks as satisfied-for-smoke instead of blocking.
 *
 * Fail-closed guard: the profile is only honored when BASE_URL points at a
 * loopback host, so setting BLUEPRINT_LOCAL_LAUNCH_SMOKE on a deployed
 * environment cannot weaken production readiness.
 */
export function isLocalLaunchSmokeProfile(env: NodeJS.ProcessEnv = process.env) {
  if (!isTruthyEnvValue(env.BLUEPRINT_LOCAL_LAUNCH_SMOKE)) {
    return false;
  }
  const baseUrl = env.BASE_URL?.trim() || "";
  try {
    const hostname = new URL(baseUrl).hostname;
    return ["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

export function buildLaunchReadinessSnapshot() {
  const localLaunchSmoke = isLocalLaunchSmokeProfile();
  const liveSessionStore = getHostedSessionLiveStoreStatus();
  const emailTransport = getEmailTransportStatus();
  const cityLaunchSender = getCityLaunchSenderStatus();
  const fieldEncryptionReady = Boolean(
    process.env.FIELD_ENCRYPTION_MASTER_KEY?.trim()
    || process.env.FIELD_ENCRYPTION_KMS_KEY_NAME?.trim(),
  );
  const pipelineSyncEnabled = Boolean(
    process.env.PIPELINE_SYNC_TOKEN?.trim()
    || isTruthyEnvValue(process.env.BLUEPRINT_PIPELINE_SYNC_REQUIRED),
  );
  // A deployed production service (not the loopback launch smoke) must be
  // able to tell a person when something breaks and to send customer email.
  const productionDeploy = process.env.NODE_ENV === "production" && !localLaunchSmoke;
  const emailRequired =
    emailTransport.enabled
    || isTruthyEnvValue(process.env.BLUEPRINT_EMAIL_DELIVERY_REQUIRED)
    || productionDeploy;
  const redisConfigured =
    Boolean(process.env.REDIS_URL?.trim()) || Boolean(process.env.RATE_LIMIT_REDIS_URL?.trim());
  // Without Redis, rate limits and idempotency are per-process and reset on
  // every restart. On the single-instance beta that degrades rather than
  // breaks (rate limits fail open), so a production service without Redis is
  // a named warning, not a blocker: a blocker fails the deploy health gate and
  // rolls the release back. BLUEPRINT_READINESS_REDIS_WAIVED=1 records that
  // the founder accepted it.
  const redisWaived = isTruthyEnvValue(process.env.BLUEPRINT_READINESS_REDIS_WAIVED);
  const redisRequired = redisConfigured;
  // Missing Slack is a warning for the same reason: intake notices and
  // escalations still go by email (a production blocker below), and the
  // warning is repeated on every readiness pass until it is fixed.
  const slackOpsRequired = false;
  const slackOpsReady = Boolean(process.env.SLACK_WEBHOOK_URL?.trim()) || !productionDeploy;
  const firebaseAdminReady = Boolean(dbAdmin && authAdmin);
  const redisReady =
    !redisRequired
    || (redisConfigured
      && liveSessionStore.backend === "redis"
      && liveSessionStore.redisConnected === true);
  const emailReady = !emailRequired || emailTransport.configured;
  const pipelineSyncReady =
    !pipelineSyncEnabled || Boolean(process.env.PIPELINE_SYNC_TOKEN?.trim());

  const siteVideoEvidence = describeSiteVideoEvidenceConfig();

  const checks = {
    server: true,
    firebaseAdmin: firebaseAdminReady || localLaunchSmoke,
    fieldEncryption: fieldEncryptionReady,
    redis: redisReady,
    email: emailReady,
    slackOpsAlerts: !slackOpsRequired || slackOpsReady,
    pipelineSync: pipelineSyncReady,
    siteVideoEvidence: siteVideoEvidence.ready,
  };

  const launchChecks = {
    siteVideoEvidence: {
      required: siteVideoEvidence.enabled,
      ready: siteVideoEvidence.ready,
      detail: siteVideoEvidence.detail,
    },
    firebaseAdmin: {
      required: !localLaunchSmoke,
      ready: firebaseAdminReady,
      detail: firebaseAdminReady
        ? "Firebase Admin auth and firestore are configured."
        : localLaunchSmoke
          ? "Local launch smoke profile: Firebase Admin is intentionally not configured. Production readiness still requires it."
          : "Firebase Admin auth/firestore is unavailable.",
    },
    fieldEncryption: {
      required: true,
      ready: fieldEncryptionReady,
      detail: fieldEncryptionReady
        ? "Inbound request field encryption is configured."
        : "Inbound request storage requires FIELD_ENCRYPTION_MASTER_KEY or FIELD_ENCRYPTION_KMS_KEY_NAME.",
    },
    redis: {
      required: redisRequired,
      // A production service without Redis stays visible as a warning.
      ready: redisReady && !(productionDeploy && !redisConfigured),
      detail: productionDeploy && !redisConfigured && !redisWaived
        ? "REDIS_URL is not set in production: rate limits, idempotency and the automation leader lease fall back to per-process state that resets on restart. Set REDIS_URL (Render Key Value), or acknowledge a single-instance beta with BLUEPRINT_READINESS_REDIS_WAIVED=1."
        : redisRequired
          ? liveSessionStore.redisConnected
            ? "Redis-backed live session state is connected."
            : "Redis is configured for live session state but is not connected."
          : redisWaived && productionDeploy
            ? "Redis requirement waived by BLUEPRINT_READINESS_REDIS_WAIVED=1: rate limits are per-process and reset on restart."
            : "Redis-backed live session state is not required.",
    },
    slackOpsAlerts: {
      required: slackOpsRequired,
      ready: slackOpsReady,
      detail: slackOpsReady
        ? "SLACK_WEBHOOK_URL is configured for ops alerts."
        : "SLACK_WEBHOOK_URL is not set: ops alerts (5xx spikes, crashes, undelivered intake notices, readiness) reach nobody.",
    },
    email: {
      required: emailRequired,
      ready: emailReady,
      detail: emailRequired
        ? emailReady
          ? "Resend delivery is configured."
          : "Resend delivery is required but not fully configured."
        : "Resend delivery is not required.",
    },
    cityLaunchSender: {
      required: false,
      ready: Boolean(cityLaunchSender.fromEmail) && cityLaunchSender.verificationStatus !== "unverified",
      detail: !cityLaunchSender.fromEmail
        ? "City-launch sender email is not configured. Set BLUEPRINT_CITY_LAUNCH_FROM_EMAIL or RESEND_FROM_EMAIL before claiming outbound city launchability."
        : cityLaunchSender.verificationStatus === "verified"
          ? `City-launch sender ${cityLaunchSender.fromEmail} is configured and manually marked verified.`
          : cityLaunchSender.verificationStatus === "unverified"
            ? `City-launch sender ${cityLaunchSender.fromEmail} is explicitly marked unverified.`
            : `City-launch sender ${cityLaunchSender.fromEmail} is configured, but verification cannot be proven programmatically. Confirm it manually and set BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified.`,
    },
    pipelineSync: {
      required: pipelineSyncEnabled,
      ready: pipelineSyncReady,
      detail: pipelineSyncEnabled
        ? pipelineSyncReady
          ? "Pipeline sync token is configured."
          : "Pipeline sync is enabled but PIPELINE_SYNC_TOKEN is missing."
        : "Pipeline sync is not required.",
    },
  };

  const blockers = Object.entries(launchChecks)
    .filter(([key, value]) => key !== "automationFlags" && "required" in value && value.required && !value.ready)
    .map(([key, value]) => launchBlockerMessage(key, value as LaunchCheck));

  const warnings = Object.entries(launchChecks)
    .filter(([key, value]) => key !== "automationFlags" && "required" in value && !value.required && !value.ready)
    .map(([key, value]) => launchBlockerMessage(key, value as LaunchCheck));

  const status = Object.values(checks).every(Boolean) ? ("ready" as const) : ("not_ready" as const);

  return {
    status,
    checks,
    blockers,
    warnings,
    profile: localLaunchSmoke ? ("local_smoke" as const) : ("standard" as const),
    dependencies: {
      liveSessionStore,
      emailTransport,
      pipelineSyncEnabled,
      redisRequired,
      launchChecks,
    },
  };
}

/**
 * The withdrawal notice check, from what the worker reported. A site's withdrawal is sent to the Pipeline by the worker
 * (`websiteCaptureWithdrawal.ts`, started only in `server/worker.ts`), which may hold other settings than this web
 * process, so the fact comes from the worker's own heartbeat report and never from this process's settings. Required
 * once a worker has reported it; a worker that has not (none deployed here, or one from before the report) is not
 * guessed at.
 */
export function withdrawalNoticeLaunchCheck(report: WorkerWithdrawalNoticeReport | undefined): LaunchCheck {
  if (!report) return { required: false, ready: true,
    detail: "The background worker has not reported whether it can send a site's withdrawal to the Pipeline." };
  const missing = [
    ...(report.addressConfigured ? [] : ["the Pipeline's address (CAPTURE_LIFECYCLE_PIPELINE_BASE_URL, or CAPTURE_UPLOAD_INTAKE_FORWARD_URL)"]),
    ...(report.tokenConfigured ? [] : ["the signing token (CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN)"]),
  ];
  return { required: true, ready: missing.length === 0, detail: missing.length === 0
    ? "The background worker can send a site's withdrawal to the Pipeline."
    : `The background worker (blueprint-webapp-worker) cannot send a site's withdrawal to the Pipeline: it has no ${missing.join(" and no ")}. `
      + "Set it on the worker service. Until then a withdrawal leaves every company's view but the Pipeline is not told." };
}

/**
 * The launch readiness snapshot with the facts only the worker knows. `/health/ready` and the ops monitor's readiness
 * pass both use it, so the blocker reaches Slack even when nothing polls `/health/ready`.
 */
export async function buildLaunchReadinessWithWorkerFacts(options: { readWorker?: () => Promise<WorkerHeartbeatReading> } = {}) {
  const base = buildLaunchReadinessSnapshot();
  const reading = await (options.readWorker || readWorkerHeartbeat)().catch(() => null);
  const withdrawalNotice = withdrawalNoticeLaunchCheck(reading?.withdrawalNotice ?? null);
  const blocked = withdrawalNotice.required && !withdrawalNotice.ready;
  return {
    ...base,
    status: blocked ? ("not_ready" as const) : base.status,
    checks: { ...base.checks, withdrawalNotice: !blocked },
    blockers: blocked ? [...base.blockers, launchBlockerMessage("withdrawalNotice", withdrawalNotice)] : base.blockers,
    dependencies: { ...base.dependencies, launchChecks: { ...base.dependencies.launchChecks, withdrawalNotice } },
  };
}
