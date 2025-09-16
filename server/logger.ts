import pino from "pino";

const REDACTED_FIELDS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers[\"x-api-key\"]",
  "req.headers[\"x-upload-token\"]",
  "body.password",
  "body.token",
  "body.apiKey",
  "body.authorization",
  "body.secret",
  "error.config.headers.Authorization",
  "error.config.headers.authorization",
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: REDACTED_FIELDS,
    censor: "[REDACTED]",
  },
  base: {
    service: "blueprint-webapp",
  },
});

export type LogContext = Record<string, unknown>;

export function attachRequestMeta(meta: LogContext): LogContext {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.length > 200) {
      sanitized[key] = `${value.slice(0, 197)}…`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

