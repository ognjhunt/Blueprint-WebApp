import OpenAI from "openai";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";

const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
const openAiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 20_000);

const client = openAiApiKey
  ? new OpenAI({
      apiKey: openAiApiKey,
      maxRetries: 2,
      timeout: openAiTimeoutMs,
    })
  : null;

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("OpenAI returned an empty response");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("OpenAI returned non-JSON output");
  }
}

function inferRequiresHumanReview<TOutput>(output: TOutput) {
  return Boolean(
    output
    && typeof output === "object"
    && "requires_human_review" in (output as Record<string, unknown>)
    && (output as Record<string, unknown>).requires_human_review === true,
  );
}

const operatorTools: any[] = [
  {
    type: "function" as const,
    name: "list_growth_campaigns",
    description: "List local growth campaigns and their current delivery state.",
    strict: true,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "create_growth_campaign_draft",
    description: "Create a growth campaign draft that can later be queued for send approval.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        audienceQuery: { type: "string" },
        channel: { type: "string" },
        recipientEmails: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["name", "subject", "body"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "build_creative_campaign_kit",
    description: "Build a proof-led campaign kit for Blueprint's exact-site offer.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        skuName: { type: "string" },
        audience: { type: "string" },
        siteType: { type: "string" },
        workflow: { type: "string" },
        callToAction: { type: "string" },
        assetGoal: { type: "string" },
        proofPoints: {
          type: "array",
          items: { type: "string" },
        },
        differentiators: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["skuName", "audience", "siteType", "workflow", "callToAction"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "queue_growth_campaign_send",
    description: "Queue a SendGrid-backed growth campaign send for human approval.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        operatorEmail: { type: "string" },
      },
      required: ["campaignId", "operatorEmail"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "run_buyer_lifecycle_check",
    description: "Queue lifecycle follow-up emails for provisioned buyers after a given number of days.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        daysSinceGrant: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "verify_growth_integrations",
    description: "Verify analytics, SendGrid, optional Nitrosend, ElevenLabs, and Google creative configuration.",
    strict: true,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "render_blueprint_proof_reel",
    description: "Render the Blueprint proof reel locally via Remotion.",
    strict: true,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

async function runOperatorTool(
  name: string,
  args: Record<string, unknown>,
) {
  const growthOps = async () => import("../../utils/growth-ops");

  switch (name) {
    case "list_growth_campaigns":
      return (await growthOps()).listGrowthCampaigns();
    case "create_growth_campaign_draft":
      return (await growthOps()).createGrowthCampaignDraft({
        name: String(args.name || ""),
        subject: String(args.subject || ""),
        body: String(args.body || ""),
        audienceQuery: typeof args.audienceQuery === "string" ? args.audienceQuery : null,
        channel: typeof args.channel === "string" ? args.channel : "sendgrid",
        recipientEmails: Array.isArray(args.recipientEmails)
          ? args.recipientEmails.filter((value): value is string => typeof value === "string")
          : null,
      });
    case "build_creative_campaign_kit":
      return (await import("../../utils/creative-pipeline")).buildCreativeCampaignKit({
        skuName: String(args.skuName || ""),
        audience: String(args.audience || ""),
        siteType: String(args.siteType || ""),
        workflow: String(args.workflow || ""),
        callToAction: String(args.callToAction || ""),
        assetGoal:
          args.assetGoal === "email_campaign" ||
          args.assetGoal === "outbound_sequence" ||
          args.assetGoal === "social_cutdown" ||
          args.assetGoal === "proof_reel"
            ? args.assetGoal
            : "landing_page",
        proofPoints: Array.isArray(args.proofPoints)
          ? args.proofPoints.filter((value): value is string => typeof value === "string")
          : [],
        differentiators: Array.isArray(args.differentiators)
          ? args.differentiators.filter((value): value is string => typeof value === "string")
          : [],
      });
    case "queue_growth_campaign_send":
      return (await growthOps()).queueGrowthCampaignSend({
        campaignId: String(args.campaignId || ""),
        operatorEmail: String(args.operatorEmail || "ops@tryblueprint.io"),
      });
    case "run_buyer_lifecycle_check":
      return (await growthOps()).runBuyerLifecycleCheck({
        daysSinceGrant:
          typeof args.daysSinceGrant === "number" ? args.daysSinceGrant : 30,
      });
    case "verify_growth_integrations":
      return (await growthOps()).verifyGrowthIntegrations();
    case "render_blueprint_proof_reel":
      return (await import("../../utils/creative-execution")).renderBlueprintProofReel();
    default:
      throw new Error(`Unknown OpenAI operator tool: ${name}`);
  }
}

export async function runOpenAIResponsesTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  if (!client) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "OPENAI_API_KEY is not configured",
      requires_human_review: true,
      requires_approval: false,
    };
  }

  const tools = task.kind === "operator_thread" ? operatorTools : undefined;
  const previousResponseId =
    task.session_policy.lane === "session" &&
    task.metadata &&
    typeof task.metadata === "object" &&
    typeof (task.metadata as Record<string, unknown>).previous_response_id === "string"
      ? String((task.metadata as Record<string, unknown>).previous_response_id)
      : undefined;

  let response = await client.responses.create({
    model: task.model,
    input: task.definition.build_prompt(task.input),
    previous_response_id: previousResponseId,
    reasoning: {
      effort: "medium",
    },
    tools,
  });

  let toolIterations = 0;
  while (tools && toolIterations < 5) {
    const outputItems = Array.isArray((response as any).output) ? (response as any).output : [];
    const toolCalls = outputItems.filter((item: any) => item?.type === "function_call");
    if (toolCalls.length === 0) {
      break;
    }

    const toolOutputs: any[] = [];
    for (const call of toolCalls) {
      const args =
        typeof call.arguments === "string" && call.arguments.trim().length > 0
          ? JSON.parse(call.arguments)
          : {};
      const result = await runOperatorTool(call.name, args);
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    response = await client.responses.create({
      model: task.model,
      previous_response_id: response.id,
      input: toolOutputs as any,
      reasoning: {
        effort: "medium",
      },
      tools,
    });

    toolIterations += 1;
  }

  const rawText = response.output_text || "";
  const parsed = (task.definition.output_schema as ZodType<TOutput>).parse(
    extractJsonPayload(rawText),
  );

  return {
    status: "completed",
    provider: task.provider,
    runtime: task.runtime,
    model: task.model,
    tool_mode: task.tool_policy.mode,
    output: parsed,
    raw_output_text: rawText,
    artifacts: {
      openai_response_id: (response as any).id || null,
      tool_iterations: toolIterations,
    },
    requires_human_review: inferRequiresHumanReview(parsed),
    requires_approval: false,
  };
}
