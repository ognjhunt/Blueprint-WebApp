// @vitest-environment node
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const bindings = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ get dbAdmin() { return bindings.db; }, authAdmin: null }));
vi.mock("../utils/blueprintWorkStore", () => ({ checkWorkOperator: vi.fn(async () => true) }));
import { configuredFounderConsent, saveFounderCredential, readFounderCredential, FOUNDER_STORAGE,
  FOUNDER_CREDENTIAL_COLLECTION } from "../agents/communications-oauth-store";
import { encryptBoundFieldValue } from "../utils/field-encryption";
import { FOUNDER_CONNECTION_ID, FOUNDER_OAUTH_CALLBACK, type FounderCredential } from "../agents/communications-oauth";
import { FOUNDER_GMAIL_READ_SCOPE } from "../agents/communications-connection";
import { memoryFirestore } from "./fixtures/communications";
import { checkWorkOperator } from "../utils/blueprintWorkStore";
const credential: FounderCredential = { version: "blueprint.founder-gmail-credential.v1", binding: FOUNDER_CONNECTION_ID,
  mailbox: "nijel@tryblueprint.io", clientId: "mock-client", refreshToken: "MOCK_PRIVATE_REFRESH",
  ownerUid: "mock-owner", approvalReference: "owner-decision-1", scopes: [FOUNDER_GMAIL_READ_SCOPE],
  consentedAt: 1000, grantMode: "durable_reviewed", usableUntil: null };
function configured() {
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE", FOUNDER_STORAGE);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_REGISTERED_CALLBACK", FOUNDER_OAUTH_CALLBACK);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID", "mock-owner");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_APPROVAL_REF", "owner-decision-1");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_GRANT_MODE", "durable_reviewed");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID", "mock-client");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET", "MOCK_PRIVATE_CLIENT_SECRET");
}
beforeEach(() => {
  bindings.db = memoryFirestore(); vi.clearAllMocks();
  for (const key of ["BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_ENABLED", "BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE",
    "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID", "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET", "BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN", "FIELD_ENCRYPTION_KMS_KEY_NAME"]) vi.stubEnv(key, "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
});
afterEach(() => vi.unstubAllEnvs());
describe("private founder binding uses existing bound encryption and Firestore", () => {
  it("default-disabled configuration never reads a database or obtains provider access", () => {
    bindings.db.collection = vi.fn(); expect(configuredFounderConsent()).toBeNull(); expect(bindings.db.collection).not.toHaveBeenCalled();
  });
  it.each(["BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE", "BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID",
    "BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_APPROVAL_REF", "BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_REGISTERED_CALLBACK",
    "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID", "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET", "FIELD_ENCRYPTION_MASTER_KEY"])("blocks incomplete setup before a grant: %s", key => {
    configured(); vi.stubEnv(key, ""); expect(configuredFounderConsent()).toBeNull();
  });
  it("stores and reads a context-bound encrypted credential without plaintext or ops mutation", async () => {
    configured(); const ops = "MOCK_OPS_TOKEN"; vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", ops);
    await saveFounderCredential(credential, "flow-1");
    const serialized = JSON.stringify([...bindings.db.records.values()]);
    expect(serialized).not.toContain(credential.refreshToken); expect(serialized).not.toContain("MOCK_PRIVATE_CLIENT_SECRET");
    expect(serialized).not.toContain(ops); expect(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN).toBe(ops);
    expect(await readFounderCredential()).toEqual(credential);
    await expect(configuredFounderConsent()!.start({ uid: "mock-owner", tenantId: null, authTime: 1000 })).rejects.toThrow("founder_oauth_secure_storage_unavailable");
  });
  it("never overwrites a different founder receipt and ignores duplicate save receipts", async () => {
    configured(); await saveFounderCredential(credential, "flow-1");
    const snapshot = JSON.stringify([...bindings.db.records]);
    await saveFounderCredential(credential, "flow-1"); expect(JSON.stringify([...bindings.db.records])).toBe(snapshot);
    await expect(saveFounderCredential({ ...credential, refreshToken: "other" }, "flow-2")).rejects.toThrow("founder_binding_exists_owner_replacement_required");
    expect(JSON.stringify([...bindings.db.records])).toBe(snapshot);
  });
  it("requires approval/client/registered callback/owner controls to remain current", async () => {
    configured(); const adapter = configuredFounderConsent()!;
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_APPROVAL_REF", "changed");
    await expect(adapter.start({ uid: "mock-owner", tenantId: null, authTime: 1000 })).rejects.toThrow("founder_oauth_owner_required");
    expect(checkWorkOperator).not.toHaveBeenCalled();
  });
  it("does not initiate new consent when founder environment credentials already exist", async () => {
    configured(); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN", "existing-private");
    await expect(configuredFounderConsent()!.start({ uid: "mock-owner", tenantId: null, authTime: 1000 })).rejects.toThrow("founder_oauth_secure_storage_unavailable");
    expect(bindings.db.records.size).toBe(0);
  });
  it("rejects client/owner metadata swaps and expired temporary grants", async () => {
    configured(); await saveFounderCredential({ ...credential, grantMode: "temporary_testing", usableUntil: 1 }, "flow-1");
    await expect(readFounderCredential()).rejects.toThrow("founder_gmail_credential_invalid_or_expired");
    const row = bindings.db.records.get(`${FOUNDER_CREDENTIAL_COLLECTION}/${FOUNDER_CONNECTION_ID}`); row.ownerUid = "different";
    await expect(readFounderCredential()).rejects.toThrow("founder_gmail_credential_binding_invalid");
  });
  it("ciphertext cannot be transplanted between owner/client/flow contexts", async () => {
    configured(); await saveFounderCredential(credential, "flow-1");
    const row = bindings.db.records.get(`${FOUNDER_CREDENTIAL_COLLECTION}/${FOUNDER_CONNECTION_ID}`); row.flowId = "other-flow";
    await expect(readFounderCredential()).rejects.toThrow();
  });
  it("runtime scope cannot silently expand to sending", async () => {
    configured(); const row: any = { ...credential, scopes: [FOUNDER_GMAIL_READ_SCOPE, "https://www.googleapis.com/auth/gmail.send"] };
    const encrypted = await encryptBoundFieldValue(JSON.stringify(row), `${FOUNDER_CONNECTION_ID}:mock-owner:mock-client:flow-1`);
    bindings.db.records.set(`${FOUNDER_CREDENTIAL_COLLECTION}/${FOUNDER_CONNECTION_ID}`, { flowId: "flow-1", ownerUid: "mock-owner", clientId: "mock-client", encrypted });
    await expect(readFounderCredential()).rejects.toThrow("founder_gmail_credential_invalid_or_expired");
  });
});
