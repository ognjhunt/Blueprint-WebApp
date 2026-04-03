import { getConfiguredEnvValue, requireConfiguredEnvValue } from "../config/env";

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

async function resolveVoiceId(apiKey: string) {
  const configuredVoiceId = getConfiguredEnvValue("ELEVENLABS_VOICE_ID");
  if (configuredVoiceId) {
    return configuredVoiceId;
  }

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs voices lookup failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    voices?: Array<{ voice_id?: string }>;
  };
  const fallback = payload.voices?.find((voice) => voice.voice_id)?.voice_id;
  if (!fallback) {
    throw new Error("ElevenLabs did not return any usable voices.");
  }
  return fallback;
}

export async function synthesizeElevenLabsSpeech(text: string) {
  const apiKey = requireConfiguredEnvValue(["ELEVENLABS_API_KEY"], "ElevenLabs speech");
  const voiceId = await resolveVoiceId(apiKey);
  const modelId =
    getConfiguredEnvValue("ELEVENLABS_TTS_MODEL_ID") || "eleven_turbo_v2_5";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    mimeType: "audio/mpeg",
    audioBase64: buffer.toString("base64"),
  };
}

export async function getElevenLabsSignedUrl() {
  const agentId = requireConfiguredEnvValue(["ELEVENLABS_AGENT_ID"], "ElevenLabs signed URL");
  const apiKey = requireConfiguredEnvValue(["ELEVENLABS_API_KEY"], "ElevenLabs signed URL");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    {
      headers: {
        "xi-api-key": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs signed URL failed (${response.status})`);
  }

  const payload = (await response.json()) as { signed_url?: string };
  if (!payload.signed_url) {
    throw new Error("ElevenLabs response did not include a signed_url.");
  }

  return {
    agentId,
    signedUrl: payload.signed_url,
  };
}
