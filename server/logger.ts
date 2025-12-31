import pino from "pino";

// Sensitive fields to redact from logs
const REDACTED_FIELDS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  'req.headers["x-upload-token"]',
  "body.password",
  "body.token",
  "body.apiKey",
  "body.authorization",
  "body.secret",
  "body.creditCard",
  "body.cardNumber",
  "body.cvv",
  "body.ssn",
  "error.config.headers.Authorization",
  "error.config.headers.authorization",
];

// Determine log level based on environment
const getLogLevel = (): string => {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  if (process.env.NODE_ENV === "production") return "info";
  if (process.env.NODE_ENV === "test") return "silent";
  return "debug";
};

// Create the logger instance
export const logger = pino({
  level: getLogLevel(),
  redact: {
    paths: REDACTED_FIELDS,
    censor: "[REDACTED]",
  },
  base: {
    service: "blueprint-webapp",
    version: process.env.npm_package_version || "1.0.0",
    env: process.env.NODE_ENV || "development",
  },
  // Add timestamp formatting
  timestamp: pino.stdTimeFunctions.isoTime,
  // Format options for development
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
});

// Type for log context
export type LogContext = Record<string, unknown>;

// Request metadata type
interface RequestMeta {
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  contentLength?: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
}

/**
 * Attach and sanitize request metadata for logging
 */
export function attachRequestMeta(meta: RequestMeta & LogContext): LogContext {
  const sanitized: LogContext = {};

  for (const [key, value] of Object.entries(meta)) {
    // Skip undefined/null values
    if (value === undefined || value === null) continue;

    // Truncate long strings
    if (typeof value === "string" && value.length > 200) {
      sanitized[key] = `${value.slice(0, 197)}…`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Generate a unique trace ID for request tracing
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Generate a span ID for distributed tracing
 */
export function generateSpanId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Create a child logger with specific context
 * Useful for tracking operations within a request
 */
export function createChildLogger(context: LogContext) {
  return logger.child(context);
}

/**
 * Log levels with semantic meaning
 */
export const logLevels = {
  // System is unusable
  fatal: (msg: string, context?: LogContext) => logger.fatal(context, msg),
  // Action must be taken immediately
  error: (msg: string, context?: LogContext) => logger.error(context, msg),
  // Warning conditions
  warn: (msg: string, context?: LogContext) => logger.warn(context, msg),
  // Normal but significant condition
  info: (msg: string, context?: LogContext) => logger.info(context, msg),
  // Debug-level messages
  debug: (msg: string, context?: LogContext) => logger.debug(context, msg),
  // Detailed trace information
  trace: (msg: string, context?: LogContext) => logger.trace(context, msg),
};

/**
 * Structured error logging helper
 */
export function logError(
  error: Error | unknown,
  context?: LogContext & { requestId?: string; userId?: string }
) {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  logger.error(
    {
      ...context,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
      },
    },
    `Error: ${errorObj.message}`
  );
}

/**
 * Performance timing helper
 */
export function createTimer(label: string, context?: LogContext) {
  const start = process.hrtime.bigint();

  return {
    end: () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;

      logger.debug(
        {
          ...context,
          label,
          durationMs: Math.round(durationMs * 100) / 100,
        },
        `Timer: ${label} completed in ${durationMs.toFixed(2)}ms`
      );

      return durationMs;
    },
  };
}

/**
 * Business event logging for analytics
 */
export function logBusinessEvent(
  event: string,
  data: LogContext & {
    userId?: string;
    requestId?: string;
    category?: string;
    value?: number;
  }
) {
  logger.info(
    {
      ...data,
      eventType: "business",
      event,
    },
    `Business Event: ${event}`
  );
}

/**
 * Security event logging
 */
export function logSecurityEvent(
  event: string,
  data: LogContext & {
    userId?: string;
    ip?: string;
    action?: string;
    success?: boolean;
  }
) {
  const level = data.success === false ? "warn" : "info";

  logger[level](
    {
      ...data,
      eventType: "security",
      event,
    },
    `Security Event: ${event}`
  );
}

// Export default logger for convenience
export default logger;
