// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const threadStore = new Map<string, Record<string, unknown>>();
const dispatchStore = new Map<string, Record<string, unknown>>();
const opsActionLogStore = new Map<string, Record<string, unknown>>();

const sendEmail = vi.hoisted(() => vi.fn());
const sendSlackMessage = vi.hoisted(() => vi.fn());
const sendSlackDirectMessage = vi.hoisted(() => vi.fn());
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
  sendSlackDirectMessage,
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
  sendSlackDirectMessage.mockReset();
  recordExternalGapReport.mockReset();
  resolveExternalGapReport.mockReset();
  vi.resetModules();
});

describe("human blocker dispatch", () => {
  it("sends the email, creates the thread, mirrors to slack, and records a dispatch artifact", async () => {
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: true });
    sendSlackDirectMessage.mockResolvedValue({ sent: false });
    recordExternalGapReport.mockResolvedValue({
      stable_id: "human_blocker:blocker-123",
      is_new: true,
    });

    const { dispatchHumanBlocker } = await import("../utils/human-blocker-dispatch");
    const result = await dispatchHumanBlocker({
      blocker_kind: "technical",
      mirror_to_slack: true,
      slack_webhook_url: "https://hooks.slack.test/human-blocker",
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
    expect(sendSlackDirectMessage).not.toHaveBeenCalled();
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

  it("uses the configured Nijel Slack DM target and stores Slack thread correlation", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_BLOCKER_SLACK_USER_ID", "U_NIJEL");
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackDirectMessage.mockResolvedValue({
      sent: true,
      channel: "D123",
      ts: "1712960000.000100",
    });
    recordExternalGapReport.mockResolvedValue({
      stable_id: "human_blocker:blocker-slack-dm",
      is_new: true,
    });

    const { dispatchHumanBlocker } = await import("../utils/human-blocker-dispatch");
    const result = await dispatchHumanBlocker({
      blocker_kind: "technical",
      mirror_to_slack: true,
      packet: {
        blockerId: "blocker-slack-dm",
        title: "Preview deployment approval needed",
        summary: "A preview deployment approval needs a fast founder reply.",
        recommendedAnswer: "Approve the bounded preview smoke.",
        exactResponseNeeded: "Reply APPROVE or REJECT.",
        whyBlocked: "The preview smoke touches a human-gated production boundary.",
        alternatives: ["Wait for email approval."],
        risk: "Wrong approval can validate the wrong environment.",
        executionOwner: "webapp-codex",
        immediateNextAction: "Rerun the preview smoke.",
        deadline: "Today",
        evidence: ["Preview smoke is prepared."],
        nonScope: "No broader release approval.",
      },
    });

    expect(sendSlackDirectMessage).toHaveBeenCalledWith(
      expect.stringContaining("blocker-slack-dm"),
      expect.objectContaining({
        userId: "U_NIJEL",
        targetName: "Nijel Hunt",
      }),
    );
    expect(sendSlackMessage).not.toHaveBeenCalled();
    expect(result.slack_sent).toBe(true);

    const thread = threadStore.get("blocker-slack-dm");
    expect(
      ((thread?.correlation as Record<string, unknown> | undefined)?.slack_thread_id as string) || "",
    ).toBe("D123:1712960000.000100");
  });

  it("rejects the disallowed org-facing email identity for blocker dispatches", async () => {
    const { dispatchHumanBlocker } = await import("../utils/human-blocker-dispatch");

    await expect(
      dispatchHumanBlocker({
        blocker_kind: "technical",
        email_target: "hlfabhunt@gmail.com",
        packet: {
          blockerId: "blocker-disallowed-email",
          title: "Disallowed identity smoke",
          summary: "This should never route to the disallowed org identity.",
          recommendedAnswer: "Use the approved durable founder inbox.",
          exactResponseNeeded: "Use ohstnhunt@gmail.com.",
          whyBlocked: "The configured identity is disallowed by policy.",
          alternatives: ["Use the approved default email target."],
          risk: "Using the wrong inbox breaks durable org reply routing.",
          executionOwner: "webapp-codex",
          immediateNextAction: "Stop and fix the target.",
          deadline: "Immediate",
          evidence: ["Human blocker packet standard disallows hlfabhunt@gmail.com."],
          nonScope: "No real send should happen.",
        },
      }),
    ).rejects.toThrow("hlfabhunt@gmail.com");

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("queues a human blocker for review without sending it", async () => {
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: true });
    recordExternalGapReport.mockResolvedValue({
      stable_id: "human_blocker:blocker-review",
      is_new: true,
    });

    const { dispatchHumanBlocker } = await import("../utils/human-blocker-dispatch");
    const result = await dispatchHumanBlocker({
      delivery_mode: "review_required",
      blocker_kind: "ops_commercial",
      review_owner: "blueprint-chief-of-staff",
      sender_owner: "blueprint-chief-of-staff",
      packet: {
        blockerId: "blocker-review",
        title: "Growth send needs founder approval",
        summary: "A buyer-facing growth send is blocked.",
        recommendedAnswer: "Approve the bounded send only if it stays inside the current guardrails.",
        exactResponseNeeded: "Reply approved or revise with exact wording changes.",
        whyBlocked: "The campaign would otherwise make a founder-gated commitment.",
        alternatives: ["Reject the send and keep the issue blocked."],
        risk: "The wrong send could overstate commercial posture.",
        executionOwner: "growth-lead",
        immediateNextAction: "Resume the queued send path from the saved issue state.",
        deadline: "Today",
        evidence: ["Draft and target list are ready."],
        nonScope: "No broader pricing or policy change.",
      },
    });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSlackMessage).not.toHaveBeenCalled();
    expect(result.delivery_mode).toBe("review_required");
    expect(result.delivery_status).toBe("awaiting_review");

    const thread = threadStore.get("blocker-review");
    expect(thread?.status).toBe("awaiting_review");
    expect(thread?.review_status).toBe("awaiting_review");

    const dispatch = [...dispatchStore.values()][0];
    expect(dispatch?.delivery_mode).toBe("review_required");
    expect(dispatch?.email_sent).toBe(false);

    const actionKeys = [...opsActionLogStore.values()].map(
      (entry) => entry.action_key,
    );
    expect(actionKeys).toContain("human.blocker.queue_review");
  });

  it("sends a saved draft after review approval", async () => {
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: true });
    recordExternalGapReport.mockResolvedValue({
      stable_id: "human_blocker:blocker-followup",
      is_new: true,
    });

    const { dispatchHumanBlocker } = await import("../utils/human-blocker-dispatch");
    const queued = await dispatchHumanBlocker({
      delivery_mode: "review_required",
      blocker_kind: "technical",
      review_owner: "blueprint-chief-of-staff",
      sender_owner: "blueprint-chief-of-staff",
      mirror_to_slack: true,
      packet: {
        blockerId: "blocker-followup",
        title: "Preview diagnosis needs operator confirmation",
        summary: "A preview-diagnosis rerun needs human confirmation.",
        recommendedAnswer: "Confirm the environment change, then rerun the preview diagnosis.",
        exactResponseNeeded: "Reply with approved after checking the fix.",
        whyBlocked: "The fix requires a human-owned environment boundary.",
        alternatives: ["Leave the issue blocked until a human confirms the change."],
        risk: "The rerun could validate against the wrong environment state.",
        executionOwner: "webapp-codex",
        immediateNextAction: "Resume the saved preview diagnosis run.",
        deadline: "Today",
        evidence: ["Rerun plan prepared."],
        nonScope: "No broader release approval.",
      },
    });

    expect(sendEmail).not.toHaveBeenCalled();
    sendSlackDirectMessage.mockResolvedValue({ sent: true });
    const sent = await dispatchHumanBlocker({
      delivery_mode: "send_saved_draft",
      dispatch_id: queued.dispatch_id,
      reviewed_by: {
        uid: "chief-1",
        email: "chief@example.com",
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sent.delivery_mode).toBe("send_now");
    expect(sent.delivery_status).toBe("sent");

    const thread = threadStore.get("blocker-followup");
    expect(thread?.status).toBe("awaiting_reply");
    expect(thread?.review_status).toBe("approved");
  });
});
