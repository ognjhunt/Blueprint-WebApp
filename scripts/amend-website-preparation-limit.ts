/** Requires an explicit owner approval; defaults to a read-only preview.
 * node --env-file=<existing-env> --import tsx scripts/amend-website-preparation-limit.ts
 *   <request-id> <authority-digest> <owner-user-id> <max-requests> <approval-reference> [--apply]
 */
import admin from "firebase-admin";
import { amendWebsitePreparationRequestLimit } from "../server/utils/websiteSceneSponsorship";

const [requestId, authorityDigest, approvedBy, maximum, approvalReference, mode] = process.argv.slice(2);
try {
  if (!requestId || !authorityDigest || !approvedBy || !maximum || !approvalReference
    || (mode && mode !== "--apply") || process.argv.length > 8)
    throw new Error("Expected request, authority digest, owner, maximum, approval reference, optional --apply");
  const receipt = await amendWebsitePreparationRequestLimit(requestId, {
    authority_digest: authorityDigest, max_requests: Number(maximum),
    approved_by: approvedBy, approval_reference: approvalReference,
  }, mode === "--apply");
  console.log(JSON.stringify({ mode: mode === "--apply" ? "applied" : "preview", request_id: requestId, receipt }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "website_preparation_amendment_failed");
  process.exitCode = 1;
} finally {
  await Promise.all(admin.apps.map(app => app?.delete()));
}
