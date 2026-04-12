import { getHumanReplyGmailDurabilityStatus } from "../../server/utils/human-reply-gmail";

async function main() {
  const status = await getHumanReplyGmailDurabilityStatus();

  console.log(
    JSON.stringify(
      {
        ok: status.production_ready,
        ...status,
      },
      null,
      2,
    ),
  );

  if (!status.production_ready) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
