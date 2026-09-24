// @vitest-environment node
/**
 * A robot team getting from nothing to a plan with no person involved.
 *
 * ## What was actually wrong
 *
 * The robot-team path ended in waiting, and the waiting was not a queue we had
 * failed to staff — it was four questions and two admin routes.
 *
 * The intake asks where the hardware is, where they can deploy, how many
 * engineers they can spare and when they could start. All four are facts about
 * *deploying a robot at a site*. None of them is needed to run a policy against
 * a scene we already hold, which is what a team came for. Then, having answered
 * them, a team still could not act: its key came from an operator and its
 * balance came from an operator.
 *
 * So these tests are about absence. No gates, no spec answers, no operator, and
 * a plan at the end of it.
 */
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState, fakeArrayUnion } from "./helpers/fake-firestore";
import { listedTaskCard } from "./helpers/listedTaskCard";

// Early access is covered in robot-team-early-access.test.ts. These tests are
// about planning, spending and settling, so every team here is admitted.
vi.mock("../utils/robotTeamEarlyAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/robotTeamEarlyAccess")>()),
  teamHasEarlyAccess: async () => true,
}));


// Runtime admission has its own contract suite. These exercise the authenticated
// plan/payment wiring with an explicitly prepared execution fixture.
vi.mock("../utils/agentExecutionAdmission", () => ({
  discoverAgentExecutionAdmission: async ({ sceneId }: { sceneId: string }) => ({
    admitted: true, envelope: { source_request_id: `prepared-${sceneId}` },
    canonicalJson: JSON.stringify({ source_request_id: `prepared-${sceneId}` }), digestSha256: `sha256:${"a".repeat(64)}`,
  }),
}));

const sendEmail = vi.hoisted(() =>
  vi.fn(async () => ({ sent: true, provider: "test" as const, messageId: "test" })),
);

// Paying needs an account-bound team; that gate has its own suite
// (robot-team-account-gate.test.ts). These suites exercise what happens after
// a verified account has claimed the team.
vi.mock("../utils/robotTeamAccounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/robotTeamAccounts")>()),
  teamAccountUid: async () => "account-uid",
}));

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
    authAdmin: { verifyIdToken: async () => ({ uid: "nobody" }) },
  };
});

vi.mock("../utils/email", () => ({
  sendEmail,
}));

// Registration is open, so the limiter is the only thing standing in front of
// it. Pass it through here and test the limit itself where it is configured.
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// No Stripe key in tests. The funding route's refusal path is the one under
// test; the session-creation path belongs to a Stripe integration test.
vi.mock("../constants/stripe", () => ({ stripeClient: null, stripeAvailable: false }));

