import { authAdmin, dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { stripeClient } from "../constants/stripe";
import { isTruthyEnvValue } from "../config/env";
import { getCityLaunchSenderStatus, getEmailTransportStatus } from "./email";
import { getHostedSessionLiveStoreStatus } from "./hosted-session-live-store";
import { getBetaCohortPolicySnapshot } from "./beta-cohort-policy";
import { describeSiteVideoEvidenceConfig } from "./siteVideoEvidenceConfig";
import { describeResultArtifactRegistryConfig } from "./taskEvaluationResultArtifactProxy";

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
  const betaCohortPolicy = getBetaCohortPolicySnapshot();
  const fieldEncryptionReady = Boolean(
    process.env.FIELD_ENCRYPTION_MASTER_KEY?.trim()
    || process.env.FIELD_ENCRYPTION_KMS_KEY_NAME?.trim(),
  );
  const stripeEnabled = Boolean(
    process.env.STRIPE_SECRET_KEY?.trim()
    || process.env.CHECKOUT_ALLOWED_ORIGINS?.trim()
    || process.env.STRIPE_WEBHOOK_SECRET?.trim(),
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
  // Mirrors stripeWebhookInlineMode() without importing the queue module.
  const stripeQueueMode =
    process.env.BLUEPRINT_STRIPE_WEBHOOK_INLINE !== "1"
    && process.env.BLUEPRINT_STRIPE_WEBHOOK_QUEUE === "1";
  const stripeQueueConsumerConfirmed = isTruthyEnvValue(
    process.env.BLUEPRINT_STRIPE_WEBHOOK_QUEUE_CONSUMER_CONFIRMED,
  );
  const stripeWebhookQueueReady = !stripeQueueMode || stripeQueueConsumerConfirmed;
  const firebaseAdminReady = Boolean(dbAdmin && authAdmin);
  const redisReady =
    !redisRequired
    || (redisConfigured
      && liveSessionStore.backend === "redis"
      && liveSessionStore.redisConnected === true);
  const stripeReady =
    !stripeEnabled || Boolean(stripeClient && process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const emailReady = !emailRequired || emailTransport.configured;
  const pipelineSyncReady =
    !pipelineSyncEnabled || Boolean(process.env.PIPELINE_SYNC_TOKEN?.trim());
  const betaCohortControlsReady =
    betaCohortPolicy.enabled
    && !betaCohortPolicy.killSwitchActive
    && (betaCohortPolicy.inviteCap ?? 0) > 0
    && (betaCohortPolicy.cohortDailyLimit ?? 0) > 0
    && (firebaseAdminReady || localLaunchSmoke);

  const siteVideoEvidence = describeSiteVideoEvidenceConfig();
  // Reported as a named warning, not a blocker: a missing registry stops
  // result videos and downloads but must not fail the deploy health gate.
  const resultArtifacts = describeResultArtifactRegistryConfig();

  const checks = {
    server: true,
    firebaseAdmin: firebaseAdminReady || localLaunchSmoke,
    fieldEncryption: fieldEncryptionReady,
    redis: redisReady,
    stripe: stripeReady,
    stripeWebhookQueue: stripeWebhookQueueReady,
    email: emailReady,
    slackOpsAlerts: !slackOpsRequired || slackOpsReady,
    pipelineSync: pipelineSyncReady,
    betaCohortControls: betaCohortControlsReady,
    siteVideoEvidence: siteVideoEvidence.ready,
  };

  const launchChecks = {
    resultArtifacts: {
      required: false,
      ready: resultArtifacts.ready,
      detail: resultArtifacts.detail,
    },
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
    stripeWebhookQueue: {
      required: stripeQueueMode,
      ready: stripeWebhookQueueReady,
      detail: !stripeQueueMode
        ? "Stripe webhooks settle inline in the web process."
        : stripeQueueConsumerConfirmed
          ? "Stripe webhook queue mode with a confirmed consumer (BLUEPRINT_STRIPE_WEBHOOK_QUEUE_CONSUMER_CONFIRMED=1)."
          : "BLUEPRINT_STRIPE_WEBHOOK_QUEUE=1 but no queue consumer is confirmed: the deployed worker is launch-forward-only and never drains the queue, so payments would be acknowledged and never settled. Unset the queue flag (inline mode) or run the Stripe queue processor and set BLUEPRINT_STRIPE_WEBHOOK_QUEUE_CONSUMER_CONFIRMED=1.",
    },
    stripe: {
      required: stripeEnabled,
      ready: stripeReady,
      detail: stripeEnabled
        ? stripeReady
          ? "Stripe secret and webhook configuration are present."
          : "Stripe is enabled but secret key or webhook secret is missing."
        : "Stripe launch checks are disabled because Stripe envs are unset.",
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
    betaCohortControls: {
      required: true,
      ready: betaCohortControlsReady,
      detail: betaCohortControlsReady
        ? `Beta cohort controls are active with invite cap ${betaCohortPolicy.inviteCap} and daily cohort limit ${betaCohortPolicy.cohortDailyLimit}.`
        : betaCohortPolicy.killSwitchActive || !betaCohortPolicy.enabled
          ? "Beta cohort access is paused by BLUEPRINT_BETA_KILL_SWITCH or BLUEPRINT_BETA_ENABLED=false."
          : !firebaseAdminReady
            ? "Beta cohort controls require Firebase Admin / Firestore for caps and throttle state."
            : "Beta cohort controls require positive BLUEPRINT_BETA_INVITE_CAP and BLUEPRINT_BETA_COHORT_DAILY_LIMIT.",
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
      stripeEnabled,
      pipelineSyncEnabled,
      redisRequired,
      betaCohortPolicy,
      launchChecks,
    },
  };
}
