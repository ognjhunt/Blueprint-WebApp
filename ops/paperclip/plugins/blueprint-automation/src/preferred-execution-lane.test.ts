import { describe, expect, it } from "vitest";
import {
  isOversightExecutionLaneKey,
  shouldPreservePreferredExecutionLane,
} from "./preferred-execution-lane.js";

describe("preferred execution lane", () => {
  it("treats specialist queue work as a strict specialist lane", () => {
    expect(shouldPreservePreferredExecutionLane({
      title: "Notion Work Queue: Market Intel Weekly Digest - 2026-04-04",
      preferredAssignee: "market-intel-agent",
      sourceType: "notion-work-queue",
    })).toBe(true);
  });

  it("treats delegated child execution as a strict specialist lane", () => {
    expect(shouldPreservePreferredExecutionLane({
      title: "Follow through: Routine follow-through: Analytics Daily",
      preferredAssignee: "analytics-agent",
      parentId: "parent-1",
    })).toBe(true);
  });

  it("treats repo drift review work as a strict specialist lane", () => {
    expect(shouldPreservePreferredExecutionLane({
      title: "blueprint-webapp local worktree drift",
      preferredAssignee: "webapp-review",
      sourceType: "repo-dirty",
    })).toBe(true);
  });

  it("keeps public capture candidate review with the public-space review specialist", () => {
    expect(shouldPreservePreferredExecutionLane({
      title: "Review Durham under-review capture candidates from app",
      preferredAssignee: "public-space-review-agent",
    })).toBe(true);
  });

  it("does not preserve oversight-owned workspace management lanes", () => {
    expect(shouldPreservePreferredExecutionLane({
      title: "Notion drift: duplicate pages for Analytics Daily Snapshot - 2026-03-29",
      preferredAssignee: "notion-manager-agent",
      sourceType: "notion-drift",
    })).toBe(false);
  });

  it("recognizes oversight owners", () => {
    expect(isOversightExecutionLaneKey("blueprint-chief-of-staff")).toBe(true);
    expect(isOversightExecutionLaneKey("market-intel-agent")).toBe(false);
  });
});
