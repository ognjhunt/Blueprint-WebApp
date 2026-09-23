import { isGeminiVideoConfigured } from "../agents/provider-config";
import { isSiteVideoEvidenceEnabled } from "../config/env";

export type SiteVideoEvidenceConfig = {
  enabled: boolean;
  keyed: boolean;
  /** False only when the lane is on and nothing can run it. */
  ready: boolean;
  detail: string;
};

/**
 * Whether the footage reader can actually run.
 *
 * The privacy screen fails closed: with the lane on, a capture it cannot
 * review is held and retried rather than processed. That is right when the
 * provider is briefly down and wrong when it was never keyed, because then
 * every upload waits forever and nothing says why. So "on but unkeyed" is
 * named here, logged at startup, and fails the readiness check, which keeps
 * a deploy carrying that configuration from replacing a healthy one.
 */
export function describeSiteVideoEvidenceConfig(): SiteVideoEvidenceConfig {
  const enabled = isSiteVideoEvidenceEnabled();
  const keyed = isGeminiVideoConfigured();
  const ready = !enabled || keyed;
  const detail = !enabled
    ? "Site footage review is off (BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED); uploads go to manual review."
    : keyed
      ? "Site footage review is on and a Gemini key is configured."
      : "BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED is on but no Gemini key is set (GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_AI_STUDIO_API_KEY). Every uploaded video would be held in privacy review. Set a key or turn the flag off.";
  return { enabled, keyed, ready, detail };
}
