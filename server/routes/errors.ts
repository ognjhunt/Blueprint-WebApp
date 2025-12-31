import { Router, Request, Response } from "express";
import { logger, attachRequestMeta } from "../logger";
import { incrementErrorCount } from "./health";

const router = Router();

interface ClientError {
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
  };
  level?: string;
  breadcrumbs?: Array<{
    category: string;
    message: string;
    level?: string;
    data?: Record<string, unknown>;
  }>;
  timestamp: string;
  url: string;
  userAgent: string;
}

/**
 * Receive client-side errors
 * POST /api/errors
 */
router.post("/", (req: Request, res: Response) => {
  const error = req.body as ClientError;

  // Validate required fields
  if (!error.message || !error.timestamp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Increment error count for metrics
  incrementErrorCount();

  // Log the error with structured data
  const logData = attachRequestMeta({
    type: "client_error",
    errorName: error.name,
    errorMessage: error.message,
    level: error.level || "error",
    url: error.url,
    userAgent: error.userAgent,
    userId: error.user?.id,
    userEmail: error.user?.email,
    tags: error.tags,
    extra: error.extra,
    breadcrumbCount: error.breadcrumbs?.length || 0,
    clientTimestamp: error.timestamp,
    requestId: res.locals.requestId,
  });

  // Log at appropriate level
  switch (error.level) {
    case "fatal":
      logger.fatal(logData, `[CLIENT FATAL] ${error.message}`);
      break;
    case "error":
      logger.error(logData, `[CLIENT ERROR] ${error.message}`);
      break;
    case "warning":
      logger.warn(logData, `[CLIENT WARNING] ${error.message}`);
      break;
    default:
      logger.info(logData, `[CLIENT INFO] ${error.message}`);
  }

  // Log stack trace separately if present (for easier debugging)
  if (error.stack && error.level !== "info") {
    logger.debug(
      { stack: error.stack, componentStack: error.componentStack },
      `[CLIENT STACK] Error stack trace`
    );
  }

  // Log breadcrumbs for debugging context
  if (error.breadcrumbs && error.breadcrumbs.length > 0) {
    logger.debug(
      { breadcrumbs: error.breadcrumbs.slice(-10) },
      `[CLIENT BREADCRUMBS] Last 10 actions before error`
    );
  }

  // Here you could also:
  // 1. Store errors in a database for analysis
  // 2. Send to external error tracking service (Sentry, etc.)
  // 3. Trigger alerts for critical errors
  // 4. Rate limit by user/IP to prevent log flooding

  res.status(202).json({
    received: true,
    eventId: res.locals.requestId,
  });
});

/**
 * Get error statistics (for admin dashboard)
 * GET /api/errors/stats
 */
router.get("/stats", (_req: Request, res: Response) => {
  // This would typically query a database for error stats
  // For now, return placeholder data
  res.status(200).json({
    message: "Error statistics endpoint - implement with your preferred storage",
    hint: "Connect to your database or error tracking service to get real stats",
  });
});

export default router;
