/** Read-only preview for a separately approved Blueprint-funded development site.
 * node --import tsx scripts/preview-website-development-site-test.ts <request-id>
 * Set the printed exact digest list in BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS
 * on both website surfaces only after the owner has authorized that request's
 * bounded development-test sponsorship. This script never writes a grant.
 */
import admin from "firebase-admin";
import { dbAdmin as db } from "../client/src/lib/firebaseAdmin";
import { developmentTestSiteEligible } from "../server/utils/websiteSceneSponsorship";
import { type SiteTaskBriefRecord } from "../server/utils/siteTaskBrief";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../server/utils/websiteTaskContext";

const requestId = process.argv[2] ?? "";
try {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(requestId) || process.argv.length !== 3)
    throw new Error("Expected one website request id");
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const [site, brief] = await Promise.all([
    db.collection("inboundRequests").doc(requestId).get(),
    db.collection("siteTaskBriefs").doc(requestId).get(),
  ]);
  if (!site.exists || !brief.exists) throw new Error("task_brief_missing");
  const record = site.data()!;
  const rights = projectWebsiteCaptureRights(record);
  const context = projectWebsiteTaskContext(brief.data() as SiteTaskBriefRecord, rights);
  if (!context.confirmed || !rights.derived_scene_generation_allowed
    || !developmentTestSiteEligible(record))
    throw new Error("website_development_site_test_ineligible");
  console.log(JSON.stringify({ request_id: requestId,
    task_context_digest: context.context_digest,
    site_claimed: Boolean(record.account_owner_uid),
    triage_disposition: record.site_task_triage.disposition,
    unresolved_gates: record.site_task_triage.unanswered_field_ids,
    config_name: "BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS",
    exact_config_value: JSON.stringify([context.context_digest]),
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "website_development_site_test_preview_failed");
  process.exitCode = 1;
} finally {
  await Promise.all(admin.apps.map(app => app?.delete()));
}
