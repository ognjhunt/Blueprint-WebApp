import { useEffect } from "react";
import { useLocation } from "wouter";
import { getCookieConsent } from "./CookieConsent";
import {
  analyticsEvents,
  initializeAnalytics,
  trackEvent,
  trackPageView,
} from "@/lib/analytics";

export function Analytics() {
  const [location] = useLocation();

  useEffect(() => {
    initializeAnalytics(getCookieConsent());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    trackPageView(location, document.title);
  }, [location]);

  return null;
}

export { analyticsEvents, trackEvent, trackPageView };
