import { getGeminiVideoModel, getOpenAiMaxOutputTokens, SITE_ASSESSMENT_MODEL } from "../provider-config";

type Call = { provider: "openai" | "gemini"; model: string; reserved_usd: number;
  usage: unknown; response: unknown; cost_usd: number | null; input_tokens: number | null; output_tokens: number | null; priced_at_ms?: number; input_ceiling:number; output_ceiling:number; usage_pricing_status?:string };
const counter = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
/** Provider totals can bound unattributed tokens, but do not establish that they were thoughts. */
export function normalizeSiteAssessmentUsage(provider:"openai"|"gemini",usage:any) {
  const input=counter(provider==="openai"?usage?.input_tokens:usage?.promptTokenCount);
  const visible=counter(provider==="openai"?usage?.output_tokens:usage?.candidatesTokenCount);
  const thoughts=provider==="openai"?0:counter(usage?.thoughtsTokenCount);
  const totalValue=provider==="openai"?usage?.total_tokens:usage?.totalTokenCount;
  const total=counter(totalValue), totalPresent=totalValue!==undefined;
  const unknown={input_tokens:null,output_tokens:null,status:"unknown" as const};
  if(input===null||visible===null||(totalPresent&&total===null))return unknown;
  const reported=input+visible+(thoughts??0);
  if(!Number.isSafeInteger(reported)||(total!==null&&total<reported))return unknown;
  if(provider==="gemini"&&thoughts===null&&total===null)return unknown;
  if(provider==="gemini"&&usage?.thoughtsTokenCount!==undefined&&thoughts===null)return unknown;
  const output=total!==null?total-input:visible+(thoughts??0);
  if(!Number.isSafeInteger(output)||output<0)return unknown;
  return {input_tokens:input,output_tokens:output,status:total!==null&&(thoughts===null||total>reported)
    ?"unattributed_total_upper_bound" as const:"reported_complete" as const};
}
export function priceSiteAssessmentUsage(provider:"openai"|"gemini",usage:unknown,pricedAtMs:number) {
  const normalized=normalizeSiteAssessmentUsage(provider,usage);
  const flashInputRate=pricedAtMs<Date.parse("2027-01-01T00:00:00Z")?.75:1.5;
  const cost=normalized.input_tokens!==null&&normalized.output_tokens!==null
    ?(normalized.input_tokens*(provider==="openai"?2.5:flashInputRate)+normalized.output_tokens*(provider==="openai"?10:flashInputRate*5))/1e6:null;
  return {...normalized,cost_usd:cost};
}