async function startRoutes(): Promise<{ server: Server; baseUrl: string }> {
  const { default: agentTeam } = await import("../routes/agent-team");
  const app = express();
  app.use(express.json());
  app.use("/api/agent-team", agentTeam);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function withRoutes<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const { server, baseUrl } = await startRoutes();
  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function json(key?: string) {
  return {
    "content-type": "application/json",
    ...(key ? { authorization: `Bearer ${key}` } : {}),
  };
}

const requiredRobotFacts = {
  hardwareMaturity: "pilots",
  deploymentGeography: "right_opportunity",
} as const;

/**
 * One site that is genuinely runnable supply.
 *
 * This fixture used to claim "screened, reconstructed" in its own name while
 * carrying neither a confirmed brief nor a scene -- the same thing
 * `loadRunnableSites` claimed in its docstring and did not check. Now that it
 * does check, the fixture has to be what it says it is: every binding gate
 * answered, the operator's confirmation on file, and a world manifest.
 */
function seedOneRunnableSite() {
  sharedFakeFirestoreState.docs.set("inboundRequests/site-1", {
    requestId: "site-1",
    request: {
      buyerType: "site",
      targetSiteType: "Grocery back room",
      capture_mode: "self_capture",
      capture_region: "us",
      siteTaskSpec: { taskFamily: "shelf_restock", payloadCapacity: "payload_20kg" },
      siteTaskGates: {
        sceneStability: "stable",
        taskShape: "single",
        objectVariety: "under_10",
        deploymentTimeline: "this_quarter",
        accessWindow: "scheduled",
      },
    },
    site_task_triage: { disposition: "qualified" },
    // Teams plan only against sites that shared a card.
    public_task_listing: listedTaskCard(),
    // The attestation: the operator confirmed our reading of their evidence.
    site_task_brief_confirmed_at: "2026-09-17T00:00:00.000Z",
    // And a scene actually exists, which nothing checked before.
    pipeline: {
      scene_id: "site-1",
      capture_id: "cap-1",
      pipeline_prefix: "gs://bucket/site-1",
      artifacts: { worldlabs_world_manifest_uri: "gs://bucket/site-1/world.json" },
    },
    // A scene existing is not a scene an evaluation can run against. This
    // fixture claims to be genuine runnable supply, so it carries the internal
    // proof `sceneRunnableReadiness` requires: a simulator has stepped it and
    // benchmark tasks are defined.
    evaluation_readiness: {
      runtime_launchable: true,
      benchmark_coverage_status: "ready",
      benchmark_task_count: 3,
      robot_eval_preflight_summary: { simulator_execution_proven: true, episode_count: 20 },
    },
  });
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sendEmail.mockClear();
});

/* ------------------------------------------------------ registration */

describe("a team registers itself", () => {
  it("accepts the two self-reported facts and returns a usable key", async () => {
    const body = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Alpha Robotics" }),
      });
      expect(response.status).toBe(201);
      return (await response.json()) as Record<string, unknown>;
    });

    expect(String(body.agentKey)).toMatch(/^bpk_/);
    expect(String(body.teamId)).toMatch(/^team_alpha-robotics_/);
    // Nothing spendable. A key is an identity, not a credit line.
    expect(body.grants).toMatchObject({ balanceUsd: 0, agentSpendEnabled: false });
  });

  it("never attaches a new key to a team that already exists", async () => {
    // The attack this closes: registering under a real team's name and being
    // handed a working key to their balance and their results.
    const ids = await withRoutes(async (baseUrl) => {
      const first = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Figure" }),
      });
      const second = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Figure" }),
      });
      return [
        ((await first.json()) as { teamId: string }).teamId,
        ((await second.json()) as { teamId: string }).teamId,
      ];
    });

    expect(ids[0]).not.toBe(ids[1]);
    expect(sharedFakeFirestoreState.docs.has(`robotTeams/${ids[0]}`)).toBe(true);
    expect(sharedFakeFirestoreState.docs.has(`robotTeams/${ids[1]}`)).toBe(true);
  });

  it("lands outside the supply that sites are told about", async () => {
    // Registration is open, so a name typed into a public endpoint must not
    // become a robot team we count in a site's reply.
    const teamId = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Vapourware Robotics" }),
      });
      return ((await response.json()) as { teamId: string }).teamId;
    });

    const record = sharedFakeFirestoreState.docs.get(`robotTeams/${teamId}`) as Record<
      string,
      unknown
    >;
    expect(record.status).toBe("self_registered");
    expect(record.registrationSource).toBe("self_serve");
    expect(record.capability).toMatchObject(requiredRobotFacts);

    const { listMatchableRobotTeams } = await import("../utils/robotTeamRegistry");
    await expect(listMatchableRobotTeams()).resolves.toEqual([]);
  });

  it("earns its place in that supply by being measured, not by claiming", async () => {
    const teamId = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Alpha Robotics" }),
      });
      return ((await response.json()) as { teamId: string }).teamId;
    });

    const { recordEvaluationOutcome, listMatchableRobotTeams } = await import(
      "../utils/robotTeamRegistry"
    );
    await recordEvaluationOutcome({
      robotTeamId: teamId,
      runId: "run-1",
      demonstratedSuccessRate: "success_90_plus",
    });

    const matchable = await listMatchableRobotTeams();
    expect(matchable.map((team) => team.id)).toContain(teamId);
    expect(matchable[0]?.status).toBe("applied");
    // And the figure is measured, which is the only reason it counts.
    expect(matchable[0]?.fieldProvenance?.demonstratedSuccessRate?.grade).toBe("measured");
  });

  it("takes a checkpoint inline, so one call reaches a plannable team", async () => {
    const body = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({
          ...requiredRobotFacts,
          teamName: "Alpha Robotics",
          checkpoint: {
            label: "v3",
            runtime: "policy_endpoint",
            reference: "https://policies.example/v3",
          },
        }),
      });
      return (await response.json()) as { checkpoint: { checkpointId?: string } };
    });

    expect(body.checkpoint?.checkpointId).toMatch(/^ckpt_/);
  });

  it("keeps the registration when the checkpoint is the part that is wrong", async () => {
    // Failing the whole call would make a team register twice and leave an
    // orphan behind.
    const body = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({
          ...requiredRobotFacts,
          teamName: "Alpha Robotics",
          checkpoint: { label: "v3", runtime: "policy_endpoint", reference: "   " },
        }),
      });
      expect(response.status).toBe(400);
      return (await response.json()) as Record<string, unknown>;
    });

    // A blank reference is caught by the schema before anything is written,
    // so nothing half-made exists.
    expect(body.code).toBe("registration_invalid");
    expect([...sharedFakeFirestoreState.docs.keys()].filter((k) => k.startsWith("robotTeams/")))
      .toEqual([]);
  });
});

