import {
  BlueprintAgentApiClient,
  type AgentClientEnv,
  type AgentDryRunCheckoutInput,
  type SearchSiteWorldsInput,
} from "./agent-api-client";

export type AgentJourneyWant =
  | "catalog_match"
  | "hosted_review"
  | "dry_run_order"
  | "entitlement_readiness"
  | "session"
  | "public_demo_session";

export type AgentJourneyPlanInput = SearchSiteWorldsInput & {
  q?: string;
  query?: string;
  want?: string;
  product?: string;
  sessionHours?: number;
  entitlementId?: string;
  orderId?: string;
  buyerUserId?: string;
  buyer?: AgentDryRunCheckoutInput["buyer"] | string;
  robotProfileId?: string;
  taskId?: string;
  scenarioId?: string;
  startStateId?: string;
};

type AgentJourneyBlocker = {
  code: string;
  severity: "info" | "blocked";
  ownerSystem: string;
  message: string;
  retryAction?: string;
};

type CompactSearchMatch = {
  siteWorldId: string;
  siteName: string;
  category: string | null;
  score: number | null;
  matchedFields: string[];
  matchedAliases: string[];
};

const DEFAULT_PUBLIC_DEMO_SITE_WORLD_ID = "siteworld-f5fd54898cfb";
const DEFAULT_BUYER_USER_ID = "agent-dry-run-buyer";

const SAFE_DEFAULTS = {
  readOnlyOrDryRun: true,
  livePayment: false,
  privateAccess: false,
  providerExecution: false,
  liveStripeTouched: false,
  hostedSessionCreated: false,
} as const;

const SUPPRESSED_ACTIONS = [
  "live_payment",
  "private_access",
  "provider_execution",
  "hosted_session_creation",
] as const;

const TRUTH_BOUNDARIES = [
  "This planner only reads public/search data and calls dry-run agent commerce endpoints when requested.",
  "It does not create live payment, private package access, rights clearance, provider execution, or hosted-session fulfillment.",
  "Protected hosted-session execution still requires Firebase robot-team/admin bearer auth plus session ownership or a matching provisioned entitlement.",
] as const;

