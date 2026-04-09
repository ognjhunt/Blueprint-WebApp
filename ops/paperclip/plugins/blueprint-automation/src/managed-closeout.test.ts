import { describe, expect, it } from "vitest";
import {
  findAutoResolvableCloseoutComment,
  isProofBearingCloseoutComment,
} from "./managed-closeout.js";

describe("managed closeout detection", () => {
  it("recognizes proof-bearing done comments", () => {
    expect(
      isProofBearingCloseoutComment(
        "## Done\nValidated with `npm run check` and `server/routes/inbound-request.ts`.",
      ),
    ).toBe(true);
  });

  it("rejects done comments without proof", () => {
    expect(isProofBearingCloseoutComment("## Done\nLooks good.")).toBe(false);
  });

  it("finds the newest assignee-authored closeout comment after the issue update", () => {
    const comment = findAutoResolvableCloseoutComment(
      [
        {
          authorAgentId: "webapp-codex",
          createdAt: "2026-04-09T15:00:00.000Z",
          body: "## Done\nValidated with `npm run check`.",
        },
        {
          authorAgentId: "webapp-codex",
          createdAt: "2026-04-09T16:00:00.000Z",
          body: "## Done\nValidated with `npm run check` and `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/inbound-request.ts`.",
        },
      ],
      {
        issueUpdatedAt: "2026-04-09T15:30:00.000Z",
        assigneeAgentId: "webapp-codex",
      },
    );

    expect(comment?.createdAt).toBe("2026-04-09T16:00:00.000Z");
  });

  it("does not reuse stale closeout comments after a later reopen", () => {
    const comment = findAutoResolvableCloseoutComment(
      [
        {
          authorAgentId: "webapp-codex",
          createdAt: "2026-04-09T15:00:00.000Z",
          body: "## Done\nValidated with `npm run check`.",
        },
      ],
      {
        issueUpdatedAt: "2026-04-09T16:00:00.000Z",
        assigneeAgentId: "webapp-codex",
      },
    );

    expect(comment).toBeNull();
  });
});
