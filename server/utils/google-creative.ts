import {
  getConfiguredEnvValue,
  requireConfiguredEnvValue,
} from "../config/env";
import {
  classifyGoogleCreativeFailure,
  getGoogleCreativeStatus,
} from "./provider-status";

export interface GoogleCreativeImageResult {
  mimeType: string;
  imageBytes: string;
  dataUrl: string;
}

export interface GenerateGoogleCreativeImagesParams {
  prompt: string;
  aspectRatio?: string | null;
  imageSize?: string | null;
  thinkingLevel?: string | null;
  personGeneration?: string | null;
  sampleCount?: number | null;
}

export async function generateGoogleCreativeImages(
  params: GenerateGoogleCreativeImagesParams,
) {
  const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const apiKey = requireConfiguredEnvValue(
    ["GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY"],
    "Google image generation",
  );
  const model =
    getConfiguredEnvValue("GOOGLE_CREATIVE_IMAGE_MODEL")
    || "gemini-3.1-flash-image-preview";
  const aspectRatio =
    typeof params.aspectRatio === "string" && params.aspectRatio.trim()
      ? params.aspectRatio.trim()
      : getConfiguredEnvValue("GOOGLE_CREATIVE_IMAGE_DEFAULT_ASPECT_RATIO") || "16:9";
  const imageSize =
    typeof params.imageSize === "string" && params.imageSize.trim()
      ? params.imageSize.trim()
      : "1K";
  const thinkingLevel =
    typeof params.thinkingLevel === "string" && params.thinkingLevel.trim()
      ? params.thinkingLevel.trim().toUpperCase()
      : undefined;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          thinkingConfig: thinkingLevel
            ? {
                thinkingLevel,
              }
            : undefined,
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Google image generation failed";
    throw Object.assign(new Error(message), {
      statusCode: response.status,
      providerStatus: classifyGoogleCreativeFailure(response.status, message),
    });
  }

  const images: GoogleCreativeImageResult[] = (payload?.candidates || [])
    .flatMap((candidate: any) => candidate?.content?.parts || [])
    .map((part: any) => {
      const inlineData = part?.inlineData;
      const imageBytes = inlineData?.data || "";
      if (!imageBytes) return null;
      const mimeType = inlineData?.mimeType || "image/png";
      return {
        mimeType,
        imageBytes,
        dataUrl: `data:${mimeType};base64,${imageBytes}`,
      };
    })
    .filter(Boolean);

  if (images.length === 0) {
    const message = "Google returned no image payload for the selected model.";
    throw Object.assign(new Error(message), {
      statusCode: response.status,
      providerStatus: classifyGoogleCreativeFailure(response.status, message),
    });
  }

  return {
    ok: true,
    model,
    aspectRatio,
    imageSize,
    thinkingLevel: thinkingLevel || null,
    images,
    providerStatus: getGoogleCreativeStatus({
      executionState: "ready",
      note: "Live image generation succeeded for the selected Google creative model.",
    }),
  };
}
