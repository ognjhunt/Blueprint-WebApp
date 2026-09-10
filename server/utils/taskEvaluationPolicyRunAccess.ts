export type PolicyRunActor = { uid: string | null; tenantId: string; isOps: boolean };

/** Shared private boundary for run progress and unpublished result links. */
export function taskEvaluationPolicyRunAccessAllowed(
  record: { owner_user_id?: unknown; team_namespace?: unknown }, actor: PolicyRunActor,
) {
  return Boolean(actor.uid) && (actor.isOps
    || (record.owner_user_id === actor.uid && record.team_namespace === `user:${actor.uid}`)
    || Boolean(actor.tenantId && actor.tenantId === record.team_namespace));
}
