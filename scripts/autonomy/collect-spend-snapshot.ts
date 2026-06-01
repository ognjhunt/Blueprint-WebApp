#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

const DEFAULT_REGISTRY_PATH = "config/autonomy/spend-sources.yaml";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/spend-snapshots";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_KEYCHAIN_SERVICE = "Blueprint-WebApp autonomous-spend";

type SourceConfig = {
  id: string;
  label: string;
  provider: string;
  ownerSystem: string;
  budgetLine: string;
  adapter: string;
  targetUsd?: number | null;
  proofKind: string;
  requiredEnv?: string[] | null;
  oneOfEnv?: string[][] | null;
  alternateEnv?: string[] | null;
  staleAfterHours?: number | null;
  localPath?: string | null;
  notes?: string[] | null;
};

type SpendRegistry = {
  schema: "blueprint/autonomous-spend-sources/v1";
  date: string;
  defaultOutputPath?: string;
  defaultWindow?: string;
  sources: SourceConfig[];
};

type CredentialCheck = {
  required_env: string[];
  missing_required_env: string[];
  present_required_env: string[];
  one_of_env: string[][];
  missing_one_of_env: string[][];
  satisfied_one_of_env: string[][];
  alternate_env_present: string[];
};

type SnapshotStatus =
  | "outside_budget_excluded"
  | "missing_credentials"
  | "missing_configuration"
  | "configured_not_queried"
  | "manual_export_loaded"
  | "manual_export_missing"
  | "live_billing_verified"
  | "live_credit_balance_verified"
  | "live_usage_verified"
  | "credential_presence_only"
  | "live_read_error";

type SnapshotProofLevel =
  | "live-billing"
  | "live-credit-balance"
  | "live-usage"
  | "repo-local-export"
  | "repo-local-config"
  | "missing";

type SourceSnapshot = {
  id: string;
  label: string;
  provider: string;
  owner_system: string;
  budget_line: string;
  adapter: string;
  target_usd: number | null;
  proof_kind: string;
  status: SnapshotStatus;
  proof_level: SnapshotProofLevel;
  can_count_toward_budget_actuals: boolean;
  live_read_attempted: boolean;
  live_mutation_attempted: false;
  credential_check: CredentialCheck;
  amount_usd_current_period: number | null;
  credit_balance_usd: number | null;
  total_usage_usd: number | null;
  account_reference: string | null;
  observed_at: string;
  stale_after_hours: number | null;
  endpoint_host: string | null;
  summary: Record<string, unknown>;
  missing_to_verify: string[];
  notes: string[];
  error: string | null;
};

type SpendSnapshot = {
  schema: "blueprint/autonomous-spend-snapshot/v1";
  generated_at: string;
  registry_path: string;
  window: {
    key: "month_to_date";
    start_iso: string;
    end_iso: string;
    start_unix: number;
    end_unix: number;
  };
  mode: {
    live_read_enabled: boolean;
    keychain_enabled: boolean;
    keychain_service: string | null;
    keychain_loaded_env: string[];
    keychain_missing_env: string[];
    live_mutation_attempted: false;
    secrets_persisted: false;
    output_redacts_secret_values: true;
  };
  totals: {
    target_usd: number;
    live_billing_verified_usd: number;
    live_credit_balance_sources: number;
    live_usage_only_sources: number;
    missing_or_unverified_target_usd: number;
  };
  sources: SourceSnapshot[];
  missing_inputs: Array<{
    source_id: string;
    label: string;
    missing_required_env: string[];
    missing_one_of_env: string[][];
    missing_configuration: string[];
  }>;
};

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function usage() {
  return `Usage:
  npm run autonomy:spend:snapshot -- [--live-read] [--keychain] [--env-file .env.spend.local] [--only openai_api_costs,digitalocean_billing]
  tsx scripts/autonomy/collect-spend-snapshot.ts --no-write --json

Default mode is local inventory only. Pass --live-read to call configured read-only provider endpoints.
Secrets are read from environment variables, macOS Keychain, or an optional env file and are never written to output.`;
}

