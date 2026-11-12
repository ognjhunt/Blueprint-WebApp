/** Requeues one video reading that used up its automatic attempts. Requires an explicit owner approval to apply;
 * defaults to a read-only preview that lists every check and every change.
 * node --env-file=<existing-env> --import tsx scripts/requeue-capture-coverage-review.ts
 *   <request-id> [--apply --approved-by <owner-user-id> --approval-evidence <text>]
 */
import admin from "firebase-admin";
import { parseRequeueArgs, printableRequeueResult, requeueExhaustedCoverageReview } from "../server/utils/captureCoverageRequeue";

try {
  const { requestId, apply, approval } = parseRequeueArgs(process.argv.slice(2));
  const result = await requeueExhaustedCoverageReview(requestId, { apply, approval });
  console.log(JSON.stringify(printableRequeueResult(requestId, apply, result), null, 2));
  if (result.outcome === "refused") process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "capture_coverage_requeue_failed");
  process.exitCode = 1;
} finally {
  await Promise.all(admin.apps.map(app => app?.delete()));
}
