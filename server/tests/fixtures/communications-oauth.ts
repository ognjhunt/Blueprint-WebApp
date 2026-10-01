import { vi } from "vitest";
import { FounderGmailConsent, FOUNDER_OAUTH_CALLBACK, type FounderConsentPorts, type FounderBindingSnapshot, type FounderCredential } from "../../agents/communications-oauth";
import { FOUNDER_GMAIL_READ_SCOPE, FOUNDER_GMAIL_SEND_SCOPE } from "../../agents/communications-connection";
export function consentFixture() {
  const records = new Map<string, any>(); let clock = 1000, ready = true, owner = true;
  let lock = Promise.resolve();
  const copy = (value: any) => value === undefined ? undefined : structuredClone(value);
  const store = { get: async (id: string) => copy(records.get(id)), set: async (id: string, value: any) => { records.set(id, copy(value)); },
    transaction: async <T>(fn: any): Promise<T> => {
      const result = lock.then(async () => {
        const writes: (() => void)[] = [];
        const value = await fn({ get: store.get, set: (id: string, row: any) => writes.push(() => records.set(id, copy(row))), delete: (id: string) => writes.push(() => records.delete(id)) });
        writes.forEach(write => write()); return value;
      }); lock = result.catch(() => {}); return result;
    } };
  const privateValues = new Map<string, string>(); let count = 0;
  const ports: FounderConsentPorts = {
    flows: store,
    seal: async (value, aad) => { const id = String(++count); privateValues.set(aad + id, value); return { mockCiphertext: id }; },
    open: async (value: any, aad) => { const found = privateValues.get(aad + value.mockCiphertext); if (!found) throw new Error("mock_binding_invalid"); return found; },
    checkOwner: vi.fn(async () => owner), storageReady: vi.fn(async () => ready), save: vi.fn(async () => {}),
    exchange: vi.fn(async () => ({ refreshToken: "PRIVATE_REFRESH", accessToken: "PRIVATE_ACCESS", scopes: [FOUNDER_GMAIL_READ_SCOPE] })),
    verify: vi.fn(async () => ({ mailbox: "nijel@tryblueprint.io", sender: "nijel@tryblueprint.io" })), now: () => clock,
  };
  const config = { ownerUid: "owner-uid", clientId: "reviewed-google-client", callback: FOUNDER_OAUTH_CALLBACK as typeof FOUNDER_OAUTH_CALLBACK,
    approvalReference: "owner-decision-1", grantMode: "temporary_testing" as const };
  const consent = new FounderGmailConsent(config, ports), identity = { uid: "owner-uid", tenantId: null, authTime: 900 };
  const start = async () => {
    const flow = await consent.start(identity);
    return { ...flow, state: new URL(flow.authorizationUrl).searchParams.get("state")! };
  };
  return { records, ports, consent, identity, start, config,
    setClock: (value: number) => { clock = value; }, setReady: (value: boolean) => { ready = value; }, setOwner: (value: boolean) => { owner = value; } };
}

export function sendUpgradeFixture() {
  const f = consentFixture(); f.setReady(false);
  let binding: FounderBindingSnapshot | null = { flowId: "readonly-flow", revision: "a".repeat(64), sendScopeGranted: false };
  let saved: FounderCredential | null = null;
  f.ports.currentBinding = vi.fn(async () => structuredClone(binding));
  f.ports.saveUpgrade = vi.fn(async (credential, flowId, previous) => {
    if (binding?.revision !== previous.revision) throw new Error("mock_binding_changed");
    await f.ports.flows.transaction(async tx => {
      const row = await tx.get(flowId);
      tx.set(flowId, { ...row, phase: "connected_send_capable", secrets: null });
    });
    saved = credential; binding = { flowId, revision: "b".repeat(64), sendScopeGranted: true };
  });
  vi.mocked(f.ports.exchange).mockResolvedValue({ refreshToken: "PRIVATE_NEW_REFRESH", accessToken: "PRIVATE_ACCESS", scopes: [FOUNDER_GMAIL_READ_SCOPE, FOUNDER_GMAIL_SEND_SCOPE] });
  const startUpgrade = async () => {
    const flow = await f.consent.start(f.identity, "send_upgrade");
    return { ...flow, state: new URL(flow.authorizationUrl).searchParams.get("state")! };
  };
  return { ...f, startUpgrade, getBinding: () => structuredClone(binding), getSaved: () => structuredClone(saved),
    setBinding: (value: FounderBindingSnapshot | null) => { binding = value; } };
}
