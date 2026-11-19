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

// Exercise real durable intent creation/deduplication; delivery stays offline.
vi.mock("../utils/captureOutbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/captureOutbox")>();
  return { ...actual, enqueueOutbox: vi.fn(actual.enqueueOutbox),
    deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })) };
});
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true })) }));
const notificationRead = vi.hoisted(() => ({ unavailable: false }));
vi.mock("../utils/field-encryption", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/field-encryption")>();
  return { ...actual, decryptFieldValue: vi.fn(async (value) => {
    if (notificationRead.unavailable && value === "ops@acme.example") {
      notificationRead.unavailable = false;
      throw new Error("notification contact temporarily unavailable");
    }
    return actual.decryptFieldValue(value);
  }) };
});

/** Armed by a test: the job record read that follows the walkthrough read fails once. */
const recordRead = vi.hoisted(() => ({ armed: false, failNext: false }));
vi.mock("../utils/siteWalkthrough", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/siteWalkthrough")>();
  return { ...actual, savedWalkthrough: vi.fn(async (...args: Parameters<typeof actual.savedWalkthrough>) => {
    if (recordRead.armed) { recordRead.armed = false; recordRead.failNext = true; }
    return actual.savedWalkthrough(...args);
  }) };
});

const notifySlackScreeningCallNeeded = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../utils/slack", () => ({ notifySlackScreeningCallNeeded }));

const briefRouter = (await import("../routes/site-task-brief")).default;
const { gateFields } = await import("../../client/src/data/siteTaskQualification");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { draftBrief, saveBrief, confirmBrief } = await import("../utils/siteTaskBrief");
const { enqueueOutbox } = await import("../utils/captureOutbox");
const { sceneScreenGateEndedMarker } = await import("../utils/sceneScreenGate");

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  storage.unreadable = false;
  notificationRead.unavailable = false;
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

