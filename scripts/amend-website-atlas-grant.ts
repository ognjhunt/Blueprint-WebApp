/** Raises one job's stored Atlas grant figure (its safety limit). Requires an explicit owner approval;
 * defaults to a read-only preview that prints exactly what would change.
 * node --env-file=<existing-env> --import tsx scripts/amend-website-atlas-grant.ts
 *   <request-id> <capture-id> <authorization-digest> <owner-user-id> <maximum-cost-usd> <approval-reference> <approved-on> [--apply]
 * <approved-on> is when the owner approved it, e.g. 2026-11-12 or 2026-11-12T09:30:00Z.
 */
import admin from "firebase-admin";
import { amendWebsiteAtlasGrantFigure } from "../server/utils/websiteSceneSponsorship";

const [requestId, captureId, authorizationDigest, approvedBy, maximum, approvalReference, approvedOn, mode] = process.argv.slice(2);
try {
  if (!requestId || !captureId || !authorizationDigest || !approvedBy || !maximum || !approvalReference || !approvedOn
    || (mode && mode !== "--apply") || process.argv.length > 10)
    throw new Error("Expected request, capture, grant authorization digest, owner, USD figure, approval reference, approval date, optional --apply");
  const result = await amendWebsiteAtlasGrantFigure(requestId, {
    capture_id: captureId, authorization_digest: authorizationDigest, maximum_cost_usd: Number(maximum),
    approved_by: approvedBy, approval_reference: approvalReference, approved_at_iso: approvedOn,
  }, mode === "--apply");
  console.log(JSON.stringify({ mode: mode === "--apply" ? "applied" : "preview", request_id: requestId, ...result }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "website_atlas_grant_amendment_failed");
  process.exitCode = 1;
} finally {
  await Promise.all(admin.apps.map(app => app?.delete()));
}
