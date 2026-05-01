import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  getConfiguredEnvValue,
  isEnvFlagEnabled,
  requireConfiguredEnvValue,
} from "../config/env";

export const META_ADS_CLI_PROVENANCE_COLLECTION = "meta_ads_cli_runs";

export type MetaAdsCliAction =
  | "adaccount_list"
  | "page_list"
  | "campaign_list"
  | "insights_get"
  | "dataset_list"
  | "catalog_list"
  | "campaign_create_paused"
  | "adset_create_paused"
  | "creative_create"
  | "ad_create_paused";

export type MetaAdsCliMode = "read_only" | "paused_draft";

export interface MetaAdsCliCommandContext {
  city?: string | null;
  launchId?: string | null;
  adStudioRunId?: string | null;
  ledgerLink?: string | null;
  accountId?: string | null;
  businessId?: string | null;
  pageId?: string | null;
  campaignId?: string | null;
  adSetId?: string | null;
  creativeId?: string | null;
  adId?: string | null;
  budgetMinorUnits?: number | null;
  objective?: string | null;
  status?: "PAUSED" | null;
}

export interface MetaAdsCliProvenanceRecord {
  id: string;
  schemaVersion: 1;
  action: MetaAdsCliAction;
  mode: MetaAdsCliMode;
  city: string | null;
  launchId: string | null;
  adStudioRunId: string | null;
  ledgerLink: string | null;
  accountId: string | null;
  businessId: string | null;
  pageId: string | null;
  campaignId: string | null;
  adSetId: string | null;
  creativeId: string | null;
  adId: string | null;
  budgetMinorUnits: number | null;
  objective: string | null;
  status: "PAUSED" | null;
  sanitizedCommand: string;
  output: unknown;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  createdAtIso: string;
}

export interface MetaAdsCliProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut?: boolean;
}

export interface MetaAdsCliExecutorOptions {
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  cwd?: string | null;
}

export type MetaAdsCliExecutor = (
  command: string,
  args: string[],
  options: MetaAdsCliExecutorOptions,
) => Promise<MetaAdsCliProcessResult>;

export interface MetaAdsCliCommandResult<TOutput = unknown> {
  output: TOutput;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  provenance: MetaAdsCliProvenanceRecord;
}

export interface ListMetaAdsInput {
  limit?: number | null;
  city?: string | null;
  launchId?: string | null;
  ledgerLink?: string | null;
  accountId?: string | null;
  businessId?: string | null;
}

export interface GetMetaAdsInsightsInput extends ListMetaAdsInput {
  fields?: string | string[] | null;
  datePreset?: string | null;
  since?: string | null;
  until?: string | null;
  timeIncrement?: string | null;
  breakdowns?: string[] | null;
  campaignId?: string | null;
  adSetId?: string | null;
  adId?: string | null;
  sort?: string | null;
}

export interface CreatePausedMetaAdsCliDraftInput {
  accountId?: string | null;
  campaignName: string;
  objective: string;
  dailyBudgetMinorUnits: number;
  primaryText: string;
  headline: string;
  destinationUrl: string;
  pageId?: string | null;
  mediaPath: string;
  mediaType?: "image" | "video" | null;
  adSetName?: string | null;
  creativeName?: string | null;
  adName?: string | null;
  targetingCountries?: string[] | null;
  callToAction?: string | null;
  pixelId?: string | null;
  customEventType?: string | null;
  city?: string | null;
  launchId?: string | null;
  adStudioRunId?: string | null;
  ledgerLink?: string | null;
}

export interface CreateMetaAdsCliCreativeInput {
  accountId?: string | null;
  name: string;
  pageId?: string | null;
  body?: string | null;
  title?: string | null;
  linkUrl: string;
  description?: string | null;
  callToAction?: string | null;
  mediaPath?: string | null;
  mediaType?: "image" | "video" | null;
  dynamicCreative?: {
    imagePaths?: string[] | null;
    videoPaths?: string[] | null;
    titles?: string[] | null;
    bodies?: string[] | null;
    descriptions?: string[] | null;
    callToActions?: string[] | null;
  } | null;
  context?: MetaAdsCliCommandContext | null;
}

const DEFAULT_META_ADS_CLI_BIN = "meta";
const DEFAULT_META_ADS_CLI_TIMEOUT_MS = 120_000;
const DEFAULT_META_ADS_MAX_DAILY_BUDGET_USD = 250;
const DEFAULT_TARGETING_COUNTRIES = ["US"];

const READ_ONLY_ACTIONS = new Set<MetaAdsCliAction>([
  "adaccount_list",
  "page_list",
  "campaign_list",
  "insights_get",
  "dataset_list",
  "catalog_list",
]);

