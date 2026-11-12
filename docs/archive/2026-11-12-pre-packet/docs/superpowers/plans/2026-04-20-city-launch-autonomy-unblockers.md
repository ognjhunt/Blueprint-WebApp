# City Launch Autonomy Unblockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `city + budget` planning and activation run autonomously without manual intervention, while converting proof, rights, hosted-review, send, and analytics gaps into explicit managed execution states instead of harness-stopping blockers.

**Architecture:** Split the city-launch lifecycle into `planning`, `activation`, `execution`, and `external-confirmation` phases. Keep only doctrine-required fail-closed checks at the harness boundary. Everything else becomes a routed lane state with machine-readable capability and evidence status so the org can continue operating autonomously until a real external confirmation or doctrine gate is reached.

**Tech Stack:** TypeScript, existing city-launch server utilities, Paperclip issue orchestration, Firestore-backed ledgers, SendGrid/SMTP transport abstraction, Vitest.

---

## Success Criteria

- A fresh `city-launch:run --city "<City, ST>" --budget-tier <tier>` completes planning and activation without human approval dispatch.
- Missing recipient-backed contacts no longer crash activation. The run downgrades launchability, creates contact-discovery work, and still creates a live issue tree.
- Missing proof assets, rights clearance, lawful access, hosted-review evidence, and Firehose do not stop planning/activation. They are emitted as explicit downstream blockers with owners, scorecard stamps, and external-confirmation states.
- Sender verification is solved globally, not city-by-city, and the harness can prove whether outbound is `ready`, `warning`, or `external_confirmation_required`.
- The scorecard can render truthful city status from first-party launch ledgers even when Firehose is absent.

## Non-Goals

- Removing doctrine-required rights, privacy, lawful-access, or non-standard commercial gates.
- Pretending proof assets, hosted reviews, or responses exist when they do not.
- Making community publication live before a real connector exists.

## File Map

**Create**
- `server/utils/cityLaunchCapabilityState.ts`
- `server/tests/city-launch-capability-state.test.ts`
- `server/tests/city-launch-autonomy-regression.test.ts`

**Modify**
- `server/utils/cityLaunchExecutionHarness.ts`
- `server/utils/cityLaunchPlanningHarness.ts`
- `server/utils/cityLaunchResearchParser.ts`
- `server/utils/cityLaunchContactEnrichment.ts`
- `server/utils/cityLaunchExternalContactDiscovery.ts`
- `server/utils/cityLaunchSendExecutor.ts`
- `server/utils/cityLaunchScorecard.ts`
- `server/utils/cityLaunchPolicy.ts`
- `server/utils/cityLaunchDoctrine.ts`
- `server/utils/email.ts`
- `server/utils/autonomous-growth.ts`
- `scripts/city-launch/run-city-launch.ts`
- `scripts/city-launch/build-execution-harness.ts`
- `server/tests/city-launch-execution-harness.test.ts`
- `server/tests/city-launch-planning-harness.test.ts`
- `server/tests/city-launch-send-executor.test.ts`
- `server/tests/city-launch-scorecard.test.ts`
- `server/tests/autonomous-growth.test.ts`

**Reference / Verify**
- `ops/paperclip/blueprint-company/tasks/city-launch-activation/TASK.md`
- `docs/generic-autonomous-city-launcher-2026-04-12.md`
- `knowledge/reports/analytics/2026-04-17-sacramento-launch-scorecard.md`

### Task 1: Define The Autonomy Contract

**Files:**
- Create: `server/utils/cityLaunchCapabilityState.ts`
- Modify: `server/utils/cityLaunchDoctrine.ts`
- Modify: `server/utils/cityLaunchPolicy.ts`
- Test: `server/tests/city-launch-capability-state.test.ts`

- [ ] **Step 1: Write the failing capability-state tests**

