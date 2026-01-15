import { withCsrfHeader } from "./csrf";

/**
 * Error Tracking Service
 *
 * A lightweight error tracking implementation that can be connected to
 * external services like Sentry, LogRocket, or custom backends.
 *
 * To connect to Sentry:
 * 1. Install: npm install @sentry/react
 * 2. Set VITE_SENTRY_DSN in your .env
 * 3. Optionally enable the smoke test helper via VITE_ENABLE_ERROR_TRACKING_SMOKE_TEST
 */

import * as Sentry from "@sentry/react";

interface ErrorContext {
  componentStack?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
  level?: "fatal" | "error" | "warning" | "info" | "debug";
}

interface BreadcrumbData {
  category: string;
  message: string;
  level?: "info" | "warning" | "error";
  data?: Record<string, unknown>;
}

class ErrorTrackingService {
  private isInitialized = false;
  private dsn: string | null = null;
  private environment: string = "development";
  private breadcrumbs: BreadcrumbData[] = [];
  private maxBreadcrumbs = 100;
  private errorQueue: Array<{ error: Error; context: ErrorContext }> = [];
  private sentryEnabled = false;

  /**
   * Initialize the error tracking service
   */
  init(options?: { dsn?: string; environment?: string }) {
    if (this.isInitialized) return;

    this.dsn = options?.dsn || import.meta.env.VITE_SENTRY_DSN || null;
    this.environment = options?.environment || import.meta.env.MODE || "development";

    if (this.dsn) {
      Sentry.init({
        dsn: this.dsn,
        environment: this.environment,
        enabled: true,
      });
      this.sentryEnabled = true;
    }

    // Set up global error handlers
    this.setupGlobalHandlers();

    this.isInitialized = true;

    // Log initialization
    if (this.environment === "development") {
      console.log("[ErrorTracking] Initialized in", this.environment, "mode");
    }

    // Flush any queued errors
    this.flushErrorQueue();
  }

  /**
   * Set up global unhandled error handlers
   */
  private setupGlobalHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.captureException(
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason)),
        {
          tags: { type: "unhandledrejection" },
          level: "error",
        }
      );
    });

    // Handle uncaught errors
    window.addEventListener("error", (event) => {
      // Ignore errors from browser extensions
      if (event.filename?.includes("extension://")) return;

      this.captureException(event.error || new Error(event.message), {
        tags: { type: "uncaught" },
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        level: "fatal",
      });
    });
  }

  /**
   * Capture and report an exception
   */
  captureException(error: Error, context: ErrorContext = {}) {
    if (!this.isInitialized) {
      this.errorQueue.push({ error, context });
      return;
    }

    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: context.componentStack,
      tags: {
        environment: this.environment,
        ...context.tags,
      },
      extra: context.extra,
      user: context.user,
      level: context.level || "error",
      breadcrumbs: [...this.breadcrumbs],
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // In development, log to console with full details
    if (this.environment === "development") {
      console.group(`[ErrorTracking] ${context.level || "error"}: ${error.message}`);
      console.error(error);
      if (context.componentStack) {
        console.log("Component Stack:", context.componentStack);
      }
      if (Object.keys(context.extra || {}).length > 0) {
        console.log("Extra:", context.extra);
      }
      console.log("Breadcrumbs:", this.breadcrumbs.slice(-5));
      console.groupEnd();
    }

    // If DSN is configured, send to error tracking service
    const eventId = this.sendToBackend(error, context);

    // Also send to our own API for logging
    this.sendToOwnApi(errorData);

    return eventId;
  }

  /**
   * Capture a message (non-error)
   */
  captureMessage(message: string, level: ErrorContext["level"] = "info") {
    return this.captureException(new Error(message), { level });
  }

  /**
   * Add a breadcrumb for debugging
   */
  addBreadcrumb(data: BreadcrumbData) {
    this.breadcrumbs.push({
      ...data,
      level: data.level || "info",
    });

    if (this.sentryEnabled) {
      Sentry.addBreadcrumb({
        category: data.category,
        message: data.message,
        level: data.level,
        data: data.data,
      });
    }

    // Keep only the last N breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  /**
   * Set user context for error reports
   */
  setUser(user: ErrorContext["user"] | null) {
    // Store user context for subsequent errors
    if (user) {
      this.addBreadcrumb({
        category: "auth",
        message: `User identified: ${user.email || user.id || "unknown"}`,
      });
    }

    if (this.sentryEnabled) {
      Sentry.setUser(user ?? null);
    }
  }

  /**
   * Send error data to external tracking service
   */
  private sendToBackend(error: Error, context: ErrorContext) {
    if (!this.sentryEnabled) {
      return undefined;
    }

    let eventId: string | undefined;
    Sentry.withScope((scope) => {
      if (context.level) {
        scope.setLevel(context.level);
      }

      if (context.tags) {
        scope.setTags(context.tags);
      }

      if (context.extra) {
        scope.setExtras(context.extra);
      }

      if (context.user) {
        scope.setUser(context.user);
      }

      if (context.componentStack) {
        scope.setContext("react", {
          componentStack: context.componentStack,
        });
      }

      eventId = Sentry.captureException(error);
    });

    return eventId;
  }

  /**
   * Send error data to our own API
   */
  private async sendToOwnApi(errorData: Record<string, unknown>) {
    try {
      // Only send in production or if explicitly enabled
      if (this.environment !== "production" && !import.meta.env.VITE_ENABLE_ERROR_TRACKING) {
        return;
      }

      await fetch("/api/errors", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(errorData),
        // Don't let error tracking errors cause more errors
        keepalive: true,
      }).catch(() => {
        // Silently fail - we don't want error tracking to cause more errors
      });
    } catch {
      // Silently fail
    }
  }

  /**
   * Flush queued errors after initialization
   */
  private flushErrorQueue() {
    for (const { error, context } of this.errorQueue) {
      this.captureException(error, context);
    }
    this.errorQueue = [];
  }

  /**
   * Create a wrapped version of a function that catches errors
   */
  wrap<T extends (...args: unknown[]) => unknown>(
    fn: T,
    context?: ErrorContext
  ): T {
    return ((...args: unknown[]) => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.captureException(error, context);
            throw error;
          });
        }
        return result;
      } catch (error) {
        this.captureException(error as Error, context);
        throw error;
      }
    }) as T;
  }

  runSmokeTest() {
    return this.captureException(new Error("Sentry smoke test"), {
      tags: { smoke_test: "true" },
      extra: { source: "errorTracking.runSmokeTest" },
      level: "error",
    });
  }
}

// Export singleton instance
export const errorTracking = new ErrorTrackingService();

// Auto-initialize
errorTracking.init();

// Export convenience functions
export const captureException = errorTracking.captureException.bind(errorTracking);
export const captureMessage = errorTracking.captureMessage.bind(errorTracking);
export const addBreadcrumb = errorTracking.addBreadcrumb.bind(errorTracking);
export const setUser = errorTracking.setUser.bind(errorTracking);
export const runErrorTrackingSmokeTest = errorTracking.runSmokeTest.bind(errorTracking);

declare global {
  interface Window {
    runErrorTrackingSmokeTest?: () => string | undefined;
  }
}

const isSmokeTestEnabled =
  (import.meta.env.VITE_ENABLE_ERROR_TRACKING_SMOKE_TEST as string | undefined) === "true";

if (isSmokeTestEnabled) {
  window.runErrorTrackingSmokeTest = () => errorTracking.runSmokeTest();
}