const OBJECTIVE_ALIASES: Record<string, string> = {
  OUTCOME_APP_PROMOTION: "outcome_app_promotion",
  OUTCOME_AWARENESS: "outcome_awareness",
  OUTCOME_ENGAGEMENT: "outcome_engagement",
  OUTCOME_LEADS: "outcome_leads",
  OUTCOME_SALES: "outcome_sales",
  OUTCOME_TRAFFIC: "outcome_traffic",
};

const ALLOWED_OBJECTIVES = new Set(Object.values(OBJECTIVE_ALIASES));
const ALLOWED_TIME_INCREMENTS = new Set(["daily", "weekly", "monthly", "all_days"]);
const ALLOWED_DATE_PRESETS = new Set([
  "today",
  "yesterday",
  "last_3d",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
]);
const ALLOWED_BREAKDOWNS = new Set([
  "age",
  "gender",
  "country",
  "publisher_platform",
  "device_platform",
  "platform_position",
  "impression_device",
]);
const ALLOWED_CALL_TO_ACTIONS = new Set([
  "apply_now",
  "book_travel",
  "buy_now",
  "contact_us",
  "download",
  "get_offer",
  "get_quote",
  "learn_more",
  "no_button",
  "open_link",
  "shop_now",
  "sign_up",
  "subscribe",
  "watch_more",
]);
const ALLOWED_CUSTOM_EVENT_TYPES = new Set([
  "add_payment_info",
  "add_to_cart",
  "add_to_wishlist",
  "complete_registration",
  "contact",
  "content_view",
  "customize_product",
  "donate",
  "find_location",
  "initiated_checkout",
  "lead",
  "other",
  "purchase",
  "schedule",
  "search",
  "start_trial",
  "submit_application",
  "subscribe",
]);

function serverTimestampValue() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date();
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown) {
  return normalizeString(value) || null;
}

function normalizeStringArray(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return values
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry, index, items) => entry.length > 0 && items.indexOf(entry) === index);
}

function normalizeAccountId(accountId: unknown) {
  return normalizeString(accountId).replace(/^act_/i, "");
}

function normalizePositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function normalizeBudgetMinorUnits(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Meta Ads CLI paused drafts require a positive budget in cents.");
  }
  return Math.round(parsed);
}

function normalizeObjective(value: unknown) {
  const raw = normalizeString(value);
  const aliased = OBJECTIVE_ALIASES[raw.toUpperCase()] || raw.toLowerCase();
  if (!ALLOWED_OBJECTIVES.has(aliased)) {
    throw new Error(`Unsupported Meta Ads CLI objective: ${raw || "missing"}.`);
  }
  return aliased;
}

function normalizeCallToAction(value: unknown) {
  const normalized = normalizeString(value).toLowerCase() || "learn_more";
  if (!ALLOWED_CALL_TO_ACTIONS.has(normalized)) {
    throw new Error(`Unsupported Meta Ads CLI call to action: ${normalized}.`);
  }
  return normalized;
}

function normalizeCustomEventType(value: unknown) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return null;
  }
  if (!ALLOWED_CUSTOM_EVENT_TYPES.has(normalized)) {
    throw new Error(`Unsupported Meta Ads CLI custom event type: ${normalized}.`);
  }
  return normalized;
}

function normalizeMediaType(mediaPath: string, mediaType: unknown): "image" | "video" {
  const explicit = normalizeString(mediaType).toLowerCase();
  if (explicit === "image" || explicit === "video") {
    return explicit;
  }
  if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(mediaPath)) {
    return "image";
  }
  if (/\.(mp4|mov|avi|mkv|wmv)$/i.test(mediaPath)) {
    return "video";
  }
  throw new Error("Meta Ads CLI media path must include a supported image or video extension.");
}

function assertLocalFile(path: string, label: string) {
  if (!path || !existsSync(path)) {
    throw new Error(`Meta Ads CLI ${label} must be a local file path that exists.`);
  }
}

function metaAdsCliBin() {
  return getConfiguredEnvValue("META_ADS_CLI_BIN") || DEFAULT_META_ADS_CLI_BIN;
}

function metaAdsCliTimeoutMs() {
  const configured = Number(getConfiguredEnvValue("META_ADS_CLI_TIMEOUT_MS"));
  return Number.isFinite(configured) && configured > 0
    ? Math.round(configured)
    : DEFAULT_META_ADS_CLI_TIMEOUT_MS;
}

function metaAdsMaxDailyBudgetUsd() {
  const configured = Number(getConfiguredEnvValue("META_ADS_MAX_DAILY_BUDGET_USD"));
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_META_ADS_MAX_DAILY_BUDGET_USD;
}

