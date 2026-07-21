import { embedTexts } from "./embeddings";

// Grounded question answering for headless agents. Answers are curated,
// citation-backed snippets over Blueprint's public canonical content — never
// generated free-form — so an agent can rely on them without a fabrication
// risk, and the endpoint keeps working with no model API key configured.

export type AgentAskAction = {
  description: string;
  method: "GET" | "POST";
  endpoint: string;
  mcpTool?: string;
};

export type AgentKnowledgeEntry = {
  id: string;
  title: string;
  aliases: string[];
  answer: string;
  citations: string[];
  actions: AgentAskAction[];
};

export type AgentAskAnswer = AgentKnowledgeEntry & {
  score: number;
  matchedAliases: string[];
};

export type AgentAskResponse = {
  question: string;
  answers: AgentAskAnswer[];
  bestAnswer: AgentAskAnswer | null;
  noConfidentMatch: boolean;
  fallback: {
    message: string;
    contactUrl: string;
    discoveryEndpoints: string[];
  };
  truthBoundary: string;
  meta: {
    knowledgeEntries: number;
    returned: number;
    usedEmbeddings: boolean;
    embeddingModel: string;
  };
};

const DEFAULT_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const CANONICAL_ORIGIN = "https://tryblueprint.io";

const AGENT_KNOWLEDGE_ENTRIES: AgentKnowledgeEntry[] = [
  {
    id: "what-is-blueprint",
    title: "What Blueprint does",
    aliases: [
      "what is blueprint",
      "what does blueprint do",
      "what do you sell",
      "product",
      "company",
      "robot policy evaluation",
      "capture backed evaluation",
    ],
    answer:
      "Blueprint is a capture-first robot-evaluation company. It helps robot teams test and rank WAM/VLA robot policies on captured real-site task packs before field time. A Policy Evaluation Run compares 1-3 policies or checkpoints on one captured real-site task pack using 100 or 500 virtual episodes and returns a ranking, failure notes, OOD flags, and validation boundaries. Virtual rankings support review; they are not deployment guarantees.",
    citations: [`${CANONICAL_ORIGIN}/`, `${CANONICAL_ORIGIN}/proof`],
    actions: [
      { description: "Read the public discovery summary", method: "GET", endpoint: "/api/site-content" },
      { description: "Read the agent access manifest", method: "GET", endpoint: "/api/agent-access" },
    ],
  },
  {
    id: "how-to-search",
    title: "How agents search the site catalog",
    aliases: [
      "search",
      "find a site",
      "browse sites",
      "filter by type",
      "filter by location",
      "semantic search",
      "catalog",
      "site worlds near me",
      "warehouse near",
      "grocery store site",
    ],
    answer:
      "Use GET /api/site-worlds/search (MCP tool blueprint.siteWorld.search). It accepts a natural-language q plus structured filters: category, industry, city, state, siteType, taskLane, objectTags, robot, availability, readiness, and sort. Ranking combines brand/ontology aliases, lexical overlap, location/task/object signals, and embedding-based semantic similarity when available; without an embedding key it stays deterministic and flags embeddings_unavailable. Results include scores, reasons, matchedFields, exact/no-exact semantics, and a requestCandidate intake draft when no exact scanned package exists.",
    citations: [`${CANONICAL_ORIGIN}/sites`, `${CANONICAL_ORIGIN}/agent-access.openapi.json`],
    actions: [
      {
        description: "Search by query and filters",
        method: "GET",
        endpoint: "/api/site-worlds/search?q=warehouse%20tote&city=Chicago&limit=5",
        mcpTool: "blueprint.siteWorld.search",
      },
      { description: "Fetch one site-world detail record", method: "GET", endpoint: "/api/site-worlds/{siteWorldId}", mcpTool: "blueprint.siteWorld.get" },
    ],
  },
  {
    id: "how-to-buy-live",
    title: "How agents buy with a budget (live checkout)",
    aliases: [
      "buy",
      "purchase",
      "pay",
      "wallet",
      "budget",
      "checkout",
      "live checkout",
      "how do i pay",
      "stripe",
      "spend",
      "order",
      "how can an agent buy",
    ],
    answer:
      "An agent with a budget buys through POST /api/agent-access/commerce/live-checkout. Send siteWorldId, product (hosted_session_rental or site_world_package), optional sessionHours, optional budgetCents, and a buyer identity (Firebase bearer token, buyer.uid, or buyer.email) so the paid entitlement binds to a usable account. The server prices the SKU from the owner-system-backed site record only — over-budget quotes return a budget_exceeded blocker and unpriced products return a price_unavailable blocker instead of a fallback charge. Eligible requests return a real Stripe Checkout URL plus an order id. After the payment method on file completes Stripe checkout, webhook fulfillment marks the order paid and provisions a marketplace entitlement automatically — poll GET /api/agent-access/commerce/live-orders/{orderId} until provisioned. Live checkout is only offered for Pipeline-backed site worlds; records without current owner-system identity return a not_live_purchasable blocker with a request-intake alternative.",
    citations: [`${CANONICAL_ORIGIN}/agent-access.openapi.json`, `${CANONICAL_ORIGIN}/pricing`],
    actions: [
      { description: "Get a quote first", method: "GET", endpoint: "/api/agent-access/commerce/quote?siteWorldId={id}&product=hosted_session_rental", mcpTool: "blueprint.commerce.quote" },
      { description: "Create the live Stripe checkout", method: "POST", endpoint: "/api/agent-access/commerce/live-checkout", mcpTool: "blueprint.commerce.checkoutLive" },
      { description: "Poll order/fulfillment status", method: "GET", endpoint: "/api/agent-access/commerce/live-orders/{orderId}", mcpTool: "blueprint.commerce.liveOrder.get" },
    ],
  },
  {
    id: "dry-run-commerce",
    title: "Dry-run commerce for integration testing",
    aliases: [
      "dry run",
      "test checkout",
      "sandbox",
      "test order",
      "without paying",
      "simulate purchase",
      "integration test",
    ],
    answer:
      "POST /api/agent-access/commerce/dry-run-checkout creates a fulfilled dry-run order, receipt, and provisioned entitlement using the same response shapes as live commerce, without calling Stripe or granting live package access. Use it to validate an agent's purchase pipeline end-to-end before spending real budget, then switch to live-checkout for the real transaction.",
    citations: [`${CANONICAL_ORIGIN}/agent-access.openapi.json`],
    actions: [
      { description: "Create a dry-run order", method: "POST", endpoint: "/api/agent-access/commerce/dry-run-checkout", mcpTool: "blueprint.commerce.checkoutDryRun" },
      { description: "Read the dry-run order", method: "GET", endpoint: "/api/agent-access/commerce/orders/{orderId}", mcpTool: "blueprint.commerce.order.get" },
    ],
  },
  {
    id: "entitlement-to-session",
    title: "Using a purchased entitlement to run evaluations",
    aliases: [
      "after purchase",
      "entitlement",
      "hosted session",
      "run evaluation",
      "launch session",
      "use what i bought",
      "start rollout",
      "run batch episodes",
    ],
    answer:
      "Once an order is paid and provisioned, the entitlement unlocks protected hosted-session launch. Check GET /api/agent-access/commerce/entitlement-readiness with the buyer's Firebase bearer token, then POST /api/site-worlds/sessions with siteWorldId, entitlementId, orderId, robotProfileId, taskId, scenarioId, and startStateId. From there agents can reset, step, run headless batch rollouts, render explorer frames, and export dataset artifacts. Every hosted session requires Firebase robot-team/admin auth plus a provisioned entitlement and current owner-system readiness.",
    citations: [`${CANONICAL_ORIGIN}/agent-access.openapi.json`],
    actions: [
      { description: "Verify entitlement unlocks launch", method: "GET", endpoint: "/api/agent-access/commerce/entitlement-readiness?siteWorldId={id}&entitlementId={id}", mcpTool: "blueprint.commerce.entitlementReadiness" },
      { description: "Create the hosted session", method: "POST", endpoint: "/api/site-worlds/sessions", mcpTool: "blueprint.session.create" },
      { description: "Run a headless batch rollout", method: "POST", endpoint: "/api/site-worlds/sessions/{sessionId}/run-batch", mcpTool: "blueprint.session.runBatch" },
    ],
  },
  {
    id: "request-new-site",
    title: "Requesting a site Blueprint has not captured yet",
    aliases: [
      "no exact match",
      "request capture",
      "new site",
      "my facility",
      "not in catalog",
      "scan my warehouse",
      "request a location",
      "intake",
    ],
    answer:
      "When search returns matchSemantics.noExactScannedPackage, use the returned requestCandidate.requestUrl or the blueprint.request.locationDraft tool to build an intake draft with a contact URL and inbound-request payload. Submitting intake records interest only — it does not grant entitlement, payment, rights clearance, provider execution, or hosted availability. Blueprint reviews the request and scopes a capture for the exact site.",
    citations: [`${CANONICAL_ORIGIN}/contact/robot-team`, `${CANONICAL_ORIGIN}/sites`],
    actions: [
      { description: "Build an intake-only location draft", method: "POST", endpoint: "cli: request location / mcp: blueprint.request.locationDraft", mcpTool: "blueprint.request.locationDraft" },
      { description: "Submit completed intake fields", method: "POST", endpoint: "/api/inbound-request" },
    ],
  },
  {
    id: "pricing",
    title: "Pricing and offer shape",
    aliases: [
      "pricing",
      "cost",
      "how much",
      "price",
      "subscription",
      "rates",
      "fees",
    ],
    answer:
      "Public planning ranges: $15,000/month robot-team eval infrastructure subscriptions, $5,000-$8,000 lite quick-look evals, $5,000/site operator supply reviews, and yearly deployed-site monitoring. Agent-purchasable SKUs are quoted per site world through /api/agent-access/commerce/quote (hosted-session rental hours or site-world package access); the server-side quote is authoritative and live checkout rejects client-supplied prices. These are planning ranges, not custom-scope quotes.",
    citations: [`${CANONICAL_ORIGIN}/pricing`],
    actions: [
      { description: "Quote a specific site world", method: "GET", endpoint: "/api/agent-access/commerce/quote?siteWorldId={id}", mcpTool: "blueprint.commerce.quote" },
    ],
  },
  {
    id: "proof-boundaries",
    title: "Proof boundaries and truth labels",
    aliases: [
      "proof",
      "truth labels",
      "is this real",
      "guarantee",
      "deployment ready",
      "evidence",
      "rights",
      "provenance",
    ],
    answer:
      "Every agent surface carries truth labels: capture_grounded, provider_derived, generated, request_gated, protected_robot_team, dry_run_order, and live_checkout. Ground truth means raw capture evidence, provenance, rights/privacy records, and runtime artifacts. Generated previews, dry-run commerce, catalog matches, and request drafts are support signals — they do not prove customer results, rights clearance, provider execution, payment, or deployment readiness. A paid live order proves payment and entitlement provisioning only.",
    citations: [`${CANONICAL_ORIGIN}/proof`],
    actions: [
      { description: "Read the proof explainer", method: "GET", endpoint: "/proof" },
    ],
  },
  {
    id: "agent-tooling",
    title: "Machine-readable interfaces for agents",
    aliases: [
      "api",
      "openapi",
      "mcp",
      "cli",
      "llms.txt",
      "integrate",
      "machine readable",
      "how do agents connect",
      "tools",
    ],
    answer:
      "Blueprint publishes /llms.txt and /llms-full.txt for orientation, /api/site-content for a JSON site summary, /api/agent-access for the agent manifest, and /agent-access.openapi.json (also served at /api/agent-access/openapi.json) for the full OpenAPI contract. A stdio MCP server (npm run agent:mcp) and a JSON-first CLI (npm run agent:cli) mirror the HTTP surface: search, ask, request drafting, dry-run and live commerce, entitlement readiness, and the hosted-session lifecycle.",
    citations: [`${CANONICAL_ORIGIN}/llms.txt`, `${CANONICAL_ORIGIN}/agent-access.openapi.json`],
    actions: [
      { description: "Fetch the OpenAPI contract", method: "GET", endpoint: "/api/agent-access/openapi.json" },
      { description: "Fetch the agent manifest", method: "GET", endpoint: "/api/agent-access" },
    ],
  },
  {
    id: "talk-to-human",
    title: "Reaching a human",
    aliases: [
      "human",
      "contact",
      "support",
      "sales",
      "talk to someone",
      "escalate",
      "email",
    ],
    answer:
      "Route human follow-up through the structured intake at /contact/robot-team (robot teams) or /contact/site-operator (site operators). Agents should attach the inboundRequestDraft fields from search or the location-draft tool so a human reviewer sees the full machine context.",
    citations: [`${CANONICAL_ORIGIN}/contact/robot-team`],
    actions: [
      { description: "Open robot-team intake", method: "GET", endpoint: "/contact/robot-team" },
    ],
  },
];

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for",
  "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "the",
  "to", "we", "what", "when", "where", "which", "who", "why", "with", "you",
  "your",
]);

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: unknown) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token));
}

