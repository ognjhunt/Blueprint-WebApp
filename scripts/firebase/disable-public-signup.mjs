#!/usr/bin/env node
/** Read by default. Apply only after the invitation-aware server is live. */
import admin from "firebase-admin";
import { google } from "googleapis";
import { pathToFileURL } from "node:url";

export async function disablePublicSignup(request, projectId, apply = false) {
  if (!/^[a-z][a-z0-9-]+$/.test(projectId)) throw new Error("A valid Firebase project ID is required.");
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const before = (await request({ url, method: "GET" })).data;
  const previouslyDisabled = before.client?.permissions?.disabledUserSignup === true;
  if (apply && !previouslyDisabled) await request({
    url, method: "PATCH", params: { updateMask: "client.permissions.disabledUserSignup" },
    data: { client: { permissions: { disabledUserSignup: true } } },
  });
  const after = apply ? (await request({ url, method: "GET" })).data : before;
  const disabledUserSignup = after.client?.permissions?.disabledUserSignup === true;
  if (apply && !disabledUserSignup) throw new Error("Firebase did not confirm the public-signup gate.");
  // Configuration responses can contain keys; emit only this bounded receipt.
  return { projectId, applied: apply && !previouslyDisabled, disabledUserSignup,
    disabledUserDeletion: after.client?.permissions?.disabledUserDeletion === true };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--apply"].includes(arg))) throw new Error("Usage: node scripts/firebase/disable-public-signup.mjs [--apply]");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
  const credentials = JSON.parse(raw);
  const projectId = credentials.project_id;
  if (projectId !== "blueprint-8c1ca") throw new Error("This release helper targets only the existing Blueprint Firebase project.");
  const { access_token } = await admin.credential.cert(credentials).getAccessToken();
  const client = new google.auth.OAuth2();
  client.setCredentials({ access_token });
  console.log(JSON.stringify(await disablePublicSignup(options => client.request({ ...options, timeout: 15000 }), projectId, args.includes("--apply"))));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Could not confirm Firebase public-signup permissions. No credentials were logged."); process.exitCode = 1; });
}