/** Accounting estimates only. Missing usage remains unknown and never imposes a spending gate. */
export class SiteAssessmentBudget {
  readonly calls: Call[] = [];
  constructor(private readonly committedExposureUsd = 0, _legacyCapUsd?: number) {
    if (!Number.isFinite(committedExposureUsd) || committedExposureUsd < 0) throw new Error("site_assessment_exposure_invalid");
  }
  readonly cap = null;
  readonly inputCeiling = 100000;
  readonly maxOutput = Math.min(8192, getOpenAiMaxOutputTokens());
  authorize(provider: "openai" | "gemini", model: string, request?: unknown) {
    if ((provider === "openai" && model !== SITE_ASSESSMENT_MODEL)
      || (provider === "gemini" && (model !== getGeminiVideoModel() || model !== "gemini-3.8-flash"))) {
      throw new Error("site_assessment_model_not_admitted");
    }
    // Sol: uncached input plus a conservative cache-write ceiling. Flash:
    // full 1,048,576-token context and 32768 output at its announced post-2026 ceiling.
    // Pricing sources are retained below; these are estimates, never invoices.
    const bound=(request as any)?.inference_bound;
    if(bound!==undefined && (provider!=="gemini" || bound.schema_version!=="site_assessment_inference_bound.v1" || bound.provider!==provider || bound.model!==model
      || !/^[a-f0-9]{64}$/.test(bound.source_sha256) || !/^[a-f0-9]{64}$/.test(bound.payload_sha256) || bound.method!=="count_tokens_same_payload"
      || !Number.isSafeInteger(bound.input_tokens)||bound.input_tokens<1||bound.input_tokens>1048576
      || !Number.isSafeInteger(bound.max_output_tokens)||bound.max_output_tokens<1||bound.max_output_tokens>32768))throw new Error("site_assessment_input_budget_exceeded");
    const reserved = provider === "openai" ? (this.inputCeiling * 2.5 + this.maxOutput * 10) / 1e6
      : ((bound?.input_tokens ?? 1_048_576) * 1.5 + (bound?.max_output_tokens ?? 32768) * 7.5) / 1e6;
    this.calls.push({ provider, model, reserved_usd: reserved, usage: null, response: null, cost_usd: null, input_tokens: null, output_tokens: null, input_ceiling:provider==="openai"?this.inputCeiling:(bound?.input_tokens??1048576), output_ceiling:provider==="openai"?this.maxOutput:(bound?.max_output_tokens??32768) });
  }
  record(provider: "openai" | "gemini", model: string, response: any) {
    const call = this.calls.at(-1);
    if (!call || call.provider !== provider || call.model !== model || call.response !== null) throw new Error("site_assessment_accounting_mismatch");
    call.response = response; call.usage = response?.usage ?? null;
    call.priced_at_ms=Date.now();
    const normalized=priceSiteAssessmentUsage(provider,call.usage,call.priced_at_ms);
    call.input_tokens=normalized.input_tokens;call.output_tokens=normalized.output_tokens;call.usage_pricing_status=normalized.status;
    if(normalized.cost_usd!==null){
      call.cost_usd=normalized.cost_usd;
      // A response above the estimate is observable accounting, not authority
      // to interrupt an otherwise authorized customer operation.
      if(normalized.input_tokens!>call.input_ceiling||normalized.output_tokens!>call.output_ceiling||normalized.cost_usd>call.reserved_usd)
        call.usage_pricing_status = "reported_usage_above_estimate";
    }
  }
  artifacts() {
    const known = this.calls.every(call => call.cost_usd !== null);
    const upperBound = this.calls.some(call=>call.usage_pricing_status === "unattributed_total_upper_bound");
    const total = (key: "input_tokens" | "output_tokens") => this.calls.every(call => call[key] !== null)
      ? this.calls.reduce((sum, call) => sum + call[key]!, 0) : null;
    const reportedCost = this.calls.filter(call => call.cost_usd !== null).reduce((sum, call) => sum + call.cost_usd!, 0);
    const unknown = this.calls.filter(call => call.cost_usd === null);
    return { provider_responses: this.calls.map(call=>({...call,priced_input_tokens:call.input_tokens,priced_output_tokens:call.output_tokens,output_tokens:call.usage_pricing_status==="unattributed_total_upper_bound"?null:call.output_tokens})), usage_samples: this.calls.map(call => ({ provider: call.provider, model: call.model,
      input_tokens: call.input_tokens, output_tokens: call.usage_pricing_status==="unattributed_total_upper_bound"?null:call.output_tokens,
      priced_input_tokens:call.input_tokens,priced_output_tokens:call.output_tokens,usage_pricing_status:call.usage_pricing_status, estimated_total_cost_usd: call.cost_usd,
      reserved_max_cost_usd: call.reserved_usd, raw_usage: call.usage })),
      known_usage_subtotals: { estimated_total_cost_usd: reportedCost }, usage_detail_status: "partial",
      usage: { calls: this.calls.length, prompt_tokens: total("input_tokens"), completion_tokens: upperBound ? null : total("output_tokens"),
        cost_usd: known ? reportedCost : null, estimated_total_cost_usd: known ? reportedCost : null },
      cost_status: known ? (upperBound ? "usage_upper_bound_pricing_estimate":"reported_usage_pricing_estimate") : "usage_missing",
      inference_reservation: { hard_cost_cap_usd: null, spending_gated: false, committed_exposure_usd: this.committedExposureUsd, known_reported_cost_usd: reportedCost,
        reconciled_cost_status: known ? (upperBound ? "usage_upper_bound_pricing_estimate":"reported_usage_pricing_estimate") : "includes_worst_case_reservations",
        projected_max_cost_per_call_usd: Math.max(0, ...unknown.map(call => call.reserved_usd)),
        unknown_usage_reserved_cost_usd: this.calls.filter(call => call.cost_usd === null).reduce((sum, call) => sum + call.reserved_usd, 0),
        reconciled_cost_usd: this.calls.reduce((sum, call) => sum + (call.cost_usd ?? call.reserved_usd), 0),
        pricing_sources: ["https://openai.com/index/introducing-gpt-6-1-sol/", "https://ai.google.dev/gemini-api/docs/pricing"],
        pricing_basis: "2026-10-07; Sol standard rates, Flash promotional rates through 2026 then announced standard rates; no cache savings assumed" },
    };
  }
}