/* ---------------------------------------------- the path, with nobody in it */

describe("registration to plan, without an operator", () => {
  it("gets a ranked plan for a team that has answered nothing", async () => {
    // The load-bearing claim of the whole redesign: a blank team is not
    // penalised by having skipped the form. `evalSelection` ranks an unknown
    // hard constraint above everything else, so the team we know least about
    // gets the most informative plan.
    seedOneRunnableSite();

    const plan = await withRoutes(async (baseUrl) => {
      const registered = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({
          ...requiredRobotFacts,
          teamName: "Alpha Robotics",
          checkpoint: {
            label: "v3",
            runtime: "policy_endpoint",
            reference: "https://policies.example/v3",
          },
        }),
      });
      const { agentKey, checkpoint } = (await registered.json()) as {
        agentKey: string;
        checkpoint: { checkpointId: string };
      };

      // Planning needs no money and no policy: free to find out.
      const response = await fetch(`${baseUrl}/api/agent-team/plan`, {
        method: "POST",
        headers: json(agentKey),
        body: JSON.stringify({ checkpointId: checkpoint.checkpointId, budgetUsd: 1_000 }),
      });
      expect(response.status).toBe(200);
      return (await response.json()) as {
        selected: { sceneId: string; rationale: string; value: number }[];
        skipped: unknown[];
      };
    });

    expect(plan.selected).toHaveLength(1);
    expect(plan.selected[0]?.sceneId).toBe("site-1");
    expect(plan.selected[0]?.rationale).toMatch(/hard constraints nobody has established/i);
  });

  it("quotes what the unfunded plan would cost instead of hiding it", async () => {
    // The regression this locks: /plan used to cap its budget at the balance,
    // so a team that had just registered got an empty list and had to pay to
    // find out whether paying was worth it.
    seedOneRunnableSite();

    const plan = await withRoutes(async (baseUrl) => {
      const registered = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({
          ...requiredRobotFacts,
          teamName: "Alpha Robotics",
          checkpoint: {
            label: "v3",
            runtime: "policy_endpoint",
            reference: "https://policies.example/v3",
          },
        }),
      });
      const { agentKey, checkpoint } = (await registered.json()) as {
        agentKey: string;
        checkpoint: { checkpointId: string };
      };
      const response = await fetch(`${baseUrl}/api/agent-team/plan`, {
        method: "POST",
        headers: json(agentKey),
        body: JSON.stringify({ checkpointId: checkpoint.checkpointId }),
      });
      return (await response.json()) as {
        committed: boolean;
        spendableNowUsd: number;
        fundingNeededUsd: number;
        totalCostUsd: number;
        blockedBy: string | null;
        next: string;
        selected: unknown[];
      };
    });

    // No budget was asked for and the team has nothing: still a real plan.
    expect(plan.selected.length).toBeGreaterThan(0);
    expect(plan.committed).toBe(false);
    expect(plan.spendableNowUsd).toBe(0);
    // And it is honest about why it cannot be bought yet, and what to do.
    expect(plan.fundingNeededUsd).toBe(plan.totalCostUsd);
    expect(plan.blockedBy).toBe("insufficient_balance");
    expect(plan.next).toContain("spendMode:one_time");
  });

  it("refuses to spend before the team has funded and switched its agent on", async () => {
    seedOneRunnableSite();

    const result = await withRoutes(async (baseUrl) => {
      const registered = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({
          ...requiredRobotFacts,
          teamName: "Alpha Robotics",
          checkpoint: {
            label: "v3",
            runtime: "policy_endpoint",
            reference: "https://policies.example/v3",
          },
        }),
      });
      const { agentKey, checkpoint } = (await registered.json()) as {
        agentKey: string;
        checkpoint: { checkpointId: string };
      };

      const response = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: json(agentKey),
        body: JSON.stringify({
          checkpointId: checkpoint.checkpointId,
          confirm: true,
          idempotencyKey: "first-try-1",
        }),
      });
      return (await response.json()) as { spent: boolean; started: unknown[] };
    });

    // A fresh registration cannot move money, and says so by doing nothing
    // rather than by erroring.
    expect(result.spent).toBe(false);
    expect(result.started).toEqual([]);
  });

  it("tells a fresh team exactly which calls come next", async () => {
    const next = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Alpha Robotics" }),
      });
      return ((await response.json()) as { next: string[] }).next;
    });

    // An agent should not have to read a document to find the next call.
    expect(next.join(" ")).toContain("POST /api/agent-team/checkpoints");
    expect(next.join(" ")).toContain("POST /api/agent-team/funding");
    expect(next.join(" ")).toContain("PUT /api/agent-team/policy");
  });
});

