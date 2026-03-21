import type { Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

export type AccessRole = "admin" | "ops";

type FirebaseUserLike = {
  uid?: string;
  email?: string;
  admin?: boolean;
  ops?: boolean;
  role?: unknown;
  roles?: unknown;
} | null | undefined;

type UserDocLike = Record<string, unknown> | null;

export type AccessContext = {
  uid: string | null;
  email: string | null;
  roles: AccessRole[];
  isAdmin: boolean;
  isOps: boolean;
};

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
      for (const entry of rawValue) {
        const role = asRole(entry);
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

function rolesFromFirebaseUser(user: FirebaseUserLike): AccessRole[] {
  if (!user) {
    return [];
  }

  const roles = new Set<AccessRole>(
    collectRoles([user.roles, user.role]),
  );

  if (user.admin === true) {
    roles.add("admin");
  }
  if (user.ops === true) {
    roles.add("ops");
  }

  return [...roles];
}

function rolesFromUserDoc(userDoc: UserDocLike): AccessRole[] {
  if (!userDoc) {
    return [];
  }

  const roles = new Set<AccessRole>(
    collectRoles([
      userDoc.roles,
      userDoc.role,
      userDoc.accessRoles,
    ]),
  );

  if (userDoc.admin === true) {
    roles.add("admin");
  }
  if (userDoc.ops === true) {
    roles.add("ops");
  }

  return [...roles];
}

async function loadUserDocRoles(uid: string | null): Promise<AccessRole[]> {
  if (!uid || !db) {
    return [];
  }

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return [];
    }
    return rolesFromUserDoc((userDoc.data() || {}) as Record<string, unknown>);
  } catch {
    return [];
  }
}

export async function resolveAccessContext(res: Response): Promise<AccessContext> {
  const firebaseUser = res.locals.firebaseUser as FirebaseUserLike;
  const uid = typeof firebaseUser?.uid === "string" ? firebaseUser.uid.trim() || null : null;
  const email =
    typeof firebaseUser?.email === "string" ? firebaseUser.email.trim().toLowerCase() || null : null;

  const roles = new Set<AccessRole>(rolesFromFirebaseUser(firebaseUser));
  const userDocRoles = await loadUserDocRoles(uid);
  for (const role of userDocRoles) {
    roles.add(role);
  }

  return {
    uid,
    email,
    roles: [...roles],
    isAdmin: roles.has("admin"),
    isOps: roles.has("admin") || roles.has("ops"),
  };
}

export async function hasAnyRole(res: Response, requiredRoles: AccessRole[]): Promise<boolean> {
  const context = await resolveAccessContext(res);
  return requiredRoles.some((role) => context.roles.includes(role));
}
