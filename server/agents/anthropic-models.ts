import { anthropicPricingForModel } from "../utils/anthropicPricing";

/**
 * What the Anthropic adapter sends for each model. Every model here takes
 * adaptive thinking, an explicit effort and a JSON-schema output format, and
 * has a list-price row, as does its fallback model. A model not here is not
 * sent, and a lane whose Anthropic model is not here does not route to
 * Anthropic at all. Kept apart from the adapter so routing can read it without
 * building a client.
 */
const MODEL_REQUEST_SHAPE: Record<string, { fallbackModel: string | null }> = {
  "claude-opus-5-5": { fallbackModel: "claude-opus-4-8" },
  "claude-opus-5": { fallbackModel: "claude-opus-4-8" },
  "claude-sonnet-5-5": { fallbackModel: "claude-sonnet-5" },
  "claude-fable-5-2": { fallbackModel: "claude-opus-4-8" },
  "claude-opus-4-8": { fallbackModel: null },
  "claude-sonnet-5": { fallbackModel: null },
  // No server-side fallback exists for this model: a fallback list is a 400.
  "claude-haiku-5-5": { fallbackModel: null },
};

export function anthropicRequestShapeFor(model: string) {
  return MODEL_REQUEST_SHAPE[String(model || "").trim().toLowerCase()] ?? null;
}

/** Every model id the adapter can send or be served by. */
export function anthropicRequestModels(): string[] {
  return [...new Set(Object.entries(MODEL_REQUEST_SHAPE).flatMap(([model, shape]) =>
    shape.fallbackModel ? [model, shape.fallbackModel] : [model]))];
}

/** A model the adapter sends: a request shape, and a price row for it and for its fallback. */
export function anthropicModelSupported(model: string | null | undefined): boolean {
  const shape = model ? anthropicRequestShapeFor(model) : null;
  return Boolean(shape && anthropicPricingForModel(model)
    && (!shape.fallbackModel || anthropicPricingForModel(shape.fallbackModel)));
}