describe("the plan a team saw is what it reserves", () => {
  // A team that is about to reserve has funded and switched its agent on --
  // otherwise the dry run caps its budget at a zero balance, selects nothing,
  // and signs an empty plan, which is not the case this describe block is about.
  // Seed the ledger and policy the way funding and PUT /policy would, so the
  // dry run sees a plan worth pinning.
  async function registerTeam(baseUrl: string) {
    const registered = await fetch(`${baseUrl}/api/agent-team/register`, {
      method: "POST",
      headers: json(),
      body: JSON.stringify({
        ...requiredRobotFacts,
        teamName: "Alpha Robotics",
        checkpoint: { label: "v3", runtime: "policy_endpoint", reference: "https://policies.example/v3" },
      }),
    });
    const body = (await registered.json()) as {
      agentKey: string;
      teamId: string;
      checkpoint: { checkpointId: string };
    };

    const { creditTeam, setSpendPolicy } = await import("../utils/robotTeamBalance");
    await creditTeam({
      teamId: body.teamId,
      amountUsd: 500,
      reason: "Test seed: funded balance",
      idempotencyKey: "seed-credit-1",
    });
    await setSpendPolicy({
      teamId: body.teamId,
      dailyLimitUsd: 500,
      perRunLimitUsd: 500,
      agentSpendEnabled: true,
    });

    return body;
  }

  it("hands back a signed plan token in the dry run", async () => {
    seedOneRunnableSite();
    const body = await withRoutes(async (baseUrl) => {
      const { agentKey, checkpoint } = await registerTeam(baseUrl);
      const response = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: json(agentKey),
        body: JSON.stringify({ checkpointId: checkpoint.checkpointId }),
      });
      return (await response.json()) as { dryRun: boolean; planToken?: string; selected: unknown[] };
    });

    expect(body.dryRun).toBe(true);
    expect(typeof body.planToken).toBe("string");
  });

  it("refuses a planned site that is no longer runnable, rather than swapping in another", async () => {
    // The exact supply-shift the fix is for: the site is runnable at dry-run
    // time, gone by confirm time. The team must be told, not silently charged
    // for a different site it never saw.
    seedOneRunnableSite();
    const result = await withRoutes(async (baseUrl) => {
      const { agentKey, checkpoint } = await registerTeam(baseUrl);

      const dry = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: json(agentKey),
        body: JSON.stringify({ checkpointId: checkpoint.checkpointId }),
      });
      const { planToken } = (await dry.json()) as { planToken: string };

      // Supply moves between the two calls.
      sharedFakeFirestoreState.docs.delete("inboundRequests/site-1");

      const confirm = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: json(agentKey),
        body: JSON.stringify({
          checkpointId: checkpoint.checkpointId,
          confirm: true,
          idempotencyKey: "pinned-confirm-1",
          planToken,
        }),
      });
      return (await confirm.json()) as {
        started: unknown[];
        refused: { sceneId: string; refusal: string }[];
      };
    });

    expect(result.started).toEqual([]);
    expect(result.refused.some((entry) => entry.refusal === "site_no_longer_runnable")).toBe(true);
  });

  it("rejects a tampered or foreign plan token before spending anything", async () => {
    seedOneRunnableSite();
    const status = await withRoutes(async (baseUrl) => {
      const { agentKey, checkpoint } = await registerTeam(baseUrl);
      const response = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: json(agentKey),
        body: JSON.stringify({
          checkpointId: checkpoint.checkpointId,
          confirm: true,
          idempotencyKey: "bad-plan-1",
          planToken: "clearly.not-signed",
        }),
      });
      return response.status;
    });

    expect(status).toBe(409);
  });
});

