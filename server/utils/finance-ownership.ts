import fs from "node:fs";
import path from "node:path";

/**
 * R035: named human finance-review owner for payout exceptions.
 *
 * There was no organization-level "who owns finance/payout exceptions" record.
 * The per-payout `finance_review.owner_email` field (see field-ops-automation)
 * could silently be null, so an overdue payout exception could sit with NO
 * accountable human. This module adds a committed ownership config + a validator
 * that FAILS CLOSED when the owner is unset, and exposes a status the payout
 * exception monitor / operator surface consults so "no finance owner assigned"
 * shows up as an explicit blocker instead of silence.
 *
 * ENFORCED BY CODE: the config schema, the validator, and the fail-closed
 * `blockers` surfaced to the monitor.
 * HUMAN STEP: a real accountable person must be named in the config (owner +
 * escalation + confirmed SLA). Until then this is honestly "no owner assigned".
 *
 * Backing config lives in the existing repo config tree (no new service):
 *   config/finance/finance-ownership.config.json
 * Override the path with BLUEPRINT_FINANCE_OWNERSHIP_CONFIG_PATH for deploys.
 */

export interface FinanceOwner {
  name: string | null;
  handle: string | null;
  email: string | null;
}

export interface FinanceEscalationContact {
  name: string | null;
  handle: string | null;
  email: string | null;
}

export interface FinanceOwnershipConfig {
  schema?: string;
  owner: FinanceOwner;
  escalation_contacts: FinanceEscalationContact[];
  review_sla_hours: number;
  updated_at: string | null;
  updated_by: string | null;
}

export interface FinanceOwnershipStatus {
  configured: boolean;
  owner: FinanceOwner | null;
  ownerLabel: string | null;
  escalationContacts: FinanceEscalationContact[];
  reviewSlaHours: number;
  blockers: string[];
  configPath: string;
  configPresent: boolean;
}

export const DEFAULT_FINANCE_OWNERSHIP_CONFIG_PATH = "config/finance/finance-ownership.config.json";
export const DEFAULT_FINANCE_REVIEW_SLA_HOURS = 24;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeContact(value: unknown): FinanceEscalationContact {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    name: isNonEmptyString(record.name) ? record.name.trim() : null,
    handle: isNonEmptyString(record.handle) ? record.handle.trim() : null,
    email: isNonEmptyString(record.email) ? record.email.trim() : null,
  };
}

function contactHasIdentity(contact: FinanceEscalationContact): boolean {
  return Boolean(contact.name || contact.handle || contact.email);
}

/**
 * Normalize an untrusted parsed config into the typed shape. Missing/garbage
 * fields collapse to the fail-closed defaults (owner null, no escalation).
 */
export function normalizeFinanceOwnershipConfig(
  raw: Record<string, unknown> | null | undefined,
): FinanceOwnershipConfig {
  const data = raw && typeof raw === "object" ? raw : {};
  const ownerRaw = data.owner && typeof data.owner === "object" ? (data.owner as Record<string, unknown>) : {};
  const contactsRaw = Array.isArray(data.escalation_contacts) ? data.escalation_contacts : [];
  const slaRaw = data.review_sla_hours;
  return {
    schema: isNonEmptyString(data.schema) ? data.schema : undefined,
    owner: {
      name: isNonEmptyString(ownerRaw.name) ? ownerRaw.name.trim() : null,
      handle: isNonEmptyString(ownerRaw.handle) ? ownerRaw.handle.trim() : null,
      email: isNonEmptyString(ownerRaw.email) ? ownerRaw.email.trim() : null,
    },
    escalation_contacts: contactsRaw.map(normalizeContact).filter(contactHasIdentity),
    review_sla_hours:
      typeof slaRaw === "number" && Number.isFinite(slaRaw) && slaRaw > 0
        ? slaRaw
        : DEFAULT_FINANCE_REVIEW_SLA_HOURS,
    updated_at: isNonEmptyString(data.updated_at) ? data.updated_at : null,
    updated_by: isNonEmptyString(data.updated_by) ? data.updated_by : null,
  };
}

function ownerLabel(owner: FinanceOwner): string | null {
  const label = owner.name || owner.handle || owner.email;
  return label ? label : null;
}

/**
 * Pure fail-closed evaluation. Returns `configured: false` with explicit
 * blockers when no accountable human owner (identity + contactable email) is
 * named, or when there is no escalation contact.
 */
export function evaluateFinanceOwnership(
  config: FinanceOwnershipConfig,
  options: { configPath: string; configPresent: boolean },
): FinanceOwnershipStatus {
  const blockers: string[] = [];

  if (!options.configPresent) {
    blockers.push(
      "no finance owner assigned: finance-ownership config file is missing.",
    );
  }

  const hasOwnerIdentity = Boolean(config.owner.name || config.owner.handle);
  const hasOwnerEmail = Boolean(config.owner.email);
  if (!hasOwnerIdentity) {
    blockers.push("no finance owner assigned: owner.name or owner.handle is required.");
  }
  if (!hasOwnerEmail) {
    blockers.push("no finance owner assigned: owner.email is required for a contactable owner.");
  }
  if (config.escalation_contacts.length === 0) {
    blockers.push("finance ownership: at least one escalation contact is required.");
  }
  if (!(config.review_sla_hours > 0)) {
    blockers.push("finance ownership: review_sla_hours must be a positive number.");
  }

  const configured = blockers.length === 0;
  return {
    configured,
    owner: configured ? config.owner : hasOwnerIdentity || hasOwnerEmail ? config.owner : null,
    ownerLabel: ownerLabel(config.owner),
    escalationContacts: config.escalation_contacts,
    reviewSlaHours: config.review_sla_hours,
    blockers,
    configPath: options.configPath,
    configPresent: options.configPresent,
  };
}

function resolveConfigPath(explicitPath?: string): string {
  if (explicitPath && explicitPath.trim()) {
    return explicitPath.trim();
  }
  const envPath = process.env.BLUEPRINT_FINANCE_OWNERSHIP_CONFIG_PATH;
  if (envPath && envPath.trim()) {
    return envPath.trim();
  }
  return DEFAULT_FINANCE_OWNERSHIP_CONFIG_PATH;
}

/**
 * Load + evaluate the finance ownership config from disk. Never throws: a
 * missing or unparseable file fails closed (configured=false with blockers)
 * rather than pretending an owner exists.
 */
export function getFinanceOwnershipStatus(options?: { configPath?: string }): FinanceOwnershipStatus {
  const configPath = resolveConfigPath(options?.configPath);
  const absolute = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  let parsed: Record<string, unknown> | null = null;
  let configPresent = false;
  try {
    if (fs.existsSync(absolute)) {
      configPresent = true;
      parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as Record<string, unknown>;
    }
  } catch {
    // Unparseable config is treated as "not configured" (fail closed).
    configPresent = fs.existsSync(absolute);
    parsed = null;
  }
  const normalized = normalizeFinanceOwnershipConfig(parsed);
  return evaluateFinanceOwnership(normalized, { configPath, configPresent });
}
