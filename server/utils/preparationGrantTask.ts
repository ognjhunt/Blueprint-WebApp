import { PLACEHOLDER_TASK_SUMMARY, type SiteTaskBriefRecord } from "./siteTaskBrief";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "./websiteTaskContext";

/** Records which retained preparation grant was issued before the site named its job. */
export const UNNAMED_TASK_GRANT_FIELD = "website_scene_sponsorship_unnamed_task";

/** Owner decision 2026-10-28: preparation starts from the received video, often before
 * the site has named its job. A preparation grant issued for the placeholder brief
 * authorized no task instructions, so the site's naming, corrections and confirmation
 * continue it -- same allowance, clock and spend history -- instead of stranding the job.
 * A grant issued for a named task, or carrying a per-task policy (managed authoring, a
 * development test site), stays bound to the task it was issued for. */
export function preparationGrantFollowsBrief(grant: Record<string, any> | undefined, input: {
  brief: SiteTaskBriefRecord; record: Record<string, any>; inventory?: TaskItemInventoryRecord | null;
}) {
  if (grant?.purpose !== "scene_preparation" || grant.agents_api_policy !== undefined
    || grant.development_test_site !== undefined) return false;
  const marker = input.record[UNNAMED_TASK_GRANT_FIELD];
  if (typeof marker === "string" && /^sha256:[a-f0-9]{64}$/.test(marker) && marker === grant.authority_digest) return true;
  // Grants issued before the marker: only a provable first naming of the placeholder task.
  return grant.task_context_digest === projectWebsiteTaskContext(
    { ...input.brief, summary: PLACEHOLDER_TASK_SUMMARY, confirmedAtIso: null },
    projectWebsiteCaptureRights(input.record), { inventory: input.inventory, purpose: "scene_preparation" }).context_digest;
}