function loadEnvFile(filePath: string) {
  const absolutePath = path.resolve(filePath);
  const body = fs.readFileSync(absolutePath, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

type KeychainLoadSummary = {
  enabled: boolean;
  service: string | null;
  loaded_env: string[];
  missing_env: string[];
};

function readRegistry(registryPath: string): SpendRegistry {
  const parsed = yaml.load(fs.readFileSync(registryPath, "utf8")) as SpendRegistry;
  if (parsed.schema !== "blueprint/autonomous-spend-sources/v1") {
    throw new Error(`Unsupported spend source registry schema: ${String(parsed.schema)}`);
  }
  if (!Array.isArray(parsed.sources)) {
    throw new Error("Spend source registry must contain a sources array");
  }
  return parsed;
}

function valuePresent(envName: string) {
  return typeof process.env[envName] === "string" && process.env[envName]!.trim().length > 0;
}

function checkCredentials(source: SourceConfig): CredentialCheck {
  const requiredEnv = source.requiredEnv ?? [];
  const oneOfEnv = source.oneOfEnv ?? [];
  return {
    required_env: requiredEnv,
    missing_required_env: requiredEnv.filter((envName) => !valuePresent(envName)),
    present_required_env: requiredEnv.filter(valuePresent),
    one_of_env: oneOfEnv,
    missing_one_of_env: oneOfEnv.filter((group) => !group.some(valuePresent)),
    satisfied_one_of_env: oneOfEnv.filter((group) => group.some(valuePresent)),
    alternate_env_present: (source.alternateEnv ?? []).filter(valuePresent),
  };
}

function hasRequiredCredentials(check: CredentialCheck) {
  return check.missing_required_env.length === 0 && check.missing_one_of_env.length === 0;
}

function isOutsideLaunchGrowthBudget(source: SourceConfig) {
  return source.targetUsd === 0
    && source.proofKind === "outside_launch_growth_budget_not_api_usage";
}

function sensitiveEnvNames(registry: SpendRegistry) {
  const names = new Set<string>();
  for (const source of registry.sources) {
    for (const envName of source.requiredEnv ?? []) {
      names.add(envName);
    }
    for (const group of source.oneOfEnv ?? []) {
      for (const envName of group) {
        names.add(envName);
      }
    }
    for (const envName of source.alternateEnv ?? []) {
      names.add(envName);
    }
  }
  return [...names];
}

function loadKeychainSecrets(
  registry: SpendRegistry,
  service: string,
): KeychainLoadSummary {
  const names = sensitiveEnvNames(registry).sort();
  const loadedEnv: string[] = [];
  const missingEnv: string[] = [];

  for (const envName of names) {
    if (valuePresent(envName)) {
      continue;
    }
    try {
      const value = execFileSync(
        "security",
        ["find-generic-password", "-s", service, "-a", envName, "-w"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      ).trim();
      if (value) {
        process.env[envName] = value;
        loadedEnv.push(envName);
      } else {
        missingEnv.push(envName);
      }
    } catch {
      missingEnv.push(envName);
    }
  }

  return {
    enabled: true,
    service,
    loaded_env: loadedEnv,
    missing_env: missingEnv,
  };
}

function sanitizeMessage(value: unknown, sensitiveNames: string[]) {
  let text = value instanceof Error ? value.message : String(value);
  for (const envName of sensitiveNames) {
    const envValue = process.env[envName];
    if (envValue && envValue.length >= 8) {
      text = text.split(envValue).join(`[redacted:${envName}]`);
    }
  }
  return text
    .replace(/SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted:sendgrid]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted:github_pat]")
    .replace(/ghp_[A-Za-z0-9_]+/g, "[redacted:github_pat]")
    .replace(/dop_v1_[A-Za-z0-9]+/g, "[redacted:digitalocean]")
    .replace(/rnd_[A-Za-z0-9]+/g, "[redacted:render]")
    .replace(/sk-admin-[A-Za-z0-9_-]+/g, "[redacted:openai_admin_key]")
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[redacted:openai_project_key]")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[redacted:openrouter_key]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[redacted:api_key]")
    .replace(/key_[A-Za-z0-9]+/g, "[redacted:runway]")
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted:firebase_web_key]");
}

function monthToDateWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return {
    key: "month_to_date" as const,
    start_iso: start.toISOString(),
    end_iso: now.toISOString(),
    start_unix: Math.floor(start.getTime() / 1000),
    end_unix: Math.floor(now.getTime() / 1000),
  };
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    let json: unknown = null;
    if (text.trim()) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { body: text.slice(0, 500) };
      }
    }
    if (!response.ok) {
      const detail = typeof json === "object" && json ? JSON.stringify(json).slice(0, 500) : text.slice(0, 500);
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${detail}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function sumNumbers(values: Array<number | null>) {
  return values.reduce((sum, value) => sum + (value ?? 0), 0);
}

function extractOpenAiCostUsd(payload: unknown) {
  const buckets = asArray(asRecord(payload).data);
  return sumNumbers(
    buckets.flatMap((bucket) => {
      const results = asArray(asRecord(bucket).results);
      return results.map((result) => {
        const amount = asRecord(asRecord(result).amount);
        const currency = String(amount.currency ?? "usd").toLowerCase();
        return currency === "usd" ? asNumber(amount.value) : null;
      });
    }),
  );
}

async function collectOpenAiCosts(source: SourceConfig, window: SpendSnapshot["window"]): Promise<Partial<SourceSnapshot>> {
  const url = new URL("https://api.openai.com/v1/organization/costs");
  const endUnix = Math.max(window.end_unix, window.start_unix + 86400);
  url.searchParams.set("start_time", String(window.start_unix));
  url.searchParams.set("end_time", String(endUnix));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  const payload = await fetchJson(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_ADMIN_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const amountUsd = extractOpenAiCostUsd(payload);
  return {
    status: "live_billing_verified",
    proof_level: "live-billing",
    can_count_toward_budget_actuals: true,
    amount_usd_current_period: amountUsd,
    endpoint_host: url.hostname,
    summary: {
      bucket_count: asArray(asRecord(payload).data).length,
      amount_usd_current_period: amountUsd,
    },
    missing_to_verify: [],
    notes: source.notes ?? [],
  };
}

async function collectOpenRouterCredits(source: SourceConfig): Promise<Partial<SourceSnapshot>> {
  const url = "https://openrouter.ai/api/v1/credits";
  const payload = await fetchJson(url, {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  });
  const data = asRecord(asRecord(payload).data);
  return {
    status: "live_credit_balance_verified",
    proof_level: "live-credit-balance",
    can_count_toward_budget_actuals: false,
    credit_balance_usd: asNumber(data.total_credits) === null || asNumber(data.total_usage) === null
      ? null
      : Math.max(0, asNumber(data.total_credits)! - asNumber(data.total_usage)!),
    total_usage_usd: asNumber(data.total_usage),
    endpoint_host: new URL(url).hostname,
    summary: {
      total_credits_usd: asNumber(data.total_credits),
      total_usage_usd: asNumber(data.total_usage),
    },
    missing_to_verify: ["monthly OpenRouter invoice or usage export by billing period"],
    notes: source.notes ?? [],
  };
}

async function collectDeepSeekBalance(source: SourceConfig): Promise<Partial<SourceSnapshot>> {
  const url = "https://api.deepseek.com/user/balance";
  const payload = await fetchJson(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
  });
  const balanceInfos = asArray(asRecord(payload).balance_infos);
  const usdBalance = sumNumbers(
    balanceInfos.map((entry) => {
      const record = asRecord(entry);
      return String(record.currency).toUpperCase() === "USD"
        ? asNumber(record.total_balance)
        : null;
    }),
  );
  return {
    status: "live_credit_balance_verified",
    proof_level: "live-credit-balance",
    can_count_toward_budget_actuals: false,
    credit_balance_usd: usdBalance || null,
    endpoint_host: new URL(url).hostname,
    summary: {
      is_available: asRecord(payload).is_available ?? null,
      currencies: balanceInfos.map((entry) => String(asRecord(entry).currency ?? "")).filter(Boolean),
      usd_total_balance: usdBalance || null,
    },
    missing_to_verify: ["DeepSeek monthly usage or invoice export"],
    notes: source.notes ?? [],
  };
}

async function collectDigitalOceanBilling(source: SourceConfig): Promise<Partial<SourceSnapshot>> {
  const headers = {
    Authorization: `Bearer ${process.env.DIGITALOCEAN_TOKEN}`,
    "Content-Type": "application/json",
  };
  const balanceUrl = "https://api.digitalocean.com/v2/customers/my/balance";
  const invoicesUrl = "https://api.digitalocean.com/v2/customers/my/invoices";
  const [balancePayload, invoicesPayload] = await Promise.all([
    fetchJson(balanceUrl, { headers }),
    fetchJson(invoicesUrl, { headers }),
  ]);
  const balance = asRecord(balancePayload);
  const invoicePreview = asRecord(asRecord(invoicesPayload).invoice_preview);
  const invoicePreviewUsd = asNumber(invoicePreview.amount);
  return {
    status: invoicePreviewUsd === null ? "live_usage_verified" : "live_billing_verified",
    proof_level: invoicePreviewUsd === null ? "live-usage" : "live-billing",
    can_count_toward_budget_actuals: invoicePreviewUsd !== null,
    amount_usd_current_period: invoicePreviewUsd,
    endpoint_host: new URL(balanceUrl).hostname,
    summary: {
      account_balance: balance.account_balance ?? null,
      generated_at: balance.generated_at ?? null,
      invoice_preview_amount_usd: invoicePreviewUsd,
      invoice_preview_period: invoicePreview.billing_period ?? null,
    },
    missing_to_verify: invoicePreviewUsd === null ? ["DigitalOcean invoice preview amount"] : [],
    notes: source.notes ?? [],
  };
}

async function collectRenderInventory(source: SourceConfig): Promise<Partial<SourceSnapshot>> {
  const url = "https://api.render.com/v1/services?limit=100";
  const payload = await fetchJson(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.RENDER_API_KEY}`,
    },
  });
  const services = Array.isArray(payload) ? payload : asArray(asRecord(payload).data);
  const serviceTypes = services.map((entry) => {
    const service = asRecord(asRecord(entry).service ?? entry);
    return String(service.type ?? "unknown");
  });
  return {
    status: "live_usage_verified",
    proof_level: "live-usage",
    can_count_toward_budget_actuals: false,
    endpoint_host: new URL(url).hostname,
    summary: {
      service_count: services.length,
      service_types: [...new Set(serviceTypes)],
    },
    missing_to_verify: ["Render billing endpoint, invoice export, or dashboard proof"],
    notes: source.notes ?? [],
  };
}

async function collectSendGridCredits(source: SourceConfig): Promise<Partial<SourceSnapshot>> {
  const url = "https://api.sendgrid.com/v3/user/credits";
  const payload = await fetchJson(url, {
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const record = asRecord(payload);
  const remaining = asNumber(record.remain ?? record.remaining ?? record.credits ?? record.credit_balance);
  const used = asNumber(record.used ?? record.total_usage);
  return {
    status: "live_credit_balance_verified",
    proof_level: "live-credit-balance",
    can_count_toward_budget_actuals: false,
    credit_balance_usd: null,
    endpoint_host: new URL(url).hostname,
    summary: {
      remaining_credits: remaining,
      used_credits: used,
      reset_frequency: record.reset_frequency ?? record.reset ?? null,
    },
    missing_to_verify: ["SendGrid plan cost or billing export"],
    notes: source.notes ?? [],
  };
}

async function collectGithubBilling(source: SourceConfig): Promise<Partial<SourceSnapshot>> {
  const owner = process.env.GITHUB_BILLING_OWNER?.trim();
  const ownerType = process.env.GITHUB_BILLING_OWNER_TYPE?.trim().toLowerCase();
  if (!owner || !ownerType || !["user", "organization"].includes(ownerType)) {
    return {
      status: "missing_configuration",
      proof_level: "missing",
      can_count_toward_budget_actuals: false,
      missing_to_verify: ["GITHUB_BILLING_OWNER", "GITHUB_BILLING_OWNER_TYPE=user|organization"],
      notes: source.notes ?? [],
    };
  }
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_CLASSIC_TOKEN;
  const pathPrefix = ownerType === "organization" ? "organizations" : "users";
  const url = `https://api.github.com/${pathPrefix}/${encodeURIComponent(owner)}/settings/billing/usage/summary`;
  const payload = await fetchJson(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  const record = asRecord(payload);
  const amount = asNumber(record.net_amount ?? record.gross_amount ?? record.total_amount);
  return {
    status: amount === null ? "live_usage_verified" : "live_billing_verified",
    proof_level: amount === null ? "live-usage" : "live-billing",
    can_count_toward_budget_actuals: amount !== null,
    amount_usd_current_period: amount,
    endpoint_host: new URL(url).hostname,
    account_reference: `${ownerType}:${owner}`,
    summary: {
      net_amount: record.net_amount ?? null,
      gross_amount: record.gross_amount ?? null,
      discount_amount: record.discount_amount ?? record.total_discount_amount ?? null,
      usage_items_present: Array.isArray(record.usageItems ?? record.usage_items),
    },
    missing_to_verify: amount === null ? ["GitHub billing response did not expose a recognized amount field"] : [],
    notes: source.notes ?? [],
  };
}

async function collectBackblazeAuthorize(source: SourceConfig): Promise<Partial<SourceSnapshot>> {
  const url = "https://api.backblazeb2.com/b2api/v3/b2_authorize_account";
  const keyId = process.env.BACKBLAZE_B2_KEY_ID || "";
  const applicationKey = process.env.BACKBLAZE_B2_APPLICATION_KEY || "";
  const auth = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");
  const payload = await fetchJson(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const record = asRecord(payload);
  return {
    status: "live_usage_verified",
    proof_level: "live-usage",
    can_count_toward_budget_actuals: false,
    endpoint_host: new URL(url).hostname,
    account_reference: typeof record.accountId === "string" ? record.accountId : null,
    summary: {
      account_authorized: Boolean(record.accountId),
      allowed_capabilities: asRecord(record.allowed).capabilities ?? null,
      api_url_present: Boolean(record.apiUrl),
    },
    missing_to_verify: ["Backblaze billing export or B2 usage pricing reconciliation"],
    notes: source.notes ?? [],
  };
}

function collectManualExport(source: SourceConfig): Partial<SourceSnapshot> {
  const exportPath = process.env.GCP_BILLING_EXPORT_JSON?.trim();
  if (!exportPath) {
    return {
      status: "manual_export_missing",
      proof_level: "missing",
      can_count_toward_budget_actuals: false,
      missing_to_verify: ["GCP_BILLING_EXPORT_JSON"],
      notes: source.notes ?? [],
    };
  }
  const absolutePath = path.resolve(exportPath);
  const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown;
  const rows = Array.isArray(parsed) ? parsed : asArray(asRecord(parsed).rows ?? asRecord(parsed).data);
  const amount = sumNumbers(rows.map((entry) => {
    const record = asRecord(entry);
    return asNumber(record.cost_usd ?? record.amount_usd ?? record.cost ?? record.amount);
  }));
  return {
    status: "manual_export_loaded",
    proof_level: "repo-local-export",
    can_count_toward_budget_actuals: amount > 0,
    amount_usd_current_period: amount || null,
    endpoint_host: null,
    account_reference: absolutePath,
    summary: {
      export_path: absolutePath,
      rows: rows.length,
      amount_usd_current_period: amount || null,
    },
    missing_to_verify: amount > 0 ? [] : ["recognized cost_usd/amount_usd/cost/amount fields in export"],
    notes: source.notes ?? [],
  };
}

function collectPaperclipAgentConfig(source: SourceConfig): Partial<SourceSnapshot> {
  const localPath = source.localPath || "ops/paperclip/blueprint-company/.paperclip.yaml";
  const absolutePath = path.resolve(localPath);
  const parsed = yaml.load(fs.readFileSync(absolutePath, "utf8")) as {
    agents?: Record<string, { budgetMonthlyCents?: number }>;
    routines?: Record<string, { status?: string }>;
  };
  const declaredBudgetUsd = Object.values(parsed.agents ?? {}).reduce(
    (sum, agent) => sum + (agent.budgetMonthlyCents ?? 0),
    0,
  ) / 100;
  const routineCounts = Object.values(parsed.routines ?? {}).reduce<Record<string, number>>((counts, routine) => {
    const status = routine.status || "active";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  return {
    status: "manual_export_loaded",
    proof_level: "repo-local-export",
    can_count_toward_budget_actuals: false,
    amount_usd_current_period: declaredBudgetUsd,
    endpoint_host: null,
    account_reference: localPath,
    summary: {
      config_path: localPath,
      declared_budget_usd: declaredBudgetUsd,
      agents: Object.keys(parsed.agents ?? {}).length,
      routines_total: Object.keys(parsed.routines ?? {}).length,
      active_routines: routineCounts.active ?? 0,
      paused_routines: routineCounts.paused ?? 0,
    },
    missing_to_verify: ["live Paperclip runtime propagation and model/provider billing export"],
    notes: source.notes ?? [],
  };
}

async function collectMetaAdsInsights(
  source: SourceConfig,
  window: SpendSnapshot["window"],
): Promise<Partial<SourceSnapshot>> {
  const accountId = process.env.META_AD_ACCOUNT_ID?.replace(/^act_/, "").trim();
  if (!accountId) {
    return {
      status: "missing_configuration",
      proof_level: "missing",
      can_count_toward_budget_actuals: false,
      missing_to_verify: ["META_AD_ACCOUNT_ID"],
      notes: source.notes ?? [],
    };
  }
  const graphVersion = process.env.META_GRAPH_VERSION?.trim() || "v20.0";
  const url = new URL(`https://graph.facebook.com/${graphVersion}/act_${accountId}/insights`);
  url.searchParams.set("fields", "spend,account_id");
  url.searchParams.set("time_range", JSON.stringify({
    since: window.start_iso.slice(0, 10),
    until: window.end_iso.slice(0, 10),
  }));
  const payload = await fetchJson(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` },
  });
  const rows = asArray(asRecord(payload).data);
  const spend = sumNumbers(rows.map((entry) => asNumber(asRecord(entry).spend)));
  return {
    status: "live_billing_verified",
    proof_level: "live-billing",
    can_count_toward_budget_actuals: true,
    amount_usd_current_period: spend,
    endpoint_host: url.hostname,
    account_reference: `act_${accountId}`,
    summary: {
      rows: rows.length,
      spend_usd_current_period: spend,
    },
    missing_to_verify: [],
    notes: source.notes ?? [],
  };
}

function collectCredentialPresence(source: SourceConfig): Partial<SourceSnapshot> {
  return {
    status: "credential_presence_only",
    proof_level: "repo-local-config",
    can_count_toward_budget_actuals: false,
    missing_to_verify: ["live billing or usage adapter"],
    notes: source.notes ?? [],
  };
}

async function collectSource(
  source: SourceConfig,
  window: SpendSnapshot["window"],
  liveReadEnabled: boolean,
  registry: SpendRegistry,
): Promise<SourceSnapshot> {
  const credentialCheck = checkCredentials(source);
  const observedAt = new Date().toISOString();
  const base: SourceSnapshot = {
    id: source.id,
    label: source.label,
    provider: source.provider,
    owner_system: source.ownerSystem,
    budget_line: source.budgetLine,
    adapter: source.adapter,
    target_usd: source.targetUsd ?? null,
    proof_kind: source.proofKind,
    status: "configured_not_queried",
    proof_level: "repo-local-config",
    can_count_toward_budget_actuals: false,
    live_read_attempted: false,
    live_mutation_attempted: false,
    credential_check: credentialCheck,
    amount_usd_current_period: null,
    credit_balance_usd: null,
    total_usage_usd: null,
    account_reference: null,
    observed_at: observedAt,
    stale_after_hours: source.staleAfterHours ?? null,
    endpoint_host: null,
    summary: {},
    missing_to_verify: [],
    notes: source.notes ?? [],
    error: null,
  };

  if (isOutsideLaunchGrowthBudget(source)) {
    return {
      ...base,
      status: "outside_budget_excluded",
      proof_level: "repo-local-config",
      can_count_toward_budget_actuals: false,
      missing_to_verify: [],
      summary: {
        excluded_from_launch_growth_budget: true,
        target_usd: source.targetUsd ?? 0,
      },
    };
  }

  if (!hasRequiredCredentials(credentialCheck)) {
    return {
      ...base,
      status: "missing_credentials",
      proof_level: "missing",
      missing_to_verify: [
        ...credentialCheck.missing_required_env,
        ...credentialCheck.missing_one_of_env.map((group) => `one of: ${group.join(", ")}`),
      ],
    };
  }

  if (source.adapter === "manual_export") {
    return {
      ...base,
      ...collectManualExport(source),
      live_read_attempted: false,
    };
  }

  if (source.adapter === "paperclip_agent_config") {
    return {
      ...base,
      ...collectPaperclipAgentConfig(source),
      live_read_attempted: false,
    };
  }

  if (!liveReadEnabled) {
    return {
      ...base,
      status: "configured_not_queried",
      missing_to_verify: ["rerun with --live-read for read-only provider query"],
    };
  }

  try {
    const liveResult = await dispatchLiveRead(source, window);
    return {
      ...base,
      ...liveResult,
      live_read_attempted: !["credential_presence_only"].includes(String(liveResult.status)),
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      status: "live_read_error",
      proof_level: "missing",
      live_read_attempted: true,
      missing_to_verify: ["successful read-only provider response"],
      error: sanitizeMessage(error, sensitiveEnvNames(registry)),
    };
  }
}

async function dispatchLiveRead(
  source: SourceConfig,
  window: SpendSnapshot["window"],
): Promise<Partial<SourceSnapshot>> {
  switch (source.adapter) {
    case "openai_costs":
      return collectOpenAiCosts(source, window);
    case "openrouter_credits":
      return collectOpenRouterCredits(source);
    case "deepseek_balance":
      return collectDeepSeekBalance(source);
    case "digitalocean_billing":
      return collectDigitalOceanBilling(source);
    case "render_inventory":
      return collectRenderInventory(source);
    case "sendgrid_credits":
      return collectSendGridCredits(source);
    case "github_billing_usage":
      return collectGithubBilling(source);
    case "backblaze_b2_authorize":
      return collectBackblazeAuthorize(source);
    case "meta_ads_insights":
      return collectMetaAdsInsights(source, window);
    case "paperclip_agent_config":
      return collectPaperclipAgentConfig(source);
    case "credential_presence":
      return collectCredentialPresence(source);
    default:
      return {
        status: "missing_configuration",
        proof_level: "missing",
        can_count_toward_budget_actuals: false,
        missing_to_verify: [`unsupported adapter: ${source.adapter}`],
      };
  }
}

function buildSnapshot(
  registry: SpendRegistry,
  registryPath: string,
  sources: SourceSnapshot[],
  liveReadEnabled: boolean,
  keychainLoad: KeychainLoadSummary,
): SpendSnapshot {
  const liveBillingVerifiedUsd = sumNumbers(
    sources.map((source) => source.proof_level === "live-billing" ? source.amount_usd_current_period : null),
  );
  const targetUsd = sumNumbers(sources.map((source) => source.target_usd));
  const verifiedTargetUsd = sumNumbers(
    sources.map((source) => source.can_count_toward_budget_actuals ? source.target_usd : null),
  );
  return {
    schema: "blueprint/autonomous-spend-snapshot/v1",
    generated_at: new Date().toISOString(),
    registry_path: registryPath,
    window: monthToDateWindow(),
    mode: {
      live_read_enabled: liveReadEnabled,
      keychain_enabled: keychainLoad.enabled,
      keychain_service: keychainLoad.service,
      keychain_loaded_env: keychainLoad.loaded_env,
      keychain_missing_env: keychainLoad.missing_env,
      live_mutation_attempted: false,
      secrets_persisted: false,
      output_redacts_secret_values: true,
    },
    totals: {
      target_usd: targetUsd,
      live_billing_verified_usd: liveBillingVerifiedUsd,
      live_credit_balance_sources: sources.filter((source) => source.proof_level === "live-credit-balance").length,
      live_usage_only_sources: sources.filter((source) => source.proof_level === "live-usage").length,
      missing_or_unverified_target_usd: Math.max(0, targetUsd - verifiedTargetUsd),
    },
    sources,
    missing_inputs: sources
      .filter((source) => (
        source.credential_check.missing_required_env.length > 0
        || source.credential_check.missing_one_of_env.length > 0
        || source.status === "missing_configuration"
      ))
      .map((source) => ({
        source_id: source.id,
        label: source.label,
        missing_required_env: source.credential_check.missing_required_env,
        missing_one_of_env: source.credential_check.missing_one_of_env,
        missing_configuration: source.status === "missing_configuration" ? source.missing_to_verify : [],
      })),
  };
}

function renderMarkdown(snapshot: SpendSnapshot) {
  const lines = [
    "# Autonomous Spend Snapshot",
    "",
    `Generated: ${snapshot.generated_at}`,
    `Mode: ${snapshot.mode.live_read_enabled ? "live-read" : "local-inventory"}`,
    `Keychain: ${snapshot.mode.keychain_enabled ? `enabled (${snapshot.mode.keychain_loaded_env.length} loaded)` : "disabled"}`,
    `Window: ${snapshot.window.start_iso} to ${snapshot.window.end_iso}`,
    `Live mutation attempted: ${snapshot.mode.live_mutation_attempted ? "yes" : "no"}`,
    `Secrets persisted: ${snapshot.mode.secrets_persisted ? "yes" : "no"}`,
    "",
    "## Totals",
    "",
    `- Source target total: $${snapshot.totals.target_usd.toFixed(2)}`,
    `- Live billing verified: $${snapshot.totals.live_billing_verified_usd.toFixed(2)}`,
    `- Credit-balance sources: ${snapshot.totals.live_credit_balance_sources}`,
    `- Usage-only sources: ${snapshot.totals.live_usage_only_sources}`,
    `- Missing or unverified target: $${snapshot.totals.missing_or_unverified_target_usd.toFixed(2)}`,
    "",
    "## Sources",
    "",
    "| source | provider | status | proof_level | amount_usd | missing_to_verify |",
    "|---|---|---|---|---:|---|",
  ];
  for (const source of snapshot.sources) {
    lines.push([
      source.id,
      source.provider,
      source.status,
      source.proof_level,
      source.amount_usd_current_period === null ? "" : source.amount_usd_current_period.toFixed(2),
      source.missing_to_verify.join("; ") || "",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }

  if (snapshot.missing_inputs.length > 0) {
    lines.push("", "## Missing Inputs", "");
    for (const missing of snapshot.missing_inputs) {
      const parts = [
        ...missing.missing_required_env,
        ...missing.missing_one_of_env.map((group) => `one of: ${group.join(", ")}`),
        ...missing.missing_configuration,
      ];
      lines.push(`- ${missing.source_id}: ${parts.join("; ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(usage());
    return;
  }

  const envFile = readArg("--env-file");
  if (envFile) {
    loadEnvFile(envFile);
  }

  const registryPath = readArg("--registry") || DEFAULT_REGISTRY_PATH;
  const outDir = readArg("--out-dir") || DEFAULT_OUT_DIR;
  const liveReadEnabled = hasFlag("--live-read") || hasFlag("--allow-live-read");
  const keychainEnabled = hasFlag("--keychain");
  const keychainService = readArg("--keychain-service") || DEFAULT_KEYCHAIN_SERVICE;
  const onlyArg = readArg("--only");
  const onlyIds = onlyArg
    ? new Set(onlyArg.split(",").map((entry) => entry.trim()).filter(Boolean))
    : null;
  const registry = readRegistry(registryPath);
  const keychainLoad = keychainEnabled
    ? loadKeychainSecrets(registry, keychainService)
    : {
      enabled: false,
      service: null,
      loaded_env: [],
      missing_env: [],
    };
  const window = monthToDateWindow();
  const selectedSources = onlyIds
    ? registry.sources.filter((source) => onlyIds.has(source.id))
    : registry.sources;

  const sources: SourceSnapshot[] = [];
  for (const source of selectedSources) {
    sources.push(await collectSource(source, window, liveReadEnabled, registry));
  }

  const snapshot = buildSnapshot(registry, registryPath, sources, liveReadEnabled, keychainLoad);

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "latest.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, "latest.md"), renderMarkdown(snapshot));
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(renderMarkdown(snapshot));
  }
}

main().catch((error) => {
  console.error(sanitizeMessage(error, []));
  process.exitCode = 1;
});
