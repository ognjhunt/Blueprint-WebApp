import { closeSync, fchmodSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ZodError } from "zod";
import { accountNoticeDigest, accountNoticeSchema, enqueueAccountNotice, previewAccountNotices } from "../../server/utils/accountNotice";
import { brandedEmail, CUSTOMER_JOB_EMAIL_IDENTITY } from "../../server/utils/emailLayout";

async function main() {
  const { values } = parseArgs({ options: {
    help: { type: "boolean", default: false }, input: { type: "string" }, reviewed: { type: "string" },
    output: { type: "string", default: "output/email/account-notice/latest" }, enqueue: { type: "boolean", default: false },
  } });
  if (values.help || !values.input) {
    console.log("Usage: npm run email:account-notice -- --input notice.json [--output directory] [--enqueue --reviewed selection.json]");
    if (!values.help) process.exitCode = 1;
    return;
  }
  const notice = accountNoticeSchema.parse(JSON.parse(readFileSync(values.input, "utf8")));
  // Never silently widen an approved list by scanning a new roster during enqueue.
  const selection = values.enqueue
    ? (values.reviewed ? JSON.parse(readFileSync(values.reviewed, "utf8")) : null)
    : await previewAccountNotices(notice);
  if (!selection || selection.schema !== "blueprint.account_notice_recipients.v1" || selection.complete !== true
    || selection.noticeDigest !== accountNoticeDigest(notice) || !Array.isArray(selection.recipients))
    throw new Error("account_notice_reviewed_selection_required");
  const message = { subject: notice.subject, ...CUSTOMER_JOB_EMAIL_IDENTITY, ...brandedEmail({ subject: notice.subject, text: notice.body }) };
  const output = values.output!;
  mkdirSync(output, { recursive: true, mode: 0o700 });
  function save(name: string, content: string) {
    const file = openSync(join(output, name), "w", 0o600);
    try { fchmodSync(file, 0o600); writeFileSync(file, content); } finally { closeSync(file); }
  }
  save("notice.html", message.html);
  save("notice.txt", message.text);
  save("selection.json", JSON.stringify(selection, null, 2));
  save("notice.json", JSON.stringify({ notice, message }, null, 2));
  const eligible = selection.recipients.filter(row => row?.state === "eligible");
  console.log(`Private preview saved to ${output}: ${eligible.length} eligible; ${selection.recipients.filter(row => row?.state === "excluded").length} excluded; ${selection.recipients.filter(row => row?.state === "held").length} held.`);
  if (!values.enqueue) { console.log("Read-only account audit; no notice enqueued or sent."); return; }
  // Explicit send authority is required for this exact saved selection. Every
  // eligible identity is re-read; stale rows cannot retarget a changed address.
  const results: unknown[] = [];
  save("enqueue-results.json", JSON.stringify(results, null, 2));
  for (const row of eligible) {
    try { results.push({ uid: row.uid, ...await enqueueAccountNotice(notice, row) }); }
    catch { results.push({ uid: row.uid, status: "review_required" }); }
    save("enqueue-results.json", JSON.stringify(results, null, 2));
  }
  if (results.some((row: any) => row.status === "review_required")) process.exitCode = 1;
  console.log("Enqueue results saved privately; inspect queue receipts before any retry.");
}
main().catch(error => {
  if (error instanceof ZodError)
    console.error(`Invalid account notice fields: ${error.issues.map(issue => issue.path.join(".") || "unknown fields").join(", ")}`);
  else if (error instanceof Error && /^account_notice_[a-z_]+$/.test(error.message)) console.error(error.message);
  else console.error("Account notice failed; no complete selection established. Inspect input and source access before retrying.");
  process.exitCode = 1;
});
