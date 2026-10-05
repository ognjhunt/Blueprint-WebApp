// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildHumanBlockerSubjectTag,
  classifyHumanReply,
  extractHumanBlockerIdFromText,
  normalizeCorrelationSubject,
  subjectsMatchForCorrelation,
} from "../utils/human-reply-routing";

describe("human reply routing helpers", () => {
  it.each(["do not approve", "yesterday", "yes, but do not spend", "> approved", "approved", "yes"])(
    "never treats unbound reply text as execution approval: %s", body => {
      const decision = classifyHumanReply(body, { blocker_kind: "technical" });
      expect(decision.should_resume_now).toBe(false);
    });
  it("extracts blocker ids from reply tags", () => {
    const blockerId = "bpb-prod-live-smoke";
    expect(
      extractHumanBlockerIdFromText(
        `Re: Production blocker ${buildHumanBlockerSubjectTag(blockerId)}`,
      ),
    ).toBe(blockerId);
  });

  it("normalizes reply prefixes when matching subjects", () => {
    expect(
      subjectsMatchForCorrelation(
        "[Blueprint Blocker] Production inbound write smoke returned 500",
        "Re: [Blueprint Blocker] Production inbound write smoke returned 500",
      ),
    ).toBe(true);
    expect(
      normalizeCorrelationSubject("Fwd: Re: [Blueprint Blocker] Hello"),
    ).toBe("[blueprint blocker] hello");
  });

  it("routes credential confirmations to the technical execution owner", () => {
    const decision = classifyHumanReply("I added FIELD_ENCRYPTION_MASTER_KEY and redeployed.", {
      blocker_kind: "technical",
      routing_owner: "blueprint-chief-of-staff",
      execution_owner: "webapp-codex",
      escalation_owner: "blueprint-cto",
    });

    expect(decision.classification).toBe("credential_env_confirmation");
    expect(decision.resolution).toBe("resolved_input");
    expect(decision.execution_owner).toBe("webapp-codex");
    expect(decision.should_resume_now).toBe(true);
  });

  it("routes logs evidence as resolved technical input", () => {
    const decision = classifyHumanReply(
      "Here are the production logs for request id prod-live-smoke-123. Error: missing key.",
      {
        blocker_kind: "technical",
        routing_owner: "blueprint-chief-of-staff",
        execution_owner: "webapp-codex",
        escalation_owner: "blueprint-cto",
      },
    );

    expect(decision.classification).toBe("logs_evidence");
    expect(decision.resolution).toBe("resolved_input");
    expect(decision.escalation_owner).toBe("blueprint-cto");
  });

  it("holds clarification replies as ambiguous input", () => {
    const decision = classifyHumanReply("Which production service needs the env var?", {
      blocker_kind: "technical",
      routing_owner: "blueprint-chief-of-staff",
      execution_owner: "webapp-codex",
      escalation_owner: "blueprint-cto",
    });

    expect(decision.classification).toBe("clarification");
    expect(decision.resolution).toBe("ambiguous_input");
    expect(decision.should_resume_now).toBe(false);
  });
});
