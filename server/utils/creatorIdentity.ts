import type { Request } from "express";

export function creatorIdFromRequest(req: Request): string {
  const headerValue = String(req.header("X-Blueprint-Creator-Id") || "").trim();
  const queryValue = String(req.query.creator_id || "").trim();
  const bodyValue =
    typeof req.body?.creator_id === "string" ? req.body.creator_id.trim() : "";

  return headerValue || queryValue || bodyValue;
}
