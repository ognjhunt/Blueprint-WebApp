// @vitest-environment node
/**
 * Confirming a brief tells the site what our screen decided, and tells ops
 * when a call is needed.
 *
 * Blueprint builds a scene only for a `qualified` site. A site that needs a
 * call must hear that (not "we are preparing your scene"), and ops must hear
 * it too, because the scene waits on the call they record.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The outbox delivery the confirm route fires must not reach a real provider.
vi.mock("../utils/captureOutbox", () => ({
  enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));

const notifySlackScreeningCallNeeded = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../utils/slack", () => ({ notifySlackScreeningCallNeeded }));

const briefRouter = (await import("../routes/site-task-brief")).default;
const { gateFields } = await import("../../client/src/data/siteTaskQualification");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { draftBrief, saveBrief } = await import("../utils/siteTaskBrief");
const { enqueueOutbox } = await import("../utils/captureOutbox");

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  notifySlackScreeningCallNeeded.mockClear();
  vi.mocked(enqueueOutbox).mockClear();
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
    contact: { email: "ops@acme.example", firstName: "Dana" },
  });
  await saveBrief(
    draftBrief({
      requestId: "req-1",
      summary: "Cartons from a conveyor onto a pallet",
      captureMode: "self_capture",
      proposed: [],
    }),
  );
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function tokenFor(scope: "owner" | "film") {
  return createCaptureUploadToken({
    requestId: "req-1",
    captureId: "cap-1",
    sceneId: "scene-1",
    scope,
  });
}

async function confirm(answers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/api/site-task-brief/${tokenFor("owner")}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmedBy: "Dana Okafor", answers,
      successCriteria: { successDefinition: "Carton reaches pallet intact", successRate: 95, cycleTimeSeconds: 30, unknown: false } }),
  });
}

const clearAnswers = () =>
  Object.fromEntries(
    gateFields.map((field) => [field.id, field.options.find((option) => option.verdict === "clear")!.value]),
  );

describe("the confirmation says what our screen decided", () => {
  it("asks for a call, rings ops, and promises no scene yet", async () => {
    const response = await confirm();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { disposition: string; screening: any };
    expect(body.disposition).toBe("needs_conversation");
    expect(body.screening.headline).toMatch(/call/i);
    expect(body.screening.detail).toMatch(/build your scene once the call/i);
    expect(body.screening.bookingUrl).toMatch(/^https:\/\//);
    expect(enqueueOutbox).toHaveBeenCalledWith(expect.objectContaining({
      to: "ops@acme.example", subject: expect.stringMatching(/call/i),
    }));

    await vi.waitFor(() => expect(notifySlackScreeningCallNeeded).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, any>;
      expect(stored.ops?.next_step).toMatch(/screening call/);
    });
  });

  it("proceeds without a call once the site clears", async () => {
    const response = await confirm(clearAnswers());
    const body = (await response.json()) as { disposition: string; screening: unknown };
    expect(body.disposition).toBe("qualified");
    expect(body.screening).toBeNull();
    expect(notifySlackScreeningCallNeeded).not.toHaveBeenCalled();
    expect(enqueueOutbox).toHaveBeenCalledWith(expect.objectContaining({
      to: "ops@acme.example", kind: "brief_confirmed",
    }));
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/req-1")).toMatchObject({
      workspace_task: { terms: { successDefinition: "Carton reaches pallet intact", successRate: 95, cycleTimeSeconds: 30 } },
    });
  });

  it("stores site-stated pilot and deployment intent without treating it as an access grant", async () => {
    const response = await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("owner")}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        confirmedBy: "Dana Okafor",
        successCriteria: { successDefinition: "Carton reaches pallet intact", successRate: 95, cycleTimeSeconds: 30, unknown: false },
        pilotIntent: { pilotConsideration: "subject_to_review", deploymentPath: "pilot_only" },
      }),
    });
    expect(response.status).toBe(200);
    expect(sharedFakeFirestoreState.docs.get("siteTaskBriefs/req-1")).toMatchObject({
      pilotIntent: { pilotConsideration: "subject_to_review", deploymentPath: "pilot_only" },
    });
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/req-1")).toMatchObject({
      workspace_task: { pilotIntent: { pilotConsideration: "subject_to_review", deploymentPath: "pilot_only" } },
    });
    const film = await (await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("film")}`)).json();
    expect(film.brief.pilotIntent).toBeUndefined();
  });

  it("says not yet, without a call, when an answer blocks it", async () => {
    const response = await confirm({ ...clearAnswers(), sceneStability: "reconfigured" });
    const body = (await response.json()) as { disposition: string; screening: any };
    expect(body.disposition).toBe("not_now");
    expect(body.screening.headline).toMatch(/not building a scene/);
    expect(body.screening.bookingUrl).toBeNull();
    expect(enqueueOutbox).toHaveBeenCalledWith(expect.objectContaining({
      to: "ops@acme.example", subject: "Your task, and what would have to change",
    }));
  });
});

describe("the brief tells the owner link whether the site is saved to an account", () => {
  it("offers a claim token bound to the submission's email until it is claimed", async () => {
    const owner = await (await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("owner")}`)).json();
    expect(owner.account).toMatchObject({ claimed: false, email: "ops@acme.example" });
    expect(typeof owner.account.claimToken).toBe("string");

    const film = await (await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("film")}`)).json();
    expect(film.account).toBeNull();

    (sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>).account_owner_uid = "uid-1";
    const claimed = await (await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("owner")}`)).json();
    expect(claimed.account).toEqual({ claimed: true, email: "ops@acme.example", claimToken: null });
  });
});

describe("an expired task link asks for a fresh one", () => {
  it("emails a fresh owner link to the address on file, and answers a forged link the same way", async () => {
    const { enqueueOutbox } = await import("../utils/captureOutbox");
    const enqueue = vi.mocked(enqueueOutbox);
    enqueue.mockClear();
    const expired = createCaptureUploadToken({
      requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1", ttlSeconds: -60,
    });
    const post = (token: string) => fetch(`${baseUrl}/api/site-task-brief/${encodeURIComponent(token)}/fresh-link`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });

    const genuine = await post(expired);
    expect(genuine.status).toBe(202);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const message = enqueue.mock.calls[0][0] as { to: string; kind: string; body: string };
    expect(message).toMatchObject({ to: "ops@acme.example", kind: "fresh_link" });
    expect(message.body).toMatch(/^Hi Dana,/);
    expect(message.body).toMatch(/\/capture-upload\//);

    const forged = await post(`${expired.split(".")[0]}.not-a-signature`);
    expect(forged.status).toBe(202);
    expect(await forged.json()).toEqual(await (await post("garbage")).json());
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
