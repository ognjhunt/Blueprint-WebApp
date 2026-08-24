import { describe, expect, it } from "vitest";

import { gateFields, specFields, proseFields } from "@/data/siteTaskQualification";
import { qualifyingConditions } from "@/data/qualifyingEnvironments";
import {
  applyNarrativeReview,
  describeDisposition,
  triageGateAnswers,
  type GateAnswers,
  type TriageDisposition,
} from "@/lib/gateTriage";

/** Every gate answered with its first `clear` option. */
function allClear(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const field of gateFields) {
    const clear = field.options.find((option) => option.verdict === "clear");
    if (clear) answers[field.id] = clear.value;
  }
  return answers;
}

function answerWith(fieldId: string, verdict: "clear" | "marginal" | "blocking"): GateAnswers {
  const answers = allClear();
  const field = gateFields.find((f) => f.id === fieldId);
  const option = field?.options.find((o) => o.verdict === verdict);
  if (field && option) answers[field.id] = option.value;
  return answers;
}

describe("site-task qualifying taxonomy", () => {
  it("asks about the room rather than naming our own criteria", () => {
    // The failure mode this guards: a site lead asked "is your scene fixed?"
    // answers yes, because "fixed" is our word and they cannot see our line.
    // Every gate question must be answerable from memory of the actual room.
    const ourJargon = /fixed scene|bounded task|known objects|clear window|qualif/i;
    for (const field of gateFields) {
      expect(field.question, `gate "${field.id}" leaks our taxonomy`).not.toMatch(ourJargon);
      expect(field.question.endsWith("?")).toBe(true);
    }
  });

  it("covers all four public conditions, so the screen matches what the site claims", () => {
    const covered = new Set(
      gateFields.map((field) => field.condition).filter((id): id is string => Boolean(id)),
    );
    for (const condition of qualifyingConditions) {
      expect(covered.has(condition.id), `no intake question feeds "${condition.id}"`).toBe(true);
    }
  });

  it("gives every blocking answer a way out, so a no is a deferral and not a dead end", () => {
    for (const field of gateFields) {
      for (const option of field.options) {
        if (option.verdict === "blocking") {
          expect(option.unblocks, `${field.id}/${option.value} blocks with no way out`).toBeTruthy();
        }
        if (option.verdict === "marginal") {
          expect(option.ambiguity, `${field.id}/${option.value} is marginal for no stated reason`).toBeTruthy();
        }
      }
    }
  });

  it("keeps the screening tier small and the specification tier off the critical path", () => {
    // Form length costs good sites. The gates have to be cheap enough to answer
    // before anyone has decided whether they care.
    expect(gateFields.length).toBeLessThanOrEqual(6);
    expect(specFields.length).toBeGreaterThan(0);
    // Nothing in the spec tier may block — those questions specify, they do not screen.
    for (const field of specFields) {
      expect(field.whyAsked, `spec field "${field.id}" does not say why it is asked`).toBeTruthy();
    }
    expect(proseFields.length).toBe(2);
  });
});

describe("triageGateAnswers", () => {
  it("qualifies only when every gate is answered and every answer is clear", () => {
    const result = triageGateAnswers(allClear());
    expect(result.disposition).toBe("qualified");
    expect(result.blockers).toHaveLength(0);
    expect(result.openQuestions).toHaveLength(0);
    expect(result.incomplete).toBe(false);
  });

  it("never qualifies a partial submission", () => {
    // The one failure mode that costs a real visit: a blank read as a pass.
    for (const field of gateFields) {
      const answers = allClear();
      delete answers[field.id];
      const result = triageGateAnswers(answers);
      expect(result.disposition, `missing "${field.id}" still qualified`).not.toBe("qualified");
      expect(result.unanswered).toContain(field.id);
      expect(result.incomplete).toBe(true);
    }
  });

  it("treats an empty submission as unanswered rather than as a rejection", () => {
    const result = triageGateAnswers({});
    expect(result.disposition).toBe("needs_conversation");
    expect(result.unanswered).toHaveLength(gateFields.length);
    expect(result.blockers).toHaveLength(0);
  });

  it("routes any single blocking answer to not_now, with the reason attached", () => {
    for (const field of gateFields) {
      const blocking = field.options.find((o) => o.verdict === "blocking");
      if (!blocking) continue;
      const result = triageGateAnswers(answerWith(field.id, "blocking"));
      expect(result.disposition, `"${field.id}" blocked without a not_now`).toBe("not_now");
      expect(result.blockers.map((b) => b.fieldId)).toContain(field.id);
      const reason = result.blockers.find((b) => b.fieldId === field.id);
      expect(reason?.detail).toBe(blocking.unblocks);
      expect(reason?.answer).toBe(blocking.label);
    }
  });

  it("routes a marginal answer to a conversation rather than to a yes or a no", () => {
    for (const field of gateFields) {
      const marginal = field.options.find((o) => o.verdict === "marginal");
      if (!marginal) continue;
      const result = triageGateAnswers(answerWith(field.id, "marginal"));
      expect(result.disposition, `"${field.id}" marginal did not route to a call`).toBe(
        "needs_conversation",
      );
      expect(result.openQuestions.map((q) => q.fieldId)).toContain(field.id);
      expect(result.blockers).toHaveLength(0);
    }
  });

  it("lets a blocker decide even when the rest of the form is blank", () => {
    // Being outside the metro does not become truer once the form is finished.
    const outside = gateFields[0].options.find((o) => o.verdict === "blocking");
    const result = triageGateAnswers({ [gateFields[0].id]: outside?.value });
    expect(result.disposition).toBe("not_now");
    expect(result.incomplete).toBe(true);
  });

  it("ignores an answer value that is not one of the offered options", () => {
    const answers = { ...allClear(), sceneStability: "definitely_fine_trust_me" };
    const result = triageGateAnswers(answers);
    expect(result.disposition).not.toBe("qualified");
    expect(result.unanswered).toContain("sceneStability");
  });
});

