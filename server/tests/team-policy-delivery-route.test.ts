// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, expect, it, vi } from "vitest";

const records = vi.hoisted(() => new Map<string, Record<string, any>>());
const setup = vi.hoisted(() => ({
  setup_digest: `sha256:${"a".repeat(64)}`,
  scene_id: "interiorgs-841757",
  task_id: "scene-841757-book-to-marked-area",
  robot_presets: [{
    robot_preset_id: "unitree_g1_dex3_sonic_v1",
    embodiment_id: "unitree_g1_dex3_v1",
    observation_schema: { schema_id: "humanoidarena_head_rgb_state64_v1" },
    action_schema: { schema_id: "humanoidarena_semantic_v3" },
  }],
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: { collection: () => ({
    doc: (id: string) => ({
      get: async () => ({ exists: records.has(id), data: () => records.get(id) }),
      create: async (value: Record<string, any>) => {
        if (records.has(id)) throw new Error("exists");
        records.set(id, structuredClone(value));
      },
    }),
    where: (_field: string, _op: string, uid: string) => ({ limit: () => ({ get: async () => ({
      docs: [...records.entries()].filter(([, row]) => row.owner.user_id === uid)
        .map(([id, row]) => ({ id, data: () => row })),
    }) }) }),
  }) },
}));
vi.mock("../utils/nativeG1TeamCampaignForwarding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/nativeG1TeamCampaignForwarding")>()),
  fetchG1TeamCatalog: async (owner: { user_id: string; organization_id: string }) => ({
    owner, setups: [setup],
  }),
}));

import router from "../routes/native-g1-team-campaigns";

let server: Server | null = null;
afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()) || resolve());
  server = null;
  records.clear();
});

async function start() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { res.locals.firebaseUser = {
    uid: req.header("x-test-owner") || "owner-a",
  }; next(); });
  app.use("/api/native-g1-team-campaigns", router);
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("port unavailable");
  return `http://127.0.0.1:${address.port}/api/native-g1-team-campaigns/policy-deliveries`;
}

it("keeps delivery profiles owner scoped and idempotent without invoking a policy", async () => {
  const url = await start();
  const body = JSON.stringify({ setup_digest: setup.setup_digest,
    robot_preset_id: "unitree_g1_dex3_sonic_v1", label: "Team endpoint v1",
    delivery: { mode: "authenticated_endpoint", endpoint_url: "https://policy.example.com/action",
      auth_secret_ref: "secretref:team/policy", timeout_ms: 5000 } });
  const post = (owner: string, value: string) => fetch(url, { method: "POST",
    headers: { "content-type": "application/json", "x-test-owner": owner }, body: value });
  const first = await post("owner-a", body);
  expect(first.status).toBe(201);
  const profile = await first.json();
  expect(profile).toMatchObject({ status: "registered_for_runtime_review",
    provider_mutation_performed: false, claim_ceiling: "planning_only",
    owner: { user_id: "owner-a" } });
  expect((await post("owner-a", body)).status).toBe(200);
  expect((await post("owner-b", body)).status).toBe(201);
  const firstList = await (await fetch(url, { headers: { "x-test-owner": "owner-a" } })).json();
  const secondList = await (await fetch(url, { headers: { "x-test-owner": "owner-b" } })).json();
  expect(firstList.profiles).toHaveLength(1);
  expect(secondList.profiles).toHaveLength(1);
  expect(firstList.profiles[0].profile_digest).not.toBe(secondList.profiles[0].profile_digest);
  expect(records.size).toBe(2);
  expect((await post("owner-a", body.replace("https://policy.example.com/action",
    "https://127.0.0.1/action"))).status).toBe(422);
  expect(records.size).toBe(2);
});
