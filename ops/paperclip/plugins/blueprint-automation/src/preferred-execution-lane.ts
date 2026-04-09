function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

const OVERSIGHT_LANE_KEYS = new Set([
  "blueprint-chief-of-staff",
  "blueprint-cto",
  "blueprint-ceo",
  "ops-lead",
  "growth-lead",
  "notion-manager-agent",
]);

export function isOversightExecutionLaneKey(value?: string | null) {
  const normalized = normalize(value);
  if (!normalized) {
    return false;
  }
  return OVERSIGHT_LANE_KEYS.has(normalized);
}

export function shouldPreservePreferredExecutionLane(input: {
  title: string;
  preferredAssignee?: string | null;
  sourceType?: string | null;
  parentId?: string | null;
}) {
  const preferredAssignee = normalize(input.preferredAssignee);
  if (!preferredAssignee || isOversightExecutionLaneKey(preferredAssignee)) {
    return false;
  }

  if (input.parentId) {
    return true;
  }

  const title = normalize(input.title);
  const sourceType = normalize(input.sourceType);

  if (sourceType === "notion-work-queue") {
    return true;
  }
  if (sourceType === "repo-dirty" || sourceType === "repo-branch-drift") {
    return true;
  }
  if (sourceType === "notion-drift" && title.includes("queue lifecycle")) {
    return true;
  }

  return (
    title.startsWith("notion work queue:")
    || title.startsWith("notion drift: conflicting queue lifecycle for")
    || title.startsWith("routine follow-through:")
    || title.startsWith("follow through:")
    || title.includes("unblock path")
    || title.includes("local worktree drift")
    || title.includes("branch drift")
  );
}