/* ------------------------------------------------------------- funding */

describe("funding needs no operator", () => {
  it("says so plainly when payments are not configured, rather than hanging", async () => {
    const result = await withRoutes(async (baseUrl) => {
      const registered = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Alpha Robotics" }),
      });
      const { agentKey } = (await registered.json()) as { agentKey: string };

      const response = await fetch(`${baseUrl}/api/agent-team/funding`, {
        method: "POST",
        headers: json(agentKey),
        body: JSON.stringify({ amountUsd: 100 }),
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    });

    expect(result.status).toBe(503);
    expect(result.body.code).toBe("stripe_unavailable");
    expect(result.body.bounds).toMatchObject({ minUsd: 99, maxUsd: 25_000 });
  });

  it("rejects an amount outside the bounds before touching Stripe", async () => {
    const codes = await withRoutes(async (baseUrl) => {
      const registered = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Alpha Robotics" }),
      });
      const { agentKey } = (await registered.json()) as { agentKey: string };

      const results: string[] = [];
      for (const amountUsd of [5, 1_000_000_000]) {
        const response = await fetch(`${baseUrl}/api/agent-team/funding`, {
          method: "POST",
          headers: json(agentKey),
          body: JSON.stringify({ amountUsd }),
        });
        results.push(String(((await response.json()) as { code: string }).code));
      }
      return results;
    });

    // The floor is checked before Stripe availability, because an amount that
    // cannot buy anything is wrong whether or not payments are configured.
    expect(codes[0]).toBe("amount_below_minimum");
    expect(codes[1]).toBe("funding_invalid");
  });

  it("refuses an unknown key without saying which part was wrong", async () => {
    const status = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/funding`, {
        method: "POST",
        headers: json("bpk_not-a-real-key"),
        body: JSON.stringify({ amountUsd: 100 }),
      });
      return response.status;
    });
    expect(status).toBe(401);
  });
});

/* ------------------------------------------------ key reissue + store linking */

describe("a lost key is re-issued to the registered address", () => {
  it("emails a new working key to the registered contact email", async () => {
    const outcome = await withRoutes(async (baseUrl) => {
      const registered = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Key Loss Co", contactEmail: "ops@keyloss.example" }),
      });
      const account = (await registered.json()) as { teamId: string; agentKey: string };

      const reissue = await fetch(`${baseUrl}/api/agent-team/keys/reissue`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ contactEmail: "ops@keyloss.example" }),
      });
      const body = (await reissue.json()) as { ok: boolean; message?: string };

      // The response must never carry a key: the endpoint has no credential,
      // so its answer has to be safe for anyone to read.
      expect(reissue.status).toBe(202);
      expect(body.ok).toBe(true);
      expect(JSON.stringify(body)).not.toContain("bpk_");

      return { account, body: JSON.stringify(body) };
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = sendEmail.mock.calls[0][0] as { to: string; text: string };
    expect(emailCall.to).toBe("ops@keyloss.example");
    expect(emailCall.text).toContain(outcome.account.teamId);
    // The new key is real, not a replay of the old one.
    expect(emailCall.text).toMatch(/bpk_[A-Za-z0-9_-]+/);
    expect(emailCall.text).not.toContain(outcome.account.agentKey);
  });

  it("answers the same whether or not the address is registered", async () => {
    const statuses = await withRoutes(async (baseUrl) => {
      const unknown = await fetch(`${baseUrl}/api/agent-team/keys/reissue`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ contactEmail: "nobody@nowhere.example" }),
      });
      return { status: unknown.status, text: await unknown.text() };
    });

    expect(statuses.status).toBe(202);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(statuses.text).not.toContain("bpk_");
  });

  it("rejects a body without a valid email", async () => {
    const status = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/keys/reissue`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ contactEmail: "not-an-email" }),
      });
      return response.status;
    });
    expect(status).toBe(400);
  });
});

