import { describe, expect, it } from "vitest";
import {
  assertIntrowDraftOnly,
  buildFirehoseBrief,
  dedupeFirehoseSignals,
  synthesizeCustomerResearch,
} from "./marketing-integrations.js";

describe("marketing integration helpers", () => {
  it("synthesizes customer research into JTBD, personas, objections, and confidence", () => {
    const synthesis = synthesizeCustomerResearch([
      {
        source: "reddit",
        type: "forum_post",
        label: "evidence",
        summary: "Deployment leads need exact-site proof before they commit budget.",
        personaRole: "Deployment lead",
        jtbdJob: "Evaluate exact-site deployment risk",
        jtbdPain: "Generic demos do not match the real facility.",
        jtbdDesiredOutcome: "Get exact-site proof before committing spend",
        objection: "We cannot trust generic benchmarks.",
      },
      {
        source: "g2",
        type: "review",
        label: "evidence",
        summary: "Simulation teams want site-grounded evidence they can share internally.",
        personaRole: "Simulation lead",
        jtbdJob: "Package site evidence for internal review",
        jtbdPain: "Teams reopen discovery when proof is not tied to a real site.",
        jtbdDesiredOutcome: "Share real-site evidence without another discovery cycle",
      },
      {
        source: "youtube",
        type: "video",
        label: "open_question",
        summary: "Which hosted-session proof pack gets repeated in procurement reviews?",
      },
    ]);

    expect(synthesis.jtbd).toHaveLength(3);
    expect(synthesis.personas.map((entry) => entry.role)).toContain("Deployment lead");
    expect(synthesis.objections).toContain("We cannot trust generic benchmarks.");
    expect(synthesis.openQuestions).toContain(
      "Which hosted-session proof pack gets repeated in procurement reviews?",
    );
    expect(synthesis.confidence).toBe("medium");
  });

  it("blocks Introw live partner activation centrally", () => {
    expect(() => assertIntrowDraftOnly({ status: "active" })).toThrow(/disabled/i);
    expect(() => assertIntrowDraftOnly({ activate: true })).toThrow(/disabled/i);
    expect(() => assertIntrowDraftOnly({ status: "proposed" })).not.toThrow();
  });

  it("dedupes Firehose signals by id and prefers the freshest record", () => {
    const deduped = dedupeFirehoseSignals([
      {
        id: "sig-1",
        source: "reddit",
        topic: "robot-teams",
        title: "Older signal",
        summary: "Earlier summary",
        publishedAt: "2026-03-30T10:00:00.000Z",
        tags: [],
      },
      {
        id: "sig-1",
        source: "reddit",
        topic: "robot-teams",
        title: "Newer signal",
        summary: "Later summary",
        publishedAt: "2026-03-30T12:00:00.000Z",
        tags: ["latest"],
      },
      {
        id: "sig-2",
        source: "linkedin",
        topic: "site-operators",
        title: "Second signal",
        summary: "Unique summary",
        publishedAt: "2026-03-30T11:00:00.000Z",
        tags: [],
      },
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.title).toBe("Newer signal");
  });

  it("builds a deterministic Firehose brief", () => {
    const brief = buildFirehoseBrief([
      {
        id: "sig-1",
        source: "reddit",
        topic: "robot-teams",
        title: "Hosted-session demand",
        summary: "Robot teams keep asking for hosted proof.",
        tags: [],
      },
      {
        id: "sig-2",
        source: "linkedin",
        topic: "site-operators",
        title: "Operator lane signal",
        summary: "Operators care about access boundaries.",
        tags: [],
      },
    ], "hosted proof");

    expect(brief.totalSignals).toBe(2);
    expect(brief.topics).toEqual(["robot-teams", "site-operators"]);
    expect(brief.headline).toContain("hosted proof");
    expect(brief.highlights[0]).toContain("Hosted-session demand");
  });
});
