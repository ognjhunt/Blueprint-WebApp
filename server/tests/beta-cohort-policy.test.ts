// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateBetaCohortGate,
  recordBetaCohortAdmission,
} from "../utils/beta-cohort-policy";

function makeDb(seed: Record<string, Record<string, Record<string, unknown>>> = {}) {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  for (const [collectionName, docs] of Object.entries(seed)) {
    collections.set(collectionName, new Map(Object.entries(docs)));
  }
  const ensure = (name: string) => {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    return collections.get(name)!;
  };
  return {
    collections,
    collection: (name: string) => ({
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs: Array.from(ensure(name).entries())
            .filter(([, data]) => data[field] === value)
            .map(([id, data]) => ({
              id,
              data: () => data,
            })),
        }),
      }),
      doc: (id: string) => ({
        set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
          const collection = ensure(name);
          const previous = collection.get(id) || {};
          collection.set(id, options?.merge ? { ...previous, ...payload } : payload);
        },
      }),
    }),
  };
}

afterEach(() => {
  delete process.env.BLUEPRINT_BETA_KILL_SWITCH;
  delete process.env.BLUEPRINT_BETA_ENABLED;
  delete process.env.BLUEPRINT_BETA_INVITE_CAP;
  delete process.env.BLUEPRINT_BETA_COHORT_DAILY_LIMIT;
  delete process.env.BLUEPRINT_BETA_ALLOWED_MARKETS;
  delete process.env.BLUEPRINT_BETA_ALLOWED_SITE_TYPES;
});

describe("beta cohort policy", () => {
  it("blocks all controlled gates when the kill switch is active", async () => {
    const decision = await evaluateBetaCohortGate(
      {
        gate: "capture_intake",
        creatorId: "creator-1",
        market: "Austin",
        siteType: "warehouse",
      },
      {
        db: makeDb() as any,
        env: {
          BLUEPRINT_BETA_KILL_SWITCH: "1",
        } as NodeJS.ProcessEnv,
      },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("beta_kill_switch_active");
    expect(decision.statusCode).toBe(503);
  });

  it("enforces invite cap and cohort daily throttle from persisted rows", async () => {
    const db = makeDb({
      waitlistSubmissions: {
        a: { queue: "capturer_beta_review", status: "new" },
        b: { queue: "capturer_beta_review", status: "new" },
      },
      betaCohortAdmissions: {
        today: { cohort_key: "austin", window_key: "2026-07-08" },
      },
    });

    const capped = await evaluateBetaCohortGate(
      {
        gate: "waitlist",
        email: "a@example.com",
        market: "Austin",
        siteType: "warehouse",
        now: new Date("2026-07-08T10:00:00Z"),
      },
      {
        db: db as any,
        env: {
          BLUEPRINT_BETA_INVITE_CAP: "2",
          BLUEPRINT_BETA_COHORT_DAILY_LIMIT: "5",
        } as NodeJS.ProcessEnv,
      },
    );

    expect(capped.allowed).toBe(false);
    expect(capped.reason).toBe("beta_invite_cap_reached");

    const throttled = await evaluateBetaCohortGate(
      {
        gate: "capture_intake",
        creatorId: "creator-1",
        market: "Austin",
        siteType: "warehouse",
        now: new Date("2026-07-08T10:00:00Z"),
      },
      {
        db: db as any,
        env: {
          BLUEPRINT_BETA_COHORT_DAILY_LIMIT: "1",
        } as NodeJS.ProcessEnv,
      },
    );

    expect(throttled.allowed).toBe(false);
    expect(throttled.reason).toBe("beta_cohort_daily_limit_reached");
  });

  it("records allowed admissions with cohort and window evidence", async () => {
    const db = makeDb();
    const decision = await evaluateBetaCohortGate(
      {
        gate: "waitlist",
        email: "capturer@example.com",
        market: "Austin",
        siteType: "warehouse",
        now: new Date("2026-07-08T10:00:00Z"),
      },
      {
        db: db as any,
        env: {
          BLUEPRINT_BETA_ALLOWED_MARKETS: "austin",
          BLUEPRINT_BETA_ALLOWED_SITE_TYPES: "warehouse",
        } as NodeJS.ProcessEnv,
      },
    );

    expect(decision.allowed).toBe(true);
    await recordBetaCohortAdmission(
      {
        gate: "waitlist",
        admissionId: "admission-1",
        decision,
        email: "capturer@example.com",
        market: "Austin",
        siteType: "warehouse",
        source: "test",
      },
      db as any,
    );

    expect(db.collections.get("betaCohortAdmissions")?.get("admission-1")).toMatchObject({
      gate: "waitlist",
      email: "capturer@example.com",
      cohort_key: "austin",
      window_key: "2026-07-08",
    });
  });
});
