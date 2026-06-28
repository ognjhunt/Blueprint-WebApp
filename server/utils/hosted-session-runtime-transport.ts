import { execFile as execFileCallback } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

/**
 * Low-level HTTP transport for fetching binary payloads (render frames, media)
 * from a hosted session runtime.
 *
 * Three strategies are supported so the same call works across local dev and
 * production: the WHATWG `fetch` path (default in non-production), a `curl`
 * subprocess, and a raw Node `http`/`https` request. The strategy is selected
 * by env flags / NODE_ENV.
 */

function shouldUseNodeRuntimeHttp() {
  return process.env.BLUEPRINT_HOSTED_SESSION_USE_NODE_HTTP === "1" || process.env.NODE_ENV === "production";
}

function shouldUseCurlRuntimeHttp() {
  return process.env.BLUEPRINT_HOSTED_SESSION_USE_CURL === "1" || process.env.NODE_ENV === "production";
}

export async function runtimeBinaryRequest(url: string, timeoutMs: number) {
  if (!shouldUseNodeRuntimeHttp()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()) as Record<string, string>,
        body: Buffer.from(await response.arrayBuffer()),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  if (shouldUseCurlRuntimeHttp()) {
    const { stdout } = await execFile(
      "curl",
      [
        "--silent",
        "--show-error",
        "--location",
        "--http1.1",
        "--max-time",
        String(Math.ceil(timeoutMs / 1000)),
        "--write-out",
        "\n__BLUEPRINT_STATUS__:%{http_code}",
        url,
      ],
      {
        encoding: "buffer",
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const marker = Buffer.from("\n__BLUEPRINT_STATUS__:");
    const markerIndex = stdout.lastIndexOf(marker);
    if (markerIndex < 0) {
      throw new Error("curl runtime render request did not return an HTTP status marker");
    }
    const statusCode = Number(stdout.subarray(markerIndex + marker.length).toString("utf-8").trim() || "0");
    return {
      statusCode,
      headers: {} as Record<string, string>,
      body: stdout.subarray(0, markerIndex),
    };
  }

  const target = new URL(url);
  const requestFn = target.protocol === "https:" ? https.request : http.request;
  return await new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const request = requestFn(
      target,
      {
        method: "GET",
        headers: { connection: "close" },
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 500,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error(`Timed out after ${timeoutMs}ms waiting for runtime render.`));
    });
    request.on("error", reject);
    request.end();
  });
}