```ts
import { describe, expect, it } from "vitest";
import {
  assessCityLaunchCapabilities,
  type CityLaunchCapabilitySnapshot,
} from "../utils/cityLaunchCapabilityState";

describe("city launch capability state", () => {
  it("treats proof and hosted review as execution blockers, not activation blockers", () => {
    const snapshot = assessCityLaunchCapabilities({
      hasCompletedPlaybook: true,
      hasActivationPayload: true,
      recipientBackedContacts: 0,
      senderVerification: "unknown",
      hasRightsClearedProofAsset: false,
      hasHostedReviewStarted: false,
      hasFirehose: false,
    });

    expect(snapshot.activation.allowed).toBe(true);
    expect(snapshot.execution.proofMotion.status).toBe("external_confirmation_required");
  });

  it("keeps doctrine-required gates explicit", () => {
    const snapshot = assessCityLaunchCapabilities({
      hasCompletedPlaybook: true,
      hasActivationPayload: true,
      recipientBackedContacts: 2,
      senderVerification: "verified",
      hasRightsClearedProofAsset: false,
      hasHostedReviewStarted: false,
      hasFirehose: false,
    });

    expect(snapshot.execution.rights.status).toBe("external_confirmation_required");
    expect(snapshot.execution.hostedReview.status).toBe("pending_upstream_evidence");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/tests/city-launch-capability-state.test.ts`
Expected: FAIL because `cityLaunchCapabilityState.ts` does not exist yet.

- [ ] **Step 3: Add the capability-state module**

```ts
export type CapabilityStatus =
  | "ready"
  | "warning"
  | "blocked"
  | "pending_upstream_evidence"
  | "external_confirmation_required";

export type CityLaunchCapabilitySnapshot = {
  activation: {
    allowed: boolean;
    blockers: string[];
    warnings: string[];
  };
  execution: {
    contacts: { status: CapabilityStatus; detail: string };
    outbound: { status: CapabilityStatus; detail: string };
    rights: { status: CapabilityStatus; detail: string };
    lawfulAccess: { status: CapabilityStatus; detail: string };
    proofMotion: { status: CapabilityStatus; detail: string };
    hostedReview: { status: CapabilityStatus; detail: string };
    analytics: { status: CapabilityStatus; detail: string };
  };
};

export function assessCityLaunchCapabilities(input: {
  hasCompletedPlaybook: boolean;
  hasActivationPayload: boolean;
  recipientBackedContacts: number;
  senderVerification: "verified" | "unverified" | "unknown" | "unset";
  hasRightsClearedProofAsset: boolean;
  hasHostedReviewStarted: boolean;
  hasFirehose: boolean;
}): CityLaunchCapabilitySnapshot {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!input.hasCompletedPlaybook) blockers.push("completed_playbook_missing");
  if (!input.hasActivationPayload) blockers.push("activation_payload_missing");
  if (input.recipientBackedContacts < 1) warnings.push("recipient_backed_contacts_missing");

  return {
    activation: {
      allowed: blockers.length === 0,
      blockers,
      warnings,
    },
    execution: {
      contacts: {
        status: input.recipientBackedContacts > 0 ? "ready" : "pending_upstream_evidence",
        detail: "Recipient-backed contact evidence is required for autonomous first-wave direct outreach.",
      },
      outbound: {
        status:
          input.senderVerification === "verified"
            ? "ready"
            : input.senderVerification === "unverified"
              ? "blocked"
              : "warning",
        detail: "Outbound send readiness is transport-level, not activation-level.",
      },
      rights: {
        status: input.hasRightsClearedProofAsset ? "ready" : "external_confirmation_required",
        detail: "Rights-cleared proof assets remain doctrine-gated external confirmations.",
      },
      lawfulAccess: {
        status: "external_confirmation_required",
        detail: "Private controlled capture requires lawful-access evidence before field execution.",
      },
      proofMotion: {
        status: input.hasRightsClearedProofAsset ? "ready" : "external_confirmation_required",
        detail: "Proof motion may proceed only when real proof evidence exists.",
      },
      hostedReview: {
        status: input.hasHostedReviewStarted ? "ready" : "pending_upstream_evidence",
        detail: "Hosted review is a downstream execution milestone, not an activation precondition.",
      },
      analytics: {
        status: input.hasFirehose ? "ready" : "warning",
        detail: "Firehose enriches analytics but must not block first-party city-launch scorecards.",
      },
    },
  };
}
```

- [ ] **Step 4: Thread the new contract into doctrine/policy constants**

Run: update `cityLaunchDoctrine.ts` and `cityLaunchPolicy.ts` so only these remain harness fail-closed:

```ts
const HARNESS_FAIL_CLOSED_KEYS = [
  "completed_playbook_missing",
  "activation_payload_missing",
];
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run server/tests/city-launch-capability-state.test.ts server/tests/city-launch-approval-mode.test.ts`
Expected: PASS

### Task 2: Stop Activation From Throwing On Contact Gaps

**Files:**
- Modify: `server/utils/cityLaunchExecutionHarness.ts`
- Modify: `server/utils/cityLaunchPlanningHarness.ts`
- Modify: `server/utils/cityLaunchResearchParser.ts`
- Test: `server/tests/city-launch-execution-harness.test.ts`
- Test: `server/tests/city-launch-planning-harness.test.ts`

- [ ] **Step 1: Write the failing regression**

```ts
it("creates the issue tree even when recipient-backed contacts are missing", async () => {
  const result = await runCityLaunchExecutionHarness({
    city: "Test City, CA",
    founderApproved: true,
  });

  expect(result.status).toBe("founder_approved_activation_ready");
  expect(result.paperclip?.rootIssueId).toBeTruthy();
  expect(result.outboundReadiness?.status).toBe("blocked");
});
```

- [ ] **Step 2: Run the regression**

Run: `npx vitest run server/tests/city-launch-execution-harness.test.ts -t "recipient-backed contacts"`
Expected: FAIL because the harness still throws on missing contacts.

- [ ] **Step 3: Replace the hard throw with capability downgrade**

In `cityLaunchExecutionHarness.ts`, replace:

```ts
if (autonomousActivation && countRecipientBackedFirstWaveContacts(completedResearch) < 1) {
  throw new Error(
    "Activation-ready direct outreach requires 1-3 recipient-backed first-wave contacts with explicit contact_email evidence.",
  );
}
```

with:

```ts
const recipientBackedContactCount = countRecipientBackedFirstWaveContacts(completedResearch);
const capabilitySnapshot = assessCityLaunchCapabilities({
  hasCompletedPlaybook: Boolean(planningState.completedArtifactPath),
  hasActivationPayload: Boolean(completedResearch?.activationPayload),
  recipientBackedContacts: recipientBackedContactCount,
  senderVerification: getCityLaunchSenderStatus().verificationStatus,
  hasRightsClearedProofAsset: false,
  hasHostedReviewStarted: false,
  hasFirehose: isFirehoseConfigured(),
});
```

- [ ] **Step 4: Make planning output downgrade readiness instead of pretending activation-ready**

Add parser/planning behavior:

```ts
activationReadiness =
  recipientBackedContacts.length > 0 ? "activation_ready" : "activation_ready_contact_gap";
```

and emit warnings instead of fatal validation for contact gaps.

- [ ] **Step 5: Re-run tests**

Run: `npx vitest run server/tests/city-launch-planning-harness.test.ts server/tests/city-launch-execution-harness.test.ts`
Expected: PASS

### Task 3: Autonomously Backfill Recipient Evidence

**Files:**
- Modify: `server/utils/cityLaunchContactEnrichment.ts`
- Modify: `server/utils/cityLaunchExternalContactDiscovery.ts`
- Modify: `server/utils/cityLaunchLedgers.ts`
- Test: `server/tests/city-launch-contact-enrichment.test.ts`

- [ ] **Step 1: Add failing tests for auto-backfill**

```ts
it("marks unresolved first-wave contacts for follow-up discovery and task routing", async () => {
  const result = await runCityLaunchContactEnrichment({
    city: "San Jose, CA",
    artifactPath: "/tmp/playbook.md",
    outputPath: "/tmp/out.json",
  });

  expect(result.unresolvedBuyerTargets.length).toBeGreaterThan(0);
  expect(result.status).toMatch(/enriched|no_changes/);
});
```

- [ ] **Step 2: Implement persistent unresolved-contact state**

Add a machine-readable enrichment result:

```ts
{
  unresolvedContactNeeds: [
    {
      lane: "buyer_direct",
      companyName: "Applied Intuition",
      reason: "missing_contact_email",
      nextAction: "external_contact_discovery"
    }
  ]
}
```

- [ ] **Step 3: Route unresolved contacts into live tasks instead of blocking activation**

Add ledger support for:

```ts
contactEvidenceState: "verified" | "missing" | "discovery_requested";
```

