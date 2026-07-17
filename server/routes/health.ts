import { Router, Request, Response } from "express";
import { logger } from "../logger";
import { getHostedSessionLiveStoreStatus } from "../utils/hosted-session-live-store";
import { buildLaunchReadinessSnapshot } from "../utils/launch-readiness";
import { maybeAlertOnLaunchReadinessTransition } from "../utils/ops-alerts";

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
router.get("/health/ready", async (req: Request, res: Response) => {
  try {
    const readiness = buildLaunchReadinessSnapshot();
    await maybeAlertOnLaunchReadinessTransition(readiness);
    const statusCode = readiness.status === "ready" ? 200 : 503;

    // The full readiness snapshot names providers, models, automation lanes,
    // env-var guidance, and integration topology — recon material on an
    // unauthenticated endpoint. In production it requires the same
    // HEALTH_STATUS_TOKEN gate as /health/status internals; the public payload
    // stays a minimal ready/not_ready verdict plus a blocker count so
    // monitoring can alert without exposing configuration structure.
    const configuredToken = (process.env.HEALTH_STATUS_TOKEN || "").trim();
    const providedToken = String(
      req.header("x-health-status-token") || req.query.token || "",
    ).trim();
    const includeDiagnostics =
      process.env.NODE_ENV !== "production" ||
      (configuredToken.length > 0 && providedToken === configuredToken);

    if (!includeDiagnostics) {
      return res.status(statusCode).json({
        status: readiness.status,
        blocker_count: readiness.blockers.length,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(statusCode).json({
      status: readiness.status,
      checks: readiness.checks,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      dependencies: readiness.dependencies,
      timestamp: new Date().toISOString(),
    });
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
router.get("/health/status", (req: Request, res: Response) => {
  const uptime = Date.now() - startTime;

  // Process internals (memory, live-session debug state) are useful for
  // dashboards but are recon material on an unauthenticated endpoint. In
  // production they require HEALTH_STATUS_TOKEN; the public payload keeps the
  // uptime + error-rate fields monitoring already depends on.
  const configuredToken = (process.env.HEALTH_STATUS_TOKEN || "").trim();
  const providedToken = String(
    req.header("x-health-status-token") || req.query.token || "",
  ).trim();
  const includeInternals =
    process.env.NODE_ENV !== "production" ||
    (configuredToken.length > 0 && providedToken === configuredToken);

  const basePayload = {
    status: "healthy",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: {
      ms: uptime,
      human: formatUptime(uptime),
    },
    metrics: {
      requestCount,
      errorCount,
      errorRate: requestCount > 0 ? (errorCount / requestCount * 100).toFixed(2) + "%" : "0%",
    },
    timestamp: new Date().toISOString(),
  };

  if (!includeInternals) {
    return res.status(200).json(basePayload);
  }

  const memoryUsage = process.memoryUsage();
  const liveSessionStore = getHostedSessionLiveStoreStatus();

  return res.status(200).json({
    ...basePayload,
    memory: {
      heapUsed: formatBytes(memoryUsage.heapUsed),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      external: formatBytes(memoryUsage.external),
      rss: formatBytes(memoryUsage.rss),
    },
    debug: {
      liveSessionStore,
    },
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
