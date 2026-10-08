import { getGeminiVideoModel, getOpenAiMaxOutputTokens, SITE_ASSESSMENT_MODEL } from "../provider-config";

type Call = { provider: "openai" | "gemini"; model: string; reserved_usd: number;
  usage: unknown; response: unknown; cost_usd: number | null; input_tokens: number | null; output_tokens: number | null };
const counter = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const configuredPositive = (value: string | undefined, fallback: number, maximum: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

/** Reuses the existing inference cap; unknown paid calls retain their exposure. */
export class SiteAssessmentBudget {
  readonly calls: Call[] = [];
  constructor(private readonly committedExposureUsd = 0) {
    if (!Number.isFinite(committedExposureUsd) || committedExposureUsd < 0) throw new Error("site_assessment_exposure_invalid");
  }
  readonly cap = configuredPositive(process.env.BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD, 5, 100);
  readonly inputCeiling = Math.floor(configuredPositive(process.env.BLUEPRINT_OPENAI_AGENT_MAX_INPUT_TOKENS, 100000, 100000));
  readonly maxOutput = Math.min(8192, getOpenAiMaxOutputTokens());
  authorize(provider: "openai" | "gemini", model: string, request?: unknown) {
    if (this.calls.some(call => call.response === null)) throw new Error("site_assessment_cost_unresolved");
    if ((provider === "openai" && model !== SITE_ASSESSMENT_MODEL)
      || (provider === "gemini" && (model !== getGeminiVideoModel() || model !== "gemini-3.8-flash"))) {
      throw new Error("site_assessment_model_not_admitted");
    }
    // UTF-8 bytes upper-bound visible text tokens; reserve room for SDK schemas.
    if (provider === "openai" && Buffer.byteLength(JSON.stringify(request ?? {})) + 4096 > this.inputCeiling) {
      throw new Error("site_assessment_input_budget_exceeded");
    }
    // Sol: uncached input plus a conservative cache-write ceiling. Flash:
    // full 1,048,576-token context and 32768 output at its announced post-2026 ceiling.
    // Pricing sources are retained below; these are estimates, never invoices.
    const reserved = provider === "openai" ? (this.inputCeiling * 2.5 + this.maxOutput * 10) / 1e6
      : (1_048_576 * 1.5 + 32768 * 7.5) / 1e6;
    if (this.committedExposureUsd + this.calls.reduce((sum, call) => sum + (call.cost_usd ?? call.reserved_usd), 0) + reserved > this.cap) {
      throw new Error("site_assessment_inference_cost_cap");
    }
    this.calls.push({ provider, model, reserved_usd: reserved, usage: null, response: null, cost_usd: null, input_tokens: null, output_tokens: null });
  }
  record(provider: "openai" | "gemini", model: string, response: any) {
    const call = this.calls.at(-1);
    if (!call || call.provider !== provider || call.model !== model || call.response !== null) throw new Error("site_assessment_accounting_mismatch");
    call.response = response; call.usage = response?.usage ?? null;
    const input = counter(provider === "openai" ? response?.usage?.input_tokens : response?.usage?.promptTokenCount);
    const visibleOutput = counter(provider === "openai" ? response?.usage?.output_tokens : response?.usage?.candidatesTokenCount);
    const thoughts = provider === "openai" ? 0 : counter(response?.usage?.thoughtsTokenCount ?? 0);
    const output = visibleOutput !== null && thoughts !== null ? visibleOutput + thoughts : null;
    call.input_tokens = input; call.output_tokens = output;
    if (input !== null && output !== null) {
      const flashInputRate = Date.now() < Date.parse("2027-01-01T00:00:00Z") ? 0.75 : 1.5;
      const flashOutputRate = flashInputRate * 5;
      // Missing cache-write detail retains the highest admitted input rate.
      // Never release this exposure at the cheaper ordinary-input rate.
      call.cost_usd = (input * (provider === "openai" ? 2.5 : flashInputRate) + output * (provider === "openai" ? 10 : flashOutputRate)) / 1e6;
      if (call.cost_usd > call.reserved_usd) throw new Error("site_assessment_actual_cost_exceeds_reservation");
    }
  }
  artifacts() {
    const known = this.calls.every(call => call.cost_usd !== null);
    const total = (key: "input_tokens" | "output_tokens") => this.calls.every(call => call[key] !== null)
      ? this.calls.reduce((sum, call) => sum + call[key]!, 0) : null;
    const reportedCost = this.calls.filter(call => call.cost_usd !== null).reduce((sum, call) => sum + call.cost_usd!, 0);
    const unknown = this.calls.filter(call => call.cost_usd === null);
    return { provider_responses: this.calls, usage_samples: this.calls.map(call => ({ provider: call.provider, model: call.model,
      input_tokens: call.input_tokens, output_tokens: call.output_tokens, estimated_total_cost_usd: call.cost_usd,
      reserved_max_cost_usd: call.reserved_usd, raw_usage: call.usage })),
      known_usage_subtotals: { estimated_total_cost_usd: reportedCost }, usage_detail_status: "partial",
      usage: { calls: this.calls.length, prompt_tokens: total("input_tokens"), completion_tokens: total("output_tokens"),
        cost_usd: known ? reportedCost : null, estimated_total_cost_usd: known ? reportedCost : null },
      cost_status: known ? "reported_usage_pricing_estimate" : "usage_missing",
      inference_reservation: { hard_cost_cap_usd: this.cap, known_reported_cost_usd: reportedCost,
        reconciled_cost_status: known ? "reported_usage_pricing_estimate" : "includes_worst_case_reservations",
        projected_max_cost_per_call_usd: Math.max(0, ...unknown.map(call => call.reserved_usd)),
        unknown_usage_reserved_cost_usd: this.calls.filter(call => call.cost_usd === null).reduce((sum, call) => sum + call.reserved_usd, 0),
        reconciled_cost_usd: this.calls.reduce((sum, call) => sum + (call.cost_usd ?? call.reserved_usd), 0),
        pricing_sources: ["https://openai.com/index/introducing-gpt-6-1-sol/", "https://ai.google.dev/gemini-api/docs/pricing"],
        pricing_basis: "2026-10-07; Sol standard rates, Flash promotional rates through 2026 then announced standard rates; no cache savings assumed" },
    };
  }
}

