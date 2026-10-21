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
import { listedTaskCard } from "./helpers/listedTaskCard";

// Nothing filmed yet unless a test says so. An unreadable bucket is not
// "nothing filmed": the reply must not guess either way.
const storage = vi.hoisted(() => ({ unreadable: false }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  const { createFakeUploadBucket } = await import("./helpers/fake-upload-bucket");
  const empty = createFakeUploadBucket();
  const down = () => { throw Object.assign(new Error("storage unavailable"), { code: 503 }); };
  const unreadable = { file: () => ({ getMetadata: async () => down(), exists: async () => down() }) };
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
    storageAdmin: { bucket: () => (storage.unreadable ? unreadable : empty.bucket) },
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
  storage.unreadable = false;
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
    // The start form's default: the anonymized card robot teams see.
    public_task_listing: listedTaskCard(),
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
  it("offers written clarification or a call without clearing the preparation gate", async () => {
    const response = await confirm();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { disposition: string; screening: any };
    expect(body.disposition).toBe("needs_conversation");
    expect(body.screening.headline).toMatch(/questions remain/i);
    expect(body.screening.detail).toMatch(/in writing.*or book a call/i);
    expect(body.screening.detail).toMatch(/review your answers.*before clearing/i);
    expect(body.screening.bookingUrl).toMatch(/^https:\/\//);
    expect(enqueueOutbox).toHaveBeenCalledWith(expect.objectContaining({
      to: "ops@acme.example", kind: "brief_confirmed", subject: "Your job brief is confirmed",
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
      to: "ops@acme.example", kind: "brief_confirmed", subject: "Your job brief is confirmed",
    }));
    // Commercial assessment remains useful without mandatory footage or evaluation.
    const sent = vi.mocked(enqueueOutbox).mock.calls[0][0] as { body: string };
    expect(sent.body).toMatch(/^Hi Dana,/);
    expect(sent.body).toMatch(/https:\/\/\S+\/capture-upload\//);
    expect(sent.body).toMatch(/assess suitable options against it.*next useful step/);
    expect(sent.body).toMatch(/Video and a buying budget are optional/);
    expect(sent.body).toMatch(/specific information when it changes a real decision/);
    expect(sent.body).not.toMatch(/film the work area|must upload|teams? on our list|Austin|checkout|fee/i);
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/req-1")).toMatchObject({
      workspace_task: { terms: { successDefinition: "Carton reaches pallet intact", successRate: 95, cycleTimeSeconds: 30 } },
    });
  });

  it("does not ask to film when the recording's status cannot be read", async () => {
    storage.unreadable = true;
    const response = await confirm(clearAnswers());
    expect((await response.json()).disposition).toBe("qualified");
    const sent = vi.mocked(enqueueOutbox).mock.calls[0][0] as { body: string };
    expect(sent.body).toMatch(/https:\/\/\S+\/capture-upload\//);
    expect(sent.body).toMatch(/Video and a buying budget are optional/);
    expect(sent.body).not.toMatch(/film the work area|upload it here/i);
  });

  it("keeps a private job private when its assessment begins", async () => {
    delete (sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>).public_task_listing;
    expect((await (await confirm(clearAnswers())).json()).disposition).toBe("qualified");
    const sent = vi.mocked(enqueueOutbox).mock.calls[0][0] as { body: string };
    expect(sent.body).toMatch(/assess suitable options/);
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/req-1")).not.toHaveProperty("public_task_listing");
  });

  it("answers a visit request without assuming where the site is", async () => {
    await saveBrief(draftBrief({
      requestId: "req-1", summary: "Cartons from a conveyor onto a pallet", captureMode: "site_visit", proposed: [],
    }));
    const response = await confirm(clearAnswers());
    expect((await response.json()).disposition).toBe("qualified");
    const sent = vi.mocked(enqueueOutbox).mock.calls[0][0] as { subject: string; body: string };
    expect(sent.subject).toBe("Your job brief is confirmed");
    expect(sent.body).toMatch(/assess suitable options/);
    expect(sent.body).not.toMatch(/visit is available|visit is booked|visit confirmed/i);
    expect(`${sent.subject}\n${sent.body}`).not.toMatch(/Austin|visit date/i);
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

  it("retains an unsupported scientific scope without rejecting the commercial assessment", async () => {
    await saveBrief(draftBrief({
      requestId: "req-1", summary: "Folding towels for wash-and-fold orders", captureMode: "self_capture", proposed: [],
    }));
    const response = await confirm(clearAnswers());
    const body = (await response.json()) as { disposition: string; screening: any };
    // The gates clear; the kind of job does not.
    expect(body.disposition).toBe("qualified");
    expect(body.screening.headline).toMatch(/cannot score this job.*not open to robot teams/);
    expect(body.screening.detail).toMatch(/soft or flexible items/);
    expect(body.screening.bookingUrl).toBeNull();
    expect(enqueueOutbox).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(enqueueOutbox).mock.calls[0][0] as { kind: string; subject: string; body: string; idempotencyKey: string };
    expect(sent).toMatchObject({ kind: "brief_confirmed", idempotencyKey: "req-1:brief-screening:qualified" });
    expect(sent.body).toMatch(/assess suitable options/);
    expect(sent.body).not.toMatch(/passed|physical success|no suitable option exists/i);
    expect(`${sent.subject}\n${sent.body}`).not.toMatch(/\bmatch|\$|price/i);
    expect(notifySlackScreeningCallNeeded).not.toHaveBeenCalled();
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/req-1")).toMatchObject({
      site_task_scope: { schemaVersion: "site_task_scope.v1", supported: false, kind: null, reason: "deformable" },
    });
  });

  it("keeps a blocked scientific preparation separate from the brief confirmation", async () => {
    const response = await confirm({ ...clearAnswers(), sceneStability: "reconfigured" });
    const body = (await response.json()) as { disposition: string; screening: any };
    expect(body.disposition).toBe("not_now");
    expect(body.screening.headline).toMatch(/not building a scene/);
    expect(body.screening.bookingUrl).toBeNull();
    expect(enqueueOutbox).toHaveBeenCalledWith(expect.objectContaining({
      to: "ops@acme.example", kind: "brief_confirmed", subject: "Your job brief is confirmed",
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
