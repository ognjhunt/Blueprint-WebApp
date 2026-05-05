// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveStartupContext } from "../agents/knowledge";

describe("agent startup context", () => {
  it("attaches compact repo document references with checksums and bounded excerpts", async () => {
    const context = await resolveStartupContext(
      {
        startupContext: {
          repoDocPaths: ["PLATFORM_CONTEXT.md"],
        },
      },
      "",
      { compact: true },
    );

    expect(context.repo_docs[0]).toMatchObject({
      path: "PLATFORM_CONTEXT.md",
      checksum: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      excerpt_length: expect.any(Number),
      excerpt_truncated: expect.any(Boolean),
    });
    expect(context.repo_docs[0]?.excerpt.length).toBeLessThanOrEqual(900);
  });
});
