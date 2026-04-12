import { runHumanReplyEmailWatcher } from "../../server/utils/human-reply-worker";

async function main() {
  const result = await runHumanReplyEmailWatcher({
    limit: Number(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_BATCH_SIZE ?? 25),
  });

  console.log(
    JSON.stringify(
      {
        ok: result.failedCount === 0,
        ...result,
      },
      null,
      2,
    ),
  );

  if (result.failedCount > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
