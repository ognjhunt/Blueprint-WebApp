import { buildOutboundReplyDurabilityStatus } from "../../server/utils/outbound-reply-durability";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const allowNotReady = hasFlag("--allow-not-ready");
  const status = await buildOutboundReplyDurabilityStatus();

  console.log(JSON.stringify(status, null, 2));

  if (!status.ok && !allowNotReady) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
