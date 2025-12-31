import { Router, Request, Response } from "express";
import { logger } from "../logger";

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
    // Add additional readiness checks here as needed
    // For example: database connectivity, external service availability

    const checks = {
      server: true,
      // database: await checkDatabase(),
      // redis: await checkRedis(),
    };

    const allHealthy = Object.values(checks).every(Boolean);

    if (allHealthy) {
      res.status(200).json({
        status: "ready",
        checks,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "not_ready",
        checks,
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