const CARTON_SUCCESS = { successDefinition: "Carton reaches pallet intact", successRate: 95, cycleTimeSeconds: 30, unknown: false };
/** Success criteria that name nothing, so only the summary says what the job is. */
const NO_SUCCESS = { successDefinition: null, successRate: null, cycleTimeSeconds: null, unknown: true };
async function confirm(answers: Record<string, string> = {}, successCriteria: Record<string, unknown> = CARTON_SUCCESS) {
  return fetch(`${baseUrl}/api/site-task-brief/${tokenFor("owner")}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmedBy: "Dana Okafor", answers, successCriteria }),
  });
}

const clearAnswers = () =>
  Object.fromEntries(
    gateFields.map((field) => [field.id, field.options.find((option) => option.verdict === "clear")!.value]),
  );

describe("the confirmation says what our screen decided", () => {
  it.each(["needs_conversation", "qualified"])("an unchanged HTTP confirmation preserves one %s intent and completed work", async disposition => {
    const answers = disposition === "qualified" ? clearAnswers() : {};
    const first = await confirm(answers);
    expect(first.status).toBe(200);
    expect((await first.json()).disposition).toBe(disposition);
    if (disposition === "needs_conversation") {
      await vi.waitFor(() => expect(notifySlackScreeningCallNeeded).toHaveBeenCalledTimes(1));
    }
    const before = structuredClone([...sharedFakeFirestoreState.docs.entries()]);
    const notified = notifySlackScreeningCallNeeded.mock.calls.length;
    const response = await confirm(answers);
    expect(response.status).toBe(200);
    expect((await response.json()).disposition).toBe(disposition);
    expect([...sharedFakeFirestoreState.docs.entries()]).toEqual(before);
    // The four-conditions screen sends no email of its own (owner decision 2026-11-11).
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toHaveLength(0);
    expect(notifySlackScreeningCallNeeded).toHaveBeenCalledTimes(notified);
  });


  it("offers written clarification or a call without clearing the preparation gate", async () => {
    const response = await confirm();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { disposition: string; screening: any };
    expect(body.disposition).toBe("needs_conversation");
    expect(body.screening.headline).toMatch(/questions remain/i);
    expect(body.screening.detail).toMatch(/in writing.*or book a call/i);
    expect(body.screening.detail).toMatch(/review your answers.*before clearing/i);
    expect(body.screening.bookingUrl).toMatch(/^https:\/\//);
    expect(enqueueOutbox).not.toHaveBeenCalled();

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
    // No "brief confirmed" email, and no fallback one (owner decision 2026-11-11).
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toHaveLength(0);
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

  it("says nothing about the job's kind when its record cannot be read at confirmation", async () => {
    await saveBrief(draftBrief({
      requestId: "req-1", summary: "Folding towels for wash-and-fold orders", captureMode: "self_capture", proposed: [],
    }));
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    const collection = sharedFakeFirestore.collection.bind(sharedFakeFirestore);
    const spy = vi.spyOn(sharedFakeFirestore, "collection").mockImplementation(((name: string) => {
      const real = collection(name);
      if (name !== "inboundRequests") return real;
      return new Proxy(real, { get: (target, key) => key !== "doc" ? Reflect.get(target, key)
        : (id: string) => new Proxy(target.doc(id), { get: (doc, prop) => prop === "get" && recordRead.failNext
          ? async () => { recordRead.failNext = false; throw new Error("record unavailable"); }
          : typeof Reflect.get(doc, prop) === "function" ? Reflect.get(doc, prop).bind(doc) : Reflect.get(doc, prop) }) });
    }) as never);
    recordRead.armed = true;
    try {
      const body = (await (await confirm(clearAnswers())).json()) as { screening: unknown };
      // The walkthrough read armed the failure and the record read consumed it.
      expect(recordRead.armed).toBe(false);
      expect(recordRead.failNext).toBe(false);
      // Never a claim that the job is held: the plain reply, with nothing about its kind.
      expect(body.screening).toBeNull();
      expect(enqueueOutbox).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); recordRead.armed = false; recordRead.failNext = false; }
  });

  it("tells a job of another kind what every job is told, with no email, and records its kind only as demand", async () => {
    await saveBrief(draftBrief({
      requestId: "req-1", summary: "Folding towels for wash-and-fold orders", captureMode: "self_capture", proposed: [],
    }));
    const response = await confirm(clearAnswers());
    const body = (await response.json()) as { disposition: string; screening: unknown };
    expect(body.disposition).toBe("qualified");
    // The same reply a job of a kind we score gets once the site clears: nothing about its kind, no hold, no list.
    expect(body.screening).toBeNull();
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect(notifySlackScreeningCallNeeded).not.toHaveBeenCalled();
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/req-1")).toMatchObject({
      site_task_scope: { schemaVersion: "site_task_scope.v1", supported: false, kind: null, reason: "deformable", demandKind: "deformable" },
    });
  });

  it("asks a brief that gives no sentence about the job for one, in its reply (no email), and names no kind of job", async () => {
    await saveBrief(draftBrief({ requestId: "req-1", summary: "your site task", captureMode: "self_capture", proposed: [] }));
    const body = (await (await confirm(clearAnswers(), NO_SUCCESS)).json()) as { screening: any };
    expect(body.screening).toEqual({ headline: "Your job brief needs one sentence about the job before we can evaluate it.",
      detail: "From your job brief, we could not tell what the job is. Describe the job in one sentence at the top of your job brief and confirm it again.",
      bookingUrl: null });
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });

  it("says not yet, without a call, when an answer blocks it", async () => {
    const response = await confirm({ ...clearAnswers(), sceneStability: "reconfigured" });
    const body = (await response.json()) as { disposition: string; screening: any };
    expect(body.disposition).toBe("not_now");
    expect(body.screening.headline).toMatch(/not building a scene/);
    expect(body.screening.bookingUrl).toBeNull();
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });
});

// Owner decision 2026-11-11: for a job uploaded after the cutover the screen's
// reading is a note; nothing says the scene is not being built, or waits on a call.
describe("the confirmation for a job past the screen's cutover", () => {
  it.each([
    ["not_now", { sceneStability: "reconfigured" }],
    ["needs_conversation", {}],
  ] as const)("notes a %s reading without saying the scene is not being built", async (disposition, extra) => {
    (sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>).scene_screen_gate_ended =
      sceneScreenGateEndedMarker("req-1", "2026-11-12T00:00:00Z");
    const response = await confirm(disposition === "not_now" ? { ...clearAnswers(), ...extra } : {});
    const body = (await response.json()) as { disposition: string; screening: any };
    expect(body.disposition).toBe(disposition);
    const said = `${body.screening.headline} ${body.screening.detail}`;
    expect(said).not.toMatch(/not building|before we build|before clearing the scene|no scene|aren't building/i);
    expect(said).toMatch(/does not hold up your job|do not hold up your job/i);
    // A job packet may carry no robot test: none is promised.
    expect(said).not.toMatch(/still build|test robots|the test fit/i);
    expect(body.screening.bookingUrl).toBeNull();
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

it("a changed task invalidates prior listing and recommendation review even with unchanged answers",async()=>{
  await confirm(clearAnswers());
  const record=sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as any;
  record.public_task_listing.details.cycleTarget="30 seconds";
  record.pilot_recommendation={id:"prior-recommendation"};
  await confirmBrief({requestId:"req-1",confirmedBy:"Dana",summary:"Fold towels",operatorAnswers:clearAnswers()});
  const current=sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as any;
  expect(current.public_task_listing).toMatchObject({enabled:false,reviewRequired:true});
  expect(current.pilot_recommendation.reviewRequired).toBe(true);
  expect(sharedFakeFirestoreState.docs.get("siteTaskBriefs/req-1")).toMatchObject({taskFamily:"general_task"});
});
