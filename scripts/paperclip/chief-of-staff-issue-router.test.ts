import { describe, expect, it } from "vitest";
import { inferChiefOfStaffRoute } from "./chief-of-staff-issue-router.ts";

describe("chief of staff issue router", () => {
  it("routes notion drift issues to notion-manager-agent", () => {
    const route = inferChiefOfStaffRoute({
      title: "Notion drift: duplicate pages for Founder EoD Brief | 2026-04-01 | Blueprint",
      status: "todo",
      project: { name: "Blueprint Executive Ops" },
    });

    expect(route?.assigneeKey).toBe("notion-manager-agent");
  });

  it("routes city launch issues to city-launch-agent", () => {
    const route = inferChiefOfStaffRoute({
      title: "City Launch Refresh",
      status: "backlog",
      project: { name: "Blueprint Executive Ops" },
    });

    expect(route?.assigneeKey).toBe("city-launch-agent");
    expect(route?.status).toBe("todo");
  });

  it("routes CI failure issues to the matching repo watcher agent", () => {
    const route = inferChiefOfStaffRoute({
      title: "blueprint-webapp CI failure: CI",
      status: "todo",
      project: { name: "blueprint-webapp" },
    });

    expect(route?.assigneeKey).toBe("webapp-ci-watch");
  });

  it("routes branch drift issues to the matching repo review agent", () => {
    const route = inferChiefOfStaffRoute({
      title: "blueprint-webapp branch drift",
      status: "todo",
      project: { name: "blueprint-webapp" },
    });

    expect(route?.assigneeKey).toBe("webapp-review");
  });

  it("routes hosted-review proof-pack buyer threads to solutions-engineering-agent", () => {
    const route = inferChiefOfStaffRoute({
      title: "Conversion Refresh: robot-team proof-pack and hosted-review path",
      status: "todo",
      project: { name: "Blueprint Executive Ops" },
    });

    expect(route?.assigneeKey).toBe("solutions-engineering-agent");
  });

  it("routes bootstrap issues to their owning specialist agents", () => {
    const route = inferChiefOfStaffRoute({
      title: "Investor Relations Agent Bootstrap",
      status: "todo",
      project: { name: "Blueprint Executive Ops" },
    });

    expect(route?.assigneeKey).toBe("investor-relations-agent");
  });

  it("routes knowledge freshness cleanup to notion-manager-agent", () => {
    const route = inferChiefOfStaffRoute({
      title: "Ensure Knowledge DB entries have review timestamps and stale entries get flagged",
      status: "backlog",
      project: { name: "Blueprint Executive Ops" },
    });

    expect(route?.assigneeKey).toBe("notion-manager-agent");
    expect(route?.status).toBe("todo");
  });

  it("routes Blueprint agent registry backfill work to notion-manager-agent", () => {
    const route = inferChiefOfStaffRoute({
      title: "Notion Work Queue: Backfill Blueprint Agents registry metadata and canonical links",
      status: "backlog",
      project: { name: "Blueprint Executive Ops" },
    });

    expect(route?.assigneeKey).toBe("notion-manager-agent");
    expect(route?.status).toBe("todo");
  });
});
