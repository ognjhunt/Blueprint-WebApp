// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";
import { createSiteClaimToken } from "../utils/request-review-auth";
import { PREVIOUS_PRIVACY_VERSION, PREVIOUS_TERMS_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "../../client/src/lib/legalAcceptance";
import { buildLegalAcceptanceRecord, legalEffectiveAtMs } from "../../client/src/lib/legalAcceptance";
import { syntheticQualifiedRun } from "./helpers/recommendation-evidence";
import { deploymentCatalogWithDigest } from "../../client/src/lib/deploymentEmbodimentSupport";
import { ownerClosure } from "./fixtures/website-run-closure";
const state = vi.hoisted(() => ({
  records: new Map<string, any>(),
  intakes: [] as any[],
  notices: vi.fn(async () => ({ enqueued: true })),
}));
const admission = vi.hoisted(() => vi.fn(async () => true));
/** Whether the walkthrough bucket can be read; it starts empty (nothing filmed). */
const storage = vi.hoisted(() => ({ readable: true }));
vi.mock("../utils/accountInvitations", () => ({ accountHasAdmission: admission }));
// Workspace route tests exercise saved records; inference is a separate boundary.
vi.mock("../utils/siteAssessmentPublic", () => ({ loadCurrentSiteAdvisory: vi.fn(async () => null) }));

const preparation = vi.hoisted(() => ({ read: vi.fn(async () => ({
  state: "failed_retryable", correlationId: "bp-prep-1234567890abcdef",
})) }));
vi.mock("../utils/websitePreparationStatus", () => ({ loadCurrentWebsitePreparationStatus: preparation.read }));
/** The 3D preview's scene preparation (fetching and unpacking the bundle) as the view ticket starts it. */
const viewerFiles = vi.hoisted(() => ({ prepare: vi.fn(async () => ({ splat: "/tmp/splat", settings: "/tmp/settings" })) }));
vi.mock("../utils/websiteAtlasPreviewView", async (original) => ({
  ...await original<typeof import("../utils/websiteAtlasPreviewView")>(),
  websiteAtlasPreviewViewerFiles: viewerFiles.prepare,
}));
vi.mock("../utils/taskLifecycleNotifications", () => ({
  enqueueTaskLifecycleNotification: state.notices,
}));
/** Blueprint's runs for a job as the evidence store reads them; the site's view is cut from these. */
const managedEvidence = vi.hoisted(() => ({ load: vi.fn(async () => ({ managedEvidence: [] as any[] })) }));
vi.mock("../utils/jobManagedEvaluation", async (original) => ({
  ...await original<typeof import("../utils/jobManagedEvaluation")>(),
  loadManagedJobEvidenceForWorkspace: managedEvidence.load,
}));
function ref(path: string): any {
  return {
    id: path.split("/").at(-1),
    path,
    get: async () => ({
      exists: state.records.has(path),
      id: path.split("/").at(-1),
      data: () => state.records.get(path),
      ref: ref(path),
    }),
    set: async (data: any, options?: { merge?: boolean }) => {
      const merge = (a: any, b: any): any => Object.fromEntries(Object.entries({ ...a, ...b }).map(([key, value]) =>
        [key, value && typeof value === "object" && !Array.isArray(value) && b[key] && a?.[key]
          ? merge(a[key], b[key]) : value]));
      state.records.set(path, options?.merge ? merge(state.records.get(path), data) : data);
    },
    update: async (data: any) => {
      const current = structuredClone(state.records.get(path) || {});
      for (const [key, value] of Object.entries(data)) {
        const parts = key.split(".");
        let target = current;
        for (const part of parts.slice(0, -1)) target = target[part] ??= {};
        target[parts.at(-1)!] = value;
      }
      state.records.set(path, current);
    },
    delete: async () => state.records.delete(path),
    collection: (name: string) => collection(`${path}/${name}`),
  };
}
function collection(
  path: string,
  filters: Array<[string, unknown]> = [],
  limit = Infinity,
): any {
  return {
    doc: (id = `note-${state.records.size}`) => ref(`${path}/${id}`),
    where: (key: string, _op: string, value: unknown) =>
      collection(path, [...filters, [key, value]], limit),
    limit: (n: number) => collection(path, filters, n),
    get: async () => ({
      docs: [...state.records.entries()]
        .filter(
          ([key, data]) =>
            key.startsWith(`${path}/`) &&
            key.split("/").length === path.split("/").length + 1 &&
            filters.every(
              ([field, value]) =>
                field.split(".").reduce((data, key) => data?.[key], data) ===
                value,
            ),
        )
        .slice(0, limit)
        .map(([key, data]) => ({
          id: key.split("/").at(-1),
          data: () => data,
          ref: ref(key),
        })),
    }),
    add: async (data: any) => {
      const key = `${path}/note-${state.records.size}`;
      state.records.set(key, data);
      return ref(key);
    },
  };
}
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedUploadBucket } = await import("./helpers/fake-upload-bucket");
  return {
    default: {
      firestore: {
        FieldValue: { serverTimestamp: () => new Date().toISOString() },
      },
    },
    dbAdmin: {
      collection: (name: string) => collection(name),
      runTransaction: async (fn: any) =>
        fn({
          get: (r: any) => r.get(),
          update: (r: any, data: any) => r.update(data),
          set: (r: any, data: any, options?: any) => r.set(data, options),
        }),
    },
    // The job page reads whether the walkthrough is saved, as the private page does.
    storageAdmin: { bucket: () => {
      if (!storage.readable) throw Object.assign(new Error("Storage is unreachable"), { code: 503 });
      return sharedUploadBucket.bucket;
    } },
  };
});
vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin: async (value: any) => {
    const decoded = structuredClone(value);
    if (typeof decoded.contact?.email === "string")
      decoded.contact.email = decoded.contact.email.replace(/^encrypted:/, "");
    if (typeof decoded.request?.taskDescription === "string")
      decoded.request.taskDescription = decoded.request.taskDescription.replace(
        /^encrypted:/,
        "",
      );
    return decoded;
  },
  encryptFieldValue: async (value: string) => `encrypted:${value}`,
  decryptFieldValue: async (value: string) => value.replace(/^encrypted:/, ""),
}));
vi.mock("../routes/inbound-request", () => ({
  submitInboundRequest: async (req: any, res: any) => {
    state.intakes.push({
      body: req.body,
      metadata: res.locals.workspaceIntake,
    });
    state.records.set(`inboundRequests/${req.body.requestId}`, {
      ...res.locals.workspaceIntake,
      request: { ...req.body },
      contact: { email: req.body.email },
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json({ requestId: req.body.requestId, ok: true });
  },
}));
const terms = {
  successRate: 95,
  cycleTimeSeconds: 30,
  pilotBudgetUsd: 25000,
  deploymentBudgetUsd: null,
  targetDate: null,
  successDefinition: "Complete a pack without drops",
};
function task(owner = "site-1") {
  return {
    requestId: "task-1",
    account_owner_uid: owner,
    createdAt: "2026-09-13T10:00:00Z",
    request: {
      buyerType: "site_operator",
      siteName: "Confidential Site",
      siteLocation: "123 Private Rd",
      taskStatement: "Pack cartons",
      targetSiteType: "Fulfillment",
      pilotOpportunity: {
        requested: true,
        visibility: "anonymized",
        anonymizedSummary: "Pack cartons into totes",
        benchmarkProfile: "40 trials",
        objectProfile: "Cartons",
        operationalProfile: "One shift",
        integrationEnvironment: "Conveyor",
        rolloutReadiness: "Owner ready",
        dataUsePermissions: {
          evaluateExistingPolicy: "granted",
          siteSpecificAdaptation: "not_granted",
          retainImprovements: "not_granted",
          generalModelTraining: "not_granted",
        },
      },
    },
    workspace_task: { terms },
    qualification_state: "qualified_ready",
    opportunity_state: "handoff_ready",
    structured_intake: {
      site_operator_claim_outcome: "site_claim_access_boundary_ready",
      access_boundary_outcome: "access_boundary_defined",
      pilot_opportunity_outcome: "evaluation_candidate",
      missing_pilot_opportunity_fields: [],
    },
    ops: { rights_status: "verified", capture_status: "approved" },
  };
}
function run(uid = "robot-1") {
  return {
    buyer_user_id: uid,
    site_submission_id: "application-1",
    status: "decided",
    updated_at_iso: "2026-09-13T11:00:00Z",
    benchmark_projection: {
      status: "complete",
      policy_aggregates: [
        {
          policy_id: "SECRET-POLICY",
          checkpoint_sha256: "SECRET-CHECKPOINT",
          metrics: {
            full_task_success: { estimate: 0.96, sample_count: 40 },
            efficiency: { estimate: 27 },
          },
        },
      ],
    },
    pipeline_result: { cycle_time_seconds: { estimate: 27, unit: "seconds" } },
    private_endpoint: "https://secret.example.com",
  };
}
function qualifiedRunForTask() {
  const qualified = syntheticQualifiedRun("task-1", "qualified-run");
  qualified.result!.observed.medianCycleSeconds = 27;
  return qualified;
}
const setup = {
  id: "setup-1",
  name: "Atlas",
  embodiment: "Mobile manipulator",
  policyName: "Packing",
  version: "v4",
  delivery: "container",
  reference: "https://registry.example.com/team/policy",
  notes: "",
};
let server: Server, base: string;
beforeEach(async () => {
  storage.readable = true;
  (await import("./helpers/fake-upload-bucket")).sharedUploadBucket.clear();
  admission.mockClear();
  admission.mockResolvedValue(true);
  state.records.clear();
  state.intakes.length = 0;
  state.records.set("users/site-1", {
    buyerType: "site_operator",
    name: "Site Owner",
  });
  state.records.set("users/site-2", {
    buyerType: "site_operator",
    name: "Other Site",
  });
  state.records.set("users/robot-1", {
    buyerType: "robot_team",
    name: "Robot Owner",
  });
  state.records.set("users/robot-2", {
    buyerType: "robot_team",
    name: "Other Robot",
  });
  const { default: router } = await import("../routes/workspace");
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.firebaseUser = {
      uid: req.headers["x-user"] || "",
      admin: req.headers["x-test-admin"] === "1",
      email: `${req.headers["x-user"]}@example.com`,
      email_verified: req.headers["x-unverified"] !== "1",
    };
    next();
  });
  app.use(router);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function api(
  path: string,
  uid: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  return fetch(`${base}${path}`, {
    method,
    headers: { "x-user": uid, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
describe("workspace access and projections", () => {
  it.each(["legacy", "current", "stale"])("requires displayed versions for an unverified source-bound acceptance (%s)", async mode => {
    const explicit = mode === "current";
    const acceptance = { ...buildLegalAcceptanceRecord({ acceptedAt: "2026-10-23T12:00:00Z" }),
      terms_version: PREVIOUS_TERMS_VERSION, privacy_version: PREVIOUS_PRIVACY_VERSION };
    state.records.set("inboundRequests/unverified-job", { ...task(), account_owner_uid: undefined,
      contact: { email: "site-1@example.com" }, terms_acceptance: acceptance });
    const token = createSiteClaimToken("unverified-job");
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T04:50:00Z"));
    try {
      const response = await fetch(`${base}/setup`, { method: "POST",
        headers: { "Content-Type": "application/json", "x-user": "site-1", "x-unverified": "1" },
        body: JSON.stringify({ name: "Site Owner", organization: "Company", workspaceType: "site_operator",
          siteClaimToken: token, acceptedTerms: true,
          ...(mode !== "legacy" ? { termsVersion: explicit ? TERMS_VERSION : "2026-11-15.2", privacyVersion: PRIVACY_VERSION } : {}) }) });
      expect(response.status).toBe(explicit ? 200 : 400);
      if (explicit) expect(state.records.get("users/site-1")).toMatchObject({
        termsAcceptance: { accepted_terms: true, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION } });
      else expect(state.records.get("users/site-1")).not.toHaveProperty("termsAcceptance");
      expect(state.records.get("inboundRequests/unverified-job").terms_acceptance).toEqual(acceptance);
      expect(state.records.get("inboundRequests/unverified-job").account_owner_uid).toBeUndefined();
    } finally { clock.mockRestore(); }
  });

  it.each(["setup", "claim"])("retains the older acceptance versions when %s reuses intake consent", async mode => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T04:50:00Z"));
    try {
      const acceptance = { ...buildLegalAcceptanceRecord({ acceptedAt: "2026-10-23T12:00:00Z" }),
        terms_version: PREVIOUS_TERMS_VERSION, privacy_version: PREVIOUS_PRIVACY_VERSION };
      state.records.set("inboundRequests/continuity-job", { ...task(), account_owner_uid: undefined,
        contact: { email: "site-1@example.com" }, terms_acceptance: acceptance });
      const token = createSiteClaimToken("continuity-job");
      const response = mode === "setup"
        ? await api("/setup", "site-1", { name: "Site Owner", organization: "Company", workspaceType: "site_operator", siteClaimToken: token })
        : await api("/claim", "site-1", { token });
      expect(response.status).toBe(200);
      const recorded = structuredClone(state.records.get("users/site-1"));
      expect(recorded).toMatchObject({ acceptedTerms: true, termsVersion: acceptance.terms_version,
        privacyVersion: acceptance.privacy_version, termsAcceptance: acceptance });
      expect((await (await api("/setup", "site-1")).json()).termsRequired).toBe(false);
      clock.mockReturnValue(legalEffectiveAtMs(TERMS_VERSION));
      expect((await (await api("/setup", "site-1")).json()).termsRequired).toBe(true);
      expect(state.records.get("users/site-1")).toEqual(recorded);
    } finally { clock.mockRestore(); }
  });

  it.each([true, false])("uses the actual recorded acceptance (%s) when legacy fields claim a newer version", async accepted => {
    const acceptance = { ...buildLegalAcceptanceRecord({ acceptedAt: "2026-10-23T12:00:00Z" }),
      accepted_terms: accepted, terms_version: PREVIOUS_TERMS_VERSION, privacy_version: PREVIOUS_PRIVACY_VERSION };
    const recorded = { ...state.records.get("users/site-1"), acceptedTerms: true,
      termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, termsAcceptance: acceptance };
    state.records.set("users/site-1", recorded);
    const retained = structuredClone(recorded);
    const effective = legalEffectiveAtMs(TERMS_VERSION);
    const clock = vi.spyOn(Date, "now").mockReturnValue(effective - 1);
    try {
      expect((await (await api("/setup", "site-1")).json()).termsRequired).toBe(!accepted);
      clock.mockReturnValue(effective);
      const response = await api("/setup", "site-1");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ termsRequired: true });
      expect(state.records.get("users/site-1")).toEqual(retained);
    } finally { clock.mockRestore(); }
  });

  it.each(["nested", "legacy"])("uses the recorded pending terms pair in the %s account shape until its effective date", async shape => {
    const acceptance = { ...buildLegalAcceptanceRecord({ acceptedAt: "2026-10-23T12:00:00Z" }),
      terms_version: PREVIOUS_TERMS_VERSION, privacy_version: PREVIOUS_PRIVACY_VERSION };
    const record = { ...state.records.get("users/site-1"), ...(shape === "nested"
      ? { termsAcceptance: acceptance }
      : { acceptedTerms: true, termsVersion: acceptance.terms_version, privacyVersion: acceptance.privacy_version }) };
    state.records.set("users/site-1", record);
    const retained = structuredClone(record);
    const effective = legalEffectiveAtMs(TERMS_VERSION);
    const clock = vi.spyOn(Date, "now");
    try {
      for (const [now, termsRequired] of [[effective - 1, false], [effective, true], [effective + 1, true]] as const) {
        clock.mockReturnValue(now);
        const response = await api("/setup", "site-1");
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ termsRequired });
        expect(state.records.get("users/site-1")).toEqual(retained);
      }
    } finally { clock.mockRestore(); }
  });

  it.each([false, undefined])("does not infer pending terms acceptance from an accepted flag of %s", async accepted => {
    state.records.set("users/site-1", { ...state.records.get("users/site-1"),
      termsAcceptance: { ...buildLegalAcceptanceRecord({ acceptedAt: "2026-10-23T12:00:00Z" }),
        accepted_terms: accepted, terms_version: PREVIOUS_TERMS_VERSION, privacy_version: PREVIOUS_PRIVACY_VERSION } });
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T04:50:00Z"));
    try {
      const response = await api("/setup", "site-1");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ termsRequired: true });
    } finally { clock.mockRestore(); }
  });

  // Owner, 2026-11-12 (~21:45Z): the limit of three introductions goes, so the Terms move to 2026-11-12.2. A site that
  // accepted 2026-11-12.1 is asked to accept the current versions; nothing is recorded for it until it does.
  it.each(["nested", "legacy"])("asks a %s account that accepted 2026-11-12.1 to accept 2026-11-12.2", async shape => {
    const acceptance = { ...buildLegalAcceptanceRecord({ acceptedAt: "2026-11-12T12:00:00Z" }),
      terms_version: "2026-11-12.1", privacy_version: "2026-11-12.1" };
    const record = { ...state.records.get("users/site-1"), ...(shape === "nested"
      ? { termsAcceptance: acceptance }
      : { acceptedTerms: true, termsVersion: "2026-11-12.1", privacyVersion: "2026-11-12.1" }) };
    state.records.set("users/site-1", record);
    const retained = structuredClone(record);
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-12T22:00:00Z"));
    try {
      const response = await api("/setup", "site-1");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ termsRequired: true });
      expect(state.records.get("users/site-1")).toEqual(retained);
    } finally { clock.mockRestore(); }
  });

  // Privacy 2026-11-13.1 changes only what may happen to jobs started from now on, and the Terms do not change: a site
  // that accepted Terms and Privacy 2026-11-12.2 is asked nothing, and nothing is recorded for it.
  it.each(["nested", "legacy"])("asks nothing of a %s account that accepted Terms and Privacy 2026-11-12.2", async shape => {
    const acceptance = { ...buildLegalAcceptanceRecord({ acceptedAt: "2026-11-12T23:00:00Z" }),
      terms_version: "2026-11-12.2", privacy_version: "2026-11-12.2" };
    const record = { ...state.records.get("users/site-1"), ...(shape === "nested"
      ? { termsAcceptance: acceptance }
      : { acceptedTerms: true, termsVersion: "2026-11-12.2", privacyVersion: "2026-11-12.2" }) };
    state.records.set("users/site-1", record);
    const retained = structuredClone(record);
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-13T09:00:00Z"));
    try {
      const response = await api("/setup", "site-1");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ termsRequired: false });
      expect(state.records.get("users/site-1")).toEqual(retained);
    } finally { clock.mockRestore(); }
  });

  it("withholds persisted capture derivatives on the owner's return after withdrawal", async () => {
    state.records.set("inboundRequests/task-1", { ...task(), consent_revoked: true,
      site_task_brief_confirmed_at: "2026-09-18T00:00:00Z", capture_coverage: { covers_scene: true } });
    state.records.set("siteTaskBriefs/task-1", { requestId: "task-1", summary: "Derived reading",
      proposed: [], unresolved: [], captureMode: "self_capture", draftedFrom: ["observation"],
      draftedAtIso: "2026-09-17T00:00:00Z", confirmedAtIso: "2026-09-18T00:00:00Z" });
    state.records.set("captureUploadSessions/walkthrough-task-1", { world_reconstruction: { state: "ready",
      assets: { launchUrl: "https://viewer.example/withdrawn", thumbnailUrl: "https://viewer.example/withdrawn.png" } } });
    state.records.set("evaluationRuns/run-withdrawn", { runId: "run-withdrawn",teamId: "team",sceneId: "task-1",
      state: "completed",result: { observed: { episodesRun: 10, episodesSucceeded: 8 } } });
    const before = structuredClone([...state.records]);
    const response = await api("/", "site-1");
    expect(response.status).toBe(200);
    const viewed = (await response.json()).tasks.find((item: any) => item.id === "task-1");
    // The list row names the job and the withdrawal; nothing derived from the capture.
    expect(viewed).toEqual({ id: "task-1", title: expect.any(String), siteName: expect.any(String),
      location: expect.any(String), archived: false, recordingPermissionWithdrawn: true, createdAt: viewed.createdAt });
    expect(JSON.stringify(viewed)).not.toMatch(/withdrawn\.png|viewer\.example|Derived reading/);
    expect([...state.records]).toEqual(before);
    expect((await (await api("/", "site-2")).json()).tasks.map((item: any) => item.id)).not.toContain("task-1");
  });
  it("records only the owner's withdrawal, cancels queued work, and never claims deletion", async () => {
    state.records.set("inboundRequests/task-1", { ...task(), capture_coverage_pending: true, coverageReviewPending: true });
    state.records.set("evaluationRuns/run", { runId: "run", sceneId: "task-1", state: "requested", dispatchPending: true });
    expect((await api("/tasks/task-1/recording-consent/withdraw", "site-2", {})).status).toBe(404);
    const first = await api("/tasks/task-1/recording-consent/withdraw", "site-1", {});
    expect(first.status).toBe(202);
    const firstBody = await first.json();
    const receipt = firstBody.receipt;
    expect(receipt.deletionConfirmed).toBe(false);
    // Same shared effect as the signed owner link; deletion is queued, not claimed.
    expect(firstBody.withdrawal).toMatchObject({ state: "uploads_stopped_cleanup_pending", uploadsStopped: true,
      deletionConfirmed: false, storageDeletion: { state: "pending" } });
    expect(state.records.get("inboundRequests/task-1").captureDeletionPending).toBe(true);
    expect(receipt.pipelineAcknowledged).toBe(false);
    expect(state.records.get("inboundRequests/task-1").account_owner_uid).toBe("site-1");
    expect(state.records.get("inboundRequests/task-1").request.consent_attestation.granted).toBe(false);
    expect(state.records.get("inboundRequests/task-1").capture_coverage_pending).toBe(false);
    expect(state.records.get("inboundRequests/task-1").coverageReviewPending).toBe(false);
    expect(state.records.get("evaluationRuns/run").cancellationRequested).toBe(true);
    expect(state.records.get("evaluationRuns/run").dispatchPending).toBe(false);
    expect((await (await api("/tasks/task-1/recording-consent/withdraw", "site-1", {})).json()).receipt).toEqual(receipt);
  });
  it("requires authentication and a supported account role", async () => {
    expect((await api("/", "")).status).toBe(401);
    state.records.set("users/admin", { role: "admin" });
    expect((await api("/", "admin")).status).toBe(403);
  });
  it("does not expose or mutate another site's task", async () => {
    state.records.set("inboundRequests/task-1", task());
    expect((await api("/tasks/task-1", "site-2")).status).toBe(404);
    expect(
      (
        await api("/tasks/task-1/pilot", "site-2", {
          action: "close",
          resultId: null,
          notes: "close",
        })
      ).status,
    ).toBe(404);
    expect((await (await api("/", "site-2")).json()).tasks).toEqual([]);
  });
  it("rejects a forged legacy intake link without a verified matching contact", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(),
      account_owner_uid: undefined,
      contact: { email: "site-1@example.com" },
    });
    state.records.set("users/site-2", {
      buyerType: "site_operator",
      structuredIntakeRequestId: "task-1",
    });
    expect((await (await api("/", "site-2")).json()).tasks).toEqual([]);
  });
});
describe("a site finds its way back to its own task", () => {
  it("mints a fresh private task link for the owner only", async () => {
    state.records.set("inboundRequests/task-1", task());
    const response = await api("/tasks/task-1/task-link", "site-1", {});
    expect(response.status).toBe(200);
    expect((await response.json()).url).toMatch(/\/capture-upload\//);
    expect((await api("/tasks/task-1/task-link", "site-2", {})).status).toBe(404);
  });


});

describe("workspace requests and lifecycle", () => {



  it("keeps the integration planning catalog internal to admin and ops", async () => {
    expect((await api("/deployment-embodiments", "")).status).toBe(401);
    expect((await api("/deployment-embodiments", "robot-1")).status).toBe(403);
    expect((await api("/deployment-embodiments", "site-1")).status).toBe(403);
    state.records.get("users/robot-1").role = "ops";
    const response = await api("/deployment-embodiments", "robot-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(await deploymentCatalogWithDigest());
  });
});

describe("account workspace setup", () => {
  it("rejects unapproved accounts despite self-selected profile types or an open library", async () => {
    admission.mockResolvedValue(false);
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS", "0");
    const before = structuredClone([...state.records]);
    for (const workspaceType of ["robot_team"]) {
      const response = await api("/setup", "site-1", { name: "Owner", organization: "Co", workspaceType, acceptedTerms: true });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "account_invitation_required" });
    }
    expect([...state.records]).toEqual(before);
  });

  it("creates a site workspace automatically from its submitted job without approval", async () => {
    admission.mockResolvedValue(false);
    state.records.set("inboundRequests/submitted-job", { ...task(), account_owner_uid: null,
      qualification_state: "not_now", contact: { email: "new-site@example.com" } });
    const response = await api("/setup", "new-site", { name: "Owner", organization: "Site", workspaceType: "site_operator", acceptedTerms: true, siteClaimToken: createSiteClaimToken("submitted-job") });
    expect(response.status).toBe(200);
    expect(admission).not.toHaveBeenCalled();
    expect(state.records.get("users/new-site").buyerType).toBe("site_operator");
  });
  it("reuses submitted identity and organization across every fresh site account entry point", async () => {
    state.records.set("inboundRequests/submitted-job", { ...task(), account_owner_uid: null, contact: { email: "new-site@example.com", firstName: "Alex", lastName: "Owner", company: "Actual Company" } });
    expect((await api("/setup", "new-site", { name: "new-site", organization: "My site", workspaceType: "site_operator", acceptedTerms: true, siteClaimToken: createSiteClaimToken("submitted-job") })).status).toBe(200);
    expect(state.records.get("users/new-site")).toMatchObject({ name: "Alex Owner", organizationName: "Actual Company", company: "Actual Company" });
  });
  it("lets an existing site owner edit workspace settings without the original link", async () => {
    state.records.set("inboundRequests/existing-job", task());
    const response = await api("/setup", "site-1", { name: "Updated Owner", organization: "Updated Site", workspaceType: "site_operator", acceptedTerms: true });
    expect(response.status).toBe(200);
    expect(state.records.get("users/site-1").organizationName).toBe("Updated Site");
    expect(await (await api("/setup", "site-1")).json()).toMatchObject({ siteIntakeRequired: false });
  });
  it("requires a matching saved job even when a client profile already selects sites", async () => {
    state.records.set("users/new-site", { buyerType: "site_operator" });
    const payload = { name: "Owner", organization: "Site", workspaceType: "site_operator", acceptedTerms: true };
    for (const siteClaimToken of [undefined, "invalid", createSiteClaimToken("task-1", -1), createSiteClaimToken("missing"), `${createSiteClaimToken("task-1")}.extra`]) {
      expect((await api("/setup", "new-site", { ...payload, siteClaimToken })).status).toBe(403);
    }
    expect(state.records.get("users/new-site")).toEqual({ buyerType: "site_operator" });
  });
  it("refuses another email, a robot intake, and a job already owned by someone else", async () => {
    const payload = { name: "Owner", organization: "Site", workspaceType: "site_operator", acceptedTerms: true, siteClaimToken: createSiteClaimToken("source-job") };
    state.records.set("inboundRequests/source-job", { ...task(), account_owner_uid: null, contact: { email: "other@example.com" } });
    expect((await api("/setup", "new-site", payload)).status).toBe(403);
    state.records.set("inboundRequests/source-job", { ...task(), account_owner_uid: null, request: { buyerType: "robot_team" }, contact: { email: "new-site@example.com" } });
    expect((await api("/setup", "new-site", payload)).status).toBe(403);
    state.records.set("inboundRequests/source-job", { ...task(), contact: { email: "new-site@example.com" } });
    expect((await api("/setup", "new-site", payload)).status).toBe(409);
    expect(state.records.has("users/new-site")).toBe(false);
  });
  it("reuses current intake terms for a verified matching account without another question", async () => {
    const terms = buildLegalAcceptanceRecord({ acceptedAt: "2026-10-09T00:00:00Z" });
    state.records.set("inboundRequests/source-job", { ...task(), account_owner_uid: null, contact: { email: "new-site@example.com" }, terms_acceptance: terms });
    const result = await api("/setup", "new-site", { name: "Owner", organization: "Site", workspaceType: "site_operator", siteClaimToken: createSiteClaimToken("source-job") });
    expect(result.status).toBe(200);
    expect(state.records.get("users/new-site")).toMatchObject({ termsAcceptance: terms, termsAcceptanceSource: { kind: "site_capture_intake", requestId: "source-job" } });
    expect(state.records.get("inboundRequests/source-job").account_owner_uid).toBeNull();
  });
  it("denies robot workspace access from a forged client profile", async () => {
    admission.mockResolvedValue(false);
    expect((await api("/", "robot-1")).status).toBe(403);
  });
  it("keeps operations access visible from authenticated claims as well as the profile", async () => {
    state.records.set("users/operator", { name: "Ops User" });
    const response = await fetch(`${base}/setup`, {
      headers: { "x-user": "operator", "x-test-admin": "1" },
    });
    expect(await response.json()).toMatchObject({
      workspaceType: null,
      access: { operations: true },
    });
  });

  it("offers setup to legacy operations accounts without granting a workspace by default", async () => {
    state.records.set("users/operator", {
      name: "Ops User",
      organizationName: "Existing Company",
      role: "admin",
      roles: ["admin", "ops"],
      admin: true,
      ops: true,
    });
    const blocked = await api("/", "operator");
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({
      code: "workspace_setup_required",
    });
    const response = await api("/setup", "operator");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      workspaceType: null,
      profile: {
        name: "Ops User",
        organization: "Existing Company",
        email: "operator@example.com",
      },
      termsRequired: true,
      access: { operations: true },
    });
    expect(state.records.get("users/operator")).not.toHaveProperty("buyerType");
  });
  it("sets up the chosen workspace and keeps operations permissions and saved data", async () => {
    state.records.set("users/operator", {
      name: "Ops User",
      role: "admin",
      roles: ["admin", "ops"],
      admin: true,
      ops: true,
      structuredIntakeRequestId: "older-request",
      finishedOnboarding: true,
    });
    state.records.set("users/other", { name: "Other User", role: "capturer" });
    const response = await api("/setup", "operator", {
      name: "Updated Name",
      organization: "Robotics Company",
      workspaceType: "robot_team",
      acceptedTerms: true,
    });
    expect(response.status).toBe(200);
    expect(state.records.get("users/operator")).toMatchObject({
      buyerType: "robot_team",
      name: "Updated Name",
      organizationName: "Robotics Company",
      company: "Robotics Company",
      role: "admin",
      roles: ["admin", "ops"],
      admin: true,
      ops: true,
      structuredIntakeRequestId: "older-request",
      finishedOnboarding: true,
      termsAcceptance: {
        accepted_terms: true,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    });
    expect(state.records.get("users/other")).toEqual({
      name: "Other User",
      role: "capturer",
    });
    expect((await api("/", "operator")).status).toBe(200);
  });
  it("lets existing customers change workspace type without deleting prior records", async () => {
    state.records.set("users/site-1", {
      buyerType: "site_operator",
      name: "Site Owner",
      acceptedTerms: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    });
    const existing = task();
    state.records.set("inboundRequests/task-1", existing);
    const response = await api("/setup", "site-1", {
      name: "Site Owner",
      organization: "Company",
      workspaceType: "robot_team",
    });
    expect(response.status).toBe(200);
    expect(state.records.get("inboundRequests/task-1")).toEqual(existing);
    expect(state.records.get("users/site-1").buyerType).toBe("robot_team");
  });
  it("requires legal acceptance when missing and never accepts privileged fields", async () => {
    state.records.set("users/operator", { role: "admin" });
    const payload = {
      name: "Ops User",
      organization: "Company",
      workspaceType: "site_operator",
      acceptedTerms: true,
    };
    const missingTerms = await api("/setup", "operator", {
      ...payload,
      acceptedTerms: false,
    });
    expect(missingTerms.status).toBe(400);
    expect(await missingTerms.json()).toMatchObject({
      code: "workspace_terms_required",
    });
    for (const extra of [
      { admin: true },
      { role: "admin" },
      { uid: "other" },
      { email: "other@example.com" },
    ])
      expect(
        (await api("/setup", "operator", { ...payload, ...extra })).status,
      ).toBe(400);
    expect(
      (await api("/setup", "operator", { ...payload, workspaceType: "admin" }))
        .status,
    ).toBe(400);
    expect(state.records.get("users/operator")).toEqual({ role: "admin" });
  });
  it("requires authentication for setup and derives any missing profile identity from the token", async () => {
    expect((await api("/setup", "")).status).toBe(401);
    expect(
      (
        await api("/setup", "", {
          name: "Test",
          organization: "Company",
          workspaceType: "robot_team",
          acceptedTerms: true,
        })
      ).status,
    ).toBe(401);
    state.records.set("inboundRequests/new-job", { ...task(), account_owner_uid: null, contact: { email: "new-user@example.com" } });
    expect(
      (
        await api("/setup", "new-user", {
          name: "New User",
          siteClaimToken: createSiteClaimToken("new-job"),
          organization: "Company",
          workspaceType: "site_operator",
          acceptedTerms: true,
        })
      ).status,
    ).toBe(200);
    expect(state.records.get("users/new-user")).toMatchObject({
      uid: "new-user",
      email: "new-user@example.com",
      buyerType: "site_operator",
    });
    expect(state.records.get("users/new-user")).not.toHaveProperty("admin");
    expect(state.records.get("users/new-user")).not.toHaveProperty("role");
  });
});

