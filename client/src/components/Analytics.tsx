import { useEffect } from "react";
import { useLocation } from "wouter";
import { getCookieConsent } from "./CookieConsent";
import {
  analyticsEvents,
  initializeAnalytics,
  trackEvent,
  trackPageView,
} from "@/lib/analytics";

function scheduleIdleTask(task: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(task, { timeout: 2_500 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(task, 1_500);
  return () => globalThis.clearTimeout(timeoutId);
}

function scheduleAnalyticsTask(task: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (document.readyState === "complete") {
    return scheduleIdleTask(task);
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const runTask = () => {
    timeoutId = globalThis.setTimeout(() => {
      scheduleIdleTask(task);
    }, 0);
  };
  window.addEventListener("load", runTask, { once: true });

  return () => {
    window.removeEventListener("load", runTask);
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  };
}

export function Analytics() {
  const [location] = useLocation();

  useEffect(() => {
    return scheduleAnalyticsTask(() => {
      initializeAnalytics(getCookieConsent());
    });
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    return scheduleAnalyticsTask(() => {
      trackPageView(location, document.title);
    });
  }, [location]);

  return null;
}

export { analyticsEvents, trackEvent, trackPageView };
