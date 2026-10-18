// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore as store, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import type { RunExecutionProgress } from "../utils/agentRunRecord";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: store,
  default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } } }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));
const { sender, teamEmail } = vi.hoisted(() => ({ sender: vi.fn(), teamEmail: vi.fn() }));
vi.mock("../utils/robotTeamAccounts", () => ({ teamAccountEmail: teamEmail }));
vi.mock("../utils/email", () => ({ sendEmail: sender }));

const { reportRunOutcome } = await import("../utils/agentEvalRuns");
const { reconcileAgentRunNotifications } = await import("../utils/agentRunNotificationRecovery");

const partial: RunExecutionProgress = { observed_attempted_episode_count: 25, scored_episode_count: 23,
  succeeded_episode_count: 5, failed_episode_count: 18, void_episode_count: 2, measurement_complete: false };
const zero: RunExecutionProgress = { observed_attempted_episode_count: 0, scored_episode_count: 0,
  succeeded_episode_count: 0, failed_episode_count: 0, void_episode_count: 0, measurement_complete: true };
const cases = [
  { label: "positive partial progress", progress: partial, episodesRun: 23,
    expected: /25 attempted; 23 scored \(5 succeeded, 18 failed\); 2 void/, extra: /counts are incomplete/ },
  { label: "unmeasured zero", progress: { ...zero, measurement_complete: false }, episodesRun: 0,
    expected: /Episode progress is unknown/, extra: /Review the run/ },
  { label: "legacy missing progress", progress: undefined, episodesRun: 0,
    expected: /Episode progress is unknown/, extra: /Review the run/ },
  { label: "legacy scored-only progress", progress: undefined, episodesRun: 23,
    expected: /23 scored episodes were reported/, extra: /total attempted and void counts are unknown/ },
  { label: "inconsistent progress", progress: { ...partial, scored_episode_count: 28 }, episodesRun: 0,
    expected: /Episode progress is unknown/, extra: /Review the run/ },
  { label: "confirmed zero", progress: zero, episodesRun: 0,
    expected: /No episode was attempted/, extra: /Review the run/ },
];

beforeEach(() => {
  state.docs.clear(); sender.mockClear();
  teamEmail.mockReset(); teamEmail.mockResolvedValue("team@example.test");
  state.docs.set("inboundRequests/site", { contact: { email: "site@example.test" } });
});

describe("durable no-result recovery", () => {
  const seed = (evaluationPurpose = "pilot") => state.docs.set("evaluationRuns/run", {
    runId: "run", sceneId: "site", teamId: "team", evaluationPurpose, state: "blocked",
    notificationPending: true, notificationIntent: { kind: "no_result" }, executionProgress: partial,
  });

  it("retains recovery until both audiences have their durable notice", async () => {
    seed();
    teamEmail.mockResolvedValueOnce(null);
    await reconcileAgentRunNotifications();
    expect(state.docs.get("evaluationRuns/run")?.notificationPending).toBe(true);
    const siteNotice = structuredClone(state.docs.get("captureOutbox/site:run_no_result:run"));
    expect(siteNotice).toMatchObject({ kind: "run_no_result" });
    expect(state.docs.has("captureOutbox/team:team:no_result:run")).toBe(false);
    // The durable scan wraps its cursor before revisiting a pending row.
    await reconcileAgentRunNotifications();
    await reconcileAgentRunNotifications();
    expect(state.docs.get("evaluationRuns/run")?.notificationPending).toBe(false);
    expect(state.docs.get("captureOutbox/site:run_no_result:run")).toEqual(siteNotice);
    expect(state.docs.get("captureOutbox/team:team:no_result:run")).toMatchObject({ kind: "team_run_no_result" });
    expect(sender).not.toHaveBeenCalled();
  });

  it("does not clear recovery for a conflicting reserved outbox identity", async () => {
    seed();
    const conflicting = { idempotencyKey: "team:team:no_result:run", kind: "team_run_result", requestId: "team:other" };
    state.docs.set("captureOutbox/team:team:no_result:run", conflicting);
    await reconcileAgentRunNotifications();
    expect(state.docs.get("evaluationRuns/run")?.notificationPending).toBe(true);
    expect(state.docs.get("captureOutbox/team:team:no_result:run")).toEqual(conflicting);
    expect(sender).not.toHaveBeenCalled();
  });

  it("requires only the team notice for a private run and never exposes it to the site", async () => {
    seed("private");
    await reconcileAgentRunNotifications();
    expect(state.docs.get("evaluationRuns/run")?.notificationPending).toBe(false);
    const rows = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toMatchObject({ to: "team@example.test", kind: "team_run_no_result" });
    expect(sender).not.toHaveBeenCalled();
  });
});

describe.each(["immediate", "recovered"])("%s no-result notifications", delivery => {
  it.each(cases)("preserves $label for both audiences and on retry", async ({ progress, episodesRun, expected, extra }) => {
    const run = { runId: "run", sceneId: "site", teamId: "team", evaluationPurpose: "pilot",
      state: delivery === "immediate" ? "requested" : "blocked", episodesRun,
      requestedAtIso: new Date().toISOString(), moneyResolved: false,
      ...(delivery === "recovered" ? { notificationPending: true, notificationIntent: { kind: "no_result" },
        ...(progress ? { executionProgress: progress } : {}) } : {}) };
    state.docs.set("evaluationRuns/run", run);
    if (delivery === "immediate") {
      await reportRunOutcome({ runId: "run", state: "blocked", episodesRun, executionProgress: progress });
      // A retry omitting optional progress must retain the accepted observation.
      await reportRunOutcome({ runId: "run", state: "blocked", episodesRun });
    }
    await reconcileAgentRunNotifications();
    await reconcileAgentRunNotifications();
    const notices = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/")).map(([, row]) => row);
    expect(notices).toHaveLength(2);
    expect(notices.map(row => row.to).sort()).toEqual(["site@example.test", "team@example.test"]);
    for (const notice of notices) {
      expect(notice.body).toMatch(/ended without a complete scored result/);
      expect(notice.body).toMatch(expected);
      expect(notice.body).toMatch(extra);
      expect(notice.body).not.toMatch(/before any episode was observed/);
      if (!progress?.measurement_complete) expect(notice.body).not.toMatch(/No episode was attempted/);
    }
    expect(state.docs.get("evaluationRuns/run")?.notificationPending).toBe(false);
    expect(sender).not.toHaveBeenCalled();
  });
});
