type CommentLike = {
  authorAgentId?: string | null;
  body?: string | null;
  createdAt?: string | null;
};

const CLOSEOUT_MARKER = /^(##\s*(done|closeout)\b|closeout:|review complete\b)/i;
const PROOF_SIGNAL = /(`[^`]+`|https?:\/\/|www\.|notion\.so|github\.com|\bnpm run\b|\bnpx\b|\bverified\b|\bvalidated\b|\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+)/i;

function toTimestamp(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function isProofBearingCloseoutComment(body: string | null | undefined) {
  const normalized = (body ?? "").trim();
  if (!normalized) return false;
  return CLOSEOUT_MARKER.test(normalized) && PROOF_SIGNAL.test(normalized);
}

export function findAutoResolvableCloseoutComment(
  comments: CommentLike[],
  options: {
    issueUpdatedAt?: string | null;
    assigneeAgentId?: string | null;
  },
) {
  const updatedAt = toTimestamp(options.issueUpdatedAt);
  const assigneeAgentId = options.assigneeAgentId?.trim() ?? "";

  return [...comments]
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .find((comment) => {
      const authorAgentId = comment.authorAgentId?.trim() ?? "";
      if (!authorAgentId) {
        return false;
      }
      if (assigneeAgentId && authorAgentId !== assigneeAgentId) {
        return false;
      }
      if (!isProofBearingCloseoutComment(comment.body)) {
        return false;
      }
      return toTimestamp(comment.createdAt) >= updatedAt;
    }) ?? null;
}
