import { createHmac, randomUUID } from "node:crypto";
import { robotConfigurationPreflightSchema } from "../../client/src/types/robotConfiguration";
import type { RobotEmbodiment } from "../../client/src/types/robotEmbodiment";
import { deploymentCatalogWithDigest } from "../../client/src/lib/deploymentEmbodimentSupport";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";

async function boundedResponseText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > 256_000) {
        await reader.cancel();
        throw new Error("Robot configuration response exceeded its size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

/** Reuse the existing signed Pipeline service; this action fetches no policy and grants no execution. */
export async function preflightRobotConfiguration(embodimentId: string, robot: RobotEmbodiment) {
  const configured = process.env.TASK_EVALUATION_RUN_PLAN_URL || process.env.TASK_EVALUATION_LAUNCH_URL
    || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL;
  const token = process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  if (!configured || !token) throw new Error("Robot configuration validation is not configured. The setup is saved; no execution was requested.");
  const url = new URL("/api/live-pipeline/deployment-embodiment-native-preflight", configured);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))
    || url.username || url.password) throw new Error("Robot configuration service address is invalid.");
  const request = { embodiment_id: embodimentId, robot_embodiment: robot };
  const body = JSON.stringify(request);
  const timestamp = new Date().toISOString(), nonce = randomUUID();
  const client = process.env.TASK_EVALUATION_RUN_FORWARD_CLIENT_ID || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_CLIENT_ID || "blueprint-webapp";
  const signature = createHmac("sha256", token).update(`${timestamp}.${client}.${nonce}.${body}`).digest("hex");
  const response = await fetch(url, { method: "POST", redirect: "error", body, signal: AbortSignal.timeout(60_000),
    headers: { "content-type": "application/json", "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-client-id": client, "x-blueprint-pipeline-nonce": nonce, "x-blueprint-pipeline-signature": `sha256=${signature}` } });
  const text = await boundedResponseText(response);
  const payload = JSON.parse(text);
  if (!response.ok) {
    const detail = typeof payload?.detail === "string" ? payload.detail.slice(0, 1000).replace(/[\x00-\x1f]/g, " ") : "";
    if (response.status === 422 && detail.startsWith("support_native_self_contained_usd_required"))
      throw new Error("This URL inspection supports self-contained USD files. Models with separate dependency files need existing operator staging and are checked during run preparation. The setup is saved and can still be requested.");
    throw new Error(response.status === 422 && detail ? `Robot configuration: ${detail}. The setup is saved.`
      : "Pipeline configuration validation is unavailable. The setup is saved; no execution was requested.");
  }
  const receipt = robotConfigurationPreflightSchema.parse(payload);
  const catalog = await deploymentCatalogWithDigest();
  if (receipt.embodiment_id !== embodimentId || receipt.catalog_digest !== catalog.catalog_digest
    || receipt.request_digest !== crossRuntimeDigest(request)
    || receipt.model.sha256 !== robot.model.sha256
    || crossRuntimeArtifactDigest(receipt, "preflight_digest") !== receipt.preflight_digest
    || (receipt.status === "configured_not_executed" && (!receipt.model_file_digest_verified || receipt.blockers.length)))
    throw new Error("Robot configuration response did not match the saved robot. Refresh before retrying.");
  return receipt;
}
