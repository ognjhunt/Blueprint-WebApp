// @vitest-environment node
/**
 * Planning is open. Paying and running need a verified account.
 *
 * A team (or its agent) can register, plan and dry-run without talking to
 * anyone. Before money moves, a person binds the team to a verified Blueprint
 * account, once; the account is also where the team's agent keys are issued
 * and revoked. These tests walk both sides: the agent surface refusing, and
 * the account connecting the team and issuing keys.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState, fakeArrayUnion } from "./helpers/fake-firestore";

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

async function register(): Promise<{ teamId: string; agentKey: string }> {
  const response = await fetch(`${base}/api/agent-team/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      teamName: "Acme Robotics",
      contactEmail: "robot-owner@example.com",
      hardwareMaturity: "pilots",
      deploymentGeography: "right_opportunity",
    }),
  });
  expect(response.status).toBe(201);
  return response.json();
}

describe("an unbound team can plan but cannot pay", () => {
  it("refuses funding, switching spend on, and confirmed runs with the steps to fix it", async () => {
    const { agentKey } = await register();

    const me = await (await agent("/me", agentKey)).json();
    expect(me.accountBound).toBe(false);
    expect(me.canSpendNow).toBe(false);

    const funding = await agent("/funding", agentKey, { amountUsd: 100 });
    expect(funding.status).toBe(403);
    expect((await funding.json()).code).toBe("team_account_required");

    const enable = await agent("/policy", agentKey,
      { dailyLimitUsd: 100, perRunLimitUsd: 99, agentSpendEnabled: true }, "PUT");
    expect(enable.status).toBe(403);

    const run = await agent("/runs", agentKey,
      { checkpointId: "cp-1", confirm: true, idempotencyKey: "idem-12345678" });
    expect(run.status).toBe(403);
    expect((await run.json()).code).toBe("team_account_required");
  });

  it("still lets a team switch its agent off and dry-run", async () => {
    const { agentKey } = await register();
    const disable = await agent("/policy", agentKey,
      { dailyLimitUsd: 0, perRunLimitUsd: 0, agentSpendEnabled: false }, "PUT");
    expect(disable.status).toBe(200);
    const dryRun = await agent("/runs", agentKey, { checkpointId: "cp-1" });
    expect(dryRun.status).not.toBe(403);
  });
});

describe("a verified account connects the team, and then it can pay", () => {
  it("binds the team behind the key the plan page holds", async () => {
    const { teamId, agentKey } = await register();

    const connected = await account("/robot-team/connect", "robot-owner", { agentKey });
    expect(connected.status).toBe(200);
    expect(sharedFakeFirestoreState.docs.get(`robotTeams/${teamId}`)).toMatchObject({
      accountUid: "robot-owner",
      accountEmail: "robot-owner@example.com",
    });

    // Past the account gate: payments are simply not configured in tests.
    const funding = await agent("/funding", agentKey, { amountUsd: 100 });
    expect(funding.status).not.toBe(403);
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
  it("creates the team on first key, and the key can pay at once", async () => {
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
    expect(sent.text).toMatch(/Settings → Agent access/);
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

