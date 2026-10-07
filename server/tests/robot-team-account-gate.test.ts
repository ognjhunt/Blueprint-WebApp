// @vitest-environment node
/**
 * Registration describes the free invited beta without granting execution.
 * Verified accounts manage team access; neither registration nor account
 * ownership enables the disabled planning, running or funding entrypoints.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState, fakeArrayUnion } from "./helpers/fake-firestore";

// Early access is covered in robot-team-early-access.test.ts. These tests are
// about planning, spending and settling, so every team here is admitted.
vi.mock("../utils/robotTeamEarlyAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/robotTeamEarlyAccess")>()),
  teamHasEarlyAccess: async () => true,
}));


const sendEmail = vi.hoisted(() =>
  vi.fn(async () => ({ sent: true, provider: "test" as const, messageId: "test" })),
);

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
          arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items),
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});
vi.mock("../utils/email", () => ({ sendEmail }));
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../constants/stripe", () => ({ stripeClient: null, stripeAvailable: false }));
vi.mock("../routes/inbound-request", () => ({ submitInboundRequest: vi.fn() }));
vi.mock("../utils/field-ops-automation", () => ({ sendCapturerCommunication: vi.fn() }));
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let server: Server;
let base: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  sendEmail.mockClear();
  sharedFakeFirestoreState.docs.set("users/robot-owner", { buyerType: "robot_team", organizationName: "Acme Robotics" });
  sharedFakeFirestoreState.docs.set("users/someone-else", { buyerType: "robot_team" });
  const { default: agentTeam } = await import("../routes/agent-team");
  const { default: workspace } = await import("../routes/workspace");
  const app = express();
  app.use(express.json());
  app.use("/api/agent-team", agentTeam);
  app.use(
    "/api/workspace",
    (req, res, next) => {
      res.locals.firebaseUser = {
        uid: req.headers["x-user"] || "",
        email: `${req.headers["x-user"]}@example.com`,
        email_verified: req.headers["x-unverified"] !== "1",
      };
      next();
    },
    workspace,
  );
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function agent(path: string, key: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  return fetch(`${base}/api/agent-team${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function account(path: string, uid: string, body?: unknown, extra: Record<string, string> = {}) {
  return fetch(`${base}/api/workspace${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-user": uid, ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function register(checkpoint?: { label: string; runtime: string; reference: string }): Promise<{
  teamId: string; agentKey: string; grants: Record<string, unknown>; next: string[];
}> {
  const response = await fetch(`${base}/api/agent-team/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      teamName: "Acme Robotics",
      contactEmail: "robot-owner@example.com",
      hardwareMaturity: "pilots",
      deploymentGeography: "right_opportunity",
      ...(checkpoint ? { checkpoint } : {}),
    }),
  });
  expect(response.status).toBe(201);
  return response.json();
}

describe("free beta refuses paid entrypoints for every account", () => {
  it.each([false, true])("registration instructions stay within the free invited beta (checkpoint: %s)", async (withCheckpoint) => {
    const reply = await register(withCheckpoint ? {
      label: "Registered policy", runtime: "policy_endpoint", reference: "https://example.test/policy",
    } : undefined);
    expect(reply.grants).toMatchObject({ balanceUsd: 0, agentSpendEnabled: false, accountBound: false });
    expect(reply.grants.note).toContain("free invited evaluations only");
    const instructions = reply.next.join(" ");
    expect(instructions).toContain(withCheckpoint ? "GET /api/agent-team/checkpoints" : "POST /api/agent-team/checkpoints");
    expect(instructions).toContain("registration does not start an evaluation");
    expect(instructions).toContain("verified Blueprint account");
    expect(instructions).toContain("/settings?tab=agent");
    expect(instructions).toContain("/app");
    expect(instructions).toContain("/contact/robot-team");
    expect(`${reply.grants.note} ${instructions}`).not.toMatch(/\/api\/agent-team\/(?:plan|runs|funding|policy)\b|can plan|can dry-run|Stripe|fund a balance|switch the agent on/i);
  });

  it("checkpoint registration gives an available next step without starting work", async () => {
    const { agentKey } = await register();
    const response = await agent("/checkpoints", agentKey, {
      label: "Registered policy", runtime: "policy_endpoint", reference: "https://example.test/policy",
    });
    expect(response.status).toBe(201);
    const reply = await response.json();
    expect(reply.checkpoint.status).toBe("registered");
    expect(reply.next).toContain("Registration does not start an evaluation");
    expect(reply.next).toContain("free invited evaluations");
    expect(reply.next).toContain("verified Blueprint account");
    expect(reply.next).toContain("/app");
    expect(reply.next).toContain("/contact/robot-team");
    expect(reply.next).not.toMatch(/\/api\/agent-team\/(?:plan|runs|funding|policy)\b|Stripe|fund a balance|switch the agent on/i);
  });

  it.each(["/plan", "/runs", "/funding"])("refuses anonymous empty %s before creating work", async (path) => {
    const before = [...sharedFakeFirestoreState.docs.entries()];
    const response = await fetch(`${base}/api/agent-team${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("paid_evaluations_disabled");
    expect([...sharedFakeFirestoreState.docs.entries()]).toEqual(before);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses funding, switching spend on, and confirmed runs with the steps to fix it", async () => {
    const { agentKey } = await register();

    const me = await (await agent("/me", agentKey)).json();
    expect(me.accountBound).toBe(false);
    expect(me.canSpendNow).toBe(false);

    const funding = await agent("/funding", agentKey, { amountUsd: 100 });
    expect(funding.status).toBe(403);
    expect((await funding.json()).code).toBe("paid_evaluations_disabled");

    const enable = await agent("/policy", agentKey,
      { dailyLimitUsd: 100, perRunLimitUsd: 99, agentSpendEnabled: true }, "PUT");
    expect(enable.status).toBe(403);

    const run = await agent("/runs", agentKey,
      { checkpointId: "cp-1", confirm: true, idempotencyKey: "idem-12345678" });
    expect(run.status).toBe(403);
    expect((await run.json()).code).toBe("paid_evaluations_disabled");
  });

  it("lets a team switch its agent off but refuses the paid dry-run", async () => {
    const { agentKey } = await register();
    const disable = await agent("/policy", agentKey,
      { dailyLimitUsd: 0, perRunLimitUsd: 0, agentSpendEnabled: false }, "PUT");
    expect(disable.status).toBe(200);
    const dryRun = await agent("/runs", agentKey, { checkpointId: "cp-1" });
    expect(dryRun.status).toBe(403);
  });
});

describe("a verified account connects the team without enabling payments", () => {
  it("binds the team behind the key the plan page holds", async () => {
    const { teamId, agentKey } = await register();

    const connected = await account("/robot-team/connect", "robot-owner", { agentKey });
    expect(connected.status).toBe(200);
    expect(sharedFakeFirestoreState.docs.get(`robotTeams/${teamId}`)).toMatchObject({
      accountUid: "robot-owner",
      accountEmail: "robot-owner@example.com",
    });

    // Account ownership does not override the release scope.
    const funding = await agent("/funding", agentKey, { amountUsd: 100 });
    expect(funding.status).toBe(403);
    expect((await (await agent("/me", agentKey)).json()).accountBound).toBe(true);
  });

  it("refuses an unverified email, and never moves a team to a second account", async () => {
    const { agentKey } = await register();
    const unverified = await account("/robot-team/connect", "robot-owner", { agentKey }, { "x-unverified": "1" });
    expect(unverified.status).toBe(403);

    expect((await account("/robot-team/connect", "robot-owner", { agentKey })).status).toBe(200);
    const stolen = await account("/robot-team/connect", "someone-else", { agentKey });
    expect(stolen.status).toBe(409);
  });
});

describe("the account issues and revokes the agent's keys", () => {
  it("creates the team on first key without enabling payments", async () => {
    const issued = await account("/robot-team/agent-keys", "robot-owner", { label: "ci agent" });
    expect(issued.status).toBe(201);
    const { teamId, agentKey, keyId } = await issued.json();
    expect(agentKey).toMatch(/^bpk_/);
    expect(sharedFakeFirestoreState.docs.get(`robotTeams/${teamId}`)).toMatchObject({ accountUid: "robot-owner" });

    const me = await (await agent("/me", agentKey)).json();
    expect(me.accountBound).toBe(true);

    const access = await (await account("/robot-team/agent-access", "robot-owner")).json();
    expect(access.teams).toHaveLength(1);
    expect(access.teams[0].keys.map((key: { keyId: string }) => key.keyId)).toContain(keyId);
    expect(JSON.stringify(access)).not.toContain(agentKey);

    const revoked = await account(`/robot-team/agent-keys/${keyId}/revoke`, "robot-owner", {});
    expect(revoked.status).toBe(200);
    expect((await agent("/me", agentKey)).status).toBe(401);
  });

  it("will not issue a key to an unverified account or revoke another account's key", async () => {
    expect((await account("/robot-team/agent-keys", "robot-owner", {}, { "x-unverified": "1" })).status).toBe(403);
    const { keyId } = await (await account("/robot-team/agent-keys", "robot-owner", {})).json();
    expect((await account(`/robot-team/agent-keys/${keyId}/revoke`, "someone-else", {})).status).toBe(404);
  });

  it("stops emailing spend-capable keys for a team an account owns", async () => {
    const { agentKey } = await register();
    await account("/robot-team/connect", "robot-owner", { agentKey });
    const reissue = await fetch(`${base}/api/agent-team/keys/reissue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactEmail: "robot-owner@example.com" }),
    });
    expect(reissue.status).toBe(202);
    const sent = sendEmail.mock.calls.at(-1)?.[0] as unknown as { text: string };
    expect(sent.text).toMatch(/Email hello@tryblueprint\.io from the account address to issue or revoke a key/);
    expect(sent.text).not.toMatch(/bpk_/);
  });
});

describe("a signed-in team sees its money and its runs without its agent key", () => {
  it("lists the balance and every run with what it showed", async () => {
    const { teamId } = await (await account("/robot-team/agent-keys", "robot-owner", { label: "ci" })).json();
    const { creditTeam } = await import("../utils/robotTeamBalance");
    await creditTeam({ teamId, amountUsd: 150, reason: "top-up", idempotencyKey: "fund-a" });
    sharedFakeFirestoreState.docs.set("evaluationRuns/run-1", {
      runId: "run-1", teamId, sceneId: "req-1", taskFamily: "pick_place", state: "settled",
      quotedUsd: 99, requestedAtIso: "2026-09-20T00:00:00.000Z", episodesRun: 50,
      result: { observed: { episodesRun: 50, episodesSucceeded: 41 } },
    });
    sharedFakeFirestoreState.docs.set("evaluationRuns/run-2", {
      runId: "run-2", teamId, sceneId: "req-2", taskFamily: "pick_place", state: "blocked",
      quotedUsd: 99, requestedAtIso: "2026-09-21T00:00:00.000Z", episodesRun: 0,
    });

    const access = await (await account("/robot-team/agent-access", "robot-owner")).json();
    const team = access.teams[0];
    expect(team.balance).toMatchObject({ availableUsd: 150, creditedUsd: 150 });
    expect(team.runs.map((run: { runId: string }) => run.runId)).toEqual(["run-2", "run-1"]);
    expect(team.runs[1]).toMatchObject({ resultStatus: "reported", episodesRun: 50, episodesSucceeded: 41 });
    expect(team.runs[0]).toMatchObject({ resultStatus: "no_result" });
  });
});

describe("the team hears when a run it bought reports", () => {
  it("emails the account once per run, for a result and for a run with none", async () => {
    const { teamId } = await (await account("/robot-team/agent-keys", "robot-owner", {})).json();
    const { notifyTeamOfRunOutcome } = await import("../utils/robotTeamNotifications");
    await notifyTeamOfRunOutcome({ teamId, runId: "run-1", outcome: { kind: "result", episodesSucceeded: 41, episodesRun: 50 } });
    await notifyTeamOfRunOutcome({ teamId, runId: "run-1", outcome: { kind: "result", episodesSucceeded: 41, episodesRun: 50 } });
    await notifyTeamOfRunOutcome({ teamId, runId: "run-2", outcome: { kind: "no_result" } });

    const rows = [...sharedFakeFirestoreState.docs.entries()]
      .filter(([key]) => key.startsWith("captureOutbox/team:"))
      .map(([, value]) => value as Record<string, string>);
    expect(rows).toHaveLength(2);
    const result = rows.find((row) => row.kind === "team_run_result")!;
    expect(result.to).toBe("robot-owner@example.com");
    expect(result.body).toContain("41 of 50 simulated episodes succeeded");
    expect(result.body).toContain("https://tryblueprint.io/settings?tab=agent");
    expect(rows.find((row) => row.kind === "team_run_no_result")!.body).toMatch(/not charged for episodes that did not run/);
  });
});
