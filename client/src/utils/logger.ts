type LogContext = Record<string, unknown> | undefined;

const isDev = import.meta.env.DEV;

function emit(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: LogContext,
) {
  if ((level === "debug" || level === "info") && !isDev) {
    return;
  }

  if (level === "warn") {
    console.warn(message, context);
    return;
  }

  if (level === "error") {
    console.error(message, context);
    return;
  }

  console.log(message, context);
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) =>
    emit("error", message, context),
};