describe("site claim and listing control", () => {
  it("attaches a claimed site to the signed-in operator via the claim token", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(),
      account_owner_uid: undefined,
      contact: { email: "site-1@example.com" },
      terms_acceptance: buildLegalAcceptanceRecord({ acceptedAt: "2026-09-24T00:00:00Z" }),
    });
    const token = createSiteClaimToken("task-1");

    // A review link is not a claim link: kinds are distinct even though the
    // secret family is shared.
    const asSite1 = await api("/claim", "site-1", { token });
    expect(asSite1.status).toBe(200);

    const record = state.records.get("inboundRequests/task-1");
    expect(record.account_owner_uid).toBe("site-1");
    expect(record.claimed_at_iso).toBeTruthy();
    // The legacy operator link is set for the claiming account.
    expect(state.records.get("users/site-1").structuredIntakeRequestId).toBe("task-1");
  });

  it("lets a verified robot-team account claim its own site while keeping its role", async () => {
    const sourceTerms = buildLegalAcceptanceRecord({ acceptedAt: "2026-09-24T00:00:00Z" });
    state.records.set("users/robot-1", {
      buyerType: "robot_team", name: "Robot Owner",
      acceptedTerms: true, termsVersion: "2026-07-09", privacyVersion: "2026-07-09",
    });
    state.records.set("inboundRequests/task-1", {
      ...task(), account_owner_uid: undefined,
      contact: { email: "encrypted:robot-1@example.com" }, terms_acceptance: sourceTerms,
    });
    state.records.set("inboundRequests/application-1", {
      account_owner_uid: "robot-1",
      request: { buyerType: "robot_team", taskStatement: "Evaluate packing", targetSiteType: "Office" },
      workspace_evaluation: { opportunityId: "task-1", targetSnapshot: terms },
      createdAt: "2026-09-24T00:00:00Z",
    });
    const token = createSiteClaimToken("task-1");
    expect((await api("/claim", "robot-1", { token })).status).toBe(200);
    expect(state.records.get("inboundRequests/task-1")).toMatchObject({
      account_owner_uid: "robot-1", terms_acceptance: sourceTerms,
    });
    expect(state.records.get("users/robot-1")).toMatchObject({
      buyerType: "robot_team", termsAcceptance: sourceTerms,
      termsAcceptanceSource: { kind: "site_capture_intake", requestId: "task-1" },
      termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION,
    });
    const workspace = await (await api("/", "robot-1")).json();
    expect(workspace.role).toBe("robot_team");
    expect(workspace.tasks.map((item: any) => item.id)).toEqual(["task-1"]);
    expect((await api("/tasks/task-1/task-link", "robot-1", {})).status).toBe(200);
    expect((await api("/tasks/task-1/task-link", "robot-2", {})).status).toBe(404);
  });

  it("does not transfer stale or absent intake terms without fresh acceptance", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(), account_owner_uid: undefined,
      contact: { email: "robot-1@example.com" },
      terms_acceptance: { ...buildLegalAcceptanceRecord({ acceptedAt: "2026-07-09T00:00:00Z" }), terms_version: "2026-07-09" },
    });
    const token = createSiteClaimToken("task-1");
    const rejected = await api("/claim", "robot-1", { token });
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).code).toBe("workspace_terms_required");
    expect(state.records.get("inboundRequests/task-1").account_owner_uid).toBeUndefined();
    expect(state.records.get("users/robot-1")).not.toHaveProperty("termsAcceptance");
    expect((await api("/claim", "robot-1", { token, acceptedTerms: true })).status).toBe(200);
    expect(state.records.get("users/robot-1")).toMatchObject({
      termsAcceptanceSource: { kind: "site_claim", requestId: "task-1" },
      termsAcceptance: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
    });
  });

  it("requires fresh acceptance when the intake has no legal record", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(), account_owner_uid: undefined,
      contact: { email: "robot-1@example.com" },
    });
    const token = createSiteClaimToken("task-1");
    expect((await api("/claim", "robot-1", { token })).status).toBe(400);
    expect(state.records.get("inboundRequests/task-1").account_owner_uid).toBeUndefined();
    expect(state.records.get("users/robot-1")).not.toHaveProperty("termsAcceptance");
  });

  it("rejects unverified and wrong-email robot accounts without changing legal state", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(), account_owner_uid: undefined,
      contact: { email: "robot-1@example.com" },
      terms_acceptance: buildLegalAcceptanceRecord({ acceptedAt: "2026-09-24T00:00:00Z" }),
    });
    const token = createSiteClaimToken("task-1");
    const unverified = await fetch(`${base}/claim`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-user": "robot-1", "x-unverified": "1" },
      body: JSON.stringify({ token }),
    });
    expect(unverified.status).toBe(403);
    expect((await api("/claim", "robot-2", { token })).status).toBe(403);
    expect(state.records.get("inboundRequests/task-1").account_owner_uid).toBeUndefined();
    expect(state.records.get("users/robot-1")).not.toHaveProperty("termsAcceptance");
  });

  it("refuses a second claimant once a site is claimed", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(),
      contact: { email: "site-1@example.com" },
    });
    const token = createSiteClaimToken("task-1");
    expect((await api("/claim", "site-2", { token })).status).toBe(409);
  });

  it("refuses a claim from an account on a different email", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(),
      account_owner_uid: undefined,
      contact: { email: "someone-else@example.com" },
    });
    const token = createSiteClaimToken("task-1");
    const response = await api("/claim", "site-2", { token });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("claim_email_mismatch");
  });

  it("rejects an invalid or foreign-kind token", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(),
      account_owner_uid: undefined,
      contact: { email: "site-1@example.com" },
    });
    expect((await api("/claim", "site-1", { token: "not-a-token" })).status).toBe(400);
  });

});



