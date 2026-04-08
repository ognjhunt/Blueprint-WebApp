import { authAdmin, dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { getAgentRuntimeConnectionMetadata } from "../agents/runtime-connectivity";
import { stripeClient } from "../constants/stripe";
import {
  getConfiguredEnvValue,
  isAutomationLaneEnabled,
  isTruthyEnvValue,
} from "../config/env";
import { getEmailTransportStatus } from "./email";
import { getHostedSessionLiveStoreStatus } from "./hosted-session-live-store";
import { buildGrowthIntegrationSummary } from "./provider-status";

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

export function buildLaunchReadinessSnapshot() {
  const liveSessionStore = getHostedSessionLiveStoreStatus();
  const emailTransport = getEmailTransportStatus();
  const agentRuntime = getAgentRuntimeConnectionMetadata();
  const growthIntegrations = buildGrowthIntegrationSummary();
  const automationFlags = {
    waitlist: isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED"),
    inbound: isAutomationLaneEnabled("BLUEPRINT_INBOUND_AUTOMATION_ENABLED"),
    support: isAutomationLaneEnabled("BLUEPRINT_SUPPORT_TRIAGE_ENABLED"),
    payout: isAutomationLaneEnabled("BLUEPRINT_PAYOUT_TRIAGE_ENABLED"),
    preview: isAutomationLaneEnabled("BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED"),
    experimentRollout: isAutomationLaneEnabled("BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED"),
    researchOutbound: isAutomationLaneEnabled("BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED"),
    creativeFactory: isAutomationLaneEnabled("BLUEPRINT_CREATIVE_FACTORY_ENABLED"),
    buyerLifecycle: isAutomationLaneEnabled("BLUEPRINT_BUYER_LIFECYCLE_ENABLED"),
    slaWatchdog: isAutomationLaneEnabled("BLUEPRINT_SLA_WATCHDOG_ENABLED"),
    notionSync: isAutomationLaneEnabled("BLUEPRINT_NOTION_SYNC_ENABLED"),
    onboarding: isAutomationLaneEnabled("BLUEPRINT_ONBOARDING_ENABLED"),
    graduationEval: isAutomationLaneEnabled("BLUEPRINT_ALL_AUTOMATION_ENABLED"),
  };
  const anyAutomationEnabled =
    automationFlags.waitlist ||
    automationFlags.inbound ||
    automationFlags.support ||
    automationFlags.payout ||
    automationFlags.preview ||
    automationFlags.slaWatchdog ||
    automationFlags.notionSync ||
    automationFlags.onboarding ||
    automationFlags.graduationEval;
  const stripeEnabled = Boolean(
    process.env.STRIPE_SECRET_KEY?.trim()
    || process.env.CHECKOUT_ALLOWED_ORIGINS?.trim()
    || process.env.STRIPE_WEBHOOK_SECRET?.trim(),
  );
  const pipelineSyncEnabled = Boolean(
    process.env.PIPELINE_SYNC_TOKEN?.trim()
    || isTruthyEnvValue(process.env.BLUEPRINT_PIPELINE_SYNC_REQUIRED),
  );
  const emailRequired =
    emailTransport.enabled || isTruthyEnvValue(process.env.BLUEPRINT_EMAIL_DELIVERY_REQUIRED);
  const redisRequired =
    Boolean(process.env.REDIS_URL?.trim()) || Boolean(process.env.RATE_LIMIT_REDIS_URL?.trim());
  const firebaseAdminReady = Boolean(dbAdmin && authAdmin);
  const redisReady =
    !redisRequired
    || (liveSessionStore.backend === "redis" && liveSessionStore.redisConnected === true);
  const stripeReady =
    !stripeEnabled || Boolean(stripeClient && process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const emailReady = !emailRequired || emailTransport.configured;
  const pipelineSyncReady =
    !pipelineSyncEnabled || Boolean(process.env.PIPELINE_SYNC_TOKEN?.trim());
  const agentRuntimeReady = !anyAutomationEnabled || agentRuntime.configured;
  const outboundChannel = (
    getConfiguredEnvValue("BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL") || "sendgrid"
  ).toLowerCase();
  const outboundRecipientsConfigured = Boolean(
    getConfiguredEnvValue("BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS"),
  );
  const outboundTopicsConfigured = Boolean(
    getConfiguredEnvValue("BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS"),
  );
  const researchDeliveryReady =
    outboundChannel === "sendgrid"
      ? emailTransport.configured && outboundRecipientsConfigured
      : false;
  const experimentAutorolloutReady = !automationFlags.experimentRollout || firebaseAdminReady;
  const researchOutboundReady =
    !automationFlags.researchOutbound ||
    (
      firebaseAdminReady &&
      growthIntegrations.researchOutbound.configured &&
      outboundTopicsConfigured &&
      researchDeliveryReady
    );
  const creativeFactoryReady =
    !automationFlags.creativeFactory ||
    (
      firebaseAdminReady &&
      growthIntegrations.googleImage.configured &&
      growthIntegrations.runway.configured
    );
  const buyerLifecycleReady =
    !automationFlags.buyerLifecycle || (firebaseAdminReady && emailTransport.configured);
  const slaWatchdogReady =
    !automationFlags.slaWatchdog || (firebaseAdminReady && emailTransport.configured);
  const notionSyncDatabaseConfigured = Boolean(
    getConfiguredEnvValue(
      "NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID",
      "NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID",
      "NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID",
      "NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID",
      "NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID",
      "NOTION_CAMPAIGNS_DB_ID",
      "NOTION_CREATIVE_RUNS_DB_ID",
      "NOTION_GRADUATION_DB_ID",
      "NOTION_SLA_DB_ID",
      "NOTION_TASKS_DB_ID",
    ),
  );
  const notionSyncReady =
    !automationFlags.notionSync ||
    (
      firebaseAdminReady
      && Boolean(getConfiguredEnvValue("NOTION_API_KEY", "NOTION_API_TOKEN"))
      && notionSyncDatabaseConfigured
    );
  const onboardingReady =
    !automationFlags.onboarding || (firebaseAdminReady && emailTransport.configured);
  const autonomousAutomationReady =
    experimentAutorolloutReady &&
    researchOutboundReady &&
    creativeFactoryReady &&
    buyerLifecycleReady &&
    slaWatchdogReady &&
    notionSyncReady &&
    onboardingReady;

  const checks = {
    server: true,
    firebaseAdmin: firebaseAdminReady,
    redis: redisReady,
    stripe: stripeReady,
    email: emailReady,
    pipelineSync: pipelineSyncReady,
    agentRuntime: agentRuntimeReady,
    autonomousAutomation: autonomousAutomationReady,
  };

  const launchChecks = {
    firebaseAdmin: {
      required: true,
      ready: firebaseAdminReady,
      detail: firebaseAdminReady
        ? "Firebase Admin auth and firestore are configured."
        : "Firebase Admin auth/firestore is unavailable.",
    },
    redis: {
      required: redisRequired,
      ready: redisReady,
      detail: redisRequired
        ? liveSessionStore.redisConnected
          ? "Redis-backed live session state is connected."
          : "Redis is configured for live session state but is not connected."
        : "Redis-backed live session state is not required.",
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
          ? "SMTP delivery is configured."
          : "SMTP delivery is required but not fully configured."
        : "SMTP delivery is not required.",
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
    agentRuntime: {
      required: anyAutomationEnabled,
      ready: agentRuntimeReady,
      detail: anyAutomationEnabled
        ? agentRuntimeReady
          ? `${agentRuntime.provider} is configured for enabled automation lanes.`
          : `Automation lanes are enabled but the selected provider (${agentRuntime.provider}) is not configured.`
        : "Agent runtime is not required because automation lanes are disabled.",
    },
    experimentAutorollout: {
      required: automationFlags.experimentRollout,
      ready: experimentAutorolloutReady,
      detail: automationFlags.experimentRollout
        ? experimentAutorolloutReady
          ? growthIntegrations.analytics.firstPartyIngest.enabled
            ? "Experiment autorollout can evaluate first-party growth events and persist live winning variants."
            : "Experiment autorollout is enabled and can evaluate existing growth_events data, but first-party analytics ingest is still disabled."
          : "Experiment autorollout is enabled, but Firebase Admin / Firestore is unavailable for growth_events evaluation."
        : "Experiment autorollout is disabled.",
    },
    researchOutbound: {
      required: automationFlags.researchOutbound,
      ready: researchOutboundReady,
      detail: automationFlags.researchOutbound
        ? researchOutboundReady
          ? `Autonomous research outbound is configured for the ${outboundChannel} delivery path.`
          : outboundChannel === "sendgrid"
            ? "Autonomous research outbound needs Firehose, research topics, BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS, and a configured SendGrid/SMTP delivery path."
            : `Autonomous research outbound channel "${outboundChannel}" is not supported. Use sendgrid.`
        : "Autonomous research outbound is disabled.",
    },
    creativeFactory: {
      required: automationFlags.creativeFactory,
      ready: creativeFactoryReady,
      detail: automationFlags.creativeFactory
        ? creativeFactoryReady
          ? "Creative factory can generate Google image assets and launch Runway proof-video tasks."
          : "Creative factory is enabled, but it still needs Firebase Admin, Google image generation credentials, and Runway API access to be fully live."
        : "Creative factory is disabled.",
    },
    buyerLifecycle: {
      required: automationFlags.buyerLifecycle,
      ready: buyerLifecycleReady,
      detail: automationFlags.buyerLifecycle
        ? buyerLifecycleReady
          ? "Buyer lifecycle outreach can queue provenance-grounded follow-up emails for provisioned entitlements."
          : "Buyer lifecycle is enabled, but Firebase Admin and a configured email transport are both required."
        : "Buyer lifecycle is disabled.",
    },
    notionSync: {
      required: automationFlags.notionSync,
      ready: notionSyncReady,
      detail: automationFlags.notionSync
        ? notionSyncReady
          ? "Notion sync can mirror Blueprint state into the configured Notion databases."
          : "Notion sync is enabled, but Firebase Admin, a Notion API token, or at least one target Notion database id is missing."
        : "Notion sync is disabled.",
    },
    voiceConcierge: {
      required: false,
      ready: growthIntegrations.elevenlabs.configured,
      detail: growthIntegrations.elevenlabs.configured
        ? "ElevenLabs web voice is configured."
        : "Configure ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to make web voice live.",
    },
    telephony: {
      required: false,
      ready: growthIntegrations.telephony.configured,
      detail: growthIntegrations.telephony.configured
        ? "Twilio-compatible PSTN voice intake is configured."
        : "Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to make PSTN intake live.",
    },
    postSignupDirect: {
      required: false,
      ready: Boolean(
        (
          (process.env.GOOGLE_CLIENT_EMAIL?.trim() && process.env.GOOGLE_PRIVATE_KEY?.trim())
          || process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
          || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
        )
        && process.env.GOOGLE_CALENDAR_ID?.trim()
        && (
          process.env.POST_SIGNUP_SPREADSHEET_ID?.trim()
          || process.env.SPREADSHEET_ID?.trim()
        ),
      ),
      detail: "Tracks whether post-signup calendar and sheet credentials are present for alpha launch.",
    },
    automationFlags,
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
    dependencies: {
      liveSessionStore,
      emailTransport,
      agentRuntime,
      growthIntegrations,
      stripeEnabled,
      pipelineSyncEnabled,
      redisRequired,
      launchChecks,
    },
  };
}
