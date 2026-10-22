/** Operator-only IPC bridge to the same production reservation transaction. */
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { crossRuntimeDigest } from "../server/utils/crossRuntimeCanonical";

async function main() {
  const { values } = parseArgs({ options: { command: { type: "string" }, output: { type: "string" }, apply: { type: "boolean" } } });
  if (!values.command || !values.output) throw Error("atlas_operator_command_and_output_required");
  if (execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim())
    throw Error("atlas_operator_webapp_checkout_not_clean");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  const remote = execFileSync("git", ["ls-remote", "origin", `refs/heads/${branch}`], { encoding: "utf8" }).trim().split(/\s/)[0];
  if (!branch.startsWith("codex/") || remote !== commit) throw Error("atlas_operator_webapp_commit_not_retained");
  const command = JSON.parse(readFileSync(values.command, "utf8"));
  const { preparationSpendRequest, reserveWebsitePreparationSpend } = await import("../server/utils/websiteSceneSponsorship");
  const spend = preparationSpendRequest.parse(command.spend);
  if (spend.provider !== "world_labs_atlas") throw Error("atlas_operator_provider_invalid");
  if (!values.apply) { console.log(JSON.stringify({ status: "validated_command_only", spend, source_commit: commit })); return; }
  const token = process.env.PIPELINE_SYNC_TOKEN;
  if (!token) throw Error("pipeline_sync_token_missing");
  const admission = await reserveWebsitePreparationSpend(command.request_id, spend, command.capture_id);
  const now = Date.now() / 1000;
  const payload = { schema_version: "website_atlas_operator_admission.v1", request_id: command.request_id,
    capture_id: command.capture_id, source_commit: commit, issued_at_epoch: now,
    expires_at_epoch: Math.min(now + 600, admission.expires_at_epoch), admission };
  const signature = createHmac("sha256", token).update(crossRuntimeDigest(payload)).digest("hex");
  writeFileSync(values.output, JSON.stringify({ ...payload, signature }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ status: admission.status, source_commit: commit,
    allocation_binding_digest: admission.allocation_binding_digest, maximum_cost_usd: admission.maximum_cost_usd }));
}
main().then(() => process.exit(0), error => { console.error(error instanceof Error ? error.message : "atlas_operator_admission_failed"); process.exit(1); });
