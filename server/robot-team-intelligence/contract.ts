import { z } from "zod";
import type { RobotTeamJobKind } from "./instructions";

const instant = z.string().datetime({ offset: true });
export const intelligenceControlSchema = z.object({
  schemaVersion: z.literal(1), enabled: z.boolean(),
  timezone: z.string().default("America/Chicago"), hour: z.number().int().min(0).max(23).default(9),
  weeklyDay: z.number().int().min(0).max(6).default(1), firstDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().regex(/^proj_[A-Za-z0-9]+$/),
  agents: z.object({ discovery: z.string().regex(/^agent_[A-Za-z0-9]+$/), refresh: z.string().regex(/^agent_[A-Za-z0-9]+$/) }).strict(),
  directoryAccess: z.object({ authorizationRef: z.string().min(1), expiresAt: instant, read: z.boolean(), updatePublicEvidence: z.boolean() }).strict(),
  budget: z.object({ authorizationRef: z.string().min(1), expiresAt: instant,
    dailySoftUsd: z.number().positive(), perRunReservationUsd: z.number().positive() }).strict(),
  executionWindowMs: z.number().int().min(60000).max(3600000).default(20 * 60 * 1000),
  semanticEnabled: z.boolean().default(false),
  mcpReadTools: z.record(z.array(z.string().min(1))).default({}),
}).strict();
export type IntelligenceControl = z.infer<typeof intelligenceControlSchema>;

/** Calendar periods are stable across DST and observer restarts. A missed
 * Monday is caught up in that week; transport polling frequency is not cadence. */
export function dueRobotTeamJobs(control: IntelligenceControl, now: Date): Array<{ id: string; kind: RobotTeamJobKind; date: string }> {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: control.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (key: string) => parts.find(part => part.type === key)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  if (date < control.firstDate || (date === control.firstDate && Number(get("hour")) < control.hour)) return [];
  const local = new Date(`${date}T12:00:00Z`), distance = (local.getUTCDay() - control.weeklyDay + 7) % 7;
  const weekly = new Date(local); weekly.setUTCDate(local.getUTCDate() - distance);
  const weekDate = weekly.toISOString().slice(0, 10);
  const jobs: Array<{ id: string; kind: RobotTeamJobKind; date: string }> = [];
  if (date.slice(8) !== "01" || Number(get("hour")) >= control.hour) {
    const monthDate = `${date.slice(0, 7)}-01`;
    if (monthDate >= control.firstDate) jobs.push({ id: `monthly_review-${date.slice(0, 7)}`, kind: "monthly_review", date: monthDate });
  }
  if (weekDate >= control.firstDate && (distance > 0 || Number(get("hour")) >= control.hour)) {
    jobs.push({ id: `weekly_discovery-${weekDate}`, kind: "weekly_discovery", date: weekDate },
      { id: `weekly_refresh-${weekDate}`, kind: "weekly_refresh", date: weekDate });
  }
  return jobs;
}

export function assertIntelligenceAccess(control: IntelligenceControl, now: string, mutation = false) {
  if (!control.enabled) throw new Error("robot_intelligence_disabled");
  if (!control.directoryAccess.read || Date.parse(control.directoryAccess.expiresAt) <= Date.parse(now)) throw new Error("robot_directory_access_expired_or_missing");
  if (mutation && !control.directoryAccess.updatePublicEvidence) throw new Error("robot_directory_update_access_missing");
}
