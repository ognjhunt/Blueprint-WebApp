// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const creativeFactoryRuns = new Map<string, Record<string, unknown>>();
const marketSignalCacheDocs: Array<Record<string, unknown>> = [];
const contactRequests: Array<Record<string, unknown>> = [];
const getActiveExperimentRollouts = vi.hoisted(() => vi.fn());
const upsertPaperclipIssue = vi.hoisted(() => vi.fn());
const createPaperclipIssueComment = vi.hoisted(() => vi.fn());
const wakePaperclipAgent = vi.hoisted(() => vi.fn());

function resetState() {
  creativeFactoryRuns.clear();
  marketSignalCacheDocs.length = 0;
  contactRequests.length = 0;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name === "market_signal_cache") {
        return {
          orderBy() {
            return {
              limit() {
                return {
                  async get() {
                    return {
                      empty: marketSignalCacheDocs.length === 0,
                      docs: marketSignalCacheDocs.map((doc, index) => ({
                        id: `signal-${index}`,
                        data: () => doc,
                      })),
                    };
                  },
                };
              },
            };
          },
          where(field: string, op: string, value: string) {
            if (field !== "last_seen_run_id" || op !== "==") {
              throw new Error(`Unexpected query ${field} ${op}`);
            }
            return {
              async get() {
                const docs = marketSignalCacheDocs
                  .filter((doc) => doc.last_seen_run_id === value)
                  .map((doc, index) => ({
                    id: `signal-${index}`,
                    data: () => doc,
                  }));
                return {
                  empty: docs.length === 0,
                  docs,
                };
              },
            };
          },
        };
      }

      if (name === "creative_factory_runs") {
        return {
          doc(id: string) {
            return {
              async get() {
                return {
                  exists: creativeFactoryRuns.has(id),
                  data: () => creativeFactoryRuns.get(id),
                };
              },
              async set(payload: Record<string, unknown>) {
                creativeFactoryRuns.set(id, {
                  ...(creativeFactoryRuns.get(id) || {}),
                  ...payload,
                });
              },
            };
          },
        };
      }

      if (name === "contactRequests") {
        return {
          where() {
            return {
              orderBy() {
                return {
                  limit() {
                    return {
                      async get() {
                        return {
                          docs: contactRequests.map((request, index) => ({
                            id: `contact-${index}`,
                            data: () => request,
                          })),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          limit() {
            return {
              async get() {
                return {
                  docs: contactRequests.map((request, index) => ({
                    id: `contact-${index}`,
                    data: () => request,
                  })),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  },
}));

vi.mock("../utils/experiment-ops", () => ({
  getActiveExperimentRollouts,
}));

vi.mock("../utils/paperclip", () => ({
  upsertPaperclipIssue,
  createPaperclipIssueComment,
  wakePaperclipAgent,
}));

import { runCreativeAssetFactoryLoop } from "../utils/creative-factory";

beforeEach(() => {
  resetState();
  getActiveExperimentRollouts.mockResolvedValue({
    exact_site_hosted_review_hero_v1: "proof_first",
  });
  marketSignalCacheDocs.push({
    topic: "warehouse robotics",
    signal_provider_key: "firehose",
    last_seen_run_id: "2026-04-20__warehouse-robotics",
    last_seen_at_iso: "2026-04-20T12:00:00.000Z",
    title: "Operators are narrowing facility pilots",
    summary: "Teams want one exact site before another travel-heavy review cycle.",
  });
  marketSignalCacheDocs.push({
    topic: "warehouse robotics",
    signal_provider_key: "firehose",
    last_seen_run_id: "2026-04-20__warehouse-robotics",
    last_seen_at_iso: "2026-04-20T12:00:00.000Z",
    title: "Travel-heavy site reviews are being compressed",
    summary: "Teams want earlier grounded evidence.",
  });
  contactRequests.push({
    message: "We need pricing clarity before another site visit.",
    summary: "Commercial question",
    voice_concierge: {
      category: "commercial_handoff",
      last_user_message: "What does this cost?",
    },
  });
  upsertPaperclipIssue.mockResolvedValue({
    companyId: "company-1",
    projectId: "project-1",
    assigneeAgentId: "agent-1",
    created: true,
    issue: {
      id: "issue-1",
      status: "todo",
    },
  });
  createPaperclipIssueComment.mockResolvedValue({ ok: true });
  wakePaperclipAgent.mockResolvedValue({ status: "queued" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("runCreativeAssetFactoryLoop", () => {
  it("skips when the run already exists", async () => {
    const today = new Date().toISOString().slice(0, 10);
    creativeFactoryRuns.set(`${today}__exact-site-hosted-review-warehouse-robotics`, {
      status: "execution_handoff_queued",
    });

    const result = await runCreativeAssetFactoryLoop();
    expect(result.status).toBe("skipped_existing");
    expect(upsertPaperclipIssue).not.toHaveBeenCalled();
  });

  it("queues a codex execution handoff and records buyer objections", async () => {
    const result = await runCreativeAssetFactoryLoop();

    expect(result).toMatchObject({
      status: "execution_handoff_queued",
      generatedImages: 0,
      runwayTaskId: null,
      remotionReelPath: null,
      executionHandoffIssueId: "issue-1",
    });
    expect(upsertPaperclipIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeKey: "webapp-codex",
        originKind: "creative_factory_run",
      }),
    );
    expect(createPaperclipIssueComment).toHaveBeenCalledWith(
      "issue-1",
      expect.stringContaining("Creative factory generated a prompt pack"),
    );
    expect(wakePaperclipAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-1",
        reason: "creative_image_execution_handoff",
      }),
    );

    const storedRun = [...creativeFactoryRuns.values()][0];
    expect(storedRun).toMatchObject({
      rollout_variant: "proof_first",
      research_topic: "warehouse robotics",
      buyer_objections: expect.arrayContaining(["pricing and commercial clarity"]),
      execution_handoff: expect.objectContaining({
        issue_id: "issue-1",
        assignee: "webapp-codex",
      }),
    });
    expect((storedRun.kit as Record<string, unknown>).landingPage).toBeTruthy();
  });

  it("continues with a prompt pack when paperclip handoff fails", async () => {
    upsertPaperclipIssue.mockRejectedValue(new Error("Paperclip 500"));

    const result = await runCreativeAssetFactoryLoop();
    expect(result.status).toBe("prompt_pack_generated");
    const storedRun = [...creativeFactoryRuns.values()][0];
    expect(storedRun).toMatchObject({
      execution_handoff: {
        issue_id: null,
        status: "failed_to_route",
        assignee: "webapp-codex",
        error: "Paperclip 500",
      },
    });
  });
});