function jaccardSimilarity(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  const union = leftSet.size + rightSet.size - intersection;
  return union ? intersection / union : 0;
}

function cosineSimilarity(left: number[] | null, right: number[] | null) {
  if (!left?.length || !right?.length || left.length !== right.length) return null;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator ? dot / denominator : null;
}

function entrySearchDoc(entry: AgentKnowledgeEntry) {
  return [entry.title, entry.aliases.join(" "), entry.answer].join("\n");
}

export function listAgentKnowledgeEntries() {
  return AGENT_KNOWLEDGE_ENTRIES;
}

export async function answerAgentQuestion(params: {
  question: string;
  limit?: number;
}): Promise<AgentAskResponse> {
  const question = String(params.question || "").trim();
  if (!question) {
    throw new Error("A question is required. Pass q as a query param or JSON body field.");
  }
  const limit = Math.min(Math.max(Math.floor(Number(params.limit || 3)), 1), 10);
  const questionTokens = tokenize(question);
  const normalizedQuestion = ` ${normalizeText(question)} `;

  let questionEmbedding: number[] | null = null;
  let entryEmbeddings: Array<number[] | null> = AGENT_KNOWLEDGE_ENTRIES.map(() => null);
  let usedEmbeddings = false;
  try {
    const embeddings = await embedTexts([
      question,
      ...AGENT_KNOWLEDGE_ENTRIES.map((entry) => entrySearchDoc(entry)),
    ]);
    if (embeddings[0]?.length && embeddings.length === AGENT_KNOWLEDGE_ENTRIES.length + 1) {
      questionEmbedding = embeddings[0];
      entryEmbeddings = embeddings.slice(1).map((embedding) => (embedding?.length ? embedding : null));
      usedEmbeddings = entryEmbeddings.some((embedding) => Boolean(embedding));
    }
  } catch {
    usedEmbeddings = false;
  }

  const scored: AgentAskAnswer[] = AGENT_KNOWLEDGE_ENTRIES.map((entry, index) => {
    const matchedAliases = entry.aliases.filter((alias) => {
      const normalizedAlias = normalizeText(alias);
      return normalizedAlias && normalizedQuestion.includes(` ${normalizedAlias} `);
    });
    const aliasScore = Math.min(0.6, matchedAliases.length * 0.3);
    const lexicalScore = jaccardSimilarity(questionTokens, tokenize(entrySearchDoc(entry)));
    const semanticSimilarity = cosineSimilarity(questionEmbedding, entryEmbeddings[index]);
    const semanticScore = typeof semanticSimilarity === "number" ? (semanticSimilarity + 1) / 2 : 0;
    const score = aliasScore + lexicalScore * 0.8 + (usedEmbeddings ? semanticScore * 0.5 : 0);
    return {
      ...entry,
      score: Number(score.toFixed(4)),
      matchedAliases,
    };
  })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);

  const confidenceFloor = usedEmbeddings ? 0.42 : 0.05;
  const bestAnswer = scored[0] && scored[0].score >= confidenceFloor ? scored[0] : null;

  return {
    question,
    answers: scored,
    bestAnswer,
    noConfidentMatch: !bestAnswer,
    fallback: {
      message:
        "If no answer fits, use the structured robot-team intake so a human can respond with full machine context attached.",
      contactUrl: `${CANONICAL_ORIGIN}/contact/robot-team?source=agent-ask&buyerType=robot_team`,
      discoveryEndpoints: ["/api/agent-access", "/api/site-content", "/agent-access.openapi.json"],
    },
    truthBoundary:
      "Answers are curated citation-backed snippets over public canonical content, not generated claims. They do not grant access, prove payment, rights clearance, provider execution, or fulfillment.",
    meta: {
      knowledgeEntries: AGENT_KNOWLEDGE_ENTRIES.length,
      returned: scored.length,
      usedEmbeddings,
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    },
  };
}
