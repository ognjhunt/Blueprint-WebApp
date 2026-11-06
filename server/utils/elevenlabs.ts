import { getConfiguredEnvValue } from "../config/env";

/**
 * Configuration presence only. The voice lane (web concierge and PSTN intake,
 * /api/voice/*) was retired; this stays because the growth integration
 * summary still reports whether ElevenLabs keys are set.
 */
export function getElevenLabsConfig() {
  const apiKey = getConfiguredEnvValue("ELEVENLABS_API_KEY");
  const voiceId = getConfiguredEnvValue("ELEVENLABS_VOICE_ID");
  const agentId = getConfiguredEnvValue("ELEVENLABS_AGENT_ID");
  const modelId =
    getConfiguredEnvValue("ELEVENLABS_TTS_MODEL_ID") || "eleven_turbo_v2_5";

  return {
    enabled: Boolean(apiKey && voiceId),
    configured: Boolean(apiKey && voiceId),
    apiKey,
    voiceId,
    agentId,
    modelId,
  };
}
