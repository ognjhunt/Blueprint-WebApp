// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, any>>(),
  setups: new Map<string, Record<string, any>>(),
  approved: new Set<string>(),
  teams: [] as Array<{ id: string; name: string; accountUid: string }>,
  checkpoints: [] as Array<Record<string, any>>,
  registered: [] as Array<Record<string, any>>,
  createdTeams: [] as Array<Record<string, any>>,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: name === "users" && state.users.has(id), data: () => state.users.get(id) }),
        collection: () => ({
          doc: (setupId: string) => ({
            get: async () => {
              const setup = state.setups.get(`${id}/${setupId}`);
              return { exists: Boolean(setup), data: () => (setup ? { payload: JSON.stringify(setup) } : undefined) };
            },
          }),
        }),
      }),
    }),
  },
}));
vi.mock("../utils/access-control", () => ({
  resolveAccessContext: async (res: express.Response) => ({ isOps: res.locals.firebaseUser?.ops === true }),
}));
vi.mock("../utils/accountInvitations", () => ({
  accountHasAdmission: async (email: string) => state.approved.has(email),
}));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));
vi.mock("../utils/robotTeamAccounts", () => ({
  teamsForAccount: async (uid: string) => state.teams.filter((team) => team.accountUid === uid),
  bindTeamToAccount: async (teamId: string, holder: { uid: string }) => {
    const created = state.createdTeams.find((team) => team.id === teamId)!;
    state.teams.push({ id: teamId, name: created.name, accountUid: holder.uid });
  },
}));
vi.mock("../utils/robotTeamRegistry", () => ({
  registerSelfServeTeam: async (params: { name: string }) => {
    const team = { id: `team-new-${state.createdTeams.length + 1}`, ...params };
    state.createdTeams.push(team);
    return team;
  },
}));
vi.mock("../utils/robotCheckpoints", () => ({
  listCheckpoints: async (teamId: string) => state.checkpoints.filter((checkpoint) => checkpoint.teamId === teamId),
  registerCheckpoint: async (params: Record<string, any>) => {
    state.registered.push(params);
    if (params.runtime === "container_image" && !String(params.reference).includes("@sha256:"))
      return { registered: false, refusal: "reference_invalid", detail: "Provide a digest-pinned container image." };
    const checkpoint = { checkpointId: `ckpt_${state.registered.length}`, ...params, status: "registered",
      unrunnableReason: null, createdAtIso: "2026-10-13T00:00:00.000Z" };
    state.checkpoints.push(checkpoint);
    return { registered: true, checkpoint };
  },
}));

const people: Record<string, Record<string, unknown>> = {
  team: { uid: "team-user", email: "lead@atlas.example", email_verified: true },
  unverified: { uid: "team-user", email: "lead@atlas.example", email_verified: false },
  pending: { uid: "pending-user", email: "pending@nova.example", email_verified: true },
  site: { uid: "site-user", email: "ops@site.example", email_verified: true },
};

let server: Server;
let baseUrl: string;
beforeEach(async () => {
  for (const value of Object.values(state)) {
    if (value instanceof Map || value instanceof Set) value.clear();
    else if (Array.isArray(value)) value.length = 0;
  }
  state.users.set("team-user", { buyerType: "robot_team", organizationName: "Atlas Robotics" });
  state.users.set("pending-user", { buyerType: "robot_team" });
  state.users.set("site-user", { buyerType: "site_operator" });
  state.approved.add("lead@atlas.example");
  state.setups.set("team-user/setup-1", { name: "Arm v2", reference: "https://policy.atlas.example/v2", delivery: "endpoint" });
  state.setups.set("team-user/setup-2", { name: "Arm container", reference: "oci://registry.example/atlas/arm:latest", delivery: "container" });
  state.teams.push({ id: "team-1", name: "Atlas", accountUid: "team-user" });
  const { default: router } = await import("../routes/workspace-checkpoints");
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.firebaseUser = people[String(req.headers.authorization || "").replace("Bearer ", "")] ?? null;
    next();
  });
  app.use("/api/workspace/checkpoints", router);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  baseUrl = `http://127.0.0.1:${address.port}/api/workspace/checkpoints`;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.resetModules();
});