function metaAdsAccessToken() {
  return requireConfiguredEnvValue(
    ["META_ADS_ACCESS_TOKEN", "META_MARKETING_API_ACCESS_TOKEN"],
    "Meta Ads CLI",
  );
}

function configuredAccountId(explicit?: string | null) {
  return (
    normalizeAccountId(explicit)
    || normalizeAccountId(getConfiguredEnvValue("META_ADS_AD_ACCOUNT_ID"))
    || normalizeAccountId(getConfiguredEnvValue("META_AD_ACCOUNT_ID"))
  );
}

function configuredBusinessId(explicit?: string | null) {
  return normalizeString(explicit) || getConfiguredEnvValue("META_ADS_BUSINESS_ID") || "";
}

function assertMetaAdsCliEnabled() {
  if (!isEnvFlagEnabled("META_ADS_CLI_ENABLED")) {
    throw new Error("Meta Ads CLI is disabled. Set META_ADS_CLI_ENABLED=1 to use this adapter.");
  }
}

function assertDailyBudgetPolicy(dailyBudgetMinorUnits: number) {
  const normalized = normalizeBudgetMinorUnits(dailyBudgetMinorUnits);
  const dollars = normalized / 100;
  const maxDollars = metaAdsMaxDailyBudgetUsd();
  if (dollars > maxDollars) {
    throw new Error(
      `Meta Ads CLI paused draft budget $${dollars.toFixed(2)} exceeds the configured policy ceiling of $${maxDollars.toFixed(2)}.`,
    );
  }
  return normalized;
}

