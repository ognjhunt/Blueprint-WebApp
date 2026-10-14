import { closeSync, fchmodSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ZodError } from "zod";
import { enqueueAccountNotice, prepareAccountNotice } from "../../server/utils/accountNotice";

async function main() {
  const { values } = parseArgs({ options: {
    help: { type: "boolean", default: false },
    input: { type: "string" },
    output: { type: "string", default: "output/email/account-notice/latest" },
    enqueue: { type: "boolean", default: false },
  } });
  if (values.help || !values.input) {
    console.log("Usage: npm run email:account-notice -- --input notice.json [--output directory] [--enqueue]");
    if (!values.help) process.exitCode = 1;
    return;
  }
  const input = JSON.parse(readFileSync(values.input, "utf8"));
  const { entry, message } = prepareAccountNotice(input);
  const output = values.output!;
  mkdirSync(output, { recursive: true, mode: 0o700 });
  for (const [name, content] of [["notice.html", message.html], ["notice.txt", message.text],
    ["notice.json", JSON.stringify({ entry, message }, null, 2)]]) {
    const file = openSync(join(output, name), "w", 0o600);
    try { fchmodSync(file, 0o600); writeFileSync(file, content); }
    finally { closeSync(file); }
  }
  console.log(`Branded preview saved to ${output}.`);
  if (!values.enqueue) {
    console.log("Preview only; no services loaded and no notice enqueued or sent.");
    return;
  }
  // This creates live delivery intent: the existing outbox pump can send it.
  // Never add a Gmail fallback or call the pump to force immediate delivery.
  const result = await enqueueAccountNotice(input);
  console.log(JSON.stringify(result));
}

main().catch(error => {
  if (error instanceof ZodError)
    console.error(`Invalid account notice fields: ${error.issues.map(issue => issue.path.join(".") || "unknown fields").join(", ")}`);
  else if (error instanceof Error && /^account_notice_[a-z_]+$/.test(error.message))
    console.error(`${error.message}; inspect the queue before retrying with the same notice ID.`);
  else console.error("Account notice failed; inspect the input or queue state before retrying.");
  process.exitCode = 1;
});
