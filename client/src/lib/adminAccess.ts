import type { UserData } from "@/lib/firebase";

export type AccessRole = "admin" | "ops";

type TokenClaimsLike =
  | (Record<string, unknown> & {
      admin?: boolean;
      ops?: boolean;
      role?: unknown;
      roles?: unknown;
    })
  | null
  | undefined;

function asRole(value: unknown): AccessRole | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "ops") {
    return normalized;
  }
  return null;
}

function collectRoles(rawValues: unknown[]): AccessRole[] {
  const roles = new Set<AccessRole>();

  for (const rawValue of rawValues) {
    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        const role = asRole(item);
        if (role) {
          roles.add(role);
        }
      }
      continue;
    }

    const role = asRole(rawValue);
    if (role) {
      roles.add(role);
    }
  }

  return [...roles];
}

export function resolveAccessRoles(
  userData?: UserData | null,
  tokenClaims?: TokenClaimsLike,
): AccessRole[] {
  const roles = new Set<AccessRole>(
    collectRoles([
      userData?.roles,
      userData?.role,
      tokenClaims?.roles,
      tokenClaims?.role,
    ]),
  );

  if (userData?.admin === true || tokenClaims?.admin === true) {
    roles.add("admin");
  }
  if (userData?.ops === true || tokenClaims?.ops === true) {
    roles.add("ops");
  }

  return [...roles];
}

export function hasRole(
  role: AccessRole,
  userData?: UserData | null,
  tokenClaims?: TokenClaimsLike,
): boolean {
  const roles = resolveAccessRoles(userData, tokenClaims);
  return roles.includes(role) || (role === "ops" && roles.includes("admin"));
}

export function hasAnyRole(
  requiredRoles: AccessRole[],
  userData?: UserData | null,
  tokenClaims?: TokenClaimsLike,
): boolean {
  return requiredRoles.some((role) => hasRole(role, userData, tokenClaims));
}
