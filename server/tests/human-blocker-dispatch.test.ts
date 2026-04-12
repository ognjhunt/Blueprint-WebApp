// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const threadStore = new Map<string, Record<string, unknown>>();
const dispatchStore = new Map<string, Record<string, unknown>>();
const opsActionLogStore = new Map<string, Record<string, unknown>>();

const sendEmail = vi.hoisted(() => vi.fn());
const sendSlackMessage = vi.hoisted(() => vi.fn());
const recordExternalGapReport = vi.hoisted(() => vi.fn());
const resolveExternalGapReport = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({ mocked: true }),
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name === "humanBlockerThreads") {
        return {
          doc(id: string) {
            return {
              async get() {
                return {
                  exists: threadStore.has(id),
                  data: () => threadStore.get(id),
                };
              },
              async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
                if (options?.merge && threadStore.has(id)) {
                  threadStore.set(id, {
                    ...(threadStore.get(id) || {}),
                    ...payload,
                  });
                  return;
                }
                threadStore.set(id, payload);
              },
            };
          },
          where() {
            return {
              where() {
                return this;
              },
              limit() {
                return this;
              },
              async get() {
                return {
                  docs: [],
                };
              },
            };
          },
        };
      }

      if (name === "humanBlockerDispatches") {
        return {
          doc(id: string) {
            return {
              async get() {
                return {
                  exists: dispatchStore.has(id),
                  data: () => dispatchStore.get(id),
                };
              },
              async set(payload: Record<string, unknown>) {
                dispatchStore.set(id, payload);
              },
            };
          },
        };
      }

      if (name === "opsActionLogs") {
        return {
          doc(id: string) {
            return {
              async set(payload: Record<string, unknown>) {
                opsActionLogStore.set(id, payload);
              },
            };
          },
          orderBy() {
            return {
              limit() {
                return {
                  async get() {
                    return { docs: [] };
                  },
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

vi.mock("../utils/email", () => ({
  sendEmail,
}));

vi.mock("../utils/slack", () => ({
  sendSlackMessage,
}));

vi.mock("../utils/gap-closure", () => ({
  recordExternalGapReport,
  resolveExternalGapReport,
}));

afterEach(() => {
  threadStore.clear();
  dispatchStore.clear();
  opsActionLogStore.clear();
  sendEmail.mockReset();
  sendSlackMessage.mockReset();
  recordExternalGapReport.mockReset();
  resolveExternalGapReport.mockReset();
  vi.resetModules();
});

describe("human blocker dispatch", () => {
  it("sends the email, creates the thread, mirrors to slack, and records a dispatch artifact", async () => {
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: true });
    recordExternalGapReport.mockResolvedValue({
      stable_id: "human_blocker:blocker-123",
      is_new: true,
    });

    const { dispatchHumanBlocker } = await import("../utils/human-blocker-dispatch");
    const result = await dispatchHumanBlocker({
      blocker_kind: "technical",
      mirror_to_slack: true,
      packet: {
        blockerId: "blocker-123",
        title: "Production inbound write smoke returned 500 on tryblueprint.io",
        summary: "Production inbound write is failing.",
        recommendedAnswer: "Set the missing field-encryption key.",
        exactResponseNeeded: "Confirm the key is set.",
        whyBlocked: "Production env access is human-gated.",
        alternatives: ["Inspect production logs."],
        risk: "Without the fix, inbound requests keep failing.",
        executionOwner: "webapp-codex",
        immediateNextAction: "Rerun the production live-write smoke.",
        deadline: "Today",
        evidence: ["Tagged smoke returned 500."],
        nonScope: "No pricing or policy change.",
      },
      report_paths: ["ops/paperclip/reports/example.md"],
      paperclip_issue_id: "issue-123",
      actor: {
        uid: "user-1",
        email: "operator@example.com",
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({
      to: "ohstnhunt@gmail.com",
      replyTo: "ohstnhunt@gmail.com",
    });
    expect(String(sendEmail.mock.calls[0]?.[0]?.subject || "")).toContain("blocker-123");

    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
    expect(recordExternalGapReport).toHaveBeenCalledWith(
      expect.objectContaining({
        stable_id: "human_blocker:blocker-123",
      }),
    );

    expect(result.blocker_id).toBe("blocker-123");
    expect(result.email_sent).toBe(true);
    expect(result.slack_sent).toBe(true);

    const thread = threadStore.get("blocker-123");
    expect(thread).toBeDefined();
    expect(thread?.channel_target).toBe("ohstnhunt@gmail.com");
    expect(thread?.status).toBe("awaiting_reply");
    expect(
      ((thread?.correlation as Record<string, unknown> | undefined)?.outbound_subject as string) || "",
    ).toContain("Production inbound write smoke returned 500");

    expect(dispatchStore.size).toBe(1);
    const dispatch = [...dispatchStore.values()][0];
    expect(dispatch?.email_sent).toBe(true);
    expect(dispatch?.slack_sent).toBe(true);
    expect(dispatch?.paperclip_issue_id).toBe("issue-123");
    expect(Array.isArray(dispatch?.report_paths)).toBe(true);
    expect(opsActionLogStore.size).toBe(2);
    const actionKeys = [...opsActionLogStore.values()].map(
      (entry) => entry.action_key,
    );
    expect(actionKeys).toContain("human.blocker.upsert");
    expect(actionKeys).toContain("human.blocker.dispatch");
  });
});
