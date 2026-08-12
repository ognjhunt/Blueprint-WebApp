// @vitest-environment node
/**
 * The control-plane blocker and the terminal-release eligibility guard are two
 * halves of one recovery path, and only their seam proves the path works.
 *
 * Unit tests on either half pass while the path is dead: the guard requires a
 * strict `terminal_receipt_present === false`, and every existing fixture
 * hand-writes that field, so nothing catches the producer never emitting it.
 * A real orphaned launch on 2026-08-12 carried every other marker correctly and
 * was still permanently ineligible for release, stranding a Vast record that
 * only this route can free.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));

import {
  CANONICAL_TASK_EVALUATION_ALLOCATOR,
  buildTaskEvaluationLaunchRequest,
  buildTaskEvaluationTerminalResourceReleaseRequest,
} from "../utils/taskEvaluationLaunchContract";
import {
  buildExpiredControlPlaneTerminalBlocker,
  buildMissingTerminalReceiptFlagPatch,
} from "../utils/taskEvaluationLaunchForwardWorker";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const EXPIRES_AT = "2026-08-11T12:00:00.000Z";

const profile = {
  profile_id: "interiorgs-sage-franka-001",
  profile_digest: sha("a"),
  source_bundle: {
    bundle_id: "scene-001",
    source_kind: "interiorgs_sage" as const,
    uri: "gs://blueprint-runs/scene.json",
    digest: sha("b"),
  },
  evaluation_run_spec: { uri: "gs://blueprint-runs/spec.json", digest: sha("c") },
  required_controls: {
    canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
    secret_profile_id: "canonical-vast-adp",
    retry_cap: 0,
  },
  execution_admission: { live_enabled: true, blockers: [] as string[] },
  claim_ceiling: "development_only",
  required_authorization: { rights: true, spend: true, execution: true },
};

function queuedLaunchRecord() {
  const request = buildTaskEvaluationLaunchRequest({
    input: {
      launch_id: "adp009d-orphan-launch",
      run_id: "adp009d-orphan-run",
      profile_id: profile.profile_id,
      profile_digest: profile.profile_digest,
      rights: {
        scope: "internal_noncommercial_research_only",
        evidence: { uri: "gs://blueprint-runs/rights.json", digest: sha("d") },
      },
      spend: { max_spend_usd: 25, expires_at: EXPIRES_AT },
      confirm_execution: true,
    } as any,
    profile: profile as any,
    actorId: "ops@example.com",
    actorRole: "ops",
    authorizedAt: "2026-08-11T11:00:00.000Z",
  });

  return {
    schema_version: "task_evaluation_launch_web_record.v1",
    launch_id: request.launch_id,
    run_id: request.run_id,
    request,
    request_digest: request.request_digest,
    state: "queued_in_pipeline",
    forward_attempt_count: 1,
    provider_mutation_observed: false,
  } as Record<string, any>;
}

describe("terminal resource release eligibility seam", () => {
  it("produces a record the eligibility guard accepts once authority expires", () => {
    const record = queuedLaunchRecord();
    const patch = buildExpiredControlPlaneTerminalBlocker(record, Date.parse(EXPIRES_AT));
    expect(patch).not.toBeNull();

    // Exactly what the worker persists: the stored record merged with its patch.
    const stored = { ...record, ...patch };

    expect(() =>
      buildTaskEvaluationTerminalResourceReleaseRequest({
        launchRecord: stored,
        input: {
          provider: "vast",
          instance_id: "47508030",
          expected_label: "blueprint-adp009d-1786496624",
          confirm_terminal_resource_release: true,
        } as any,
        actorId: "ops@example.com",
        actorRole: "ops",
        authorizedAt: "2026-08-12T13:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("records the absent terminal receipt as an explicit false", () => {
    // The guard compares with !==, so an omitted field is not the same as false.
    const patch = buildExpiredControlPlaneTerminalBlocker(
      queuedLaunchRecord(),
      Date.parse(EXPIRES_AT),
    );
    expect(patch).toMatchObject({ terminal_receipt_present: false });
  });

  it("still refuses release when a Pipeline terminal receipt did arrive", () => {
    const record = { ...queuedLaunchRecord(), terminal_receipt: { status: "completed" } };
    expect(buildExpiredControlPlaneTerminalBlocker(record, Date.parse(EXPIRES_AT))).toBeNull();
  });
});

describe("repair of records blocked before the flag was recorded", () => {
  /** A record already blocked, as persisted without terminal_receipt_present. */
  function legacyBlockedRecord() {
    const record = queuedLaunchRecord();
    const patch = buildExpiredControlPlaneTerminalBlocker(record, Date.parse(EXPIRES_AT))!;
    const stored = { ...record, ...patch } as Record<string, any>;
    delete stored.terminal_receipt_present;
    return stored;
  }

  it("repairs a blocked record that predates the flag", () => {
    expect(buildMissingTerminalReceiptFlagPatch(legacyBlockedRecord()))
      .toEqual({ terminal_receipt_present: false });
  });

  it("is idempotent once the flag is present", () => {
    const repaired = { ...legacyBlockedRecord(), terminal_receipt_present: false };
    expect(buildMissingTerminalReceiptFlagPatch(repaired)).toBeNull();
  });

  it("never rewrites history for a launch that has a terminal receipt", () => {
    const withReceipt = {
      ...legacyBlockedRecord(),
      terminal_receipt: { status: "completed" },
    };
    expect(buildMissingTerminalReceiptFlagPatch(withReceipt)).toBeNull();
  });

  it("refuses to repair a record whose blocker does not assert the missing receipt", () => {
    const record = legacyBlockedRecord();
    record.control_plane_terminal_blocker = {
      ...record.control_plane_terminal_blocker,
      pipeline_terminal_receipt_observed: true,
    };
    expect(buildMissingTerminalReceiptFlagPatch(record)).toBeNull();
  });

  it("ignores records that are not control-plane terminal blocked", () => {
    expect(buildMissingTerminalReceiptFlagPatch(queuedLaunchRecord())).toBeNull();
  });
});
