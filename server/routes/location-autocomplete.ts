import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getConfiguredEnvValue } from "../config/env";

const router = Router();
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const placePattern = /^[A-Za-z0-9_-]{1,255}$/;

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
router.use(rateLimit({ windowMs: 60_000, limit: 80, standardHeaders: true, legacyHeaders: false }));

// A server credential stays out of Vite bundles and browser requests. A Gemini
// key is usable here only if its Cloud project and restrictions permit Places.
function placesKey() {
  return getConfiguredEnvValue(
    "GOOGLE_PLACES_API_KEY", "GEMINI_API_KEY", "GOOGLE_GENAI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_STUDIO_API_KEY",
  );
}

function failureCode(payload: unknown): string {
  const error = (payload as { error?: { message?: string; status?: string; details?: { reason?: string }[] } })?.error;
  const reasons = error?.details?.map((detail) => detail.reason) ?? [];
  if (reasons.includes("API_KEY_EXPIRED") || /key expired/i.test(error?.message ?? "")) return "key_expired";
  if (reasons.includes("SERVICE_DISABLED")) return "api_not_enabled";
  if (reasons.includes("BILLING_DISABLED")) return "billing_disabled";
  if (error?.status === "RESOURCE_EXHAUSTED") return "quota_exceeded";
  return "request_denied";
}

async function placesRequest(path: string, key: string, fields: string, body?: object) {
  const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(1200),
  });
  const payload = await response.json();
  if (!response.ok) return { ok: false as const, code: failureCode(payload) };
  return { ok: true as const, payload };
}

router.get("/", async (req, res) => {
  const input = typeof req.query.input === "string" ? req.query.input.trim() : "";
  const sessionToken = typeof req.query.sessionToken === "string" ? req.query.sessionToken : "";
  if (input.length < 2 || input.length > 300 || !sessionPattern.test(sessionToken)) {
    res.status(400).json({ code: "invalid_query" });
    return;
  }
  const key = placesKey();
  if (!key) { res.status(503).json({ code: "not_configured" }); return; }
  try {
    const result = await placesRequest("places:autocomplete", key,
      "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      { input, sessionToken, languageCode: "en" });
    if (!result.ok) { res.status(502).json({ code: result.code }); return; }
    const suggestions = (result.payload.suggestions ?? []).flatMap((item: {
      placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } };
    }) => {
      const prediction = item.placePrediction;
      if (!prediction?.placeId || !placePattern.test(prediction.placeId) || !prediction.text?.text) return [];
      return [{
        label: prediction.text.text,
        placeId: prediction.placeId,
        mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text.text,
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
      }];
    }).slice(0, 5);
    res.json({ suggestions });
  } catch {
    // Never relay provider messages, credentials, or the searched address.
    res.status(502).json({ code: "provider_unavailable" });
  }
});

router.get("/country", async (req, res) => {
  const placeId = typeof req.query.placeId === "string" ? req.query.placeId : "";
  const sessionToken = typeof req.query.sessionToken === "string" ? req.query.sessionToken : "";
  if (!placePattern.test(placeId) || !sessionPattern.test(sessionToken)) {
    res.status(400).json({ code: "invalid_place" });
    return;
  }
  const key = placesKey();
  if (!key) { res.status(503).json({ code: "not_configured" }); return; }
  try {
    const query = new URLSearchParams({ sessionToken, languageCode: "en" });
    const result = await placesRequest(`places/${encodeURIComponent(placeId)}?${query}`, key, "addressComponents");
    if (!result.ok) { res.status(502).json({ code: result.code }); return; }
    const country = result.payload.addressComponents?.find((part: { types?: string[] }) => part.types?.includes("country"));
    const code = typeof country?.shortText === "string" ? country.shortText.trim().toUpperCase() : "";
    res.json({ countryCode: /^[A-Z]{2}$/.test(code) ? code : null });
  } catch {
    res.status(502).json({ code: "provider_unavailable" });
  }
});

export default router;