function buildMetaAdsCliEnv(input?: { accountId?: string | null; businessId?: string | null }) {
  const accessToken = metaAdsAccessToken();
  const accountId = configuredAccountId(input?.accountId);
  const businessId = configuredBusinessId(input?.businessId);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ACCESS_TOKEN: accessToken,
  };
  if (accountId) {
    env.AD_ACCOUNT_ID = accountId;
  }
  if (businessId) {
    env.BUSINESS_ID = businessId;
  }
  return {
    env,
    accessToken,
    accountId: accountId || null,
    businessId: businessId || null,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactText(value: string, secrets: string[]) {
  return secrets
    .filter(Boolean)
    .reduce((text, secret) => text.replace(new RegExp(escapeRegExp(secret), "g"), "[REDACTED]"), value);
}

function shellArg(value: string) {
  if (/^[A-Za-z0-9_./:=,@%-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function formatSanitizedCommand(command: string, args: string[], secrets: string[]) {
  return redactText([command, ...args].map(shellArg).join(" "), secrets);
}

function parseCliJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { raw: trimmed };
  }
}

function normalizeLimitArgs(limit: number | null | undefined, fallback: number, max: number) {
  return ["--limit", String(normalizePositiveInt(limit, fallback, max))];
}

function appendIf(args: string[], flag: string, value: string | null | undefined) {
  if (value) {
    args.push(flag, value);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractMetaId(output: unknown): string {
  if (Array.isArray(output)) {
    for (const entry of output) {
      const nested = extractMetaId(entry);
      if (nested) {
        return nested;
      }
    }
    return "";
  }

  if (!isObject(output)) {
    return "";
  }

  for (const key of ["id", "campaign_id", "adset_id", "creative_id", "ad_id"]) {
    const value = output[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  for (const value of Object.values(output)) {
    const nested = extractMetaId(value);
    if (nested) {
      return nested;
    }
  }

  return "";
}

function outputContextForAction(
  action: MetaAdsCliAction,
  output: unknown,
): Partial<MetaAdsCliCommandContext> {
  const id = extractMetaId(output);
  if (!id) {
    return {};
  }
  if (action === "campaign_create_paused") {
    return { campaignId: id };
  }
  if (action === "adset_create_paused") {
    return { adSetId: id };
  }
  if (action === "creative_create") {
    return { creativeId: id };
  }
  if (action === "ad_create_paused") {
    return { adId: id };
  }
  return {};
}

function normalizeFields(value: string | string[] | null | undefined) {
  const values = Array.isArray(value)
    ? value
    : normalizeString(value)
      ? normalizeString(value).split(",")
      : ["spend", "impressions", "clicks", "ctr", "cpc", "reach"];
  const fields = normalizeStringArray(values)
    .map((field) => field.toLowerCase())
    .filter((field) => /^[a-z0-9_]+$/.test(field));
  if (fields.length === 0) {
    throw new Error("Meta Ads CLI insights require at least one valid field.");
  }
  return fields.join(",");
}

function normalizeDate(value: unknown, label: string) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Meta Ads CLI ${label} must use YYYY-MM-DD format.`);
  }
  return normalized;
}

function normalizeBreakdowns(value: string[] | null | undefined) {
  return normalizeStringArray(value).map((entry) => {
    const normalized = entry.toLowerCase();
    if (!ALLOWED_BREAKDOWNS.has(normalized)) {
      throw new Error(`Unsupported Meta Ads CLI insights breakdown: ${entry}.`);
    }
    return normalized;
  });
}

function normalizeTargetingCountries(value: string[] | null | undefined) {
  const countries = normalizeStringArray(value).map((entry) => entry.toUpperCase());
  return countries.length > 0 ? countries : DEFAULT_TARGETING_COUNTRIES;
}

function assertDcoLimits(input: NonNullable<CreateMetaAdsCliCreativeInput["dynamicCreative"]>) {
  const imagePaths = normalizeStringArray(input.imagePaths);
  const videoPaths = normalizeStringArray(input.videoPaths);
  const titles = normalizeStringArray(input.titles);
  const bodies = normalizeStringArray(input.bodies);
  const descriptions = normalizeStringArray(input.descriptions);
  const callToActions = normalizeStringArray(input.callToActions);

  if (imagePaths.length + videoPaths.length === 0) {
    throw new Error("Meta Ads CLI DCO creative requires at least one image or video path.");
  }
  if (imagePaths.length + videoPaths.length > 10) {
    throw new Error("Meta Ads CLI DCO creative supports at most 10 images/videos.");
  }
  if (titles.length > 5 || bodies.length > 5 || descriptions.length > 5 || callToActions.length > 5) {
    throw new Error("Meta Ads CLI DCO creative supports at most 5 titles, bodies, descriptions, and CTAs.");
  }

  for (const path of [...imagePaths, ...videoPaths]) {
    assertLocalFile(path, "DCO media");
  }

  return {
    imagePaths,
    videoPaths,
    titles,
    bodies,
    descriptions,
    callToActions: callToActions.map(normalizeCallToAction),
  };
}

export const defaultMetaAdsCliExecutor: MetaAdsCliExecutor = async (
  command,
  args,
  options,
) => {
  return await new Promise<MetaAdsCliProcessResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | null = null;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1500);
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: timedOut ? 124 : code,
        signal: timedOut ? "SIGTERM" : signal,
        timedOut,
      });
    });
  });
};

async function persistMetaAdsCliProvenance(input: Omit<MetaAdsCliProvenanceRecord, "id">) {
  if (!db) {
    throw new Error("Database not available");
  }
  const ref = db.collection(META_ADS_CLI_PROVENANCE_COLLECTION).doc();
  const record: MetaAdsCliProvenanceRecord = {
    id: ref.id,
    ...input,
  };
  await ref.set({
    ...record,
    created_at: serverTimestampValue(),
  });
  return record;
}

async function executeAllowedMetaAdsCli<TOutput = unknown>(input: {
  action: MetaAdsCliAction;
  args: string[];
  context?: MetaAdsCliCommandContext | null;
  executor?: MetaAdsCliExecutor | null;
  accountId?: string | null;
  businessId?: string | null;
}) {
  assertMetaAdsCliEnabled();

  const command = metaAdsCliBin();
  const accountId = configuredAccountId(input.accountId || input.context?.accountId);
  const businessId = configuredBusinessId(input.businessId || input.context?.businessId);
  const { env, accessToken } = buildMetaAdsCliEnv({ accountId, businessId });
  const secrets = [accessToken, getConfiguredEnvValue("META_MARKETING_API_ACCESS_TOKEN") || ""];
  const args = ["--output", "json", "--no-input", ...input.args];
  const sanitizedCommand = formatSanitizedCommand(command, args, secrets);
  const executor = input.executor || defaultMetaAdsCliExecutor;
  let processResult: MetaAdsCliProcessResult;

  try {
    processResult = await executor(command, args, {
      env,
      timeoutMs: metaAdsCliTimeoutMs(),
      cwd: process.cwd(),
    });
  } catch (error) {
    processResult = {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: null,
      signal: null,
      timedOut: false,
    };
  }

  const safeStdout = redactText(processResult.stdout, secrets);
  const safeStderr = redactText(processResult.stderr, secrets);
  const output = parseCliJson(safeStdout);
  const context = {
    ...(input.context || {}),
    ...outputContextForAction(input.action, output),
  };
  const mode: MetaAdsCliMode = READ_ONLY_ACTIONS.has(input.action) ? "read_only" : "paused_draft";
  const provenance = await persistMetaAdsCliProvenance({
    schemaVersion: 1,
    action: input.action,
    mode,
    city: normalizeNullableString(context.city),
    launchId: normalizeNullableString(context.launchId),
    adStudioRunId: normalizeNullableString(context.adStudioRunId),
    ledgerLink: normalizeNullableString(context.ledgerLink),
    accountId: normalizeAccountId(context.accountId) || accountId || null,
    businessId: normalizeNullableString(context.businessId) || businessId || null,
    pageId: normalizeNullableString(context.pageId),
    campaignId: normalizeNullableString(context.campaignId),
    adSetId: normalizeNullableString(context.adSetId),
    creativeId: normalizeNullableString(context.creativeId),
    adId: normalizeNullableString(context.adId),
    budgetMinorUnits: typeof context.budgetMinorUnits === "number" ? context.budgetMinorUnits : null,
    objective: normalizeNullableString(context.objective),
    status: context.status || null,
    sanitizedCommand,
    output,
    stdout: safeStdout,
    stderr: safeStderr,
    exitCode: processResult.exitCode,
    signal: processResult.signal,
    timedOut: Boolean(processResult.timedOut),
    createdAtIso: new Date().toISOString(),
  });

  if (processResult.exitCode !== 0) {
    const detail = safeStderr || safeStdout || "no output";
    throw new Error(
      `Meta Ads CLI ${input.action} failed with exit ${processResult.exitCode ?? "unknown"}; provenance ${provenance.id}: ${detail.slice(0, 500)}`,
    );
  }

  return {
    output: output as TOutput,
    stdout: safeStdout,
    stderr: safeStderr,
    exitCode: processResult.exitCode,
    signal: processResult.signal,
    provenance,
  } satisfies MetaAdsCliCommandResult<TOutput>;
}

export function getMetaAdsCliStatus() {
  const accountId = configuredAccountId();
  const businessId = configuredBusinessId();
  return {
    enabled: isEnvFlagEnabled("META_ADS_CLI_ENABLED"),
    binary: metaAdsCliBin(),
    accessTokenConfigured: Boolean(
      getConfiguredEnvValue("META_ADS_ACCESS_TOKEN")
      || getConfiguredEnvValue("META_MARKETING_API_ACCESS_TOKEN"),
    ),
    adAccountConfigured: Boolean(accountId),
    businessIdConfigured: Boolean(businessId),
    accountId: accountId ? `act_${accountId}` : null,
    maxDailyBudgetUsd: metaAdsMaxDailyBudgetUsd(),
    timeoutMs: metaAdsCliTimeoutMs(),
    provenanceCollection: META_ADS_CLI_PROVENANCE_COLLECTION,
    allowedActions: [
      "adaccount list",
      "page list",
      "campaign list",
      "insights get",
      "dataset list",
      "catalog list",
      "campaign/adset/creative/ad create with paused status only",
    ],
  };
}

export async function listMetaAdsAdAccounts(
  input: ListMetaAdsInput = {},
  executor?: MetaAdsCliExecutor,
) {
  return await executeAllowedMetaAdsCli({
    action: "adaccount_list",
    args: ["ads", "adaccount", "list", ...normalizeLimitArgs(input.limit, 25, 100)],
    context: input,
    executor,
  });
}

export async function listMetaAdsPages(
  input: ListMetaAdsInput = {},
  executor?: MetaAdsCliExecutor,
) {
  return await executeAllowedMetaAdsCli({
    action: "page_list",
    args: ["ads", "page", "list", ...normalizeLimitArgs(input.limit, 25, 100)],
    context: input,
    executor,
  });
}

export async function listMetaAdsCampaigns(
  input: ListMetaAdsInput = {},
  executor?: MetaAdsCliExecutor,
) {
  const accountId = configuredAccountId(input.accountId);
  if (!accountId) {
    throw new Error("Meta Ads CLI campaign list requires META_ADS_AD_ACCOUNT_ID or META_AD_ACCOUNT_ID.");
  }
  return await executeAllowedMetaAdsCli({
    action: "campaign_list",
    args: ["ads", "campaign", "list", ...normalizeLimitArgs(input.limit, 10, 100)],
    context: {
      ...input,
      accountId,
    },
    accountId,
    executor,
  });
}

export async function listMetaAdsDatasets(
  input: ListMetaAdsInput = {},
  executor?: MetaAdsCliExecutor,
) {
  const accountId = configuredAccountId(input.accountId);
  const businessId = configuredBusinessId(input.businessId);
  if (!accountId && !businessId) {
    throw new Error("Meta Ads CLI dataset list requires an ad account id or business id.");
  }
  return await executeAllowedMetaAdsCli({
    action: "dataset_list",
    args: ["ads", "dataset", "list", ...normalizeLimitArgs(input.limit, 25, 100)],
    context: {
      ...input,
      accountId,
      businessId,
    },
    accountId,
    businessId,
    executor,
  });
}

export async function listMetaAdsCatalogs(
  input: ListMetaAdsInput = {},
  executor?: MetaAdsCliExecutor,
) {
  const businessId = configuredBusinessId(input.businessId);
  if (!businessId) {
    throw new Error("Meta Ads CLI catalog list requires META_ADS_BUSINESS_ID.");
  }
  return await executeAllowedMetaAdsCli({
    action: "catalog_list",
    args: ["ads", "catalog", "list", ...normalizeLimitArgs(input.limit, 25, 100)],
    context: {
      ...input,
      businessId,
    },
    businessId,
    executor,
  });
}

export async function getMetaAdsInsights(
  input: GetMetaAdsInsightsInput = {},
  executor?: MetaAdsCliExecutor,
) {
  const accountId = configuredAccountId(input.accountId);
  if (!accountId) {
    throw new Error("Meta Ads CLI insights require META_ADS_AD_ACCOUNT_ID or META_AD_ACCOUNT_ID.");
  }

  const datePreset = normalizeString(input.datePreset).toLowerCase() || "last_30d";
  if (!ALLOWED_DATE_PRESETS.has(datePreset)) {
    throw new Error(`Unsupported Meta Ads CLI date preset: ${datePreset}.`);
  }

  const timeIncrement = normalizeString(input.timeIncrement).toLowerCase() || "all_days";
  if (!ALLOWED_TIME_INCREMENTS.has(timeIncrement)) {
    throw new Error(`Unsupported Meta Ads CLI time increment: ${timeIncrement}.`);
  }

  const args = [
    "ads",
    "insights",
    "get",
    "--fields",
    normalizeFields(input.fields),
    "--date-preset",
    datePreset,
    "--time-increment",
    timeIncrement,
    ...normalizeLimitArgs(input.limit, 50, 500),
  ];
  appendIf(args, "--since", normalizeDate(input.since, "since"));
  appendIf(args, "--until", normalizeDate(input.until, "until"));
  for (const breakdown of normalizeBreakdowns(input.breakdowns)) {
    args.push("--breakdown", breakdown);
  }
  appendIf(args, "--campaign-id", normalizeString(input.campaignId));
  appendIf(args, "--adset-id", normalizeString(input.adSetId));
  appendIf(args, "--ad-id", normalizeString(input.adId));
  appendIf(args, "--sort", normalizeString(input.sort));

  return await executeAllowedMetaAdsCli({
    action: "insights_get",
    args,
    context: {
      ...input,
      accountId,
      campaignId: normalizeString(input.campaignId) || null,
      adSetId: normalizeString(input.adSetId) || null,
      adId: normalizeString(input.adId) || null,
    },
    accountId,
    executor,
  });
}

export async function createPausedMetaAdsCliCampaign(input: {
  accountId?: string | null;
  campaignName: string;
  objective: string;
  dailyBudgetMinorUnits: number;
  context?: MetaAdsCliCommandContext | null;
}, executor?: MetaAdsCliExecutor) {
  const accountId = configuredAccountId(input.accountId);
  if (!accountId) {
    throw new Error("Meta Ads CLI campaign create requires an ad account id.");
  }
  const campaignName = normalizeString(input.campaignName);
  if (!campaignName) {
    throw new Error("Meta Ads CLI campaign create requires a campaign name.");
  }
  const dailyBudgetMinorUnits = assertDailyBudgetPolicy(input.dailyBudgetMinorUnits);
  const objective = normalizeObjective(input.objective);
  const result = await executeAllowedMetaAdsCli({
    action: "campaign_create_paused",
    args: [
      "ads",
      "campaign",
      "create",
      "--name",
      campaignName,
      "--objective",
      objective,
      "--adset-budget-sharing",
      "--status",
      "paused",
    ],
    context: {
      ...input.context,
      accountId,
      budgetMinorUnits: dailyBudgetMinorUnits,
      objective,
      status: "PAUSED",
    },
    accountId,
    executor,
  });
  return {
    ...result,
    campaignId: extractMetaId(result.output),
  };
}

export async function createPausedMetaAdsCliAdSet(input: {
  accountId?: string | null;
  campaignId: string;
  name: string;
  dailyBudgetMinorUnits: number;
  targetingCountries?: string[] | null;
  pixelId?: string | null;
  customEventType?: string | null;
  context?: MetaAdsCliCommandContext | null;
}, executor?: MetaAdsCliExecutor) {
  const accountId = configuredAccountId(input.accountId);
  if (!accountId) {
    throw new Error("Meta Ads CLI ad set create requires an ad account id.");
  }
  const campaignId = normalizeString(input.campaignId);
  const name = normalizeString(input.name);
  if (!campaignId || !name) {
    throw new Error("Meta Ads CLI ad set create requires a campaign id and name.");
  }
  const dailyBudgetMinorUnits = assertDailyBudgetPolicy(input.dailyBudgetMinorUnits);
  const args = [
    "ads",
    "adset",
    "create",
    campaignId,
    "--name",
    name,
    "--optimization-goal",
    "link_clicks",
    "--billing-event",
    "impressions",
    "--daily-budget",
    String(dailyBudgetMinorUnits),
    "--status",
    "paused",
    "--targeting-countries",
    normalizeTargetingCountries(input.targetingCountries).join(","),
  ];
  appendIf(args, "--pixel-id", normalizeString(input.pixelId));
  appendIf(args, "--custom-event-type", normalizeCustomEventType(input.customEventType));

  const result = await executeAllowedMetaAdsCli({
    action: "adset_create_paused",
    args,
    context: {
      ...input.context,
      accountId,
      campaignId,
      budgetMinorUnits: dailyBudgetMinorUnits,
      status: "PAUSED",
    },
    accountId,
    executor,
  });
  return {
    ...result,
    adSetId: extractMetaId(result.output),
  };
}

export async function createMetaAdsCliCreative(
  input: CreateMetaAdsCliCreativeInput,
  executor?: MetaAdsCliExecutor,
) {
  const accountId = configuredAccountId(input.accountId);
  if (!accountId) {
    throw new Error("Meta Ads CLI creative create requires an ad account id.");
  }
  const name = normalizeString(input.name);
  const pageId = normalizeString(input.pageId) || getConfiguredEnvValue("META_PAGE_ID") || "";
  const linkUrl = normalizeString(input.linkUrl);
  if (!name || !pageId || !linkUrl) {
    throw new Error("Meta Ads CLI creative create requires name, page id, and destination URL.");
  }

  const args = [
    "ads",
    "creative",
    "create",
    "--name",
    name,
    "--page-id",
    pageId,
    "--link-url",
    linkUrl,
  ];

  if (input.dynamicCreative) {
    const dco = assertDcoLimits(input.dynamicCreative);
    for (const path of dco.imagePaths) args.push("--images", path);
    for (const path of dco.videoPaths) args.push("--videos", path);
    for (const title of dco.titles) args.push("--titles", title);
    for (const body of dco.bodies) args.push("--bodies", body);
    for (const description of dco.descriptions) args.push("--descriptions", description);
    for (const cta of dco.callToActions) args.push("--call-to-actions", cta);
  } else {
    const mediaPath = normalizeString(input.mediaPath);
    const body = normalizeString(input.body);
    const title = normalizeString(input.title);
    if (!mediaPath || !body || !title) {
      throw new Error("Meta Ads CLI standard creative requires media path, body, and title.");
    }
    assertLocalFile(mediaPath, "creative media");
    const mediaType = normalizeMediaType(mediaPath, input.mediaType);
    args.push(mediaType === "image" ? "--image" : "--video", mediaPath);
    args.push("--body", body, "--title", title);
    appendIf(args, "--description", normalizeString(input.description));
    args.push("--call-to-action", normalizeCallToAction(input.callToAction));
  }

  const result = await executeAllowedMetaAdsCli({
    action: "creative_create",
    args,
    context: {
      ...input.context,
      accountId,
      pageId,
    },
    accountId,
    executor,
  });
  return {
    ...result,
    creativeId: extractMetaId(result.output),
  };
}

export async function createPausedMetaAdsCliAd(input: {
  accountId?: string | null;
  adSetId: string;
  name: string;
  creativeId: string;
  pixelId?: string | null;
  context?: MetaAdsCliCommandContext | null;
}, executor?: MetaAdsCliExecutor) {
  const accountId = configuredAccountId(input.accountId);
  if (!accountId) {
    throw new Error("Meta Ads CLI ad create requires an ad account id.");
  }
  const adSetId = normalizeString(input.adSetId);
  const name = normalizeString(input.name);
  const creativeId = normalizeString(input.creativeId);
  if (!adSetId || !name || !creativeId) {
    throw new Error("Meta Ads CLI ad create requires an ad set id, name, and creative id.");
  }
  const args = [
    "ads",
    "ad",
    "create",
    adSetId,
    "--name",
    name,
    "--creative-id",
    creativeId,
    "--status",
    "paused",
  ];
  appendIf(args, "--pixel-id", normalizeString(input.pixelId));

  const result = await executeAllowedMetaAdsCli({
    action: "ad_create_paused",
    args,
    context: {
      ...input.context,
      accountId,
      adSetId,
      creativeId,
      status: "PAUSED",
    },
    accountId,
    executor,
  });
  return {
    ...result,
    adId: extractMetaId(result.output),
  };
}

export async function createPausedMetaAdsCliDraft(
  input: CreatePausedMetaAdsCliDraftInput,
  executor?: MetaAdsCliExecutor,
) {
  const accountId = configuredAccountId(input.accountId);
  if (!accountId) {
    throw new Error("Meta Ads CLI paused draft requires an ad account id.");
  }
  const campaignName = normalizeString(input.campaignName);
  const destinationUrl = normalizeString(input.destinationUrl);
  const primaryText = normalizeString(input.primaryText);
  const headline = normalizeString(input.headline);
  const pageId = normalizeString(input.pageId) || getConfiguredEnvValue("META_PAGE_ID") || "";
  const mediaPath = normalizeString(input.mediaPath);
  const mediaType = normalizeMediaType(mediaPath, input.mediaType);
  const dailyBudgetMinorUnits = assertDailyBudgetPolicy(input.dailyBudgetMinorUnits);

  if (!campaignName || !destinationUrl || !primaryText || !headline || !pageId || !mediaPath) {
    throw new Error(
      "Meta Ads CLI paused draft requires campaign name, destination URL, creative copy, page id, media path, and budget.",
    );
  }

  const commonContext: MetaAdsCliCommandContext = {
    city: input.city || null,
    launchId: input.launchId || null,
    adStudioRunId: input.adStudioRunId || null,
    ledgerLink: input.ledgerLink || null,
    accountId,
    pageId,
    budgetMinorUnits: dailyBudgetMinorUnits,
    objective: normalizeObjective(input.objective),
    status: "PAUSED",
  };

  const campaign = await createPausedMetaAdsCliCampaign({
    accountId,
    campaignName,
    objective: input.objective,
    dailyBudgetMinorUnits,
    context: commonContext,
  }, executor);
  if (!campaign.campaignId) {
    throw new Error(`Meta Ads CLI campaign create did not return a campaign id; provenance ${campaign.provenance.id}.`);
  }

  const adSet = await createPausedMetaAdsCliAdSet({
    accountId,
    campaignId: campaign.campaignId,
    name: normalizeString(input.adSetName) || `${campaignName} Ad Set`,
    dailyBudgetMinorUnits,
    targetingCountries: input.targetingCountries,
    pixelId: input.pixelId,
    customEventType: input.customEventType,
    context: {
      ...commonContext,
      campaignId: campaign.campaignId,
    },
  }, executor);
  if (!adSet.adSetId) {
    throw new Error(`Meta Ads CLI ad set create did not return an ad set id; provenance ${adSet.provenance.id}.`);
  }

  const creative = await createMetaAdsCliCreative({
    accountId,
    name: normalizeString(input.creativeName) || `${campaignName} Creative`,
    pageId,
    body: primaryText,
    title: headline,
    linkUrl: destinationUrl,
    callToAction: input.callToAction,
    mediaPath,
    mediaType,
    context: {
      ...commonContext,
      campaignId: campaign.campaignId,
      adSetId: adSet.adSetId,
    },
  }, executor);
  if (!creative.creativeId) {
    throw new Error(`Meta Ads CLI creative create did not return a creative id; provenance ${creative.provenance.id}.`);
  }

  const ad = await createPausedMetaAdsCliAd({
    accountId,
    adSetId: adSet.adSetId,
    name: normalizeString(input.adName) || `${campaignName} Ad`,
    creativeId: creative.creativeId,
    pixelId: input.pixelId,
    context: {
      ...commonContext,
      campaignId: campaign.campaignId,
      adSetId: adSet.adSetId,
      creativeId: creative.creativeId,
    },
  }, executor);
  if (!ad.adId) {
    throw new Error(`Meta Ads CLI ad create did not return an ad id; provenance ${ad.provenance.id}.`);
  }

  return {
    accountId,
    campaignId: campaign.campaignId,
    adSetId: adSet.adSetId,
    creativeId: creative.creativeId,
    adId: ad.adId,
    status: "PAUSED" as const,
    ledgerLink: input.ledgerLink || null,
    provenanceIds: [
      campaign.provenance.id,
      adSet.provenance.id,
      creative.provenance.id,
      ad.provenance.id,
    ],
  };
}
