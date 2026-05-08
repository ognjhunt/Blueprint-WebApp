// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const executeAction = vi.hoisted(() => vi.fn());

const growthCampaigns = new Map<string, Record<string, unknown>>();
const growthCampaignEvents: Record<string, unknown>[] = [];
const emailSuppressions = new Map<string, Record<string, unknown>>();
const creativeRuns: Array<{ id: string; data: Record<string, unknown> }> = [];
let campaignCounter = 0;

function resetState() {
  growthCampaigns.clear();
  growthCampaignEvents.length = 0;
  emailSuppressions.clear();
  creativeRuns.length = 0;
  campaignCounter = 0;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
        increment: (value: number) => ({ increment: value }),
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name === "creative_factory_runs") {
        return {
          orderBy() {
            return {
              limit() {
                return {
                  async get() {
                    return {
                      docs: creativeRuns.map((run) => ({
                        id: run.id,
                        data: () => run.data,
                      })),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (name === "growthCampaigns") {
        return {
          async add(payload: Record<string, unknown>) {
            const id = `campaign-${++campaignCounter}`;
            growthCampaigns.set(id, payload);
            return { id };
          },
          doc(id: string) {
            return {
              async get() {
                return {
                  exists: growthCampaigns.has(id),
                  data: () => growthCampaigns.get(id),
                };
              },
              async set(payload: Record<string, unknown>) {
                growthCampaigns.set(id, {
                  ...(growthCampaigns.get(id) || {}),
                  ...payload,
                });
              },
            };
          },
        };
      }

      if (name === "growth_campaign_events") {
        return {
          async add(payload: Record<string, unknown>) {
            growthCampaignEvents.push(payload);
            return { id: `event-${growthCampaignEvents.length}` };
          },
        };
      }

      if (name === "email_suppressions") {
        return {
          doc(id: string) {
            return {
              async get() {
                return {
                  exists: emailSuppressions.has(id),
                  data: () => emailSuppressions.get(id),
                };
              },
              async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
                emailSuppressions.set(id, {
                  ...(options?.merge ? emailSuppressions.get(id) || {} : {}),
                  ...payload,
                });
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  },
}));

vi.mock("../agents/action-executor", () => ({
  executeAction,
}));

describe("growth ops creative context", () => {
  beforeEach(() => {
    resetState();
    executeAction.mockResolvedValue({
      state: "pending_approval",
      tier: 3,
      ledgerDocId: "ledger-1",
    });
  });

  it("attaches the latest durable creative run to growth campaign drafts", async () => {
    creativeRuns.push({
      id: "creative-run-1",
      data: {
        sku_name: "Exact-Site Hosted Review",
        created_at_iso: "2026-04-02T14:00:00.000Z",
        rollout_variant: "proof_first",
        research_topic: "warehouse robotics",
        remotion_reel: {
          storage_uri: "gs://blueprint-8c1ca.appspot.com/creative-factory/run-1/product-reel.mp4",
        },
      },
    });

    const { createGrowthCampaignDraft } = await import("../utils/growth-ops");
    const result = await createGrowthCampaignDraft({
      name: "Campaign",
      subject: "Subject",
      body: "Body",
      recipientEmails: ["ops@tryblueprint.io"],
    });

    expect(result.id).toBe("campaign-1");
    expect(growthCampaigns.get("campaign-1")).toMatchObject({
      creative_context: {
        creative_run_id: "creative-run-1",
        storage_uri:
          "gs://blueprint-8c1ca.appspot.com/creative-factory/run-1/product-reel.mp4",
      },
    });
  });

  it("carries creative asset context into queued send actions", async () => {
    growthCampaigns.set("campaign-1", {
      channel: "sendgrid",
      subject: "Subject",
      body: "Body",
      recipient_emails: ["ops@tryblueprint.io"],
      creative_context: {
        creative_run_id: "creative-run-1",
        storage_uri:
          "gs://blueprint-8c1ca.appspot.com/creative-factory/run-1/product-reel.mp4",
      },
    });

    const { queueGrowthCampaignSend } = await import("../utils/growth-ops");
    await queueGrowthCampaignSend({
      campaignId: "campaign-1",
      operatorEmail: "ops@tryblueprint.io",
    });

    expect(executeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionPayload: expect.objectContaining({
          creativeContext: expect.objectContaining({
            storage_uri:
              "gs://blueprint-8c1ca.appspot.com/creative-factory/run-1/product-reel.mp4",
          }),
        }),
        draftOutput: expect.objectContaining({
          creative_asset_uri:
            "gs://blueprint-8c1ca.appspot.com/creative-factory/run-1/product-reel.mp4",
        }),
      }),
    );
  });

  it("records SendGrid unsubscribe events into the local suppression ledger", async () => {
    growthCampaigns.set("campaign-1", {
      event_counts: { unsubscribed: 0 },
      response_tracking: {},
    });

    const { ingestSendGridWebhook } = await import("../utils/growth-ops");
    await ingestSendGridWebhook([
      {
        event: "unsubscribe",
        email: "buyer@robotics.co",
        bp_campaign_id: "campaign-1",
        sg_message_id: "message-1",
      },
    ]);

    expect(emailSuppressions.get("buyer@robotics.co")).toMatchObject({
      email: "buyer@robotics.co",
      suppressed_scopes: ["lifecycle", "growth_campaign"],
      reason: "unsubscribe",
      source: "sendgrid:webhook",
    });
  });
});
