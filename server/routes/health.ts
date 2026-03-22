import { Router, Request, Response } from "express";
import { authAdmin, dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { getHostedSessionLiveStoreStatus } from "../utils/hosted-session-live-store";
import { getEmailTransportStatus } from "../utils/email";
import { stripeClient } from "../constants/stripe";
import { isTruthyEnvValue } from "../config/env";

const router = Router();

// Track server start time for uptime calculation
const startTime = Date.now();

// Track basic metrics
let requestCount = 0;
let errorCount = 0;

export function incrementRequestCount() {
  requestCount++;
}

export function incrementErrorCount() {
  errorCount++;
}

/**
 * Basic health check endpoint
 * Returns 200 if server is running
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Liveness probe for Kubernetes/container orchestration
 * Returns 200 if server process is alive
 */
router.get("/health/live", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe for Kubernetes/container orchestration
 * Returns 200 if server is ready to accept traffic
 * Could include checks for database, cache, etc.
 */
router.get("/health/ready", async (_req: Request, res: Response) => {
  try {
    const liveSessionStore = getHostedSessionLiveStoreStatus();
    const emailTransport = getEmailTransportStatus();
    const automationFlags = {
      waitlist: isTruthyEnvValue(process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED),
      inbound: isTruthyEnvValue(process.env.BLUEPRINT_INBOUND_AUTOMATION_ENABLED),
      support: isTruthyEnvValue(process.env.BLUEPRINT_SUPPORT_TRIAGE_ENABLED),
      payout: isTruthyEnvValue(process.env.BLUEPRINT_PAYOUT_TRIAGE_ENABLED),
      preview: isTruthyEnvValue(process.env.BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED),
    };
    const anyAutomationEnabled = Object.values(automationFlags).some(Boolean);
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
    const agentRuntimeReady =
      !anyAutomationEnabled || Boolean(process.env.OPENAI_API_KEY?.trim());

    const checks = {
      server: true,
      firebaseAdmin: firebaseAdminReady,
      redis: redisReady,
      stripe: stripeReady,
      email: emailReady,
      pipelineSync: pipelineSyncReady,
      agentRuntime: agentRuntimeReady,
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
            ? "OpenAI Responses runtime is configured for enabled automation lanes."
            : "Automation lanes are enabled but OPENAI_API_KEY is missing."
          : "Agent runtime is not required because automation lanes are disabled.",
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

    const allHealthy = Object.values(checks).every(Boolean);

    if (allHealthy) {
      res.status(200).json({
        status: "ready",
        checks,
        dependencies: {
          liveSessionStore,
          emailTransport,
          stripeEnabled,
          pipelineSyncEnabled,
          redisRequired,
          launchChecks,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "not_ready",
        checks,
        dependencies: {
          liveSessionStore,
          emailTransport,
          stripeEnabled,
          pipelineSyncEnabled,
          redisRequired,
          launchChecks,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error({ error }, "Readiness check failed");
    res.status(503).json({
      status: "error",
      message: "Readiness check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Detailed status endpoint (for monitoring dashboards)
 * Returns server metrics and version info
 */
router.get("/health/status", (_req: Request, res: Response) => {
  const uptime = Date.now() - startTime;
  const memoryUsage = process.memoryUsage();
  const liveSessionStore = getHostedSessionLiveStoreStatus();

  res.status(200).json({
    status: "healthy",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: {
      ms: uptime,
      human: formatUptime(uptime),
    },
    memory: {
      heapUsed: formatBytes(memoryUsage.heapUsed),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      external: formatBytes(memoryUsage.external),
      rss: formatBytes(memoryUsage.rss),
    },
    metrics: {
      requestCount,
      errorCount,
      errorRate: requestCount > 0 ? (errorCount / requestCount * 100).toFixed(2) + "%" : "0%",
    },
    debug: {
      liveSessionStore,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format uptime to human-readable string
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export default router;
