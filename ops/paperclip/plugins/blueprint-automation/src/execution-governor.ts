type AgentStatusMap = Record<string, string | null | undefined>;

export type AssignmentResolution = {
  assigneeKey: string;
  rerouted: boolean;
  attempted: string[];
};

export type RoutineExecutionPolicy = {
  concurrencyPolicy: "coalesce_if_active" | "skip_if_active" | "always_enqueue";
  catchUpPolicy: "skip_missed" | "enqueue_missed_with_cap";
};

export type ScheduleTriggerLike = {
  cronExpression?: string | null;
  timezone?: string | null;
  nextRunAt?: string | null;
  lastFiredAt?: string | null;
  enabled?: boolean | null;
};

export type RoutineExecutionIssueLike = {
  originKind?: string | null;
  executionRunId?: string | null;
  status?: string | null;
  updatedAt?: string | null;
};

type ManagementRouting = {
  chiefOfStaffKey: string;
  ctoKey: string;
  ceoKey: string;
};

const NON_OPERATIONAL_AGENT_STATUSES = new Set(["error", "archived", "deleted"]);

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.length > 0))];
}

export function isAgentOperational(status: string | null | undefined) {
  const normalized = normalizeKey(status);
  if (!normalized) return true;
  return !NON_OPERATIONAL_AGENT_STATUSES.has(normalized);
}

function fallbackChainForAgent(preferredKey: string, management: ManagementRouting) {
  const normalized = normalizeKey(preferredKey);
  const projectFallbacks: Record<string, string[]> = {
    "webapp-codex": ["webapp-review", management.ctoKey, management.chiefOfStaffKey],
    "webapp-review": ["webapp-codex", management.ctoKey, management.chiefOfStaffKey],
    "pipeline-codex": ["pipeline-review", management.ctoKey, management.chiefOfStaffKey],
    "pipeline-review": ["pipeline-codex", management.ctoKey, management.chiefOfStaffKey],
    "capture-codex": ["capture-review", management.ctoKey, management.chiefOfStaffKey],
    "capture-review": ["capture-codex", management.ctoKey, management.chiefOfStaffKey],
    "blueprint-chief-of-staff": [management.ctoKey],
    "blueprint-cto": [management.chiefOfStaffKey],
    "blueprint-ceo": [management.chiefOfStaffKey],
    "ops-lead": [management.chiefOfStaffKey, management.ctoKey],
    "intake-agent": ["ops-lead", management.chiefOfStaffKey],
    "capture-qa-agent": ["ops-lead", management.chiefOfStaffKey],
    "field-ops-agent": ["ops-lead", management.chiefOfStaffKey],
    "finance-support-agent": ["ops-lead", management.chiefOfStaffKey],
    "growth-lead": [management.chiefOfStaffKey, management.ctoKey],
    "conversion-agent": [management.ctoKey, management.chiefOfStaffKey],
    "docs-agent": [management.ctoKey, management.chiefOfStaffKey],
  };

  if (projectFallbacks[normalized]) {
    return projectFallbacks[normalized];
  }

  if (
    normalized.includes("market-intel")
    || normalized.includes("demand-intel")
    || normalized.includes("city-demand")
    || normalized.includes("supply-intel")
    || normalized.includes("capturer-growth")
    || normalized.includes("robot-team-growth")
    || normalized.includes("site-operator")
    || normalized.includes("community")
    || normalized.includes("investor")
    || normalized.includes("revenue-ops")
    || normalized.includes("buyer-")
    || normalized.includes("solutions-engineering")
    || normalized.includes("security-procurement")
    || normalized.includes("site-catalog")
    || normalized.includes("outbound-sales")
  ) {
    return ["growth-lead", management.chiefOfStaffKey, management.ctoKey];
  }

  return [management.chiefOfStaffKey, management.ctoKey, management.ceoKey];
}

