export const openAiResponsesOperatorTools: any[] = [
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
    description: "Verify analytics, SendGrid, ElevenLabs, and Google creative configuration.",
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

export const chatCompletionOperatorTools = openAiResponsesOperatorTools.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

export async function runOperatorTool(
  name: string,
  args: Record<string, unknown>,
) {
  const growthOps = async () => import("../utils/growth-ops");

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
      return (await import("../utils/creative-pipeline")).buildCreativeCampaignKit({
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
      return (await import("../utils/creative-execution")).renderBlueprintProofReel();
    default:
      throw new Error(`Unknown operator tool: ${name}`);
  }
}
