/**
 * R052: client runtime config (force-update / kill-switch / maintenance mode).
 *
 * Pure, dependency-free helpers for the capture-client runtime config document.
 * The route module (server/routes/client-runtime-config.ts) does the Firestore
 * I/O and HTTP; this module owns the shape, safe defaults, normalization, and
 * admin-update validation so the logic is unit-testable without a server.
 *
 * Honesty / fail-safe posture:
 *   - Defaults are permissive-for-availability, NOT fabricated readiness:
 *     killSwitch=false, maintenanceMode=false, minSupportedVersion="0.0.0"
 *     (i.e. "no client is force-updated") so a missing/unavailable config never
 *     accidentally bricks every client. Enforcement is opt-IN by an admin.
 *   - The kill-switch / maintenance flags are only ever TRUE when an admin has
 *     explicitly set them in the backing Firestore doc.
 */

export interface ClientRuntimeConfig {
  /** Minimum capture-client version allowed to run. "0.0.0" = no floor. */
  minSupportedVersion: string;
  /** Hard stop: clients should refuse to operate and show an update/blocked screen. */
  killSwitch: boolean;
  /** Soft stop: clients should show a maintenance banner / read-only mode. */
  maintenanceMode: boolean;
  /** Operator-authored message shown to clients (update prompt / maintenance copy). */
  message: string;
  /** ISO timestamp of the last admin update, or null when never set. */
  updatedAt: string | null;
  /** Admin identity (email/uid) that last updated the config, or null. */
  updatedBy: string | null;
}

export const CLIENT_RUNTIME_CONFIG_COLLECTION = "appConfig";
export const CLIENT_RUNTIME_CONFIG_DOC_ID = "clientRuntime";

export const DEFAULT_CLIENT_RUNTIME_CONFIG: ClientRuntimeConfig = {
  minSupportedVersion: "0.0.0",
  killSwitch: false,
  maintenanceMode: false,
  message: "",
  updatedAt: null,
  updatedBy: null,
};

/** Accepts 1-4 dotted numeric segments, e.g. "1", "1.2", "1.2.3", "1.2.3.4". */
const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;

export function isValidVersionString(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value.trim());
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === "function") {
    const date = maybeTimestamp.toDate();
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  return null;
}

/**
 * Normalize an untrusted stored doc (or partial) into a complete, safe config.
 * Unknown/garbage fields fall back to the availability-preserving defaults.
 */
export function normalizeClientRuntimeConfig(
  raw: Record<string, unknown> | null | undefined,
): ClientRuntimeConfig {
  const data = raw && typeof raw === "object" ? raw : {};
  const minSupportedVersion = isValidVersionString(data.minSupportedVersion)
    ? String(data.minSupportedVersion).trim()
    : DEFAULT_CLIENT_RUNTIME_CONFIG.minSupportedVersion;
  const message =
    typeof data.message === "string" ? data.message.slice(0, 2000) : DEFAULT_CLIENT_RUNTIME_CONFIG.message;
  return {
    minSupportedVersion,
    killSwitch: asBool(data.killSwitch, DEFAULT_CLIENT_RUNTIME_CONFIG.killSwitch),
    maintenanceMode: asBool(data.maintenanceMode, DEFAULT_CLIENT_RUNTIME_CONFIG.maintenanceMode),
    message,
    updatedAt: asIso(data.updatedAt),
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

export interface ClientRuntimeConfigUpdate {
  minSupportedVersion?: string;
  killSwitch?: boolean;
  maintenanceMode?: boolean;
  message?: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  errors: string[];
  value: T | null;
}

/**
 * Validate an admin update body. Every field is optional (partial update), but
 * any field that IS present must be well-formed; otherwise we reject the write
 * rather than silently coercing an admin's intent.
 */
export function validateClientRuntimeConfigUpdate(
  body: unknown,
): ValidationResult<ClientRuntimeConfigUpdate> {
  const errors: string[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: ["Request body must be a JSON object."], value: null };
  }
  const record = body as Record<string, unknown>;
  const update: ClientRuntimeConfigUpdate = {};

  if (record.minSupportedVersion !== undefined) {
    if (!isValidVersionString(record.minSupportedVersion)) {
      errors.push("minSupportedVersion must be a dotted numeric version like 1.2.3.");
    } else {
      update.minSupportedVersion = String(record.minSupportedVersion).trim();
    }
  }
  if (record.killSwitch !== undefined) {
    if (typeof record.killSwitch !== "boolean") {
      errors.push("killSwitch must be a boolean.");
    } else {
      update.killSwitch = record.killSwitch;
    }
  }
  if (record.maintenanceMode !== undefined) {
    if (typeof record.maintenanceMode !== "boolean") {
      errors.push("maintenanceMode must be a boolean.");
    } else {
      update.maintenanceMode = record.maintenanceMode;
    }
  }
  if (record.message !== undefined) {
    if (typeof record.message !== "string") {
      errors.push("message must be a string.");
    } else if (record.message.length > 2000) {
      errors.push("message must be 2000 characters or fewer.");
    } else {
      update.message = record.message;
    }
  }

  if (Object.keys(update).length === 0 && errors.length === 0) {
    errors.push(
      "Provide at least one of: minSupportedVersion, killSwitch, maintenanceMode, message.",
    );
  }

  return { ok: errors.length === 0, errors, value: errors.length === 0 ? update : null };
}
