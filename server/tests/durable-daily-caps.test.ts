// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, storageAdmin: null, default: {} }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { createFakeFirestore, createFakeFirestoreState } from "./helpers/fake-firestore";
import {
  __resetDurableDailyCapsForTests,
  adjustDailyCap,
  consumeDailyCaps,
  dailyCapSubjectKey,
  readDailyCapUsage,
  secondsUntilNextUtcDay,
  type DailyCapStore,
} from "../utils/durableDailyCaps";
import {
  admitIntake,
  admitIntakeMessage,
  admitUploadBytes,
  intakeCapLimits,
  intakeRefusal,
  mailboxSubject,
  modelReviewHeadroom,
  reconcileModelReviewSpend,
  reserveModelReviewSpend,
  uploadCapLimitsBytes,
} from "../utils/betaAbuseCaps";

const env = { NODE_ENV: "test", BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET: "unit-test-secret" } as NodeJS.ProcessEnv;
const day1 = () => new Date("2026-10-14T10:00:00Z");
const day2 = () => new Date("2026-10-15T00:00:01Z");

let state: ReturnType<typeof createFakeFirestoreState>;
let store: DailyCapStore;
const docs = (prefix: string) => [...state.docs.entries()].filter(([key]) => key.startsWith(prefix));

beforeEach(() => {
  state = createFakeFirestoreState();
  store = createFakeFirestore(state) as unknown as DailyCapStore;
});
afterEach(() => __resetDurableDailyCapsForTests());

