export type WebsiteResultNotification = {
  schema_version: "task_evaluation_result_notification_projection.v1";
  record_id: string;
  run_id: string;
  run_result_digest: string;
  status: "pending" | "accepted" | "delivered" | "failed";
  attempts: number;
  accepted_at_iso: string | null;
  delivered_at_iso: string | null;
  failure_reason: string | null;
};

function timestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

/** Delivery state is a separately bound Website fact, not a rewrite of Pipeline's publication. */
export function projectWebsiteResultNotification(
  result: Record<string, any>,
  run: Record<string, any> | undefined,
): WebsiteResultNotification | null {
  const publication = result.publication;
  const projectionDigest = publication?.policy_canary_result?.projection_digest;
  const notification = run?.notification_delivery;
  const terminalState = publication?.result_status === "completed_unqualified" ? "completed" : publication?.result_status;
  if (!run || !notification || publication?.run_kind !== "internal_policy_canary"
    || run.run_kind !== "internal_policy_canary"
    || run.run_id !== publication.run_id || run.result_record_id !== result.record_id
    || run.owner_user_id !== result.owner_user_id || run.team_namespace !== result.organization_id
    || run.request_digest !== publication.request_digest
    || run.delivery_digest !== publication.result_delivery?.delivery_digest
    || typeof projectionDigest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(projectionDigest)
    || notification.run_result_digest !== projectionDigest
    || notification.terminal_state !== terminalState
    || !["pending", "accepted", "delivered", "failed"].includes(notification.status)
    || !Number.isSafeInteger(notification.attempts) || notification.attempts < 0) return null;
  return {
    schema_version: "task_evaluation_result_notification_projection.v1",
    record_id: result.record_id,
    run_id: run.run_id,
    run_result_digest: projectionDigest,
    status: notification.status,
    attempts: notification.attempts,
    accepted_at_iso: timestamp(notification.accepted_at_iso ?? notification.accepted_at),
    delivered_at_iso: timestamp(notification.delivered_at_iso ?? notification.delivered_at),
    // Provider error payloads can contain URLs/headers. Project a safe code only.
    failure_reason: notification.status === "failed"
      ? typeof notification.failure_reason === "string" && /^[a-z0-9_.:-]{1,120}$/i.test(notification.failure_reason)
        ? notification.failure_reason : "notification_delivery_failed"
      : null,
  };
}
