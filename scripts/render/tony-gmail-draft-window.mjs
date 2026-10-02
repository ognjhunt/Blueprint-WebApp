import { pathToFileURL } from "node:url";

// Fixed, nonsecret scope approved by this thread's 2026-10-02 owner reply:
// ["request_user_input_async","call_WPD6LNdwi8lTSCz8gFyTKNX3",0]
// "Approve compose and one draft only". No arbitrary service/key/value input.
const serviceId = "srv-d4vnmk3e5dus73aiohk0";
const prefix = "BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_";
const enabledKey = "BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED";
const approved = {
  [`${prefix}APPROVAL_REF`]: "BP-APPROVAL-GMAIL-DRAFT-20261002-TONY",
  [`${prefix}APPROVED_JOB_ID`]: "8bd2e1ad55b127866236c5ffd0872a59f6434ed378fa9dea319a53daedf8f0d0",
  [`${prefix}APPROVED_REVISION_ID`]: "6554668d42ff72712f4d656afaeaedb0c2590dfb2956afe1fa510faec28d118d",
  [`${prefix}APPROVED_REVIEW_DIGEST`]: "26fecd10fcecd41f900ab4e4b1a0ff73c0002557bc9df00d1819ec546e3bd725",
};

export async function configureTonyDraftWindow(operation, apiKey, request = fetch) {
  if (!["inspect", "prepare-consent", "open-one-draft", "close-one-draft"].includes(operation)) throw new Error("fixed_operation_required");
  if (!apiKey) throw new Error("existing_actions_render_key_required");
  const endpoint = key => `https://api.render.com/v1/services/${serviceId}/env-vars/${key}`;
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const read = async key => {
    const response = await request(endpoint(key), { headers, signal: AbortSignal.timeout(20000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`render_key_read_failed:${key}:HTTP${response.status}`);
    const result = await response.json();
    if (result.key !== key || typeof result.value !== "string") throw new Error(`render_key_readback_shape_invalid:${key}`);
    return result.value;
  };
  const write = async (key, value) => {
    const response = await request(endpoint(key), { method: "PUT", headers, body: JSON.stringify({ value }), signal: AbortSignal.timeout(20000) });
    // Never echo or retain a provider response body. Uncertain PUT is recovered
    // by another individual-key GET; no bulk env replacement or blind retry.
    if (!response.ok) throw new Error(`render_key_write_failed:${key}:HTTP${response.status}`);
    if (await read(key) !== value) throw new Error(`render_key_readback_mismatch:${key}`);
  };
  let writes = 0;
  if (operation !== "inspect") {
    const current = {};
    for (const key of Object.keys(approved)) current[key] = await read(key);
    const enabled = await read(enabledKey);
    if (enabled !== null && !["true", "false"].includes(enabled)) throw new Error("draft_flag_not_boolean");
    for (const [key, expected] of Object.entries(approved)) {
      if (current[key] !== null && current[key] !== expected) throw new Error(`conflicting_approval_window:${key}`);
      if (operation !== "prepare-consent" && current[key] !== expected) throw new Error(`prepare_consent_required:${key}`);
    }
    if (operation === "prepare-consent") {
      if (enabled === "true") throw new Error("close_existing_draft_window_before_preparing");
      await write(enabledKey, "false"); writes++;
      for (const [key, value] of Object.entries(approved)) if (current[key] !== value) { await write(key, value); writes++; }
    } else { await write(enabledKey, operation === "open-one-draft" ? "true" : "false"); writes++; }
  }
  const matches = {};
  for (const [key, value] of Object.entries(approved)) matches[key] = await read(key) === value;
  const enabled = await read(enabledKey);
  return { operation, serviceId, writes, approvalScopeMatches: matches, draftFlagConfigured: enabled === "true" ? true : enabled === "false" ? false : null,
    runtimeObserved: false, deployTriggered: false, founderConsentPerformed: false, mailboxWrites: 0, sends: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  configureTonyDraftWindow(process.argv[2] ?? "inspect", process.env.RENDER_API_KEY)
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error("Fixed Tony draft configuration failed; no provider response or credential was logged. Inspect the five allowlisted keys before retry; config readback does not prove runtime activation."); process.exitCode = 1; });
}