describe("consumeDailyCaps", () => {
  it("checks and increments atomically per UTC day and refuses past the limit", async () => {
    const consume = (now = day1) => consumeDailyCaps({ scope: "unit", failClosed: true, caps: [{ name: "unit_global", limit: 2 }] },
      { store, env, now });
    expect(await consume()).toMatchObject({ allowed: true, counted: true, degraded: false, day: "2026-10-14" });
    expect(await consume()).toMatchObject({ allowed: true });
    expect(await consume()).toMatchObject({ allowed: false, reason: "limit_reached", cap: "unit_global", used: 2, limit: 2,
      retryAfterSeconds: 14 * 3600 });
    const [, counter] = docs("durableDailyCaps/unit_global__2026-10-14")[0];
    expect(counter).toMatchObject({ schema_version: "durable_daily_cap.v1", cap: "unit_global", day: "2026-10-14", used: 2, limit: 2,
      subject_key: null });
    // The TTL field lands after the retention window, so the policy can sweep it.
    expect(Date.parse(String(counter.expires_at))).toBe(Date.parse("2026-10-23T00:00:00Z"));
    expect(await consume(day2)).toMatchObject({ allowed: true, day: "2026-10-15" });
  });

  it("is all or nothing across caps: a refused subject cap leaves the global cap untouched", async () => {
    const caps = (ip: string) => [{ name: "unit_global", limit: 10 }, { name: "unit_ip", limit: 1, subject: ip }];
    expect((await consumeDailyCaps({ scope: "unit", failClosed: true, caps: caps("203.0.113.9") }, { store, env, now: day1 })).allowed).toBe(true);
    expect(await consumeDailyCaps({ scope: "unit", failClosed: true, caps: caps("203.0.113.9") }, { store, env, now: day1 }))
      .toMatchObject({ allowed: false, cap: "unit_ip" });
    expect(docs("durableDailyCaps/unit_global__")[0][1].used).toBe(1);
    expect((await consumeDailyCaps({ scope: "unit", failClosed: true, caps: caps("198.51.100.4") }, { store, env, now: day1 })).allowed).toBe(true);
    expect(docs("durableDailyCaps/unit_global__")[0][1].used).toBe(2);
  });

  it("never stores a raw subject; keys it by HMAC under the server secret", async () => {
    await consumeDailyCaps({ scope: "unit", failClosed: true, caps: [{ name: "unit_email", limit: 3, subject: "person@example.com" }] },
      { store, env, now: day1 });
    const serialized = JSON.stringify([...state.docs.entries()]);
    expect(serialized).not.toContain("person@example.com");
    const key = dailyCapSubjectKey("unit_email", "person@example.com", env);
    expect(key).toMatch(/^[a-f0-9]{40}$/);
    expect(state.docs.has(`durableDailyCaps/unit_email__2026-10-14__${key}`)).toBe(true);
    // A different secret yields an unrelated key: the counter cannot be guessed from the address.
    expect(dailyCapSubjectKey("unit_email", "person@example.com", { ...env, BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET: "other" })).not.toBe(key);
    expect(() => dailyCapSubjectKey("unit_email", "x", { NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow("daily_cap_subject_secret_required");
  });

  it("counts an idempotency key once per day, including a racing duplicate", async () => {
    const input = { scope: "unit", failClosed: true, idempotencyKey: "request-1", caps: [{ name: "unit_global", limit: 1 }] };
    const [first, second] = await Promise.all([consumeDailyCaps(input, { store, env, now: day1 }), consumeDailyCaps(input, { store, env, now: day1 })]);
    expect([first, second].map((row) => row.allowed)).toEqual([true, true]);
    expect([first, second].filter((row) => row.allowed && row.counted)).toHaveLength(1);
    expect(docs("durableDailyCaps/unit_global__")[0][1].used).toBe(1);
    expect(docs("durableDailyCapReceipts/")).toHaveLength(1);
    expect(JSON.stringify(docs("durableDailyCapReceipts/"))).not.toContain("request-1");
    // A different key is still refused by the spent cap.
    expect((await consumeDailyCaps({ ...input, idempotencyKey: "request-2" }, { store, env, now: day1 })).allowed).toBe(false);
  });

  it("treats a zero limit as closed", async () => {
    expect(await consumeDailyCaps({ scope: "unit", failClosed: true, caps: [{ name: "unit_global", limit: 0 }] }, { store, env, now: day1 }))
      .toMatchObject({ allowed: false, reason: "limit_reached", used: 0, limit: 0 });
  });

  it("fails closed without a store or on a failing transaction, and falls back in-process otherwise", async () => {
    const failing = { collection: store.collection, runTransaction: async () => { throw new Error("unavailable"); } } as DailyCapStore;
    const input = { scope: "unit", caps: [{ name: "unit_global", limit: 1 }] };
    expect(await consumeDailyCaps({ ...input, failClosed: true }, { store: null, env, now: day1 }))
      .toMatchObject({ allowed: false, reason: "store_unavailable", retryAfterSeconds: 60 });
    expect(await consumeDailyCaps({ ...input, failClosed: true }, { store: failing, env, now: day1 }))
      .toMatchObject({ allowed: false, reason: "store_unavailable" });
    expect(await consumeDailyCaps({ ...input, failClosed: false }, { store: failing, env, now: day1 }))
      .toMatchObject({ allowed: true, degraded: true });
    expect(await consumeDailyCaps({ ...input, failClosed: false }, { store: null, env, now: day1 }))
      .toMatchObject({ allowed: false, reason: "limit_reached" });
  });

  it("refuses a subject cap in production without a signing secret instead of keying with a constant", async () => {
    expect(await consumeDailyCaps({ scope: "unit", failClosed: true, caps: [{ name: "unit_ip", limit: 5, subject: "203.0.113.9" }] },
      { store, env: { NODE_ENV: "production" } as NodeJS.ProcessEnv, now: day1 })).toMatchObject({ allowed: false, reason: "store_unavailable" });
    expect(state.docs.size).toBe(0);
  });

  it("rejects malformed specs before touching the store", async () => {
    await expect(consumeDailyCaps({ scope: "unit", failClosed: true, caps: [{ name: "Bad Name", limit: 1 }] }, { store, env })).rejects.toThrow("daily_cap_name_invalid");
    await expect(consumeDailyCaps({ scope: "unit", failClosed: true, caps: [{ name: "unit", limit: -1 }] }, { store, env })).rejects.toThrow("daily_cap_limit_invalid");
    await expect(consumeDailyCaps({ scope: "unit", failClosed: true, amount: 0, caps: [{ name: "unit", limit: 1 }] }, { store, env })).rejects.toThrow("daily_cap_amount_invalid");
    expect(state.docs.size).toBe(0);
  });
});

describe("adjustDailyCap and readDailyCapUsage", () => {
  it("reconciles a reservation down (floored at zero) and up without a limit check", async () => {
    await consumeDailyCaps({ scope: "unit", failClosed: true, amount: 100, caps: [{ name: "unit_usd", limit: 150 }] }, { store, env, now: day1 });
    expect(await adjustDailyCap({ name: "unit_usd", day: "2026-10-14", delta: -70 }, { store, env, now: day1 })).toBe(true);
    expect(await readDailyCapUsage({ name: "unit_usd" }, { store, env, now: day1 })).toEqual({ day: "2026-10-14", used: 30 });
    await adjustDailyCap({ name: "unit_usd", day: "2026-10-14", delta: 500 }, { store, env, now: day1 });
    expect((await readDailyCapUsage({ name: "unit_usd" }, { store, env, now: day1 }))?.used).toBe(530);
    await adjustDailyCap({ name: "unit_usd", day: "2026-10-14", delta: -10_000 }, { store, env, now: day1 });
    expect((await readDailyCapUsage({ name: "unit_usd" }, { store, env, now: day1 }))?.used).toBe(0);
  });

  it("reports an unreadable counter as null", async () => {
    const failing = { collection: store.collection, runTransaction: async () => { throw new Error("unavailable"); } } as DailyCapStore;
    expect(await readDailyCapUsage({ name: "unit_usd" }, { store: failing, env, now: day1 })).toBeNull();
    expect(await adjustDailyCap({ name: "unit_usd", day: "2026-10-14", delta: -1 }, { store: failing, env })).toBe(false);
  });

  it("computes the seconds to the next UTC day", () => {
    expect(secondsUntilNextUtcDay(new Date("2026-10-14T23:59:59.500Z"))).toBe(1);
    expect(secondsUntilNextUtcDay(new Date("2026-10-14T00:00:00Z"))).toBe(86_400);
  });
});

describe("beta abuse caps", () => {
  it("uses observed-scale defaults and env overrides", () => {
    expect(intakeCapLimits({})).toEqual({ global: 50, perIp: 20, perEmail: 5 });
    expect(intakeCapLimits({ BLUEPRINT_INTAKE_DAILY_LIMIT: "0", BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT: "junk" })).toMatchObject({ global: 0, perIp: 20 });
    expect(uploadCapLimitsBytes({})).toEqual({ global: 20_480 * 1024 * 1024, perJob: 4_096 * 1024 * 1024 });
  });

  it("groups the addresses one mailbox receives", () => {
    expect(mailboxSubject(" First.Last+jobs@GoogleMail.com ")).toBe("firstlast@gmail.com");
    expect(mailboxSubject("ops+a@site.example")).toBe("ops@site.example");
    expect(mailboxSubject("o.ps@site.example")).toBe("o.ps@site.example");
  });

  it("admits an intake once per request id and names the cap that refused", async () => {
    const options = { store, env: { ...env, BLUEPRINT_INTAKE_PER_EMAIL_DAILY_LIMIT: "1" }, now: day1 };
    expect((await admitIntake({ requestId: "r1", clientIp: "203.0.113.9", email: "a@site.example", failClosed: true }, options)).allowed).toBe(true);
    expect(await admitIntake({ requestId: "r1", clientIp: "203.0.113.9", email: "a@site.example", failClosed: true }, options))
      .toMatchObject({ allowed: true, counted: false });
    const refused = await admitIntake({ requestId: "r2", clientIp: "203.0.113.9", email: "A+x@site.example", failClosed: true }, options);
    expect(refused).toMatchObject({ allowed: false, cap: "intake_email" });
    expect(intakeRefusal(refused as never)).toMatchObject({ status: 429, code: "intake_email_daily_limit" });
    expect(intakeRefusal({ allowed: false, day: "x", reason: "store_unavailable", cap: null, retryAfterSeconds: 60 }))
      .toMatchObject({ status: 503, code: "intake_capacity_unavailable", retryAfterSeconds: 60 });
  });

  it("suppresses intake messages past the per-recipient and global caps, failing closed", async () => {
    const options = { store, env, now: day1 };
    for (const requestId of ["r1", "r2"]) {
      expect(await admitIntakeMessage({ requestId, recipient: "victim@example.com", kind: "confirmation" }, options)).toEqual({ send: true });
    }
    expect(await admitIntakeMessage({ requestId: "r3", recipient: "Victim+3@example.com", kind: "confirmation" }, options))
      .toEqual({ send: false, reason: "recipient_daily_limit", day: "2026-10-14" });
    expect(await admitIntakeMessage({ requestId: "r1", recipient: "victim@example.com", kind: "confirmation" }, options)).toEqual({ send: true });
    expect(await admitIntakeMessage({ requestId: "r4", recipient: "+1 (555) 010-0000", kind: "filmer_handoff" },
      { ...options, env: { ...env, BLUEPRINT_INTAKE_EMAIL_DAILY_LIMIT: "2" } })).toEqual({ send: false, reason: "global_daily_limit", day: "2026-10-14" });
    expect(await admitIntakeMessage({ requestId: "r5", recipient: "x@example.com", kind: "confirmation" }, { store: null, env, now: day1 }))
      .toEqual({ send: false, reason: "cap_store_unavailable", day: "2026-10-14" });
  });

  it("charges uploads by bytes, per job and globally, once per idempotency key", async () => {
    const options = { store, env: { ...env, BLUEPRINT_UPLOAD_PER_JOB_DAILY_MB_LIMIT: "2", BLUEPRINT_UPLOAD_DAILY_MB_LIMIT: "3" }, now: day1 };
    const mib = 1024 * 1024;
    expect((await admitUploadBytes({ jobId: "job-a", bytes: mib, idempotencyKey: "part-0", failClosed: true }, options)).allowed).toBe(true);
    expect(await admitUploadBytes({ jobId: "job-a", bytes: mib, idempotencyKey: "part-0", failClosed: true }, options)).toMatchObject({ counted: false });
    expect((await admitUploadBytes({ jobId: "job-a", bytes: mib, idempotencyKey: "part-1", failClosed: true }, options)).allowed).toBe(true);
    expect(await admitUploadBytes({ jobId: "job-a", bytes: 1, idempotencyKey: "part-2", failClosed: true }, options))
      .toMatchObject({ allowed: false, cap: "upload_bytes_job" });
    expect(await admitUploadBytes({ jobId: null, bytes: mib + 1, failClosed: true }, options))
      .toMatchObject({ allowed: false, cap: "upload_bytes_global" });
    expect((await admitUploadBytes({ jobId: null, bytes: mib, failClosed: true }, options)).allowed).toBe(true);
  });

  it("reserves model spend before a call, reconciles after, and reports headroom", async () => {
    const options = { store, env: { ...env, BLUEPRINT_SITE_ASSESSMENT_DAILY_USD_CAP: "3" }, now: day1 };
    const reservation = await reserveModelReviewSpend(1.818624, options);
    expect(reservation).toEqual({ day: "2026-10-14", reserved_micro_usd: 1_818_624, daily_cap_usd: 3 });
    expect(await modelReviewHeadroom(1.818624, options)).toMatchObject({ available: false, reason: "daily_usd_cap_reached",
      cap_usd: 3, reserved_usd: 1.818624 });
    await expect(reserveModelReviewSpend(1.818624, options)).rejects.toThrow("site_assessment_daily_cost_cap");
    await reconcileModelReviewSpend(reservation, 0.02, options);
    expect(await modelReviewHeadroom(1.818624, options)).toEqual({ available: true, day: "2026-10-14" });
    await reconcileModelReviewSpend(reservation, null, options);
    expect((await readDailyCapUsage({ name: "model_review_spend_micro_usd" }, options))?.used).toBe(20_000);
    await expect(reserveModelReviewSpend(1, { ...options, store: null })).rejects.toThrow("site_assessment_cost_unresolved");
  });
});
