// @vitest-environment node
import { describe, expect, it } from "vitest";
import { answerAgentQuestion, listAgentKnowledgeEntries } from "../retrieval/agentAsk";

describe("agent grounded ask", () => {
  it("keeps every knowledge entry grounded with citations and machine actions", () => {
    for (const entry of listAgentKnowledgeEntries()) {
      expect(entry.citations.length, `${entry.id} needs at least one citation`).toBeGreaterThan(0);
      expect(entry.actions.length, `${entry.id} needs at least one machine action`).toBeGreaterThan(0);
      expect(entry.answer.length).toBeGreaterThan(40);
    }
  });

  it("answers buying-with-a-budget questions with the free intake, not a purchase path", async () => {
    const response = await answerAgentQuestion({
      question: "I have a wallet and a budget - how do I buy access?",
    });
    expect(response.bestAnswer?.id).toBe("how-to-request-run");
    expect(response.bestAnswer?.answer).toMatch(/nothing to buy/i);
    expect(response.bestAnswer?.answer).toMatch(/gives Blueprint access to its system or an integration and Blueprint runs it/);
    expect(response.bestAnswer?.answer).not.toMatch(/joins by invitation|delivery proposals/);
    expect(response.bestAnswer?.actions.map((action) => action.endpoint).join(" ")).toContain(
      "task-evaluation-run",
    );
    expect(response.truthBoundary).toContain("curated");
  });

  it("routes a robot team's how-to-start question to the same intake", async () => {
    const response = await answerAgentQuestion({ question: "How does a robot team start an evaluation?" });
    expect(response.bestAnswer?.id).toBe("how-to-request-run");
  });

  it("explains who delivers the pilot and preserves customer contract authority", async () => {
    const response = await answerAgentQuestion({ question: "How do I compare delivery proposals and choose deployment partner?" });
    expect(response.bestAnswer?.id).toBe("choosing-delivery");
    expect(response.bestAnswer?.answer).toMatch(/customer decides whether to proceed and agrees the physical work directly with the deployment company/i);
    expect(response.bestAnswer?.answer).not.toMatch(/comparable delivery proposals/i);
    expect(response.bestAnswer?.answer).toMatch(/does not establish physical performance or safety/i);
  });

  it("routes search and pricing questions to their entries", async () => {
    const search = await answerAgentQuestion({
      question: "How do I filter sites by type and location with semantic search?",
    });
    expect(search.bestAnswer?.id).toBe("how-to-search");

    const pricing = await answerAgentQuestion({ question: "How much does it cost?" });
    expect(pricing.bestAnswer?.id).toBe("pricing");
    expect(pricing.bestAnswer?.answer).toMatch(/^Free during the beta\./);
    expect(pricing.bestAnswer?.answer).toMatch(/Blueprint takes no cut/);
  });

  it("falls back to human intake when nothing matches confidently", async () => {
    const response = await answerAgentQuestion({ question: "zzz qqq xylophone" });
    expect(response.noConfidentMatch).toBe(true);
    expect(response.bestAnswer).toBeNull();
    expect(response.fallback.contactUrl).toContain("/contact/robot-team");
  });

  it("rejects empty questions", async () => {
    await expect(answerAgentQuestion({ question: "" })).rejects.toThrow(/question is required/i);
  });
});
