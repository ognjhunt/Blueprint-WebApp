// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const serverRoots = [
  "server/routes",
  "server/utils",
  "server/agents",
  "server/middleware",
  "server/constants",
];

function listTypeScriptFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(fullPath);
    }
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      return [];
    }
    return [fullPath];
  });
}

describe("server logging conventions", () => {
  it("keeps production server code on the structured logger instead of console output", () => {
    const files = serverRoots.flatMap((root) => listTypeScriptFiles(path.join(repoRoot, root)));
    const offenders = files
      .map((file) => ({
        file: path.relative(repoRoot, file),
        content: fs.readFileSync(file, "utf8"),
      }))
      .filter(({ content }) => /\bconsole\.(log|info|warn|error)\b/.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("keeps stable event names on the audited high-value logging paths", () => {
    const expectedEvents = new Map<string, string[]>([
      ["server/utils/email.ts", ["email_transport_unconfigured", "email_dispatch_failed"]],
      [
        "server/routes/contact.ts",
        [
          "contact_submission_rejected",
          "contact_form_firestore_required_unavailable",
          "contact_submission_email_processed",
        ],
      ],
      [
        "server/utils/idempotency.ts",
        ["idempotency_read_failed", "idempotency_store_failed"],
      ],
      [
        "server/utils/marketSignalProviderFirehose.ts",
        [
          "firehose_market_signals_config_unavailable",
          "firehose_market_signals_fetch_failed",
        ],
      ],
      [
        "server/routes/api/create-checkout-session.ts",
        ["stripe_checkout_session_create_failed"],
      ],
      [
        "server/routes/creator.ts",
        ["city_launch_candidate_paperclip_handoff_failed"],
      ],
      [
        "server/utils/cityLaunchCandidateReview.ts",
        ["city_launch_notification_dispatch_failed"],
      ],
    ]);

    for (const [relativePath, events] of expectedEvents.entries()) {
      const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      for (const event of events) {
        expect(content, `${relativePath} should keep ${event}`).toContain(event);
      }
    }
  });
});
