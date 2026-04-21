import { getConfiguredEnvValue, isEnvFlagEnabled } from "../config/env";
import { getEmailTransportStatus } from "./email";
import { getElevenLabsConfig } from "./elevenlabs";
import { getMarketSignalProviderStatus } from "./marketSignalProviders";
import { getRunwayStatus } from "./runway";

export type ProviderExecutionState =
  | "not_configured"
  | "configured_unverified"
  | "ready"
  | "blocked_quota_or_billing"
  | "blocked_permission"
  | "request_failed";

export interface GoogleCreativeStatus {
  configured: boolean;
  available: boolean;
  model: string;
  apiKeySource: "GOOGLE_GENAI_API_KEY" | "GEMINI_API_KEY" | null;
  executionState: ProviderExecutionState;
  note: string;
  lastError: string | null;
}

function detectGoogleKeySource(): GoogleCreativeStatus["apiKeySource"] {
  if (getConfiguredEnvValue("GOOGLE_GENAI_API_KEY")) {
    return "GOOGLE_GENAI_API_KEY";
  }
  if (getConfiguredEnvValue("GEMINI_API_KEY")) {
    return "GEMINI_API_KEY";
  }
  return null;
}

export function getGoogleCreativeStatus(
  overrides?: Partial<Pick<GoogleCreativeStatus, "executionState" | "note" | "lastError">>,
): GoogleCreativeStatus {
  const model = "disabled_by_policy";
  const apiKeySource = null;
  const configured = false;
  const executionState = overrides?.executionState || "not_configured";
  const defaultNote =
    "Paid server-side image generation is disabled by policy. Route image-heavy creative work to Codex execution lanes instead.";

  return {
    configured,
    available: executionState === "ready" || executionState === "configured_unverified",
    model,
    apiKeySource,
    executionState,
    note: overrides?.note || defaultNote,
    lastError: overrides?.lastError || null,
  };
}

export function classifyGoogleCreativeFailure(
  statusCode: number | null | undefined,
  rawMessage: string | null | undefined,
) {
  const message = String(rawMessage || "").trim();
  const normalized = message.toLowerCase();

  if (
    statusCode === 429 ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("resource_exhausted")
  ) {
    return getGoogleCreativeStatus({
      executionState: "blocked_quota_or_billing",
      note: "Google creative credentials are present, but the selected image model is currently blocked by quota or billing state.",
      lastError: message || null,
    });
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    normalized.includes("permission") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return getGoogleCreativeStatus({
      executionState: "blocked_permission",
      note: "Google creative credentials are present, but the request is not authorized for the selected image model.",
      lastError: message || null,
    });
  }

  return getGoogleCreativeStatus({
    executionState: "request_failed",
    note: "Google creative is configured, but the last image generation request failed.",
    lastError: message || null,
  });
}

export function buildGrowthIntegrationSummary(params?: {
  analyticsResult?: { ok?: boolean; persisted?: boolean; error?: string };
  googleImage?: Partial<Pick<GoogleCreativeStatus, "executionState" | "note" | "lastError">>;
}) {
  const marketSignalProvider = getMarketSignalProviderStatus();
  const analyticsIngestEnabled = isEnvFlagEnabled("BLUEPRINT_ANALYTICS_INGEST_ENABLED");
  const gaMeasurementId = getConfiguredEnvValue("VITE_GA_MEASUREMENT_ID", "VITE_FIREBASE_MEASUREMENT_ID");
  const posthogToken = getConfiguredEnvValue("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN");
  const posthogHost = getConfiguredEnvValue("VITE_PUBLIC_POSTHOG_HOST");
  const email = getEmailTransportStatus();
  const elevenlabs = getElevenLabsConfig();
  const twilioConfigured = Boolean(
    getConfiguredEnvValue("TWILIO_ACCOUNT_SID") &&
    getConfiguredEnvValue("TWILIO_AUTH_TOKEN") &&
    getConfiguredEnvValue("TWILIO_PHONE_NUMBER"),
  );

  return {
    analytics: {
      firstPartyIngest: {
        enabled: analyticsIngestEnabled,
        verificationLogged: Boolean(params?.analyticsResult?.ok),
        persisted: params?.analyticsResult?.persisted === true,
        error: params?.analyticsResult?.error || null,
      },
      ga4: {
        configured: Boolean(gaMeasurementId),
      },
      posthog: {
        configured: Boolean(posthogToken && posthogHost),
      },
      alignment: {
        externalConfigured: Boolean(gaMeasurementId || (posthogToken && posthogHost)),
        firstPartyEnabled: analyticsIngestEnabled,
        note:
          analyticsIngestEnabled && (gaMeasurementId || (posthogToken && posthogHost))
            ? "First-party growth events can be compared against GA4/PostHog if both runtime configs are active."
            : analyticsIngestEnabled
              ? "First-party growth events are enabled, but external analytics is not fully configured."
              : "External analytics may be configured, but first-party event mirroring is disabled.",
      },
    },
    runway: getRunwayStatus(),
    elevenlabs: {
      configured: elevenlabs.configured,
      agentConfigured: Boolean(elevenlabs.agentId),
      modelId: elevenlabs.modelId,
    },
    telephony: {
      configured: twilioConfigured,
      forwardNumberConfigured: Boolean(getConfiguredEnvValue("BLUEPRINT_VOICE_FORWARD_NUMBER")),
    },
    researchOutbound: {
      configured: marketSignalProvider.configured,
      optional: marketSignalProvider.optional,
      providerKey: marketSignalProvider.providerKey,
      availableProviderKeys: marketSignalProvider.availableProviderKeys,
      topicsConfigured: Boolean(getConfiguredEnvValue("BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS")),
      recipientsConfigured: Boolean(getConfiguredEnvValue("BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS")),
      note: marketSignalProvider.note,
    },
    sendgrid: email,
    sendgridWebhook: {
      configured: Boolean(getConfiguredEnvValue("SENDGRID_EVENT_WEBHOOK_SECRET")),
    },
    googleImage: getGoogleCreativeStatus(params?.googleImage),
  };
}
