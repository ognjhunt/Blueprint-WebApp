import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

type RoutineConfig = {
  status?: string;
  concurrencyPolicy?: string;
  catchUpPolicy?: string;
};

const configPath = path.resolve("ops/paperclip/blueprint-company/.paperclip.yaml");
const config = yaml.load(fs.readFileSync(configPath, "utf8")) as {
  routines?: Record<string, RoutineConfig>;
};

const ALWAYS_ENQUEUE_ALLOWLIST = new Set([
  "ceo-daily-review",
  "cto-cross-repo-triage",
  "founder-morning-brief",
  "founder-daily-accountability-report",
  "founder-eod-brief",
  "founder-friday-operating-recap",
  "founder-weekly-gaps-report",
  "analytics-daily",
  "analytics-weekly",
  "growth-lead-weekly",
  "market-intel-weekly",
  "demand-intel-weekly",
  "capturer-growth-weekly",
  "robot-team-growth-weekly",
]);

function isReviewCheckManagerAutonomyLoop(routineKey: string) {
  return /(?:review|check|manager|autonomy|continuous-loop|sweep|stale-audit|refresh)$/i.test(routineKey);
}

describe("Paperclip routine execution policy", () => {
  it("keeps review/check/manager/autonomy loops coalesced with missed runs skipped", () => {
    const failures = Object.entries(config.routines ?? {})
      .filter(([routineKey, routine]) => routine.status !== "paused")
      .filter(([routineKey]) => isReviewCheckManagerAutonomyLoop(routineKey))
      .filter(([routineKey]) => !ALWAYS_ENQUEUE_ALLOWLIST.has(routineKey))
      .filter(([, routine]) =>
        routine.concurrencyPolicy !== "coalesce_if_active" ||
        routine.catchUpPolicy !== "skip_missed",
      )
      .map(([routineKey, routine]) =>
        `${routineKey}: ${routine.concurrencyPolicy ?? "unset"} / ${routine.catchUpPolicy ?? "unset"}`,
      );

    expect(failures).toEqual([]);
  });

  it("requires every broad always_enqueue routine to be explicitly allowlisted", () => {
    const failures = Object.entries(config.routines ?? {})
      .filter(([, routine]) => routine.status !== "paused")
      .filter(([, routine]) => routine.concurrencyPolicy === "always_enqueue")
      .filter(([routineKey]) => !ALWAYS_ENQUEUE_ALLOWLIST.has(routineKey))
      .map(([routineKey]) => routineKey);

    expect(failures).toEqual([]);
  });
});