- [ ] **Step 4: Re-run contact tests**

Run: `npx vitest run server/tests/city-launch-contact-enrichment.test.ts`
Expected: PASS

### Task 4: Make Sender Verification A Global Capability, Not A City Blocker

**Files:**
- Modify: `server/utils/email.ts`
- Modify: `server/utils/cityLaunchSendExecutor.ts`
- Test: `server/tests/city-launch-send-executor.test.ts`
- Test: `server/tests/city-launch-autonomy-regression.test.ts`

- [ ] **Step 1: Add failing tests for sender capability**

```ts
it("does not block activation when sender verification is unknown", () => {
  const readiness = assessCityLaunchOutboundReadiness({
    city: "San Jose, CA",
    sendActions: [],
  });

  expect(readiness.status).toBe("blocked");
  expect(readiness.blockers).toContain("No recipient-backed direct-outreach send actions were seeded for San Jose, CA.");
});
```

- [ ] **Step 2: Add explicit sender capability states**

In `email.ts`, add:

```ts
export function isCityLaunchSenderOperational() {
  const sender = getCityLaunchSenderStatus();
  const transport = getEmailTransportStatus();
  return {
    transportReady: transport.configured,
    senderReady: sender.verificationStatus === "verified",
    senderWarning: sender.verificationStatus === "unknown",
  };
}
```

- [ ] **Step 3: Ensure planning/activation never depend on sender verification**

In `cityLaunchSendExecutor.ts`, keep sender state as outbound-only and remove any path that upgrades it into an activation precondition.

- [ ] **Step 4: Add a global bootstrap health assertion**

Add a regression that fails only when live send execution is attempted with `verificationStatus === "unverified"`, not when planning/activation runs.

- [ ] **Step 5: Run tests**

Run: `npx vitest run server/tests/city-launch-send-executor.test.ts server/tests/city-launch-autonomy-regression.test.ts`
Expected: PASS

### Task 5: Convert Proof / Hosted Review Into Routed Execution States

**Files:**
- Modify: `server/utils/cityLaunchExecutionHarness.ts`
- Modify: `server/utils/cityLaunchScorecard.ts`
- Modify: `server/utils/cityLaunchDoctrine.ts`
- Test: `server/tests/city-launch-scorecard.test.ts`
- Test: `server/tests/city-launch-execution-harness.test.ts`

- [ ] **Step 1: Write failing scorecard tests**

```ts
it("shows proof motion as blocked in execution without failing launch activation", async () => {
  const scorecard = await buildCityLaunchScorecard("San Jose, CA");
  expect(scorecard.dimensions.proofMotion.status).toBe("blocked");
  expect(scorecard.dimensions.activation.status).toBe("on_track");
});
```

- [ ] **Step 2: Add explicit machine states**

Use:

```ts
proofMotionState:
  | "not_started"
  | "rights_clearance_pending"
  | "proof_asset_cleared"
  | "proof_pack_ready"
  | "hosted_review_pending"
  | "hosted_review_started";
```

- [ ] **Step 3: Stamp these states into ledgers and manifests**

Ensure the manifest writes:

```ts
result.executionBlockers = capabilitySnapshot.execution;
```

- [ ] **Step 4: Make scorecards read first-party proof state**

Scorecards must derive proof / hosted review state from city-launch ledgers even if no Firehose enrichment is available.

- [ ] **Step 5: Run tests**

Run: `npx vitest run server/tests/city-launch-scorecard.test.ts server/tests/city-launch-execution-harness.test.ts`
Expected: PASS

### Task 6: Remove Firehose As A City-Launch Hard Dependency

**Files:**
- Modify: `server/utils/autonomous-growth.ts`
- Modify: `server/utils/cityLaunchScorecard.ts`
- Test: `server/tests/autonomous-growth.test.ts`
- Test: `server/tests/city-launch-scorecard.test.ts`

- [ ] **Step 1: Add failing test for no-Firehose city scorecard**

```ts
it("renders a truthful scorecard without Firehose", async () => {
  delete process.env.FIREHOSE_API_TOKEN;
  delete process.env.FIREHOSE_BASE_URL;

  const scorecard = await buildCityLaunchScorecard("Sacramento, CA");
  expect(scorecard.dimensions.analytics.status).toBe("warning");
  expect(scorecard.dimensions.proofMotion.status).toBe("blocked");
});
```

