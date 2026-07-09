import admin, { dbAdmin as defaultDb } from "../../client/src/lib/firebaseAdmin";

type FirestoreLike = typeof defaultDb;

type BetaCohortGate = "waitlist" | "capture_intake";

type BetaCohortGateInput = {
  gate: BetaCohortGate;
  creatorId?: string | null;
  email?: string | null;
  market?: string | null;
  siteType?: string | null;
  source?: string | null;
  now?: Date;
};

export type BetaCohortDecision = {
  allowed: boolean;
  statusCode: number;
  reason: string;
  message: string;
  cohortKey: string;
  windowKey: string;
  policy: ReturnType<typeof getBetaCohortPolicySnapshot>;
};

function truthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function explicitlyFalse(value: string | undefined) {
  return ["0", "false", "no", "off"].includes(String(value || "").trim().toLowerCase());
}

function intEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value || "");
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function tokens(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeToken(item))
    .filter(Boolean);
}

function normalizeToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function includesAllowed(allowed: string[], value: string | null | undefined) {
  if (!allowed.length) {
    return true;
  }
  const normalized = normalizeToken(value);
  return Boolean(normalized) && allowed.includes(normalized);
}

export function getBetaCohortPolicySnapshot(env: NodeJS.ProcessEnv = process.env) {
  const betaEnabled = !explicitlyFalse(env.BLUEPRINT_BETA_ENABLED)
    && !truthy(env.BLUEPRINT_BETA_KILL_SWITCH);
  return {
    enabled: betaEnabled,
    killSwitchActive: truthy(env.BLUEPRINT_BETA_KILL_SWITCH),
    inviteCap: intEnv(env.BLUEPRINT_BETA_INVITE_CAP, 100),
    cohortDailyLimit: intEnv(env.BLUEPRINT_BETA_COHORT_DAILY_LIMIT, 25),
    allowedMarkets: tokens(env.BLUEPRINT_BETA_ALLOWED_MARKETS),
    allowedSiteTypes: tokens(env.BLUEPRINT_BETA_ALLOWED_SITE_TYPES),
    defaultCohort: normalizeToken(env.BLUEPRINT_BETA_DEFAULT_COHORT) || "default",
  };
}

async function countCollectionDocs(
  db: FirestoreLike,
  collectionName: string,
  field: string,
  value: string,
  filter?: (data: Record<string, unknown>) => boolean,
) {
  const snapshot = await db
    ?.collection(collectionName)
    .where(field, "==", value)
    .get();
  const docs = snapshot?.docs || [];
  return filter
    ? docs.filter((doc) => filter((doc.data() || {}) as Record<string, unknown>)).length
    : docs.length;
}

function blockedDecision(
  input: BetaCohortGateInput,
  reason: string,
  statusCode: number,
  message: string,
  policy: ReturnType<typeof getBetaCohortPolicySnapshot>,
) {
  const now = input.now || new Date();
  const cohortKey =
    normalizeToken(input.market)
    || normalizeToken(input.siteType)
    || policy.defaultCohort;
  return {
    allowed: false,
    statusCode,
    reason,
    message,
    cohortKey,
    windowKey: now.toISOString().slice(0, 10),
    policy,
  };
}

export async function evaluateBetaCohortGate(
  input: BetaCohortGateInput,
  options: {
    db?: FirestoreLike;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<BetaCohortDecision> {
  const db = options.db ?? defaultDb;
  const policy = getBetaCohortPolicySnapshot(options.env);
  const now = input.now || new Date();
  const cohortKey =
    normalizeToken(input.market)
    || normalizeToken(input.siteType)
    || policy.defaultCohort;
  const windowKey = now.toISOString().slice(0, 10);

  if (!policy.enabled) {
    return blockedDecision(
      input,
      policy.killSwitchActive ? "beta_kill_switch_active" : "beta_disabled",
      503,
      "Blueprint beta access is temporarily paused.",
      policy,
    );
  }

  if (!includesAllowed(policy.allowedMarkets, input.market)) {
    return blockedDecision(
      input,
      "market_outside_beta_scope",
      403,
      "This market is outside the current beta cohort scope.",
      policy,
    );
  }

  if (!includesAllowed(policy.allowedSiteTypes, input.siteType)) {
    return blockedDecision(
      input,
      "site_type_outside_beta_scope",
      403,
      "This site type is outside the current beta cohort scope.",
      policy,
    );
  }

  if (!db) {
    return blockedDecision(
      input,
      "beta_policy_store_unavailable",
      503,
      "Blueprint beta access controls are temporarily unavailable.",
      policy,
    );
  }

  if (policy.inviteCap > 0 && input.gate === "waitlist") {
    const acceptedCount = await countCollectionDocs(
      db,
      "waitlistSubmissions",
      "queue",
      "capturer_beta_review",
      (data) => String(data.status || "new") !== "rejected",
    );
    if (acceptedCount >= policy.inviteCap) {
      return blockedDecision(
        input,
        "beta_invite_cap_reached",
        429,
        "The current beta cohort is full.",
        policy,
      );
    }
  }

  if (policy.cohortDailyLimit > 0) {
    const admittedToday = await countCollectionDocs(
      db,
      "betaCohortAdmissions",
      "cohort_key",
      cohortKey,
      (data) => String(data.window_key || "") === windowKey,
    );
    if (admittedToday >= policy.cohortDailyLimit) {
      return blockedDecision(
        input,
        "beta_cohort_daily_limit_reached",
        429,
        "This beta cohort has reached today's intake limit.",
        policy,
      );
    }
  }

  return {
    allowed: true,
    statusCode: 200,
    reason: "allowed",
    message: "Beta cohort gate allowed.",
    cohortKey,
    windowKey,
    policy,
  };
}

export function betaDecisionForResponse(decision: BetaCohortDecision) {
  return {
    allowed: decision.allowed,
    reason: decision.reason,
    cohort_key: decision.cohortKey,
    window_key: decision.windowKey,
    invite_cap: decision.policy.inviteCap,
    cohort_daily_limit: decision.policy.cohortDailyLimit,
    kill_switch_active: decision.policy.killSwitchActive,
    allowed_markets: decision.policy.allowedMarkets,
    allowed_site_types: decision.policy.allowedSiteTypes,
  };
}

export async function recordBetaCohortAdmission(
  input: BetaCohortGateInput & {
    decision: BetaCohortDecision;
    admissionId: string;
  },
  db: FirestoreLike = defaultDb,
) {
  if (!db || !input.decision.allowed) {
    return { recorded: false };
  }
  await db.collection("betaCohortAdmissions").doc(input.admissionId).set(
    {
      id: input.admissionId,
      gate: input.gate,
      creator_id: input.creatorId || null,
      email: input.email || null,
      market: input.market || null,
      site_type: input.siteType || null,
      source: input.source || null,
      cohort_key: input.decision.cohortKey,
      window_key: input.decision.windowKey,
      beta_policy: betaDecisionForResponse(input.decision),
      admitted_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { recorded: true };
}
