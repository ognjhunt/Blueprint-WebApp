export type EntitlementAccessState =
  | "provisioned"
  | "manual_review_required"
  | "revoked"
  | "expired"
  | string;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numericTimeMs(value: unknown): number | null {
  if (!value) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === "object") {
    const candidate = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof candidate.toMillis === "function") {
      const time = candidate.toMillis();
      return Number.isFinite(time) ? time : null;
    }
    if (typeof candidate.toDate === "function") {
      const time = candidate.toDate().getTime();
      return Number.isNaN(time) ? null : time;
    }
  }
  const raw = stringValue(value);
  if (!raw) {
    return null;
  }
  const time = Date.parse(raw);
  return Number.isNaN(time) ? null : time;
}

export function entitlementExpiresAtMs(
  entitlement: Record<string, unknown>,
): number | null {
  return (
    numericTimeMs(entitlement.expires_at) ??
    numericTimeMs(entitlement.expiresAt) ??
    numericTimeMs(entitlement.valid_until) ??
    numericTimeMs(entitlement.validUntil)
  );
}

export function isEntitlementExpired(
  entitlement: Record<string, unknown>,
  nowMs = Date.now(),
) {
  const expiresAtMs = entitlementExpiresAtMs(entitlement);
  return expiresAtMs !== null && expiresAtMs <= nowMs;
}

export function effectiveEntitlementAccessState(
  entitlement: Record<string, unknown>,
  nowMs = Date.now(),
): EntitlementAccessState {
  const accessState = stringValue(entitlement.access_state || entitlement.accessState);
  if (accessState === "provisioned" && isEntitlementExpired(entitlement, nowMs)) {
    return "expired";
  }
  return accessState || "manual_review_required";
}

export function entitlementTermForOrderItem(params: {
  itemType?: string | null;
  deliveryMode?: string | null;
  quantity?: number | null;
  grantedAtIso: string;
}): {
  expires_at: string | null;
  license_term_hours: number | null;
  license_term_unit: "hour" | null;
} {
  const itemType = stringValue(params.itemType).toLowerCase();
  const deliveryMode = stringValue(params.deliveryMode).toLowerCase();
  if (itemType !== "hosted_session_rental" && deliveryMode !== "hosted_session") {
    return {
      expires_at: null,
      license_term_hours: null,
      license_term_unit: null,
    };
  }
  const rawQuantity = Number(params.quantity || 1);
  const quantity = Math.max(
    1,
    Math.ceil(Number.isFinite(rawQuantity) ? rawQuantity : 1),
  );
  const grantedAtMs = Date.parse(params.grantedAtIso);
  const startMs = Number.isNaN(grantedAtMs) ? Date.now() : grantedAtMs;
  return {
    expires_at: new Date(startMs + quantity * 60 * 60 * 1000).toISOString(),
    license_term_hours: quantity,
    license_term_unit: "hour",
  };
}