function clean(value: unknown) {
  return String(value || "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => clean(entry)).filter(Boolean)
    : [];
}

function boolAt(record: Record<string, unknown> | null, key: string) {
  return Boolean(record?.[key]);
}

function stringAt(record: Record<string, unknown> | null, key: string) {
  return clean(record?.[key]);
}

function numberAt(record: Record<string, unknown> | null, key: string) {
  const value = Number(record?.[key]);
  return Number.isFinite(value) ? value : null;
}

function nestedRecord(record: Record<string, unknown> | null, key: string) {
  return asRecord(record?.[key]);
}

function nestedString(record: Record<string, unknown> | null, path: string[]) {
  let current: Record<string, unknown> | null = record;
  for (let index = 0; index < path.length - 1; index += 1) {
    current = nestedRecord(current, path[index]);
  }
  return stringAt(current, path[path.length - 1]);
}

function normalizeWant(value: unknown): AgentJourneyWant {
  const normalized = clean(value || "catalog_match")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (["hosted_review", "hosted_evaluation", "hosted_review_path"].includes(normalized)) {
    return "hosted_review";
  }
  if (["dry_run_order", "dry_run_quote", "commerce", "quote", "order"].includes(normalized)) {
    return "dry_run_order";
  }
  if (["entitlement_readiness", "readiness"].includes(normalized)) {
    return "entitlement_readiness";
  }
  if (["session", "hosted_session", "protected_session"].includes(normalized)) {
    return "session";
  }
  if (["public_demo", "public_demo_session", "demo_session"].includes(normalized)) {
    return "public_demo_session";
  }
  return "catalog_match";
}

function normalizeProduct(value: unknown) {
  const normalized = clean(value || "hosted_session_rental")
    .toLowerCase()
    .replace(/-/g, "_");
  if (["site_world_package", "package", "site_package", "world_model"].includes(normalized)) {
    return "site_world_package";
  }
  return "hosted_session_rental";
}

function envValue(env: AgentClientEnv | undefined, key: string) {
  return env?.[key] ?? process.env[key];
}

function publicDemoIds(env: AgentClientEnv | undefined) {
  return new Set(
    [
      DEFAULT_PUBLIC_DEMO_SITE_WORLD_ID,
      clean(envValue(env, "BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID")),
    ].filter(Boolean),
  );
}

function hasBearerAuth(env: AgentClientEnv | undefined) {
  return Boolean(
    clean(envValue(env, "BLUEPRINT_AGENT_AUTH_TOKEN")) ||
      clean(envValue(env, "BLUEPRINT_FIREBASE_ID_TOKEN")),
  );
}

function shellQuote(value: string) {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function buildPlanSearchInput(input: AgentJourneyPlanInput): SearchSiteWorldsInput {
  return {
    q: clean(input.q || input.query),
    limit: typeof input.limit === "number" ? input.limit : 5,
    category: input.category,
    industry: input.industry,
    city: input.city,
    state: input.state,
    siteType: input.siteType,
    taskLane: input.taskLane,
    objectTags: input.objectTags,
    robot: input.robot,
    availability: input.availability,
    readiness: input.readiness,
    sort: input.sort,
  };
}

function compactRequestCandidate(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;
  return {
    contactUrl: stringAt(record, "requestUrl"),
    source: stringAt(record, "source") || "site-worlds",
    requestPath: stringAt(record, "requestPath") || "new-capture",
    proofPathPreference: stringAt(record, "proofPathPreference") || "exact_site_required",
  };
}

function compactTopMatch(result: Record<string, unknown> | null): CompactSearchMatch | null {
  const siteWorld = nestedRecord(result, "siteWorld");
  const siteWorldId = stringAt(siteWorld, "id");
  if (!siteWorldId) return null;
  return {
    siteWorldId,
    siteName: stringAt(siteWorld, "siteName") || siteWorldId,
    category: stringAt(siteWorld, "category") || null,
    score: numberAt(result, "score"),
    matchedFields: stringArray(result?.matchedFields),
    matchedAliases: stringArray(result?.matchedAliases),
  };
}

function firstCatalogId(siteWorld: Record<string, unknown> | null, key: string, fallbackKey = "id") {
  const first = arrayOfRecords(siteWorld?.[key])[0];
  return stringAt(first, fallbackKey) || stringAt(first, "id");
}

function sessionIdsFromSiteWorld(siteWorld: Record<string, unknown> | null, input: AgentJourneyPlanInput) {
  return {
    robotProfileId: clean(input.robotProfileId) || firstCatalogId(siteWorld, "robotProfiles"),
    taskId: clean(input.taskId) || firstCatalogId(siteWorld, "taskCatalog", "taskId"),
    scenarioId: clean(input.scenarioId) || firstCatalogId(siteWorld, "scenarioCatalog"),
    startStateId: clean(input.startStateId) || firstCatalogId(siteWorld, "startStateCatalog"),
  };
}

function compactSearchPayload(searchPayload: unknown, topMatch: CompactSearchMatch | null) {
  const search = asRecord(searchPayload);
  const matchSemantics = nestedRecord(search, "matchSemantics");
  return {
    exactMatch: boolAt(matchSemantics, "exactMatch"),
    noExactScannedPackage: boolAt(matchSemantics, "noExactScannedPackage"),
    message: stringAt(matchSemantics, "message"),
    topMatch,
    requestCandidate: compactRequestCandidate(search?.requestCandidate),
    warnings: stringArray(search?.warnings),
  };
}

function noExactBlocker(message: string): AgentJourneyBlocker {
  return {
    code: "no_exact_scanned_package",
    severity: "blocked",
    ownerSystem: "site_world_catalog",
    message: message || "No scanned package for this exact place yet.",
    retryAction: "Use the request candidate or request-location draft before attempting commerce or hosted-session access.",
  };
}

function noMatchBlocker(query: string): AgentJourneyBlocker {
  return {
    code: "no_catalog_match",
    severity: "blocked",
    ownerSystem: "site_world_catalog",
    message: `No public catalog candidate was returned for ${query || "the query"}.`,
    retryAction: "Run site-world search with broader category, city, workflow, or object-tag filters.",
  };
}

function authBlocker(): AgentJourneyBlocker {
  return {
    code: "protected_bearer_auth_required",
    severity: "blocked",
    ownerSystem: "firebase_auth",
    message: "Protected hosted-session paths require BLUEPRINT_AGENT_AUTH_TOKEN or BLUEPRINT_FIREBASE_ID_TOKEN for a robot_team/admin user.",
    retryAction: "Run npm run agent:cli -- setup-auth --require-auth after exporting a valid bearer token.",
  };
}

function entitlementBlocker(): AgentJourneyBlocker {
  return {
    code: "hosted_session_entitlement_required",
    severity: "blocked",
    ownerSystem: "marketplace_entitlements",
    message: "A provisioned hosted-session entitlement is required before protected site-world launch.",
    retryAction: "Run dry-run commerce first for planning, or provide a real provisioned entitlement for an authorized protected flow.",
  };
}

function missingEntitlementIdBlocker(): AgentJourneyBlocker {
  return {
    code: "entitlement_id_required",
    severity: "blocked",
    ownerSystem: "agent_cli_input",
    message: "Entitlement-readiness planning requires --entitlement-id.",
    retryAction: "Run dry-run commerce first or pass an existing entitlement id.",
  };
}

function missingPublicDemoInputsBlocker(): AgentJourneyBlocker {
  return {
    code: "public_demo_session_inputs_missing",
    severity: "blocked",
    ownerSystem: "site_world_catalog",
    message: "The public-demo session path needs site-world robot, task, scenario, and start-state ids.",
    retryAction: "Pass --robot-profile-id, --task-id, --scenario-id, and --start-state-id explicitly.",
  };
}

function compactCommercePayload(params: {
  quotePayload?: unknown;
  checkoutPayload?: unknown;
  readinessPayload?: unknown;
}) {
  const quote = nestedRecord(asRecord(params.quotePayload), "quote");
  const checkout = asRecord(params.checkoutPayload);
  const order = nestedRecord(checkout, "order");
  const entitlement = nestedRecord(checkout, "entitlement");
  const readiness = asRecord(params.readinessPayload);
  return {
    quoteId: stringAt(quote, "quoteId") || null,
    product: stringAt(quote, "product") || null,
    orderId: stringAt(order, "id") || null,
    entitlementId: stringAt(entitlement, "id") || null,
    entitlementReadiness: readiness
      ? {
          entitled: boolAt(readiness, "entitled"),
          launchable: boolAt(readiness, "launchable"),
          blockers: stringArray(readiness.blockers),
        }
      : null,
  };
}

function readinessBlockers(readinessPayload: unknown): AgentJourneyBlocker[] {
  const readiness = asRecord(readinessPayload);
  if (!readiness || boolAt(readiness, "launchable")) return [];
  return stringArray(readiness.blockers).map((message) => ({
    code: "entitlement_readiness_blocked",
    severity: "blocked",
    ownerSystem: "agent_access_entitlement_readiness",
    message,
    retryAction: "Resolve the readiness blocker before attempting hosted-session creation.",
  }));
}

function buildBasePlan(params: {
  query: string;
  want: AgentJourneyWant;
  searchPayload: unknown;
  topMatch: CompactSearchMatch | null;
}) {
  return {
    mode: "dry_run" as const,
    action: "agent_journey_plan" as const,
    query: params.query,
    want: params.want,
    search: compactSearchPayload(params.searchPayload, params.topMatch),
    safeDefaults: SAFE_DEFAULTS,
    suppressedActions: SUPPRESSED_ACTIONS,
    truthBoundaries: TRUTH_BOUNDARIES,
  };
}

function buildPublicDemoCommand(siteWorldId: string, ids: ReturnType<typeof sessionIdsFromSiteWorld>) {
  return [
    "npm run agent:cli -- session create",
    `--site-world-id ${siteWorldId}`,
    "--session-mode runtime_only",
    `--robot-profile-id ${ids.robotProfileId}`,
    `--task-id ${ids.taskId}`,
    `--scenario-id ${ids.scenarioId}`,
    `--start-state-id ${ids.startStateId}`,
  ].join(" ");
}

function parseBuyer(value: AgentJourneyPlanInput["buyer"], buyerUserId: string): AgentDryRunCheckoutInput["buyer"] {
  if (value && typeof value === "object") {
    return value;
  }
  if (typeof value === "string" && clean(value)) {
    try {
      const parsed = JSON.parse(value) as AgentDryRunCheckoutInput["buyer"];
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return { uid: buyerUserId };
    }
  }
  return { uid: buyerUserId };
}

export async function planAgentJourney(
  input: AgentJourneyPlanInput,
  client: BlueprintAgentApiClient,
  env?: AgentClientEnv,
) {
  const searchInput = buildPlanSearchInput(input);
  const query = clean(searchInput.q);
  const want = normalizeWant(input.want);
  const searchPayload = await client.searchSiteWorlds(searchInput);
  const search = asRecord(searchPayload);
  const results = arrayOfRecords(search?.results);
  const topResult = results[0] || null;
  const topMatch = compactTopMatch(topResult);
  const topSiteWorld = nestedRecord(topResult, "siteWorld");
  const compactSearch = compactSearchPayload(searchPayload, topMatch);
  const base = buildBasePlan({ query, want, searchPayload, topMatch });
  const requestCandidate = compactSearch.requestCandidate;

  if (!topMatch) {
    const blockers = [noMatchBlocker(query)];
    return {
      ...base,
      nextAction: {
        kind: "blocked_no_catalog_match",
        safeToRun: false,
        command: `npm run agent:cli -- site-world search --q ${shellQuote(query)}`,
      },
      blockers,
    };
  }

  if (compactSearch.noExactScannedPackage || !compactSearch.exactMatch) {
    const blockers = [noExactBlocker(compactSearch.message)];
    return {
      ...base,
      nextAction: {
        kind: "request_candidate",
        siteWorldId: topMatch.siteWorldId,
        safeToRun: true,
        command: `npm run agent:cli -- request location --location ${shellQuote(query)}`,
      },
      search: {
        ...base.search,
        requestCandidate,
      },
      blockers,
    };
  }

  if (want === "catalog_match") {
    return {
      ...base,
      nextAction: {
        kind: "exact_catalog_match",
        siteWorldId: topMatch.siteWorldId,
        safeToRun: true,
        command: `npm run agent:cli -- world get ${topMatch.siteWorldId}`,
      },
      blockers: [],
    };
  }

  if (want === "hosted_review" || want === "dry_run_order") {
    const product = normalizeProduct(input.product);
    const buyerUserId = clean(input.buyerUserId) || DEFAULT_BUYER_USER_ID;
    const buyer = parseBuyer(input.buyer, buyerUserId);
    const quotePayload = await client.quoteCommerce({
      siteWorldId: topMatch.siteWorldId,
      product,
      sessionHours: input.sessionHours,
    });
    const checkoutPayload = await client.createDryRunCheckout({
      siteWorldId: topMatch.siteWorldId,
      product,
      sessionHours: input.sessionHours,
      mode: "dry_run",
      buyer,
    });
    const entitlementId = nestedString(asRecord(checkoutPayload), ["entitlement", "id"]);
    const readinessPayload = entitlementId
      ? await client.entitlementReadiness({
          siteWorldId: topMatch.siteWorldId,
          entitlementId,
          buyerUserId,
          product,
        })
      : null;
    const blockers = readinessBlockers(readinessPayload);

    return {
      ...base,
      nextAction: {
        kind: "dry_run_quote_order",
        siteWorldId: topMatch.siteWorldId,
        safeToRun: blockers.length === 0,
        command: `npm run agent:cli -- commerce entitlement-readiness --site-world-id ${topMatch.siteWorldId} --entitlement-id ${entitlementId || "<dry-entitlement-id>"}`,
      },
      commerce: compactCommercePayload({ quotePayload, checkoutPayload, readinessPayload }),
      blockers,
    };
  }

  if (want === "entitlement_readiness") {
    const entitlementId = clean(input.entitlementId);
    if (!entitlementId) {
      const blockers = [missingEntitlementIdBlocker()];
      return {
        ...base,
        nextAction: {
          kind: "blocked_entitlement_readiness",
          siteWorldId: topMatch.siteWorldId,
          safeToRun: false,
          command: `npm run agent:cli -- commerce entitlement-readiness --site-world-id ${topMatch.siteWorldId} --entitlement-id <entitlement-id>`,
        },
        blockers,
      };
    }
    const readinessPayload = await client.entitlementReadiness({
      siteWorldId: topMatch.siteWorldId,
      entitlementId,
      buyerUserId: clean(input.buyerUserId) || DEFAULT_BUYER_USER_ID,
      product: normalizeProduct(input.product),
    });
    const blockers = readinessBlockers(readinessPayload);
    return {
      ...base,
      nextAction: {
        kind: "entitlement_readiness",
        siteWorldId: topMatch.siteWorldId,
        safeToRun: blockers.length === 0,
        command: `npm run agent:cli -- commerce entitlement-readiness --site-world-id ${topMatch.siteWorldId} --entitlement-id ${entitlementId}`,
      },
      commerce: compactCommercePayload({ readinessPayload }),
      blockers,
    };
  }

  const ids = sessionIdsFromSiteWorld(topSiteWorld, input);
  const publicDemo = publicDemoIds(env).has(topMatch.siteWorldId);
  const missingSessionInputs = !ids.robotProfileId || !ids.taskId || !ids.scenarioId || !ids.startStateId;

  if (want === "public_demo_session" || (want === "session" && publicDemo)) {
    const blockers = missingSessionInputs ? [missingPublicDemoInputsBlocker()] : [];
    return {
      ...base,
      nextAction: {
        kind: "public_demo_session_path",
        siteWorldId: topMatch.siteWorldId,
        safeToRun: publicDemo && blockers.length === 0,
        command: publicDemo && blockers.length === 0
          ? buildPublicDemoCommand(topMatch.siteWorldId, ids)
          : `npm run agent:cli -- site-world search --q ${shellQuote(query)}`,
      },
      blockers: publicDemo
        ? blockers
        : [
            {
              code: "not_public_demo_site_world",
              severity: "blocked",
              ownerSystem: "hosted_session_access_policy",
              message: "The matched site world is not public-demo eligible.",
              retryAction: "Use dry-run commerce or provide protected-flow auth and entitlement proof.",
            } satisfies AgentJourneyBlocker,
          ],
    };
  }

  const blockers: AgentJourneyBlocker[] = [];
  if (!hasBearerAuth(env)) blockers.push(authBlocker());
  if (!clean(input.entitlementId)) blockers.push(entitlementBlocker());

  return {
    ...base,
    nextAction: {
      kind: blockers.length ? "blocked_protected_session_path" : "entitlement_readiness",
      siteWorldId: topMatch.siteWorldId,
      safeToRun: blockers.length === 0,
      command: blockers.length
        ? "npm run agent:cli -- setup-auth --require-auth"
        : `npm run agent:cli -- commerce entitlement-readiness --site-world-id ${topMatch.siteWorldId} --entitlement-id ${clean(input.entitlementId)}`,
    },
    blockers,
  };
}