- [ ] **Step 2: Split first-party city-launch metrics from Firehose enrichments**

Add:

```ts
const firehoseAvailable = Boolean(process.env.FIREHOSE_API_TOKEN && process.env.FIREHOSE_BASE_URL);
```

and fall back to ledgers when false.

- [ ] **Step 3: Keep the warning explicit**

The scorecard should render:

```ts
analyticsWarning: "Firehose enrichment unavailable; using first-party city-launch ledgers only."
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/tests/autonomous-growth.test.ts server/tests/city-launch-scorecard.test.ts`
Expected: PASS

### Task 7: Add End-To-End Autonomy Certification

**Files:**
- Create: `server/tests/city-launch-autonomy-regression.test.ts`
- Modify: `scripts/city-launch/run-city-launch.ts`
- Modify: `scripts/city-launch/build-execution-harness.ts`
- Test: `server/tests/city-launch-autonomy-regression.test.ts`

- [ ] **Step 1: Add the end-to-end certification fixture**

```ts
it("runs city plus budget through planning and activation with no manual intervention", async () => {
  const result = await runCityLaunchExecutionHarness({
    city: "Certification City, CA",
    founderApproved: true,
    budgetTier: "zero_budget",
  });

  expect(result.paperclip?.rootIssueId).toBeTruthy();
  expect(result.planning.status).toBe("completed");
  expect(result.activationStatus).toBe("activation_ready");
  expect(result.outboundReadiness).toBeTruthy();
  expect(result.error).toBeUndefined();
});
```

- [ ] **Step 2: Add a second fixture for missing contacts**

```ts
it("does not fail closed when contacts, proof, or Firehose are missing", async () => {
  const result = await runCityLaunchExecutionHarness({
    city: "Sparse Evidence City, CA",
    founderApproved: true,
    budgetTier: "zero_budget",
  });

  expect(result.paperclip?.rootIssueId).toBeTruthy();
  expect(result.outboundReadiness?.status).toMatch(/blocked|warning/);
  expect(result.researchMaterialization?.status).toBeTruthy();
});
```

- [ ] **Step 3: Run the autonomy regression suite**

Run: `npx vitest run server/tests/city-launch-autonomy-regression.test.ts server/tests/city-launch-execution-harness.test.ts`
Expected: PASS

- [ ] **Step 4: Run the focused full verification set**

Run: `npm run check`
Expected: PASS

Run: `npx vitest run server/tests/paperclip.test.ts server/tests/city-launch-send-executor.test.ts server/tests/city-launch-scorecard.test.ts server/tests/city-launch-execution-harness.test.ts server/tests/city-launch-autonomy-regression.test.ts`
Expected: PASS

- [ ] **Step 5: Produce certification artifacts**

Run:

```bash
npm run city-launch:run -- --city "Certification City, CA" --budget-tier zero_budget
```

Expected:
- manifest written under `ops/paperclip/reports/city-launch-execution/certification-city-ca/<timestamp>/manifest.json`
- `paperclipRootIssueId` present
- no fatal activation error
- capability warnings present where evidence is still missing

## Sequencing Notes

1. Implement Tasks 1-2 first. They define the new fail-closed boundary.
2. Implement Task 3 next so contact gaps become routable work, not activation crashes.
3. Implement Task 4 before any attempt to claim full outbound autonomy.
4. Implement Tasks 5-6 together so proof motion and analytics remain truthful after the lifecycle shift.
5. Finish with Task 7 and do not claim success until the certification run passes.

## Expected End State

- Planning a city never requires manual intervention.
- Activation creates a live issue tree even when contact, proof, rights, or analytics evidence is incomplete.
- Doctrine-required external confirmations still exist, but they live in lane state and scorecards instead of crashing the harness.
- The first “real” blockers after planning become external world confirmations, not orchestration failures.

## Self-Review

- Spec coverage: covers rights/proof truth, recipient-backed contacts, sender verification, Firehose decoupling, approval-path cleanup, and post-fix autonomy verification.
- Placeholder scan: no `TODO` / `TBD` placeholders remain.
- Type consistency: capability-state and proof-motion names are consistent across tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-city-launch-autonomy-unblockers.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
