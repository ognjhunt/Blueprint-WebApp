export type TaskEvaluationResultAccessRecord = {
  owner_user_id: string;
  organization_id: string;
  access_visibility: "owner_only" | "organization_members" | "unlisted_public";
};

export function taskEvaluationResultAccessAllowed(
  record: TaskEvaluationResultAccessRecord,
  actor: { uid: string | null; tenantId: string; isOps: boolean },
) {
  if (record.access_visibility === "unlisted_public") return true;
  if (!actor.uid) return false;
  if (actor.isOps) return true;
  if (record.owner_user_id === actor.uid) return true;
  return record.access_visibility === "organization_members"
    && Boolean(actor.tenantId)
    && record.organization_id === actor.tenantId;
}
