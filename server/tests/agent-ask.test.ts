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

  it("routes buying-with-a-budget questions to the live checkout answer", async () => {
    const response = await answerAgentQuestion({
      question: "I have a wallet and a budget - how do I buy access?",
    });
    expect(response.bestAnswer?.id).toBe("how-to-buy-live");
    expect(response.bestAnswer?.actions.map((action) => action.endpoint).join(" ")).toContain(
      "/api/agent-access/commerce/live-checkout",
    );
    expect(response.truthBoundary).toContain("curated");
  });

  it("routes search and pricing questions to their entries", async () => {
    const search = await answerAgentQuestion({
      question: "How do I filter sites by type and location with semantic search?",
    });
    expect(search.bestAnswer?.id).toBe("how-to-search");

    const pricing = await answerAgentQuestion({ question: "How much does it cost?" });
    expect(pricing.bestAnswer?.id).toBe("pricing");
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
