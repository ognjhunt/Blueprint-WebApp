// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
// Explicit unit contract fake: native strict IndexedDB execution is a separate layer.
const durability = vi.hoisted(() => ({ rows: new Map<string, { value: any; retired: boolean }>() }));
vi.mock("@/lib/siteCaptureDurability", () => ({
  readDurableSiteCaptureRecovery: async (key: string) => {
    const row = durability.rows.get(key);
    return row ? JSON.parse(JSON.stringify(row)) : null;
  },
  writeDurableSiteCaptureRecovery: async (key: string, value: any, replaceIdentity = false) => {
    const current = durability.rows.get(key);
    if (!replaceIdentity && current && (current.retired || current.value?.requestId !== value.requestId
      || current.value?.retryToken !== value.retryToken)) throw new Error("Fixture durability transaction aborted");
    const { task, location, email, company, method, region, regionManuallySet, privateHandling } = value.draft;
    durability.rows.set(key, { retired: false, value: {
      version: value.version, savedAt: value.savedAt, requestId: value.requestId, retryToken: value.retryToken,
      draft: { task, location, email, company, method, region, regionManuallySet, ...(privateHandling === true ? { privateHandling } : {}) },
      pending: value.pending ? { body: value.pending.body, endpoint: value.pending.endpoint, acknowledged: value.pending.acknowledged } : null,
    } });
  },
  retireDurableSiteCaptureRecovery: async (key: string) => { durability.rows.set(key, { value: null, retired: true }); },
  durableSiteCaptureRecoveryKeys: async () => [...durability.rows.keys()],
}));
import catalog from "../../../docs/reliability/2026-10-07/program-intake.json";
import { newSiteCaptureRecovery, readSiteCaptureRecovery, writeSiteCaptureRecovery, forgetSiteCaptureRecovery,
  siteCaptureDraftKey, SITE_CAPTURE_DRAFT_TTL_MS, type SiteCaptureRecovery } from "@/lib/siteCaptureDraft";
