/** Give a held capture a fresh privacy-review budget; defaults to a read-only preview.
 * node --import tsx scripts/rescreen-held-capture.ts
 *   <request-id> <capture-id> <granted-by> <reason> [--apply]
 *
 * Only for a hold that is our own failure to get an answer (`pending`). A
 * capture the reviewer flagged (`rejected`) is refused. See
 * `grantPrivacyRescreen` in server/utils/capturePrivacyResume.ts.
 */
import admin from "firebase-admin";
import { grantPrivacyRescreen } from "../server/utils/capturePrivacyResume";

const [requestId, captureId, grantedBy, reason, mode] = process.argv.slice(2);
try {
  if (!requestId || !captureId || !grantedBy || !reason || (mode && mode !== "--apply") || process.argv.length > 7)
    throw new Error("Expected request, capture, granted-by, reason, optional --apply");
  const result = await grantPrivacyRescreen({ requestId, captureId, grantedBy, reason, apply: mode === "--apply" });
  console.log(JSON.stringify({ mode: result.applied ? "applied" : "preview", ...result.grant }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "rescreen_failed");
  process.exitCode = 1;
} finally {
  await Promise.all(admin.apps.map(app => app?.delete()));
}