describe("capture-first workspace intake", () => {
  const capture = {
    requestId: "capture-owned", siteLocation: "Austin, TX", taskStatement: "Pack cartons",
    captureMode: "self_capture", captureRegion: "us", hasExistingFootage: false,
    consentAttestation: { granted: true, statementVersion: "2026-09-18.v1" },
  };
  it.each([undefined, "", "   "])("keeps a self-recorded site's omitted location unknown (%s)", async siteLocation => {
    expect((await api("/capture-start", "site-1", { ...capture, siteLocation, taskStatement: "", hasExistingFootage: true })).status).toBe(201);
    expect(state.intakes.at(-1).body).toMatchObject({ siteName: "", siteLocation: "", captureRegion: "us", taskStatement: "" });
  });
  it("requires the address only for a Blueprint filming visit", async () => {
    expect((await api("/capture-start", "site-1", { ...capture, siteLocation: "", captureMode: "site_visit" })).status).toBe(400);
    expect(state.intakes).toHaveLength(0);
  });
  it("accepts authorized capture or recording setup without a required description or goal", async () => {
    expect((await api("/capture-start", "site-1", { ...capture, taskStatement: "", hasExistingFootage: true })).status).toBe(201);
    expect(state.intakes.at(-1).body).toMatchObject({ taskStatement: "", taskDescription: "", hasExistingFootage: true,
      consentAttestation: capture.consentAttestation, siteTaskGates: {}, siteTaskSpec: {} });
    expect((await api("/capture-start", "site-1", { ...capture, taskStatement: "", descriptionOnly: true,
      consentAttestation: null, acceptedTerms: true, descriptionAuthority: { granted: true, statementVersion: "2026-10-06.v1" } })).status).toBe(201);
    expect(state.intakes.at(-1).body).toMatchObject({ taskStatement: "", descriptionOnly: true, consentAttestation: null });
    expect((await api("/capture-start", "site-1", { ...capture, captureMode: "site_visit", taskStatement: "", descriptionOnly: true,
      consentAttestation: null, acceptedTerms: true, descriptionAuthority: { granted: true, statementVersion: "2026-10-06.v1" } })).status).toBe(201);
    expect((await api("/capture-start", "site-1", { ...capture, taskStatement: "", consentAttestation: null })).status).toBe(400);
  });
  it("accepts a recording grant under the v1 or v2 rights sentence and refuses any other version", async () => {
    // v1 is what a page opened before the v2 sentence still sends; v2 is the sentence shown now.
    for (const statementVersion of ["2026-09-18.v1", "2026-11-02.v2"]) {
      const consentAttestation = { granted: true, statementVersion };
      expect((await api("/capture-start", "site-1", { ...capture, taskStatement: "", hasExistingFootage: true,
        consentAttestation })).status).toBe(201);
      expect(state.intakes.at(-1).body.consentAttestation).toEqual(consentAttestation);
    }
    const accepted = state.intakes.length;
    for (const statementVersion of ["2026-11-02.v3", "2026-09-18.v2", "2026-11-02.V2", "2026-10-06.v1", "", null]) {
      expect((await api("/capture-start", "site-1", { ...capture, taskStatement: "", hasExistingFootage: true,
        consentAttestation: { granted: true, statementVersion } })).status).toBe(400);
    }
    expect(state.intakes).toHaveLength(accepted);
  });
  it("preserves explicit Terms and description authority for a signed-in prose submission", async () => {
    const descriptionAuthority = { granted: true, statementVersion: "2026-10-06.v1" };
    const response = await api("/capture-start", "site-1", { ...capture, descriptionOnly: true,
      descriptionAuthority, acceptedTerms: true, consentAttestation: null });
    expect(response.status).toBe(201);
    expect(state.intakes.at(-1)).toMatchObject({ body: { acceptedTerms: true, descriptionOnly: true,
      descriptionAuthority, consentAttestation: null, email: "site-1@example.com" }, metadata: { account_owner_uid: "site-1" } });
  });
  it("carries the approved anonymized listing grant through signed-in intake", async () => {
    const publicTaskListing = { consent: true, statementVersion: "public-task-card-v1", details: anonymizedOpportunityDraft(capture.taskStatement) };
    expect((await api("/capture-start", "site-1", { ...capture, publicTaskListing })).status).toBe(201);
    expect(state.intakes.at(-1).body.publicTaskListing).toEqual(publicTaskListing);
    expect((await api("/capture-start", "site-1", { ...capture, publicTaskListing: { ...publicTaskListing, consent: false } })).status).toBe(400);
  });
  it("binds new capture to the authenticated account, ignoring forged identity and permissions", async () => {
    const response = await api("/capture-start", "site-1", { ...capture, email: "forged@example.com", account_owner_uid: "site-2", siteTaskGates: { cleared: true } });
    expect(response.status).toBe(201);
    expect(state.intakes.at(-1)).toMatchObject({
      body: { email: "site-1@example.com", buyerType: "site_operator", siteTaskGates: {}, consentAttestation: capture.consentAttestation },
      metadata: { account_owner_uid: "site-1" },
    });
    expect((await api("/tasks/capture-owned/task-link", "site-1", {})).status).toBe(200);
    expect((await api("/tasks/capture-owned/task-link", "site-2", {})).status).toBe(404);
  });
  it("allows a new account to create its own draft before email verification", async () => {
    const response = await fetch(`${base}/capture-start`, { method: "POST", headers: { "Content-Type": "application/json", "x-user": "site-1", "x-unverified": "1" }, body: JSON.stringify(capture) });
    expect(response.status).toBe(201);
    expect(state.intakes.at(-1).metadata.account_owner_uid).toBe("site-1");
  });
  // Owner decision 2026-10-22: the start form creates the account with the job,
  // so the job is owned from the start and its video can go with the form.
  it("sets up a brand-new account as a site workspace with its first job, accepting the shown Terms", async () => {
    const response = await fetch(`${base}/capture-start`, { method: "POST",
      headers: { "Content-Type": "application/json", "x-user": "new-site", "x-unverified": "1" },
      body: JSON.stringify({ ...capture, hasExistingFootage: true, acceptedTerms: true, company: "Acme Foods",
        termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }) });
    expect(response.status).toBe(201);
    expect(state.intakes.at(-1)).toMatchObject({ body: { email: "new-site@example.com", buyerType: "site_operator", company: "Acme Foods" },
      metadata: { account_owner_uid: "new-site" } });
    expect(state.records.get("users/new-site")).toMatchObject({ uid: "new-site", email: "new-site@example.com",
      buyerType: "site_operator", company: "Acme Foods", acceptedTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION,
      termsAcceptance: { accepted_terms: true, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION } });
    expect((await api("/tasks/capture-owned/task-link", "new-site", {})).status).toBe(200);
  });
  // D2b: a start form opened before forms sent their versions showed Terms and Privacy 2026-11-12.2; that is recorded.
  it("records Privacy 2026-11-12.2 for a start form that sends no versions, never the current one", async () => {
    const response = await fetch(`${base}/capture-start`, { method: "POST",
      headers: { "Content-Type": "application/json", "x-user": "old-form", "x-unverified": "1" },
      body: JSON.stringify({ ...capture, hasExistingFootage: true, acceptedTerms: true, company: "Acme Foods" }) });
    expect(response.status).toBe(201);
    expect(state.records.get("users/old-form")).toMatchObject({ termsVersion: "2026-11-12.2", privacyVersion: "2026-11-12.2",
      termsAcceptance: { terms_version: "2026-11-12.2", privacy_version: "2026-11-12.2" } });
  });
  it.each([
    ["an older Privacy version", { termsVersion: "2026-11-12.2", privacyVersion: "2026-11-02.1" }],
    ["an older Terms version", { termsVersion: "2026-11-02.1", privacyVersion: "2026-11-13.1" }],
  ])("/setup refuses a page that showed %s and writes nothing", async (_name, versions) => {
    state.records.set("inboundRequests/submitted-job", { ...task(), account_owner_uid: null,
      contact: { email: "new-site@example.com" } });
    const response = await api("/setup", "new-site", { name: "Owner", organization: "Site", workspaceType: "site_operator",
      acceptedTerms: true, siteClaimToken: createSiteClaimToken("submitted-job"), ...versions });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("workspace_terms_versions_not_current");
    expect(state.records.has("users/new-site")).toBe(false);
    expect(state.records.get("inboundRequests/submitted-job").account_owner_uid).toBeNull();
  });
  it("the start form's account setup records nothing for a page that showed versions that no longer count", async () => {
    const response = await fetch(`${base}/capture-start`, { method: "POST",
      headers: { "Content-Type": "application/json", "x-user": "stale-form", "x-unverified": "1" },
      body: JSON.stringify({ ...capture, hasExistingFootage: true, acceptedTerms: true, company: "Acme Foods",
        termsVersion: "2026-11-12.2", privacyVersion: "2026-11-02.1" }) });
    // The setup step passes the request on untouched: no account is made from a page whose versions no longer count,
    // so the account has no workspace and the job is not taken.
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "workspace_setup_required" });
    expect(state.records.has("users/stale-form")).toBe(false);
    expect(state.intakes).toHaveLength(0);
  });
  // Ordinary sign-up writes a profile with no workspace type; it is set up the
  // same way and keeps what sign-up wrote.
  it("sets up a signed-up account that has not chosen a workspace type, keeping its profile", async () => {
    state.records.set("users/new-site", { uid: "new-site", email: "new-site@example.com", name: "Dana", finishedOnboarding: false, acceptedTerms: false });
    state.records.set("users/capturer-1", { role: "capturer", name: "Field Capturer" });
    expect(await (await api("/setup", "new-site")).json()).toMatchObject({ workspaceType: null, siteSetupAvailable: true });
    expect(await (await api("/setup", "capturer-1")).json()).toMatchObject({ workspaceType: null, siteSetupAvailable: false });
    expect(await (await api("/setup", "robot-1")).json()).toMatchObject({ siteSetupAvailable: false });
    const response = await api("/capture-start", "new-site", { ...capture, hasExistingFootage: true, acceptedTerms: true, company: "Acme Foods" });
    expect(response.status).toBe(201);
    expect(state.intakes.at(-1)).toMatchObject({ body: { buyerType: "site_operator" }, metadata: { account_owner_uid: "new-site" } });
    expect(state.records.get("users/new-site")).toMatchObject({ name: "Dana", finishedOnboarding: false,
      buyerType: "site_operator", company: "Acme Foods", acceptedTerms: true, termsVersion: TERMS_VERSION });
    expect((await api("/tasks/capture-owned/task-link", "new-site", {})).status).toBe(200);
  });
  it("sets up no account without the Terms, and never changes an existing profile", async () => {
    expect((await api("/capture-start", "new-site", capture)).status).toBe(403);
    expect(state.records.has("users/new-site")).toBe(false);
    state.records.set("users/capturer-1", { role: "capturer", name: "Field Capturer" });
    expect((await api("/capture-start", "capturer-1", { ...capture, acceptedTerms: true })).status).toBe(403);
    expect(state.records.get("users/capturer-1")).toEqual({ role: "capturer", name: "Field Capturer" });
    expect((await api("/capture-start", "robot-1", { ...capture, acceptedTerms: true })).status).toBe(403);
    expect(state.records.get("users/robot-1")).toMatchObject({ buyerType: "robot_team" });
    expect(state.intakes).toHaveLength(0);
  });
  it("requires explicit country and recording consent and refuses robot accounts", async () => {
    expect((await api("/capture-start", "robot-1", capture)).status).toBe(403);
    expect((await api("/capture-start", "site-1", { ...capture, captureRegion: "" })).status).toBe(400);
    expect((await api("/capture-start", "site-1", { ...capture, consentAttestation: { ...capture.consentAttestation, granted: false } })).status).toBe(400);
    expect(state.intakes).toHaveLength(0);
  });
});



