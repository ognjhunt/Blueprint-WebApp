/** The existing signed WebApp→Pipeline client admission for website reads. */
import { createHmac, randomUUID } from "node:crypto";

/**
 * One canonical base URL, token and client id for every signed website read:
 * `CAPTURE_LIFECYCLE_PIPELINE_BASE_URL`, else `CAPTURE_UPLOAD_INTAKE_FORWARD_URL`
 * without `/capture-upload-intakes`, signed with `CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN`
 * over `${timestamp}.${client}.${nonce}.${body}`. Only the origin is kept, so a
 * caller can never be pointed at a configured path. Null when not configured or
 * when the origin carries credentials or is not HTTPS (loopback HTTP in tests only).
 */
export function signedWebsitePipelineRequest(pathname: string, body: string, search?: Record<string, string>) {
  const configured = process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL
    || process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL?.replace(/\/capture-upload-intakes\/?$/, "");
  const token = process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN;
  if (!configured || !token) return null;
  const url = new URL(configured);
  if (url.username || url.password || (url.protocol !== "https:" && !(process.env.NODE_ENV === "test"
    && url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) return null;
  url.pathname = pathname; url.search = search ? new URLSearchParams(search).toString() : ""; url.hash = "";
  const timestamp = new Date().toISOString(), nonce = randomUUID();
  const client = "blueprint-webapp";
  const signature = createHmac("sha256", token).update(`${timestamp}.${client}.${nonce}.${body}`).digest("hex");
  return { url, headers: { "x-blueprint-pipeline-timestamp": timestamp, "x-blueprint-pipeline-client-id": client,
    "x-blueprint-pipeline-nonce": nonce, "x-blueprint-pipeline-signature": `sha256=${signature}` } };
}
