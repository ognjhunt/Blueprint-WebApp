import { useEffect } from "react";
import { getCookieConsent } from "./CookieConsent";
import {
  analyticsEvents,
  initializeAnalytics,
  trackEvent,
  trackPageView,
} from "@/lib/analytics";

export function Analytics() {
  useEffect(() => {
    initializeAnalytics(getCookieConsent());
  }, []);

  return null;
}

export { analyticsEvents, trackEvent, trackPageView };
