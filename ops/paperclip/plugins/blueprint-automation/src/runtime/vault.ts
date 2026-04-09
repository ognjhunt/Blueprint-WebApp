import { randomUUID } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { readRuntimeState, RUNTIME_STATE_KEYS, writeRuntimeState } from "./state.js";
import { nowIso, type VaultGrant } from "./types.js";

type VaultGrantState = Record<string, VaultGrant>;

async function readVaultGrantState(ctx: PluginContext, companyId: string): Promise<VaultGrantState> {
  return await readRuntimeState<VaultGrantState>(ctx, companyId, RUNTIME_STATE_KEYS.vaultGrants) ?? {};
}

async function writeVaultGrantState(ctx: PluginContext, companyId: string, state: VaultGrantState) {
  await writeRuntimeState(ctx, companyId, RUNTIME_STATE_KEYS.vaultGrants, state);
}

export async function createVaultGrant(
  ctx: PluginContext,
  companyId: string,
  input: Omit<VaultGrant, "id" | "createdAt" | "revokedAt">,
) {
  const state = await readVaultGrantState(ctx, companyId);
  const grant: VaultGrant = {
    id: randomUUID(),
    createdAt: nowIso(),
    revokedAt: null,
    ...input,
  };
  state[grant.id] = grant;
  await writeVaultGrantState(ctx, companyId, state);
  return grant;
}

export async function listVaultGrants(ctx: PluginContext, companyId: string) {
  const state = await readVaultGrantState(ctx, companyId);
  return Object.values(state);
}

export async function getVaultGrant(ctx: PluginContext, companyId: string, grantId: string) {
  const state = await readVaultGrantState(ctx, companyId);
  return state[grantId] ?? null;
}

export async function revokeVaultGrant(ctx: PluginContext, companyId: string, grantId: string) {
  const state = await readVaultGrantState(ctx, companyId);
  const existing = state[grantId];
  if (!existing) {
    return null;
  }
  const next: VaultGrant = {
    ...existing,
    revokedAt: nowIso(),
  };
  state[grantId] = next;
  await writeVaultGrantState(ctx, companyId, state);
  return next;
}

export function isVaultGrantActive(grant: VaultGrant, at = Date.now()) {
  if (grant.revokedAt) {
    return false;
  }
  if (!grant.expiresAt) {
    return true;
  }
  const expiresAt = Date.parse(grant.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > at;
}