describe("applyNarrativeReview — the one-way door", () => {
  const qualified = triageGateAnswers(allClear());

  it("leaves a result untouched when the prose is consistent", () => {
    expect(applyNarrativeReview(qualified, { finding: "consistent", note: "" })).toBe(qualified);
    expect(applyNarrativeReview(qualified, null)).toBe(qualified);
    expect(applyNarrativeReview(qualified, undefined)).toBe(qualified);
  });

  it("downgrades a qualified result when the description contradicts the dropdowns", () => {
    // The case worth building for: three jobs described under "one task".
    const reviewed = applyNarrativeReview(qualified, {
      finding: "contradicts_structured",
      note: "Ticked one repeated task; described picking, sorting, and palletising.",
    });
    expect(reviewed.disposition).toBe("needs_conversation");
    expect(reviewed.openQuestions.at(-1)?.detail).toMatch(/palletising/);
  });

  it("cannot raise any disposition, whatever the model reports", () => {
    // A hallucination may cost a call. It may never put an operator in a car.
    const blocked = triageGateAnswers(answerWith("serviceArea", "blocking"));
    const marginal = triageGateAnswers(answerWith("sceneStability", "marginal"));

    const findings = ["consistent", "needs_detail", "contradicts_structured"] as const;
    const rank: Record<TriageDisposition, number> = {
      not_now: 0,
      needs_conversation: 1,
      qualified: 2,
    };

    for (const base of [blocked, marginal, qualified]) {
      for (const finding of findings) {
        const after = applyNarrativeReview(base, { finding, note: "n/a" });
        expect(
          rank[after.disposition],
          `finding "${finding}" raised "${base.disposition}"`,
        ).toBeLessThanOrEqual(rank[base.disposition]);
      }
    }

    // Specifically: a blocked submission stays blocked and keeps its blockers.
    expect(
      applyNarrativeReview(blocked, { finding: "consistent", note: "looks great" }).disposition,
    ).toBe("not_now");
    expect(
      applyNarrativeReview(blocked, { finding: "needs_detail", note: "" }).blockers,
    ).toHaveLength(1);
  });
});

describe("describeDisposition", () => {
  it("tells a rejected site which answer blocked it and what would flip it", () => {
    const blocked = triageGateAnswers(answerWith("accessWindow", "blocking"));
    const copy = describeDisposition(blocked);
    expect(copy.headline).toMatch(/not yet/i);
    expect(copy.body).toMatch(/maintenance window|changeover|shift boundary/i);
    // No call is asked of someone we just told no.
    expect(copy.nextStep).toMatch(/no call needed/i);
  });

  it("promises the call has an agenda already written", () => {
    const copy = describeDisposition(triageGateAnswers(answerWith("taskShape", "marginal")));
    expect(copy.body).toMatch(/cannot be decided from a form/i);
    expect(copy.nextStep).toMatch(/agenda/i);
  });

  it("does not promise a visit to a qualified site, because a match comes first", () => {
    const copy = describeDisposition(triageGateAnswers(allClear()));
    expect(copy.nextStep).toMatch(/we do not capture speculatively/i);
    expect(copy.nextStep).not.toMatch(/we will schedule|book a visit|pick a date/i);
  });
});
