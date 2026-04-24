import { getHumanReplyGmailDurabilityStatus } from "../../server/utils/human-reply-gmail";
import { runHumanReplyEmailWatcher } from "../../server/utils/human-reply-worker";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const requireProcessedReply = hasFlag("--require-processed-reply");
  const gmail = await getHumanReplyGmailDurabilityStatus();

  if (!gmail.production_ready || gmail.approved_identity !== "ohstnhunt@gmail.com") {
    console.log(
      JSON.stringify(
        {
          ok: false,
          phase: "gmail_durability",
          gmail,
          reason:
            gmail.approved_identity !== "ohstnhunt@gmail.com"
              ? "approved_identity_not_ohstnhunt"
              : gmail.reason || gmail.risk || "gmail_not_production_ready",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const watcher = await runHumanReplyEmailWatcher({
    limit: Number(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_BATCH_SIZE ?? 25),
  });

  const processedCount = Number(watcher.processedCount || 0);
  const ok =
    watcher.failedCount === 0
    && (!requireProcessedReply || processedCount > 0);

  console.log(
    JSON.stringify(
      {
        ok,
        phase: processedCount > 0 ? "gmail_reply_resume_processed" : "gmail_watcher_ready_no_new_reply",
        gmail,
        watcher,
        requireProcessedReply,
      },
      null,
      2,
    ),
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