const fixedTime = Date.UTC(2026, 9, 8, 4);
const key = siteCaptureDraftKey(null, "default");
function base(): SiteCaptureRecovery {
  const value = newSiteCaptureRecovery(); value.draft = {...value.draft, task: "Move cartons", location: "Austin, TX", email: "operator@example.test", company: "Fixture company", region: "us"};
  return value;
}
function pending(value: SiteCaptureRecovery) {
  value.pending = {endpoint: "/api/inbound-request", acknowledged: false, body: JSON.stringify({requestId: value.requestId, retryToken: value.retryToken, buyerType: "site_operator", taskStatement: value.draft.task, siteLocation: value.draft.location, captureRegion: value.draft.region})};
  return value;
}
function changeBody(value: SiteCaptureRecovery, property: string, replacement: unknown) {
  const body = JSON.parse(value.pending!.body); body[property] = replacement; value.pending!.body = JSON.stringify(body);
}
beforeEach(() => { durability.rows.clear(); localStorage.clear(); vi.spyOn(Date, "now").mockReturnValue(fixedTime); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
for (const item of catalog.cases.filter(item => item.layer === "local-storage-helper")) {
  it(`${item.id}: ${item.meaningful_condition}`, () => {
    const value: any = base(); let raw: string | null = null;
    if (item.family === "return") {
      switch (item.operation) {
        case "valid_empty": value.draft.task = ""; value.draft.location = ""; break;
        case "valid_unicode": value.draft.task = "搬运 cartons — café"; break;
        case "valid_maximum": value.draft.task = "t".repeat(2000); value.draft.location = "l".repeat(300); value.draft.email = "e".repeat(320); value.draft.company = "c".repeat(200); break;
        case "valid_inferred_us": value.draft.regionManuallySet = false; break;
        case "valid_manual_non_us": value.draft.region = "non_us"; value.draft.regionManuallySet = true; break;
        case "valid_upload": value.draft.method = "upload"; break;
        case "valid_visit": value.draft.method = "visit"; break;
        case "valid_uncertain": pending(value); break;
        case "valid_acknowledged": pending(value).pending!.acknowledged = true; break;
        case "valid_boundary_age": value.savedAt = fixedTime - SITE_CAPTURE_DRAFT_TTL_MS + 1; break;
        case "expired": value.savedAt = fixedTime - SITE_CAPTURE_DRAFT_TTL_MS; break;
        case "future": value.savedAt = fixedTime + 60001; break;
        case "missing_timestamp": delete value.savedAt; break;
        case "bad_timestamp": value.savedAt = "today"; break;
        case "wrong_version": value.version = 2; break;
        case "malformed_json": raw = "{"; break;
        case "oversized_record": raw = " ".repeat(25001); break;
        case "null_record": raw = "null"; break;
        case "missing_draft": delete value.draft; break;
        case "wrong_task_type": value.draft.task = {}; break;
        case "task_overlong": value.draft.task = "t".repeat(2001); break;
        case "location_overlong": value.draft.location = "l".repeat(301); break;
        case "email_overlong": value.draft.email = "e".repeat(321); break;
        case "company_overlong": value.draft.company = "c".repeat(201); break;
        case "wrong_method": value.draft.method = "unknown"; break;
        case "wrong_region": value.draft.region = "europe"; break;
        case "wrong_manual_flag": value.draft.regionManuallySet = "true"; break;
        case "missing_pending": delete value.pending; break;
        case "wrong_request_id": value.requestId = "another-request"; break;
        case "wrong_retry_token": value.retryToken = "short"; break;
        default: throw new Error(`Unmapped catalog case ${item.id}`);
      }
      localStorage.setItem(key, raw ?? JSON.stringify(value));
      const recovered = readSiteCaptureRecovery(key);
      if (item.expected === "accept") expect(recovered).toEqual(value); else expect(recovered).toBeNull();
      return;
    }
    const routes: Record<string, [string | null, string, string | null, string]> = {
      anonymous_to_account: [null,"default","owner","default"], account_to_anonymous: ["owner","default",null,"default"], account_to_other: ["owner","default","other","default"],
      default_to_claude: [null,"default",null,"claude-opus-5-5"], claude_to_default: [null,"claude-opus-5-5",null,"default"],
      default_to_sol: [null,"default",null,"gpt-6.1-sol-agents-api"], sol_to_default: [null,"gpt-6.1-sol-agents-api",null,"default"],
      claude_to_sol: [null,"claude-opus-5-5",null,"gpt-6.1-sol-agents-api"], sol_to_claude: [null,"gpt-6.1-sol-agents-api",null,"claude-opus-5-5"],
      legacy_to_sol: [null,"gpt-6-sol-agents-api",null,"gpt-6.1-sol-agents-api"],
    };
    if (item.expected === "isolated") {
      const [sourceOwner,sourceMode,targetOwner,targetMode] = routes[item.operation];
      const source = siteCaptureDraftKey(sourceOwner,sourceMode), target = siteCaptureDraftKey(targetOwner,targetMode);
      writeSiteCaptureRecovery(source,pending(value)); expect(readSiteCaptureRecovery(target)).toBeNull(); expect(readSiteCaptureRecovery(source)).toEqual(value); return;
    }
    pending(value);
    switch (item.operation) {
      case "bad_endpoint": value.pending.endpoint = "https://example.test/send"; break;
      case "bad_pending_type": value.pending = "pending"; break;
      case "bad_body_type": value.pending.body = {}; break;
      case "oversized_body": value.pending.body = " ".repeat(16001); break;
      case "bad_body_json": value.pending.body = "{"; break;
      case "swapped_request": changeBody(value,"requestId","another-request"); break;
      case "swapped_token": changeBody(value,"retryToken","another-token"); break;
      case "swapped_buyer": changeBody(value,"buyerType","robot_team"); break;
      case "changed_task": changeBody(value,"taskStatement","Another task"); break;
      case "changed_location": changeBody(value,"siteLocation","London"); break;
      case "changed_region": changeBody(value,"captureRegion","non_us"); break;
      case "bad_acknowledgement": value.pending.acknowledged = "yes"; break;
      case "read_denied": vi.spyOn(Storage.prototype,"getItem").mockImplementation(() => {throw new Error("denied");}); expect(readSiteCaptureRecovery(key)).toBeNull(); return;
      case "write_denied": vi.spyOn(Storage.prototype,"setItem").mockImplementation(() => {throw new Error("denied");}); expect(writeSiteCaptureRecovery(key,value)).toBe(false); return;
      case "clear_denied": vi.spyOn(Storage.prototype,"removeItem").mockImplementation(() => {throw new Error("denied");}); expect(forgetSiteCaptureRecovery(key)).toBe(false); return;
      case "clear_local": writeSiteCaptureRecovery(key,value); expect(forgetSiteCaptureRecovery(key)).toBe(true); expect(readSiteCaptureRecovery(key)).toBeNull(); return;
      case "no_capture_url": value.captureUrl = "/capture-upload/private-fixture"; writeSiteCaptureRecovery(key,value); expect(localStorage.getItem(key)).not.toContain("capture-upload/"); return;
      case "no_video_bytes": value.file = "raw-video-bytes"; value.draft.video = "raw-video-bytes"; writeSiteCaptureRecovery(key,value); expect(localStorage.getItem(key)).not.toContain("raw-video-bytes"); return;
      case "same_scope": writeSiteCaptureRecovery(key,value); expect(readSiteCaptureRecovery(key)).toEqual(value); return;
      case "missing_scope": expect(writeSiteCaptureRecovery(null,value)).toBe(false); expect(readSiteCaptureRecovery(null)).toBeNull(); return;
      default: throw new Error(`Unmapped catalog case ${item.id}`);
    }
    localStorage.setItem(key, JSON.stringify(value)); expect(readSiteCaptureRecovery(key)).toBeNull();
  });
}
it("ACCESS-REGRESSION-031: real UID named anonymous cannot collide with the unauthenticated scope",()=>{
  expect(siteCaptureDraftKey("anonymous","default")).not.toBe(siteCaptureDraftKey(null,"default"));
});

it("retains private handling across local autosave and durable restoration without changing job identity", async () => {
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, action: () => unknown) => action() } });
  const { writeSiteCaptureRecoveryDurably, hydrateSiteCaptureRecovery } = await import("@/lib/siteCaptureDraft");
  const value = base(); value.draft.privateHandling = true;
  expect(await writeSiteCaptureRecoveryDurably(key, value)).toBe(true);
  expect(readSiteCaptureRecovery(key)?.draft.privateHandling).toBe(true);
  localStorage.clear();
  await hydrateSiteCaptureRecovery(key);
  expect(readSiteCaptureRecovery(key)).toMatchObject({ requestId: value.requestId, retryToken: value.retryToken, draft: { privateHandling: true } });
});