function post(who: string, body: unknown) {
  return fetch(baseUrl, { method: "POST", headers: { Authorization: `Bearer ${who}`, "Content-Type": "application/json" },
    body: JSON.stringify(body) });
}

describe("workspace checkpoint registration", () => {
  it("requires a signed-in account", async () => {
    expect((await fetch(baseUrl)).status).toBe(401);
    expect((await post("nobody", { setupId: "setup-1", label: "v2", runtime: "policy_endpoint" })).status).toBe(401);
  });

  it("refuses site accounts and robot teams Blueprint has not approved", async () => {
    const site = await post("site", { setupId: "setup-1", label: "v2", runtime: "policy_endpoint" });
    expect(site.status).toBe(403);
    expect((await site.json()).code).toBe("robot_team_required");
    const pending = await fetch(baseUrl, { headers: { Authorization: "Bearer pending" } });
    expect(pending.status).toBe(403);
    expect((await pending.json()).code).toBe("account_invitation_required");
  });

  it("requires a verified email to register", async () => {
    const response = await post("unverified", { setupId: "setup-1", label: "v2", runtime: "policy_endpoint" });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("account_email_unverified");
  });

  it("registers with the saved setup's reference, never one from the request", async () => {
    const response = await post("team", { setupId: "setup-1", label: "Arm v2", runtime: "policy_endpoint" });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, created: true, checkpoint: { teamId: "team-1", reference: "https://policy.atlas.example/v2",
      runtime: "policy_endpoint", status: "registered" } });
    expect(state.registered).toEqual([{ teamId: "team-1", label: "Arm v2", runtime: "policy_endpoint", reference: "https://policy.atlas.example/v2" }]);

    const smuggled = await post("team", { setupId: "setup-1", label: "x", runtime: "policy_endpoint", reference: "https://evil.example" });
    expect(smuggled.status).toBe(400);
  });

  it("is idempotent for the same setup and runtime", async () => {
    await post("team", { setupId: "setup-1", label: "Arm v2", runtime: "policy_endpoint" });
    const again = await post("team", { setupId: "setup-1", label: "Arm v2 again", runtime: "policy_endpoint" });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ created: false, checkpoint: { checkpointId: "ckpt_1" } });
    expect(state.registered).toHaveLength(1);
  });

  it("rejects runtimes that cannot match a setup reference and unknown setups", async () => {
    expect((await post("team", { setupId: "setup-1", label: "v2", runtime: "model_artifact" })).status).toBe(400);
    expect((await post("team", { setupId: "setup-1", label: "v2", runtime: "skill_trace" })).status).toBe(400);
    const missing = await post("team", { setupId: "setup-404", label: "v2", runtime: "policy_endpoint" });
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe("setup_not_found");
  });

  it("refuses a team the account does not own", async () => {
    state.teams.push({ id: "team-other", name: "Other", accountUid: "someone-else" });
    const response = await post("team", { teamId: "team-other", setupId: "setup-1", label: "v2", runtime: "policy_endpoint" });
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("team_not_found");
    expect(state.registered).toHaveLength(0);
  });

  it("passes the shared reference validation through as a refusal", async () => {
    const response = await post("team", { setupId: "setup-2", label: "Container", runtime: "container_image" });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("reference_invalid");
  });

  it("creates and binds a team for an approved account that has none", async () => {
    state.teams.length = 0;
    const response = await post("team", { setupId: "setup-1", label: "Arm v2", runtime: "customer_hosted" });
    expect(response.status).toBe(201);
    expect(state.createdTeams).toEqual([{ id: "team-new-1", name: "Atlas Robotics", contactEmail: "lead@atlas.example" }]);
    expect((await response.json()).checkpoint.teamId).toBe("team-new-1");
  });

  it("lists the account's teams and checkpoints", async () => {
    await post("team", { setupId: "setup-1", label: "Arm v2", runtime: "policy_endpoint" });
    const response = await fetch(baseUrl, { headers: { Authorization: "Bearer team" } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.teams).toEqual([{ teamId: "team-1", name: "Atlas" }]);
    expect(body.checkpoints).toHaveLength(1);
    expect(body.runtimes).toEqual(["policy_endpoint", "customer_hosted", "container_image", "controller_adapter"]);
  });
});