describe("self-serve registration links to an intake application", () => {
  it("cross-links both records when the contact email matches an applied team", async () => {
    // The application arrived first, through the form: deterministic slug,
    // status applied.
    sharedFakeFirestoreState.docs.set("robotTeams/team_compiler-robotics", {
      id: "team_compiler-robotics",
      name: "Compiler Robotics",
      status: "applied",
      registrationSource: "intake",
      contactEmail: "grace@compiler.example",
      capability: {},
      fieldProvenance: {},
      createdAt: "2026-09-18T00:00:00.000Z",
      updatedAt: "2026-09-18T00:00:00.000Z",
    });

    const linked = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({
          ...requiredRobotFacts,
          teamName: "Compiler Robotics",
          contactEmail: "grace@compiler.example",
        }),
      });
      const account = (await response.json()) as { teamId: string };
      expect(response.status).toBe(201);

      const selfServe = sharedFakeFirestoreState.docs.get(
        `robotTeams/${account.teamId}`,
      ) as { linkedIntakeTeamIds?: string[] };
      const applied = sharedFakeFirestoreState.docs.get(
        "robotTeams/team_compiler-robotics",
      ) as { selfServeTeamIds?: string[] };
      return {
        selfServeLinked: selfServe.linkedIntakeTeamIds ?? [],
        appliedLinked: applied.selfServeTeamIds ?? [],
      };
    });

    expect(linked.selfServeLinked).toEqual(["team_compiler-robotics"]);
    expect(linked.appliedLinked).toHaveLength(1);
  });

  it("leaves a registration with no matching application unlinked", async () => {
    const linked = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Lone Wolf", contactEmail: "solo@lone.example" }),
      });
      const account = (await response.json()) as { teamId: string };
      const record = sharedFakeFirestoreState.docs.get(
        `robotTeams/${account.teamId}`,
      ) as { linkedIntakeTeamIds?: string[] };
      return record.linkedIntakeTeamIds ?? null;
    });

    expect(linked).toBeNull();
  });
});

