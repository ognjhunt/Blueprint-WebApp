// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSiteClaimToken } from "../utils/request-review-auth";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../client/src/lib/legalAcceptance";
const state = vi.hoisted(() => ({
  records: new Map<string, any>(),
  messages: vi.fn(),
  intakes: [] as any[],
  notices: vi.fn(async () => ({ enqueued: true })),
}));
vi.mock("../utils/taskLifecycleNotifications", () => ({
  enqueueTaskLifecycleNotification: state.notices,
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
    set: async (data: any) => state.records.set(path, data),
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
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
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
        set: (r: any, data: any) => r.set(data),
      }),
  },
}));
vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin: async (value: any) => {
    const decoded = structuredClone(value);
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
vi.mock("../utils/field-ops-automation", () => ({
  sendCapturerCommunication: state.messages,
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
  state.records.clear();
  state.intakes.length = 0;
  state.messages.mockReset().mockResolvedValue({ state: "pending_approval" });
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
  it("gives sites anonymous metrics while excluding team identity and policy secrets", async () => {
    state.records.set("inboundRequests/task-1", task());
    state.records.set("inboundRequests/application-1", {
      account_owner_uid: "robot-1",
      workspace_evaluation: { opportunityId: "task-1", targetSnapshot: terms },
    });
    state.records.set("robotEvalJobRequests/run-1", run());
    const response = await (await api("/tasks/task-1", "site-1")).json();
    expect(response.results[0]).toMatchObject({
      successRate: 96,
      cycleTimeSeconds: 27,
      targetsMet: true,
    });
    expect(JSON.stringify(response)).not.toMatch(
      /SECRET|secret\.example|robot-1/,
    );
  });
  it("shows robot teams only their own evaluations and never confidential source identity", async () => {
    state.records.set("inboundRequests/task-1", task());
    state.records.set("inboundRequests/application-1", {
      account_owner_uid: "robot-1",
      workspace_evaluation: {
        opportunityId: "task-1",
        targetSnapshot: terms,
        setupName: "Atlas",
      },
      request: { taskStatement: "Anonymous packing task" },
    });
    state.records.set("robotEvalJobRequests/run-1", run());
    state.records.set("robotEvalJobRequests/other", run("robot-2"));
    const response = await (await api("/", "robot-1")).json();
    expect(response.evaluations).toHaveLength(1);
    expect(JSON.stringify(response)).not.toMatch(
      /Confidential Site|123 Private|robot-2|SECRET/,
    );
  });
  it("does not interpret efficiency as seconds or unknown scores as zero", async () => {
    state.records.set("robotEvalJobRequests/run-1", {
      ...run(),
      pipeline_result: {},
    });
    const response = await (await api("/", "robot-1")).json();
    expect(response.evaluations[0].cycleTimeSeconds).toBeNull();
    expect(response.evaluations[0].targetsMet).toBeNull();
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

  it("projects the listing, the capture mode, and takes a closed task off the library", async () => {
    const { operatorListingPaused } = await import("../utils/operatorListing");
    const record = {
      ...task(),
      request: { ...task().request, capture_mode: "self_capture" },
      public_task_listing: { enabled: true },
    };
    state.records.set("inboundRequests/task-1", record);
    const listed = (await (await api("/", "site-1")).json()).tasks[0];
    expect(listed).toMatchObject({
      captureMode: "self_capture",
      paused: false,
      listing: { approved: true, live: true, cardUrl: "/sites?sceneId=task-1" },
    });
    expect(operatorListingPaused(record)).toBe(false);
    expect(operatorListingPaused({ ...record, workspace_task: { archived: true } })).toBe(true);
    expect(operatorListingPaused({ ...record, workspace_task: { paused: true } })).toBe(true);

    state.records.set("inboundRequests/task-1", { ...record, workspace_task: { archived: true } });
    const closed = (await (await api("/", "site-1")).json()).tasks[0];
    expect(closed.listing).toMatchObject({ approved: true, live: false });
  });
});

describe("workspace requests and lifecycle", () => {
  it("can record a decision when the source task prose is encrypted", async () => {
    const source: any = task();
    source.workspace_task.terms.successDefinition = "";
    source.request.taskDescription = "encrypted:Pack cartons without drops";
    state.records.set("inboundRequests/task-1", source);
    state.records.set("inboundRequests/application-1", {
      account_owner_uid: "robot-1",
      workspace_evaluation: { opportunityId: "task-1", targetSnapshot: terms },
    });
    state.records.set("robotEvalJobRequests/run-1", run());
    const response = await api("/tasks/task-1/pilot", "site-1", {
      action: "invite",
      resultId: "application-1",
      notes: "Review terms",
    });
    expect(response.status).toBe(200);
    expect(
      state.records.get("inboundRequests/task-1").workspace_task.pilot.notes,
    ).toMatch(/^encrypted:/);
    expect(
      [...state.records.keys()].some((key) =>
        key.startsWith("inboundRequests/task-1/notes/"),
      ),
    ).toBe(true);
  });

  it("does not turn a provisional capturer assignment into a confirmed appointment", async () => {
    state.records.set("inboundRequests/task-1", task());
    state.records.set("capture_jobs/capture-1", {
      buyer_request_id: "task-1",
      status: "scheduled",
      availabilityStartsAt: "2026-09-16T15:00:00Z",
      field_ops: { dispatch_review: { manual_confirmation_required: true } },
    });
    const response = await (await api("/tasks/task-1", "site-1")).json();
    expect(response.capture.status).toBe("awaiting_confirmation");
  });
  it("does not apply current targets retroactively to an older evaluation", async () => {
    state.records.set("inboundRequests/task-1", task());
    state.records.set("inboundRequests/application-1", {
      account_owner_uid: "robot-1",
      workspace_evaluation: {
        opportunityId: "task-1",
        targetSnapshot: { ...terms, successRate: 90 },
      },
    });
    state.records.set("robotEvalJobRequests/run-1", run());
    const response = await (await api("/tasks/task-1", "site-1")).json();
    expect(response.results[0].status).toBe("criteria_changed");
    expect(response.results[0].targetsMet).toBeNull();
    expect(
      (
        await api("/tasks/task-1/pilot", "site-1", {
          action: "invite",
          resultId: "application-1",
          notes: "Select",
        })
      ).status,
    ).toBe(409);
  });
  it("does not promote failed or zero-sample runs into scored results", async () => {
    const failed = run();
    failed.status = "failed";
    state.records.set("robotEvalJobRequests/failed", failed);
    const empty = run();
    empty.benchmark_projection.policy_aggregates[0].metrics.full_task_success.sample_count = 0;
    state.records.set("robotEvalJobRequests/empty", empty);
    const response = await (await api("/", "robot-1")).json();
    expect(
      response.evaluations.every(
        (item: any) =>
          item.successRate === null && item.cycleTimeSeconds === null,
      ),
    ).toBe(true);
  });

  it("uses the existing intake handler with server-owned identity and private defaults", async () => {
    const response = await api("/tasks", "site-1", {
      id: "task-new",
      title: "Pack",
      siteName: "Site",
      location: "Austin",
      siteType: "Fulfillment",
      terms,
      visibility: "private",
      notes: "",
    });
    expect(response.status).toBe(201);
    expect(state.intakes[0].metadata.account_owner_uid).toBe("site-1");
    expect(state.intakes[0].body.email).toBe("site-1@example.com");
    expect(state.intakes[0].body.pilotOpportunity.visibility).toBe("private");
    expect(state.intakes[0].metadata.workspace_task).not.toHaveProperty(
      "published",
    );
  });
  it("rejects role escalation, arbitrary owner fields and invalid thresholds", async () => {
    const body = {
      id: "task-new",
      title: "Pack",
      siteName: "Site",
      location: "Austin",
      siteType: "Fulfillment",
      terms,
      visibility: "private",
      notes: "",
    };
    expect((await api("/tasks", "robot-1", body)).status).toBe(403);
    expect(
      (await api("/tasks", "site-1", { ...body, account_owner_uid: "site-2" }))
        .status,
    ).toBe(400);
    expect(
      (
        await api("/tasks", "site-1", {
          ...body,
          terms: { ...terms, successRate: 101 },
        })
      ).status,
    ).toBe(400);
  });
  it("encrypts private setups and prevents reading or deleting another team's setup", async () => {
    expect((await api("/setups", "robot-1", setup)).status).toBe(200);
    expect(
      state.records.get("users/robot-1/robotSetups/setup-1").payload,
    ).toMatch(/^encrypted:/);
    expect((await (await api("/", "robot-2")).json()).setups).toEqual([]);
    await api("/setups/setup-1", "robot-2", undefined, "DELETE");
    expect(state.records.has("users/robot-1/robotSetups/setup-1")).toBe(true);
  });
  it("keeps model descriptions private and prevents arbitrary runtime binding", async () => {
    const robotDescription={source:"model",format:"urdf",reference:"https://example.test/robot.urdf",mobility:"mobile",details:"Wrist camera"};
    const response=await api("/setups","robot-1",{...setup,robotDescription,executionBindingId:"franka"});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({robotDescription});
    const saved=await (await api("/","robot-1")).json();
    expect(saved.setups[0].executionBindingId).toBeUndefined();
    expect((await (await api("/","robot-2")).json()).setups).toEqual([]);
    // Older clients cannot strip the physical model and reattach a different robot.
    const legacy=await api("/setups","robot-1",{...setup,executionBindingId:"franka"});
    expect(await legacy.json()).toMatchObject({robotDescription});
    const again=await (await api("/","robot-1")).json();
    expect(again.setups[0].executionBindingId).toBeUndefined();
  });
  it("rejects credentials and caller-supplied readiness in robot descriptions", async () => {
    const robotDescription={source:"model",format:"usd",reference:"https://example.test/robot.usd",mobility:"fixed",details:""};
    for(const change of [{reference:"https://example.test/robot.usd?key=secret"},{ready:true}]) {
      expect((await api("/setups","robot-1",{...setup,robotDescription:{...robotDescription,...change}})).status).toBe(400);
    }
  });
  it("rejects credential-bearing and executable references", async () => {
    for (const reference of [
      "javascript:alert(1)",
      "https://user:password@example.com/policy",
      "https://example.com/policy?token=secret",
    ]) {
      expect(
        (await api("/setups", "robot-1", { ...setup, reference })).status,
      ).toBe(400);
    }
  });
  it("rechecks opportunity rights before accepting a setup-backed evaluation request", async () => {
    state.records.set("inboundRequests/task-1", task());
    await api("/setups", "robot-1", setup);
    expect(
      (
        await api("/evaluations", "robot-1", {
          id: "application-1",
          opportunityId: "task-1",
          setupId: "setup-1",
          notes: "",
        })
      ).status,
    ).toBe(201);
    expect(state.intakes[0].body.taskStatement).toBe("Pack cartons into totes");
    expect(state.intakes[0].body).not.toMatchObject({
      siteName: "Confidential Site",
    });
    // The site hears that a team asked, once per request.
    expect(state.notices).toHaveBeenCalledWith({
      requestId: "task-1",
      milestone: "pilot_request",
      eventId: "application-1",
    });
    state.notices.mockClear();
    const source = task();
    source.ops.rights_status = "pending";
    state.records.set("inboundRequests/task-1", source);
    expect(
      (
        await api("/evaluations", "robot-1", {
          id: "application-2",
          opportunityId: "task-1",
          setupId: "setup-1",
          notes: "",
        })
      ).status,
    ).toBe(404);
    expect(state.notices).not.toHaveBeenCalled();
  });
  it("records cancellation as pending without falsifying the actual schedule", async () => {
    state.records.set("inboundRequests/task-1", task());
    state.records.set("capture_jobs/capture-1", {
      buyer_request_id: "task-1",
      status: "scheduled",
      availabilityStartsAt: "2026-09-16T15:00:00Z",
    });
    const response = await (
      await api("/tasks/task-1/capture", "site-1", {
        action: "cancel",
        message: "Site closed",
      })
    ).json();
    expect(response.status).toBe("pending_review");
    expect(state.records.get("capture_jobs/capture-1").status).toBe(
      "scheduled",
    );
    expect(state.records.get("inboundRequests/task-1").ops.next_step).toContain(
      "cancel",
    );
  });
  it("routes a capturer message through the existing communication boundary", async () => {
    state.records.set("inboundRequests/task-1", task());
    state.records.set("capture_jobs/capture-1", {
      buyer_request_id: "task-1",
      status: "scheduled",
      field_ops: {
        capturer_assignment: { creator_id: "capturer-1", name: "Jordan" },
      },
    });
    const response = await (
      await api("/tasks/task-1/capture", "site-1", {
        action: "message",
        message: "Use the east entrance",
      })
    ).json();
    expect(state.messages).toHaveBeenCalledWith(
      expect.objectContaining({
        captureJobId: "capture-1",
        communicationType: "custom",
        body: "Use the east entrance",
      }),
    );
    expect(response.message).toContain("queued");
  });
  it("requires an actual result for selection and a pilot before deployment", async () => {
    state.records.set("inboundRequests/task-1", task());
    expect(
      (
        await api("/tasks/task-1/pilot", "site-1", {
          action: "invite",
          resultId: "invented",
          notes: "Pick",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api("/tasks/task-1/pilot", "site-1", {
          action: "deploy",
          resultId: null,
          notes: "Deploy",
        })
      ).status,
    ).toBe(409);
    state.records.set("inboundRequests/application-1", {
      account_owner_uid: "robot-1",
      workspace_evaluation: { opportunityId: "task-1", targetSnapshot: terms },
    });
    state.records.set("robotEvalJobRequests/run-1", run());
    expect(
      (
        await api("/tasks/task-1/pilot", "site-1", {
          action: "invite",
          resultId: "application-1",
          notes: "Review pilot terms",
        })
      ).status,
    ).toBe(200);
    expect(
      state.records.get("inboundRequests/task-1").workspace_task.pilot.state,
    ).toBe("selected");
    expect(
      (
        await api("/tasks/task-1/pilot", "site-1", {
          action: "invite",
          resultId: "application-1",
          notes: "Again",
        })
      ).status,
    ).toBe(409);
  });
});

describe("account workspace setup", () => {
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
    expect(
      (
        await api("/setup", "new-user", {
          name: "New User",
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

  it("lets the owning operator pause and resume the site listing", async () => {
    state.records.set("inboundRequests/task-1", task());
    const paused = await api("/tasks/task-1/listing", "site-1", { paused: true });
    expect(paused.status).toBe(200);
    expect(state.records.get("inboundRequests/task-1").workspace_task.paused).toBe(true);

    const resumed = await api("/tasks/task-1/listing", "site-1", { paused: false });
    expect(resumed.status).toBe(200);
    expect(state.records.get("inboundRequests/task-1").workspace_task.paused).toBe(false);

    // A non-owner has no listing control: it reads as not-found, like every
    // other task route.
    expect((await api("/tasks/task-1/listing", "site-2", { paused: true })).status).toBe(404);
  });
});

describe("agent screening runs on the site's task", () => {
  it("shows a reported run as an anonymised simulation row and moves the ladder to results", async () => {
    state.records.set("inboundRequests/task-1", {
      ...task(),
      site_task_brief_confirmed_at: "2026-09-18T00:00:00Z",
      capture_coverage: { covers_scene: true, missing_coverage: [], supplement_would_finish: false },
    });
    state.records.set("siteTaskBriefs/task-1", {
      requestId: "task-1",
      summary: "Pack cartons",
      proposed: [],
      unresolved: [],
      captureMode: "self_capture",
      draftedAtIso: "2026-09-17T00:00:00Z",
      draftedFrom: ["description"],
      confirmedAtIso: "2026-09-18T00:00:00Z",
      confirmedBy: "Site Owner",
      operatorAnswers: null,
      operatorUnknown: null,
    });
    state.records.set("evaluationRuns/run_r1", {
      runId: "run_r1",
      teamId: "team-alpha",
      checkpointId: "ckpt-secret",
      sceneId: "task-1",
      state: "completed",
      requestedAtIso: "2026-09-19T00:00:00.000Z",
      result: {
        observed: { episodesRun: 50, episodesSucceeded: 41, successRate: 0.82, medianCycleSeconds: 38 },
      },
    });

    const body = await (await api("/", "site-1")).json();
    const siteTask = body.tasks.find((item: any) => item.id === "task-1");
    const row = siteTask.results.find((item: any) => item.id === "run_r1");

    expect(row).toMatchObject({
      evidenceLabel: "Simulation",
      successRate: 82,
      sampleCount: 50,
      cycleTimeSeconds: 38,
    });
    expect(JSON.stringify(body)).not.toContain("team-alpha");
    expect(JSON.stringify(body)).not.toContain("ckpt-secret");
    expect(siteTask.readiness?.decision).toBe("results");
  });
});


describe("capture-first workspace intake", () => {
  const capture = {
    requestId: "capture-owned", siteLocation: "Austin, TX", taskStatement: "Pack cartons",
    captureMode: "self_capture", captureRegion: "us", hasExistingFootage: false,
    consentAttestation: { granted: true, statementVersion: "2026-09-18.v1" },
  };
  it("binds new capture to the authenticated account, ignoring forged identity and permissions", async () => {
    const response = await api("/capture-start", "site-1", { ...capture, email: "forged@example.com", account_owner_uid: "site-2", siteTaskGates: { cleared: true } });
    expect(response.status).toBe(201);
    expect(state.intakes.at(-1)).toMatchObject({
      body: { email: "site-1@example.com", buyerType: "site_operator", siteTaskGates: {}, consentAttestation: capture.consentAttestation },
      metadata: { account_owner_uid: "site-1" },
    });
    expect((await api("/tasks/capture-owned", "site-1")).status).toBe(200);
    expect((await api("/tasks/capture-owned", "site-2")).status).toBe(404);
  });
  it("allows a new account to create its own draft before email verification", async () => {
    const response = await fetch(`${base}/capture-start`, { method: "POST", headers: { "Content-Type": "application/json", "x-user": "site-1", "x-unverified": "1" }, body: JSON.stringify(capture) });
    expect(response.status).toBe(201);
    expect(state.intakes.at(-1).metadata.account_owner_uid).toBe("site-1");
  });
  it("requires explicit country and recording consent and refuses robot accounts", async () => {
    expect((await api("/capture-start", "robot-1", capture)).status).toBe(403);
    expect((await api("/capture-start", "site-1", { ...capture, captureRegion: "" })).status).toBe(400);
    expect((await api("/capture-start", "site-1", { ...capture, consentAttestation: { ...capture.consentAttestation, granted: false } })).status).toBe(400);
    expect(state.intakes).toHaveLength(0);
  });
});