describe("practice-run videos of a job's simulation evaluation", () => {
  const consent = { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-18T00:00:00.000Z" };
  /** The Pipeline's own publication, as this job's accepted screening run. */
  async function screeningRun() {
    const { crossRuntimeArtifactDigest } = await import("../utils/crossRuntimeCanonical");
    const producer = structuredClone((await import("./fixtures/pipeline-beta-policy-screening-review-videos.v2.json")).default) as any;
    const { publication_digest: _digest, ...value } = { ...producer, site_id: "site-task-1" };
    const publication = { ...value, publication_digest: crossRuntimeArtifactDigest(value, "publication_digest") };
    const job = task();
    state.records.set("inboundRequests/task-1", { ...job, request: { ...job.request, consent_attestation: { ...consent } } });
    state.records.set(`taskEvaluationPolicyRuns/${publication.campaign_id}`, { run_id: publication.campaign_id,
      run_kind: "beta_policy_screening", result_record_id: "result-1", job_evidence_binding: { job_id: "task-1" },
      publication_digest: publication.publication_digest });
    state.records.set("captureTaskEvaluationRuns/result-1", { record_id: "result-1", publication });
    return { runId: publication.campaign_id as string, candidateId: publication.candidates[0].candidate_id as string,
      videoIds: publication.review_videos[0].practice_runs[0].videos.map((video: any) => video.sha256.slice(7)) as string[] };
  }
  afterEach(() => { delete process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET; });
  const path = "/tasks/task-1/practice-run-videos/view-ticket";



  it("forgets the job's cached copies when its recording permission is withdrawn", async () => {
    const { mkdir, stat, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    const { practiceRunVideoCachePath, practiceRunVideoMarkerPath } = await import("../utils/screeningPracticeRunVideos");
    const body = await screeningRun();
    const [videoId] = body.videoIds;
    await mkdir(dirname(practiceRunVideoMarkerPath("task-1", videoId)), { recursive: true });
    await writeFile(practiceRunVideoMarkerPath("task-1", videoId), "");
    await mkdir(dirname(practiceRunVideoCachePath(videoId)), { recursive: true });
    await writeFile(practiceRunVideoCachePath(videoId), "cached render");
    expect((await api("/tasks/task-1/recording-consent/withdraw", "site-1", {})).status).toBe(202);
    await expect(stat(practiceRunVideoCachePath(videoId))).rejects.toThrow();
  });
});