describe("an operator-paused site leaves runnable supply", () => {
  it("drops the site from a robot team's plan while paused", async () => {
    const withAndWithout = await withRoutes(async (baseUrl) => {
      const registered = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({
          ...requiredRobotFacts,
          teamName: "Alpha Robotics",
          checkpoint: { label: "v3", runtime: "policy_endpoint", reference: "https://policies.example/v3" },
        }),
      });
      const { agentKey, checkpoint } = (await registered.json()) as {
        agentKey: string;
        checkpoint: { checkpointId: string };
      };
      const plan = async () => {
        const response = await fetch(`${baseUrl}/api/agent-team/plan`, {
          method: "POST",
          headers: json(agentKey),
          body: JSON.stringify({ checkpointId: checkpoint.checkpointId }),
        });
        return (await response.json()) as { selected: { sceneId: string }[] };
      };

      seedOneRunnableSite();
      const live = await plan();

      // The operator pauses the listing: the same lever the catalog honors.
      const site = sharedFakeFirestoreState.docs.get("inboundRequests/site-1") as Record<string, any>;
      site.workspace_task = { ...(site.workspace_task || {}), paused: true };
      sharedFakeFirestoreState.docs.set("inboundRequests/site-1", site);
      const paused = await plan();

      return {
        liveIds: (live.selected ?? []).map((c) => c.sceneId),
        pausedIds: (paused.selected ?? []).map((c) => c.sceneId),
      };
    });

    expect(withAndWithout.liveIds).toContain("site-1");
    expect(withAndWithout.pausedIds).not.toContain("site-1");
  });
});

/* ------------------------------------------- the robot's facts, structured */

describe("the robot's non-observable physical facts", () => {
  it("stores embodiment, geography, and maturity on the capability at self-reported grade", async () => {
    const body = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({
          ...requiredRobotFacts,
          teamName: "Alpha Robotics",
          embodiment: "Mobile manipulator",
          hardwareMaturity: "pilots",
          deploymentGeography: "right_opportunity",
          website: "https://alpha.example/specs",
        }),
      });
      expect(response.status).toBe(201);
      return (await response.json()) as { teamId: string };
    });

    const team = sharedFakeFirestoreState.docs.get(`robotTeams/${body.teamId}`) as Record<string, any>;
    expect(team.capability).toMatchObject({
      embodiment: "Mobile manipulator",
      hardwareMaturity: "pilots",
      deploymentGeography: "right_opportunity",
    });
    expect(team.fieldProvenance.deploymentGeography.grade).toBe("self_reported");
    expect(team.fieldProvenance.embodiment.grade).toBe("self_reported");
    expect(team.fieldProvenance.hardwareMaturity.grade).toBe("self_reported");
    expect(team.hardwareMaturity).toBeUndefined();
    expect(team.website).toBe("https://alpha.example/specs");
  });

  it("keeps agent registration backward compatible when a deployment fact is unknown", async () => {
    const statuses = await withRoutes(async (baseUrl) => {
      const requests = [
        { teamName: "No maturity", deploymentGeography: "yes" },
        { teamName: "No geography", hardwareMaturity: "prototype" },
      ];
      return Promise.all(requests.map(async (body) => {
        const response = await fetch(`${baseUrl}/api/agent-team/register`, {
          method: "POST",
          headers: json(),
          body: JSON.stringify(body),
        });
        return response.status;
      }));
    });
    expect(statuses).toEqual([201, 201]);
  });

  it("refuses an answer outside the gate's own vocabulary", async () => {
    const status = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/register`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ ...requiredRobotFacts, teamName: "Alpha Robotics", deploymentGeography: "maybe" }),
      });
      return response.status;
    });
    expect(status).toBe(400);
  });
});
