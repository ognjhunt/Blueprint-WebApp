// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_KEYS, DEFAULT_COMPANY_NAME } from "../../ops/paperclip/plugins/blueprint-automation/src/constants.ts";

type ActionHandler = (params: Record<string, unknown>) => Promise<any>;

describe("blueprint automation worker action handlers", () => {
  let handlers: Record<string, ActionHandler>;
  let stateSet: ReturnType<typeof vi.fn>;
  let ctx: any;

  function getHandler(actionKey: string) {
    const handler = handlers[actionKey];
    expect(handler).toBeTypeOf("function");
    return handler;
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-03T04:05:06.000Z"));
    vi.resetModules();

    handlers = {};
    stateSet = vi.fn().mockResolvedValue(undefined);

    const configGet = vi.fn().mockResolvedValue({
      companyName: DEFAULT_COMPANY_NAME,
    });
    const companyList = vi.fn().mockResolvedValue([
      { id: "company-1", name: DEFAULT_COMPANY_NAME },
    ]);
    const secretsResolve = vi.fn().mockResolvedValue(null);
    const registerAction = vi.fn((actionKey: string, handler: ActionHandler) => {
      handlers[actionKey] = handler;
    });

    ctx = {
      actions: { register: registerAction },
      activity: { log: vi.fn() },
      agents: { list: vi.fn() },
      companies: {
        get: vi.fn(),
        list: companyList,
      },
      config: {
        get: configGet,
      },
      data: { register: vi.fn() },
      entities: {
        list: vi.fn(),
        upsert: vi.fn(),
      },
      http: { fetch: vi.fn() },
      issues: {
        create: vi.fn(),
        createComment: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      },
      jobs: { register: vi.fn() },
      projects: {
        getPrimaryWorkspace: vi.fn(),
        list: vi.fn(),
      },
      secrets: {
        resolve: secretsResolve,
      },
      state: {
        get: vi.fn().mockResolvedValue(null),
        set: stateSet,
      },
      tools: { register: vi.fn() },
    };

    const module = await import("../../ops/paperclip/plugins/blueprint-automation/src/worker.ts");
    await module.default.definition.setup(ctx);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("registers and runs the market intel report action path", async () => {
    const result = await getHandler(ACTION_KEYS.marketIntelReport)({
      companyName: DEFAULT_COMPANY_NAME,
      params: {
        headline: "Capture Demand Snapshot",
        cadence: "monthly",
        reportDate: "2026-02-03T04:05:06Z",
        signals: [
          {
            date: "2026-02-01",
            relevance: 8,
            source: "market-scan",
            summary: "More qualified operator demand is showing up.",
            title: "Demand is rising",
          },
        ],
        competitorUpdates: [
          {
            company: "RivalCo",
            threatLevel: "high",
            update: "Published a new pilot package.",
          },
        ],
        technologyFindings: [
          {
            relevance: 6,
            summary: "Vision stack adoption is still accelerating.",
            title: "Vision tooling",
          },
        ],
        recommendedActions: [
          {
            action: "Expand outreach",
            priority: "high",
            rationale: "Demand is rising faster than expected.",
          },
        ],
        sourcesAnalyzed: ["market-news", "internal-captures"],
      },
    });

    expect(result).toMatchObject({
      outcome: "done",
      data: {
        headline: "Capture Demand Snapshot",
        cadence: "monthly",
        reportDate: "2026-02-03T04:05:06Z",
        signalCount: 1,
        competitorCount: 1,
        techFindingCount: 1,
        actionCount: 1,
      },
    });
    expect(result.issueComment).toContain("## Market Intel Monthly Report — 2026-02-03T04:05:06Z");
    expect(result.issueComment).toContain("### Capture Demand Snapshot");
    expect(result.issueComment).toContain("- **Demand is rising** (relevance: 8/10) — More qualified operator demand is showing up.");
    expect(result.issueComment).toContain("- **RivalCo** [high]: Published a new pilot package.");
    expect(result.issueComment).toContain("- [high] Expand outreach — Demand is rising faster than expected.");
    expect(result.issueComment).toContain("- market-news");
    expect(result.issueComment).toContain("- internal-captures");
    expect(stateSet).toHaveBeenCalledTimes(1);
    expect(stateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "blueprint-automation",
        scopeId: expect.any(String),
        scopeKind: "company",
        stateKey: "market-intel-monthly-latest",
      }),
      expect.objectContaining({
        actionCount: 1,
        cadence: "monthly",
        comment: expect.any(String),
        competitorCount: 1,
        headline: "Capture Demand Snapshot",
        outcome: "done",
        reportDate: "2026-02-03T04:05:06Z",
        signalCount: 1,
        sourceCount: 2,
        techFindingCount: 1,
      }),
    );
  });

  it("registers and runs the analytics report action path", async () => {
    const result = await getHandler(ACTION_KEYS.analyticsReport)({
      params: {
        cadence: "daily",
        headline: "Operator Funnel",
        recommendedFollowUps: ["Triage the stale scan backlog."],
        risks: ["The inbound queue is still growing."],
        summaryBullets: ["2 new requests landed overnight.", "1 request converted."],
        workflowFindings: ["Inbound triage latency improved by 12%."],
      },
    });

    expect(result).toMatchObject({
      outcome: "done",
      data: {
        actionCount: 1,
        cadence: "daily",
        findingsCount: 1,
        headline: "Operator Funnel",
        outcome: "done",
        reportDate: "2026-02-03T04:05:06.000Z",
        riskCount: 1,
        summaryCount: 2,
      },
    });
    expect(result.issueComment).toContain("## Analytics Daily Report — 2026-02-03T04:05:06.000Z");
    expect(result.issueComment).toContain("### Operator Funnel");
    expect(result.issueComment).toContain("- 2 new requests landed overnight.");
    expect(result.issueComment).toContain("- Inbound triage latency improved by 12%.");
    expect(result.issueComment).toContain("- The inbound queue is still growing.");
    expect(result.issueComment).toContain("- [ ] Triage the stale scan backlog.");
    expect(stateSet).toHaveBeenCalledTimes(1);
    expect(stateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "blueprint-automation",
        scopeId: expect.any(String),
        scopeKind: "company",
        stateKey: "analytics-daily-latest",
      }),
      expect.objectContaining({
        actionCount: 1,
        cadence: "daily",
        headline: "Operator Funnel",
        outcome: "done",
        reportDate: "2026-02-03T04:05:06.000Z",
        riskCount: 1,
        summaryCount: 2,
      }),
    );
  });
});
