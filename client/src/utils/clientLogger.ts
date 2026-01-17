type LogLevel = "log" | "info" | "warn" | "error" | "debug";

type LogEntry = {
  level: LogLevel;
  message: string;
  context?: unknown;
  timestamp: string;
};

const REDACT_KEYS = new Set([
  "password",
  "token",
  "secret",
  "apikey",
  "apiKey",
  "authorization",
  "email",
  "uid",
]);

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_TOKEN_REGEX = /\b[A-Za-z0-9_-]{32,}\b/g;

const isDev = import.meta.env.DEV;

const nativeConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
  group: console.group?.bind(console),
  groupCollapsed: console.groupCollapsed?.bind(console),
  groupEnd: console.groupEnd?.bind(console),
  table: console.table?.bind(console),
};

const redactString = (value: string): string => {
  let redacted = value.replace(EMAIL_REGEX, "[redacted-email]");
  redacted = redacted.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]");
  redacted = redacted.replace(LONG_TOKEN_REGEX, "[redacted-token]");
  return redacted;
};

const sanitizeValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (REDACT_KEYS.has(key.toLowerCase())) {
        result[key] = "[redacted]";
        continue;
      }
      result[key] = sanitizeValue(entryValue, seen);
    }
    return result;
  }

  return value;
};

const buildEntry = (level: LogLevel, args: unknown[]): LogEntry => {
  const [first, ...rest] = args;
  const message =
    typeof first === "string" ? redactString(first) : "Client log entry";
  const context =
    rest.length > 0
      ? sanitizeValue(rest.length === 1 ? rest[0] : rest)
      : typeof first === "string"
        ? undefined
        : sanitizeValue(first);
  return {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };
};

const emitLog = (level: LogLevel, args: unknown[]) => {
  if (!isDev && (level === "log" || level === "info" || level === "debug")) {
    return;
  }

  const entry = buildEntry(level, args);
  if (level === "warn") {
    nativeConsole.warn(entry);
    return;
  }

  if (level === "error") {
    nativeConsole.error(entry);
    return;
  }

  nativeConsole.log(entry);
};

const emitGroup = (method: "group" | "groupCollapsed", args: unknown[]) => {
  if (!isDev) {
    return;
  }
  const entry = buildEntry("debug", args);
  if (method === "groupCollapsed") {
    nativeConsole.groupCollapsed?.(entry.message);
  } else {
    nativeConsole.group?.(entry.message);
  }
  if (entry.context) {
    nativeConsole.log(entry.context);
  }
};

export const installClientLogger = () => {
  if ((window as { __clientLoggerInstalled?: boolean }).__clientLoggerInstalled) {
    return;
  }

  (window as { __clientLoggerInstalled?: boolean }).__clientLoggerInstalled = true;

  console.log = (...args: unknown[]) => emitLog("log", args);
  console.info = (...args: unknown[]) => emitLog("info", args);
  console.warn = (...args: unknown[]) => emitLog("warn", args);
  console.error = (...args: unknown[]) => emitLog("error", args);
  console.debug = (...args: unknown[]) => emitLog("debug", args);
  console.group = (...args: unknown[]) => emitGroup("group", args);
  console.groupCollapsed = (...args: unknown[]) => emitGroup("groupCollapsed", args);
  console.groupEnd = () => {
    if (isDev) {
      nativeConsole.groupEnd?.();
    }
  };
  console.table = (data?: unknown, columns?: readonly string[]) => {
    if (!isDev) {
      return;
    }
    nativeConsole.table?.(sanitizeValue(data), columns as string[] | undefined);
  };
};