export function selectHealthyAgentKey(
  preferredKey: string,
  statuses: AgentStatusMap,
  management: ManagementRouting,
): AssignmentResolution {
  const normalizedPreferred = normalizeKey(preferredKey);
  const attempted = unique([
    normalizedPreferred,
    ...fallbackChainForAgent(normalizedPreferred, management).map((entry) => normalizeKey(entry)),
  ]);

  for (const candidate of attempted) {
    if (!candidate) continue;
    if (candidate in statuses && isAgentOperational(statuses[candidate])) {
      return {
        assigneeKey: candidate,
        rerouted: candidate !== normalizedPreferred,
        attempted,
      };
    }
  }

  return {
    assigneeKey: normalizedPreferred,
    rerouted: false,
    attempted,
  };
}

export function recommendedRoutineExecutionPolicy(): RoutineExecutionPolicy {
  return {
    concurrencyPolicy: "always_enqueue",
    catchUpPolicy: "enqueue_missed_with_cap",
  };
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    weekday: WEEKDAY_INDEX_BY_NAME[parts.weekday.slice(0, 3).toLowerCase()],
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function parseNumericSet(token: string, min: number, max: number) {
  if (token === "*") {
    return new Set(Array.from({ length: max - min + 1 }, (_, index) => min + index));
  }

  const values = new Set<number>();
  for (const segment of token.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    if (trimmed.includes("-")) {
      const [startRaw, endRaw] = trimmed.split("-", 2);
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
      for (let value = start; value <= end; value += 1) values.add(value);
      continue;
    }
    const value = Number(trimmed);
    if (!Number.isInteger(value)) return null;
    values.add(value);
  }
  return values;
}

function sameScheduledWindow(
  left: Date,
  right: Date,
  cronExpression: string,
  timeZone: string,
) {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [, , dayOfMonth, month, dayOfWeek] = parts;
  const leftParts = zonedParts(left, timeZone);
  const rightParts = zonedParts(right, timeZone);

  if (leftParts.year !== rightParts.year || leftParts.month !== rightParts.month) return false;

  const sameDayOfMonth = dayOfMonth !== "*" && month !== "*" && leftParts.day === rightParts.day;
  const sameWeekday = dayOfWeek !== "*" && leftParts.weekday === rightParts.weekday;
  const dailyWindow = dayOfMonth === "*" && month === "*" && dayOfWeek === "*" && leftParts.day === rightParts.day;
  const weekdayWindow = dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5" && leftParts.day === rightParts.day;

  return sameDayOfMonth || sameWeekday || dailyWindow || weekdayWindow;
}

export function buildRoutineCatchUpWindowKey(trigger: ScheduleTriggerLike, now: Date = new Date()) {
  if (!trigger.cronExpression || !trigger.timezone) return null;
  const cronParts = trigger.cronExpression.trim().split(/\s+/);
  if (cronParts.length !== 5) return null;
  const [minuteToken, hourToken, dayOfMonthToken, monthToken, dayOfWeekToken] = cronParts;
  const allowedMinutes = parseNumericSet(minuteToken, 0, 59);
  const allowedHours = parseNumericSet(hourToken, 0, 23);
  const allowedDaysOfMonth = parseNumericSet(dayOfMonthToken, 1, 31);
  const allowedMonths = parseNumericSet(monthToken, 1, 12);
  const allowedDaysOfWeek = parseNumericSet(dayOfWeekToken, 0, 7);
  if (!allowedMinutes || !allowedHours || !allowedDaysOfMonth || !allowedMonths || !allowedDaysOfWeek) {
    return null;
  }
  const current = zonedParts(now, trigger.timezone);
  const normalizedWeekdays = new Set(
    [...allowedDaysOfWeek].map((value) => (value === 7 ? 0 : value)),
  );
  if (!allowedMonths.has(current.month)) return null;
  if (!allowedDaysOfMonth.has(current.day) && dayOfMonthToken !== "*") return null;
  if (!normalizedWeekdays.has(current.weekday) && dayOfWeekToken !== "*") return null;

  const currentMinutes = current.hour * 60 + current.minute;
  const scheduledMoments = [...allowedHours]
    .flatMap((hour) => [...allowedMinutes].map((minute) => hour * 60 + minute))
    .sort((left, right) => left - right);
  const latestScheduledMoment = scheduledMoments.filter((value) => value <= currentMinutes).pop();
  if (latestScheduledMoment === undefined) return null;

  const scheduledHour = Math.floor(latestScheduledMoment / 60);
  const scheduledMinute = latestScheduledMoment % 60;
  return `${current.year}-${String(current.month).padStart(2, "0")}-${String(current.day).padStart(2, "0")}:${String(scheduledHour).padStart(2, "0")}:${String(scheduledMinute).padStart(2, "0")}:${trigger.cronExpression}`;
}

export function shouldTriggerRoutineCatchUp(trigger: ScheduleTriggerLike, now: Date = new Date()) {
  if (trigger.enabled === false || !trigger.cronExpression || !trigger.timezone || !trigger.nextRunAt) {
    return false;
  }

  const cronParts = trigger.cronExpression.trim().split(/\s+/);
  if (cronParts.length !== 5) return false;

  const [minuteToken, hourToken, dayOfMonthToken, monthToken, dayOfWeekToken] = cronParts;
  const allowedMinutes = parseNumericSet(minuteToken, 0, 59);
  const allowedHours = parseNumericSet(hourToken, 0, 23);
  const allowedDaysOfMonth = parseNumericSet(dayOfMonthToken, 1, 31);
  const allowedMonths = parseNumericSet(monthToken, 1, 12);
  const allowedDaysOfWeek = parseNumericSet(dayOfWeekToken, 0, 7);

  if (!allowedMinutes || !allowedHours || !allowedDaysOfMonth || !allowedMonths || !allowedDaysOfWeek) {
    return false;
  }

  const current = zonedParts(now, trigger.timezone);
  const normalizedWeekdays = new Set(
    [...allowedDaysOfWeek].map((value) => (value === 7 ? 0 : value)),
  );

  if (!allowedMonths.has(current.month)) return false;
  if (!allowedDaysOfMonth.has(current.day) && dayOfMonthToken !== "*") return false;
  if (!normalizedWeekdays.has(current.weekday) && dayOfWeekToken !== "*") return false;

  const currentMinutes = current.hour * 60 + current.minute;
  const scheduledMoments = [...allowedHours]
    .flatMap((hour) => [...allowedMinutes].map((minute) => hour * 60 + minute))
    .sort((left, right) => left - right);
  const latestScheduledMoment = scheduledMoments.filter((value) => value <= currentMinutes).pop();
  if (latestScheduledMoment === undefined) return false;

  const nextRunAt = new Date(trigger.nextRunAt);
  if (Number.isNaN(nextRunAt.getTime()) || nextRunAt.getTime() <= now.getTime()) {
    return false;
  }

  if (!trigger.lastFiredAt) return true;

  const lastFiredAt = new Date(trigger.lastFiredAt);
  if (Number.isNaN(lastFiredAt.getTime())) return true;

  return !sameScheduledWindow(lastFiredAt, now, trigger.cronExpression, trigger.timezone);
}

export function isStaleRoutineExecutionIssue(
  issue: RoutineExecutionIssueLike | null | undefined,
  expectedIntervalHours: number | null | undefined,
  nowMs: number,
) {
  if (!issue) return false;
  if (issue.originKind !== "routine_execution") return false;
  if (typeof issue.executionRunId === "string" && issue.executionRunId.length > 0) return false;
  if (issue.status === "done" || issue.status === "cancelled") return false;
  if (!issue.updatedAt) return false;
  const updatedAtMs = Date.parse(issue.updatedAt);
  if (!Number.isFinite(updatedAtMs)) return false;
  const ageHours = (nowMs - updatedAtMs) / (1000 * 60 * 60);
  const resetThresholdHours = Math.max((expectedIntervalHours ?? 1) * 2, 6);
  return ageHours >= resetThresholdHours;
}
