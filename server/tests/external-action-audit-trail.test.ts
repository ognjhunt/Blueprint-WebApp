// @vitest-environment node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  filterExternalActionAuditTrail,
  projectExternalActionAuditTrail,
  type ExternalActionAuditTrailSource,
} from "../utils/external-action-audit-trail";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadFixture(): Promise<ExternalActionAuditTrailSource> {
  const raw = await fs.readFile(
    path.join(__dirname, "fixtures/external-action-audit-trail-sources.json"),
    "utf8",
  );
  return JSON.parse(raw) as ExternalActionAuditTrailSource;
}

describe("external action audit trail projector", () => {
  it("projects local action, GTM, escalation, and voice fixtures into one queryable trail", async () => {
    const projection = projectExternalActionAuditTrail(await loadFixture());

    expect(projection.items.length).toBeGreaterThanOrEqual(9);
    expect(projection.summary.total).toBe(projection.items.length);
    expect(projection.summary.byActionKind).toMatchObject({
      outbound: expect.any(Number),
      lifecycle: expect.any(Number),
      escalation: expect.any(Number),
    });
    expect(projection.summary.byResult).toMatchObject({
      approved: expect.any(Number),
      skipped: expect.any(Number),
      dry_run: expect.any(Number),
      failed: expect.any(Number),
      blocked: expect.any(Number),
    });

    expect(projection.items.find((item) => item.id === "action_ledger:ledger-lifecycle-approved")).toMatchObject({
      actionKind: "lifecycle",
      actor: "ops@tryblueprint.io",
      sourceObject: {
        collection: "marketplaceEntitlements",
        id: "ent-approved",
        key: "marketplaceEntitlements/ent-approved",
      },
      approvalState: "approved",
      result: "approved",
      providerPath: "action_ledger/send_email",
    });

    expect(projection.items.find((item) => item.id === "gtm_target:gtm-skipped-target")).toMatchObject({
      actionKind: "outbound",
      approvalState: "pending",
      result: "skipped",
      providerPath: "gtm/ledger-target",
    });

    expect(projection.items.find((item) => item.id === "voice_support_queue:voice-escalation-1")).toMatchObject({
      actionKind: "escalation",
      approvalState: "pending",
      result: "blocked",
      providerPath: "voice/support-queue",
    });
  });

  it("filters by actor, source object, approval state, result, and provider path", async () => {
    const projection = projectExternalActionAuditTrail(await loadFixture());

    const lifecycleApprovals = filterExternalActionAuditTrail(projection.items, {
      actor: "ops@tryblueprint.io",
      sourceObject: "marketplaceEntitlements/ent-approved",
      approvalState: "approved",
      result: "approved",
      providerPath: "action_ledger/send_email",
    });

    expect(lifecycleApprovals.map((item) => item.id)).toEqual([
      "action_ledger:ledger-lifecycle-approved",
    ]);

    const dryRunProof = filterExternalActionAuditTrail(projection.items, {
      providerPath: "gtm/send-executor/dry-run",
      result: "dry_run",
    });

    expect(dryRunProof).toHaveLength(1);
    expect(dryRunProof[0]).toMatchObject({
      id: expect.stringContaining("gtm_send_executor:"),
      actionKind: "outbound",
      providerPath: "gtm/send-executor/dry-run",
      evidencePaths: expect.arrayContaining([
        "ops/paperclip/reports/gtm-send-executor/2026-05-20/send-executor-manifest.json",
      ]),
    });
  });

  it("keeps escalation approvals separate from live provider telemetry", async () => {
    const projection = projectExternalActionAuditTrail(await loadFixture());

    const escalationApprovals = filterExternalActionAuditTrail(projection.items, {
      actionKind: "escalation",
      result: "approved",
      providerPath: "human_reply/email",
    });

    expect(escalationApprovals).toHaveLength(1);
    expect(escalationApprovals[0]).toMatchObject({
      id: "human_reply:reply-approval",
      actor: "ohstnhunt@gmail.com",
      approvalState: "approved",
      result: "approved",
      liveTelemetry: false,
      notes: expect.stringContaining("Human approval was explicit"),
    });
  });
});
