// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));

import {
  __resetInboundQualificationGateForTests,
  admitInboundQualificationRun,
  inboundQualificationDailyLimit,
  inboundQualificationLlmEnabled,
} from "../utils/inboundQualificationGate";

function counterStore() {
  const docs = new Map<string, Record<string, unknown>>();
  return {
    docs,
    collection: () => ({ doc: (id: string) => ({ id }) as never }),
    runTransaction: async <T>(fn: (tx: any) => Promise<T>) => fn({
      get: async (ref: { id: string }) => ({ data: () => docs.get(ref.id) }),
      set: (ref: { id: string }, data: Record<string, unknown>) => { docs.set(ref.id, { ...(docs.get(ref.id) || {}), ...data }); },
    }),
  };
}

afterEach(() => __resetInboundQualificationGateForTests());

describe("inbound qualification LLM admission", () => {
  it("is on by default with a 200/day cap and can be switched off", () => {
    expect(inboundQualificationLlmEnabled({})).toBe(true);
    expect(inboundQualificationLlmEnabled({ BLUEPRINT_INBOUND_QUALIFICATION_LLM_ENABLED: "false" })).toBe(false);
    expect(inboundQualificationDailyLimit({})).toBe(200);
    expect(inboundQualificationDailyLimit({ BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT: "5" })).toBe(5);
    expect(inboundQualificationDailyLimit({ BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT: "junk" })).toBe(200);
  });

  it("counts per UTC day in Firestore and refuses past the cap", async () => {
    const store = counterStore();
    const env = { BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT: "2" };
    const day1 = () => new Date("2026-10-13T10:00:00Z");
    expect((await admitInboundQualificationRun({ store: store as never, env, now: day1 })).allowed).toBe(true);
    expect((await admitInboundQualificationRun({ store: store as never, env, now: day1 })).allowed).toBe(true);
    expect(await admitInboundQualificationRun({ store: store as never, env, now: day1 })).toMatchObject({ allowed: false, reason: "daily_limit_reached", used: 2 });
    expect(store.docs.get("inbound_qualification_llm:2026-10-13")).toMatchObject({ count: 2 });
    const day2 = () => new Date("2026-10-14T00:00:01Z");
    expect((await admitInboundQualificationRun({ store: store as never, env, now: day2 })).allowed).toBe(true);
  });

  it("reports disabled without spending a counter", async () => {
    const store = counterStore();
    expect(await admitInboundQualificationRun({ store: store as never, env: { BLUEPRINT_INBOUND_QUALIFICATION_LLM_ENABLED: "0" } }))
      .toMatchObject({ allowed: false, reason: "disabled" });
    expect(await admitInboundQualificationRun({ store: store as never, env: { BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT: "0" } }))
      .toMatchObject({ allowed: false, reason: "disabled" });
    expect(store.docs.size).toBe(0);
  });

  it("falls back to an in-process cap when Firestore is unavailable or failing", async () => {
    const env = { BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT: "1" };
    expect((await admitInboundQualificationRun({ store: null, env })).allowed).toBe(true);
    expect((await admitInboundQualificationRun({ store: null, env })).allowed).toBe(false);
    __resetInboundQualificationGateForTests();
    const failing = { collection: () => ({ doc: () => ({}) as never }), runTransaction: async () => { throw new Error("unavailable"); } };
    expect((await admitInboundQualificationRun({ store: failing as never, env })).allowed).toBe(true);
    expect((await admitInboundQualificationRun({ store: failing as never, env })).allowed).toBe(false);
  });
});
