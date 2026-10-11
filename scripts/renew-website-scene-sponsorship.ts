import { parseArgs } from "node:util";

const help = `Usage:
  npx tsx scripts/renew-website-scene-sponsorship.ts --request-id ID --approved-by SPONSOR_UID --approval-reference TEXT
  npx tsx scripts/renew-website-scene-sponsorship.ts ... --apply --ack renew-expired-blueprint-preparation-sponsorship
Re-issues an expired Blueprint-funded scene-preparation grant under its identical recorded policy.
Without --apply it only prints the grant it would write. The sponsor's approval is required for --apply.`;

async function main() {
  const { values } = parseArgs({ options: { "request-id": { type: "string" }, "approved-by": { type: "string" },
    "approval-reference": { type: "string" }, ack: { type: "string" }, apply: { type: "boolean" }, help: { type: "boolean" } } });
  if (values.help) { console.log(help); return; }
  const requestId = values["request-id"], approvedBy = values["approved-by"], reference = values["approval-reference"];
  if (!requestId || !approvedBy || !reference) throw Error("renewal_arguments_required");
  process.env.LOG_LEVEL = "silent";
  const { renewExpiredWebsiteSceneSponsorship, SPONSORSHIP_RENEWAL_ACK } = await import("../server/utils/websiteSceneSponsorship");
  const apply = Boolean(values.apply);
  const renewed = await renewExpiredWebsiteSceneSponsorship(requestId, { approved_by: approvedBy, approval_reference: reference,
    ack: apply ? values.ack ?? "" : SPONSORSHIP_RENEWAL_ACK, apply });
  console.log(JSON.stringify({ applied: apply, authority_digest: renewed.authority_digest, renewal: renewed.renewal,
    task_context_digest: renewed.task_context_digest, policy_digest: renewed.policy_digest,
    expires_at: new Date(renewed.expires_at_epoch * 1000).toISOString(),
    caps_usd: { preparation: renewed.preparation_max_total_spend_usd, upstream: renewed.upstream_max_spend_usd,
      native: renewed.max_total_spend_usd }, max_paid_attempts: renewed.max_paid_attempts }, null, 2));
}

main().then(() => process.exit(0), error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
