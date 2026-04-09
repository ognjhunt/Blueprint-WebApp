import { describe, expect, it } from "vitest";
import { issueStatusToRuntimeSessionStatus, uniqueStrings } from "./types.js";

describe("runtime types helpers", () => {
  it("maps issue statuses into runtime session statuses", () => {
    expect(issueStatusToRuntimeSessionStatus("todo")).toBe("queued");
    expect(issueStatusToRuntimeSessionStatus("in_progress")).toBe("running");
    expect(issueStatusToRuntimeSessionStatus("blocked")).toBe("blocked");
    expect(issueStatusToRuntimeSessionStatus("done")).toBe("completed");
    expect(issueStatusToRuntimeSessionStatus("cancelled")).toBe("cancelled");
  });

  it("dedupes and normalizes string lists", () => {
    expect(uniqueStrings([" doctrine_shared ", "doctrine_shared", "", null, "project_shared:blueprint-webapp"])).toEqual([
      "doctrine_shared",
      "project_shared:blueprint-webapp",
    ]);
  });
});
