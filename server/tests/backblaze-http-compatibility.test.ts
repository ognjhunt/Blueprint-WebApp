// @vitest-environment node
import { createHash } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";

// Resolve the same CommonJS Axios entry that the production B2 SDK uses.
const require = createRequire(import.meta.url);
const B2 = require("backblaze-b2");
const axios = require("axios") as typeof import("axios").default;

type RecordedRequest = {
  path: string;
  method: string | undefined;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

describe("Backblaze SDK HTTP compatibility", () => {
  let server: Server;
  let baseUrl: string;
  let b2: InstanceType<typeof B2>;
  let requests: RecordedRequest[];
  let downloadFailures: number;
  let uploadFailure: boolean;
  const bytes = Buffer.from([0, 255, 1, 128, 13, 10]);

  beforeEach(async () => {
    requests = [];
    downloadFailures = 0;
    uploadFailure = false;
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const path = req.url!;
      requests.push({ path, method: req.method, headers: req.headers, body: Buffer.concat(chunks) });
      res.setHeader("Content-Type", "application/json");
      if (path === "/authorize") {
        res.end(JSON.stringify({
          authorizationToken: "fixture-account-token", accountId: "fixture-account",
          apiUrl: baseUrl, downloadUrl: baseUrl,
        }));
      } else if (path === "/b2api/v2/b2_get_upload_url") {
        res.end(JSON.stringify({ uploadUrl: `${baseUrl}/upload`, authorizationToken: "fixture-upload-token" }));
      } else if (path === "/upload") {
        res.statusCode = uploadFailure ? 503 : 200;
        res.end(JSON.stringify(uploadFailure ? { code: "service_unavailable" } : { fileId: "fixture-file" }));
      } else if (path.startsWith("/file/")) {
        if (downloadFailures > 0) {
          downloadFailures--;
          res.statusCode = 503;
          res.end(JSON.stringify({ code: "service_unavailable" }));
        } else {
          res.setHeader("Content-Type", "application/octet-stream");
          res.end(bytes);
        }
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ code: "fixture_route_missing" }));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture failed to bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
    const httpAdapter = axios.getAdapter("http");
    b2 = new B2({
      applicationKeyId: "fixture-key-id", applicationKey: "fixture-secret",
      axios: {
        proxy: false, maxRedirects: 0,
        adapter: (config: InternalAxiosRequestConfig) => {
          if (new URL(config.url!).origin !== baseUrl) {
            throw new Error("HTTP fixture refused a non-loopback destination");
          }
          return httpAdapter(config);
        },
      },
      retry: { retries: 1, retryDelay: () => 0 },
    });
    await b2.authorize({ axiosOverride: { url: `${baseUrl}/authorize` } });
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("preserves authorization, JSON request bodies, binary uploads and downloads", async () => {
    const upload = await b2.getUploadUrl({ bucketId: "fixture-bucket" });
    const result = await b2.uploadFile({
      uploadUrl: upload.data.uploadUrl, uploadAuthToken: upload.data.authorizationToken,
      fileName: "captures/synthetic sample.bin", data: bytes, mime: "application/octet-stream",
    });
    expect(result.data.fileId).toBe("fixture-file");
    const download = await b2.downloadFileByName({
      bucketName: "fixture-bucket", fileName: "captures/synthetic sample.bin", responseType: "arraybuffer",
    });
    expect(Buffer.from(download.data)).toEqual(bytes);
    expect(requests[0].headers.authorization).toBe(`Basic ${Buffer.from("fixture-key-id:fixture-secret").toString("base64")}`);
    expect(JSON.parse(requests[1].body.toString())).toEqual({ bucketId: "fixture-bucket" });
    expect(requests[1].headers.authorization).toBe("fixture-account-token");
    expect(requests[2]).toMatchObject({ method: "POST", body: bytes, headers: {
      authorization: "fixture-upload-token", "content-type": "application/octet-stream",
      "content-length": String(bytes.length), "x-bz-file-name": "captures/synthetic%20sample.bin",
      "x-bz-content-sha1": createHash("sha1").update(bytes).digest("hex"),
    } });
    expect(requests[3]).toMatchObject({ method: "GET", path: "/file/fixture-bucket/captures/synthetic%20sample.bin",
      headers: { authorization: "fixture-account-token" } });
  });

  it("retries a transient download failure without corrupting binary output", async () => {
    downloadFailures = 1;
    const result = await b2.downloadFileByName({ bucketName: "fixture-bucket", fileName: "sample.bin", responseType: "arraybuffer" });
    expect(Buffer.from(result.data)).toEqual(bytes);
    expect(requests.filter((req) => req.path.startsWith("/file/"))).toHaveLength(2);
  });

  it("preserves provider error details without replaying a failed upload POST", async () => {
    uploadFailure = true;
    await expect(b2.uploadFile({ uploadUrl: `${baseUrl}/upload`, uploadAuthToken: "fixture-upload-token",
      fileName: "sample.bin", data: bytes })).rejects.toMatchObject({
      response: { status: 503, data: { code: "service_unavailable" } },
    });
    expect(requests.filter((req) => req.path === "/upload")).toHaveLength(1);
  });

  it("honors cancellation before sending another request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(b2.downloadFileByName({ bucketName: "fixture-bucket", fileName: "sample.bin",
      axiosOverride: { signal: controller.signal } })).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(requests).toHaveLength(1);
  });

  it("refuses external destinations before any HTTP request", async () => {
    await expect(b2.uploadFile({ uploadUrl: "https://provider.invalid/upload", uploadAuthToken: "fixture-token",
      fileName: "sample.bin", data: bytes })).rejects.toThrow("HTTP fixture refused a non-loopback destination");
    expect(requests).toHaveLength(1);
  });
});
