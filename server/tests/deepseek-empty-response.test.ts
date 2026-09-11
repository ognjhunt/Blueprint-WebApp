/**
 * The failure that cost a deploy.
 *
 * deepseek-v4-pro is asked to think, and reasoning tokens come out of the same
 * max_tokens budget as the answer. With the ceiling set below what the largest
 * schema can legitimately emit, the model spent the budget reasoning and
 * returned a successful response with empty content -- which surfaced as
 * "DeepSeek returned an empty response" and pointed at nothing useful.
 */
import { describe, expect, it } from "vitest";

import { inboundQualificationOutputSchema } from "../agents/tasks/inbound-qualification";

describe("token ceiling", () => {
  it("leaves room for the largest schema's own declared output", async () => {
    // Read the ceiling the adapter ships with.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("server/agents/adapters/deepseek-chat.ts", "utf8"),
    );
    const match = source.match(/const DEFAULT_DEEPSEEK_MAX_TOKENS = (\d+);/);
    expect(match, "DEFAULT_DEEPSEEK_MAX_TOKENS should be declared").toBeTruthy();
    const ceiling = Number(match![1]);

    // The qualification schema's maxima sum to ~8,573 characters of JSON, which
    // is roughly 2,150 tokens before a single reasoning token is spent. A
    // ceiling anywhere near that guarantees an empty answer on this lane.
    const schemaMaxChars = 8573;
    const approxContentTokens = schemaMaxChars / 4;
    expect(ceiling).toBeGreaterThan(approxContentTokens * 2);
  });

  it("still describes the shape that made the budget large", () => {
    // Guards the assumption above: if the schema shrinks or grows a lot, the
    // ceiling deserves rechecking rather than silently drifting.
    const shape = inboundQualificationOutputSchema.shape;
    expect(shape.buyer_follow_up).toBeDefined();
    expect(shape.internal_summary).toBeDefined();
    expect(shape.missing_information).toBeDefined();
  });
});
