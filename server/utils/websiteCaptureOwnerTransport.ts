/** One cancellable route deadline for authenticated, read-only Google REST calls. */
import { Gaxios, type GaxiosOptions } from "gaxios";
import { GoogleAuth } from "google-auth-library";
import { performance } from "node:perf_hooks";
import { Readable } from "node:stream";
import type { Response } from "express";
import { initializedFirebaseServiceAccountForRead } from "../../client/src/lib/firebaseAdmin";
import { decodeMaskedOwnerDocument, OWNER_FIRESTORE_FIELD_PATHS } from "./firestoreOwnerProjection";
import { strictBoundedProofJson } from "./strictBoundedProofJson";
import type { OwnerObservationDeps } from "./websiteCaptureOwnerObservation";

const GOOGLE_TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token";
const FIRESTORE_ORIGIN = "https://firestore.googleapis.com";
const STORAGE_ORIGIN = "https://storage.googleapis.com";

/** Overrides are local fixture inputs only; the HTTP route never supplies them. */
interface TransportOptions {
  serviceAccount?: Record<string, unknown>;
  bucket?: string;
  projectId?: string;
  tokenUrl?: string;
  firestoreOrigin?: string;
  storageOrigin?: string;
  disconnect?: Response;
}

function normalizedServiceAccount(raw: Record<string, unknown>) {
  const client_email = raw.client_email ?? raw.clientEmail;
  const private_key = raw.private_key ?? raw.privateKey;
  const project_id = raw.project_id ?? raw.projectId;
  if (raw.type !== "service_account" && raw.type !== undefined) throw new Error("owner_credential_mode_unavailable");
  if (typeof client_email !== "string" || !client_email.endsWith(".gserviceaccount.com")
      || typeof private_key !== "string" || !private_key.includes("PRIVATE KEY")
      || typeof project_id !== "string" || !/^[a-z][a-z0-9-]{2,62}$/.test(project_id)) {
    throw new Error("owner_credential_mode_unavailable");
  }
  return { type: "service_account", client_email, private_key, project_id };
}

export async function withWebsiteOwnerDeps<T>(
  remainingMs: number, action: (deps: OwnerObservationDeps) => Promise<T>, options: TransportOptions = {},
): Promise<T> {
  if (!Number.isInteger(remainingMs) || remainingMs < 1 || remainingMs > 10_000)
    throw new Error("capture_owner_deadline_invalid");
  const fixture = Boolean(options.serviceAccount || options.tokenUrl || options.firestoreOrigin || options.storageOrigin);
  if (fixture && process.env.NODE_ENV !== "test") throw new Error("capture_owner_fixture_unavailable");
  const rawIdentity = options.serviceAccount ?? initializedFirebaseServiceAccountForRead() as Record<string, unknown> | null;
  if (!rawIdentity) throw new Error("capture_owner_credential_mode_unavailable");
  const identity = normalizedServiceAccount(rawIdentity);
  const bucket = options.bucket ?? process.env.FIREBASE_STORAGE_BUCKET ?? "blueprint-8c1ca.appspot.com";
  const projectId = options.projectId ?? identity.project_id;
  if (projectId !== identity.project_id || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,250}$/.test(bucket))
    throw new Error("capture_owner_configuration_invalid");
  const controller = new AbortController();
  const deadline = performance.now() + remainingMs;
  let activeStream: Readable | null = null;
  const abort = () => {
    controller.abort();
    activeStream?.destroy(new Error("capture_owner_deadline"));
  };
  const timer = setTimeout(abort, remainingMs);
  const disconnect = () => { if (!options.disconnect?.writableEnded) abort(); };
  options.disconnect?.once("close", disconnect);
  const remaining = () => {
    const left = Math.floor(deadline - performance.now());
    if (controller.signal.aborted || left < 1) throw new Error("capture_owner_deadline");
    return left;
  };
  const client = new Gaxios();
  const bounded = <V>(request: GaxiosOptions, max: number) => client.request<V>({
    ...request, signal: controller.signal, timeout: remaining(), retry: false,
    maxRedirects: 0, size: max, maxContentLength: max,
  });
  try {
    const transporter = { request<V>(request: GaxiosOptions) {
      if (String(request.url) !== GOOGLE_TOKEN_URL) throw new Error("capture_owner_auth_endpoint_invalid");
      return bounded<V>({ ...request, url: options.tokenUrl ?? GOOGLE_TOKEN_URL }, 16_384);
    } };
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const authClient = auth.fromJSON(identity, { transporter });
    const access = await authClient.getAccessToken();
    if (!access.token || controller.signal.aborted) throw new Error("capture_owner_auth_unavailable");
    const headers = { Authorization: `Bearer ${access.token}`, Accept: "application/json",
      "Accept-Encoding": "identity" };
    const streamRequest = async (url: string, max: number): Promise<Buffer> => {
      const response = await bounded<Readable>({ url, method: "GET", headers,
        responseType: "stream", validateStatus: () => true }, max);
      const stream = response.data;
      if (!(stream instanceof Readable)) throw new Error("capture_owner_stream_invalid");
      activeStream = stream;
      try {
        if (response.status !== 200) throw new Error("capture_owner_source_unavailable");
        const responseHeaders = response.headers as unknown as Record<string, string> & { get?: (name: string) => string | null };
        const header = (name: string) => typeof responseHeaders.get === "function"
          ? responseHeaders.get(name) : responseHeaders[name] ?? null;
        const encoding = header("content-encoding");
        if (encoding && encoding.toLowerCase() !== "identity") throw new Error("capture_owner_encoding_invalid");
        const announced = header("content-length");
        if (announced && Number(announced) > max) throw new Error("capture_owner_source_oversize");
        const chunks: Buffer[] = [];
        let length = 0;
        for await (const part of stream) {
          remaining();
          const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
          length += chunk.length;
          if (length > max) throw new Error("capture_owner_source_oversize");
          chunks.push(chunk);
        }
        remaining();
        return Buffer.concat(chunks, length);
      } finally {
        if (!stream.destroyed) stream.destroy();
        activeStream = null;
      }
    };
    const firestoreOrigin = options.firestoreOrigin ?? FIRESTORE_ORIGIN;
    const storageOrigin = options.storageOrigin ?? STORAGE_ORIGIN;
    const metadata = async (name: string, generation: string | null) => {
      if (name.length > 4096 || !name.startsWith("scenes/") || name.includes("..")
          || generation !== null && !/^[1-9][0-9]{0,19}$/.test(generation))
        throw new Error("capture_owner_object_invalid");
      const query = new URLSearchParams({ fields: "name,generation,size,crc32c,md5Hash,metageneration" });
      if (generation) query.set("generation", generation);
      const url = `${storageOrigin}/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?${query}`;
      const parsed = strictBoundedProofJson(await streamRequest(url, 65_536), 65_536);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("capture_owner_metadata_invalid");
      return parsed as Record<string, unknown>;
    };
    const deps: OwnerObservationDeps = {
      bucket, now: () => Math.floor(Date.now() / 1000),
      async readRequest(requestId) {
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(requestId))
          throw new Error("capture_owner_request_invalid");
        const docName = `projects/${projectId}/databases/(default)/documents/inboundRequests/${requestId}`;
        const query = new URLSearchParams();
        for (const field of OWNER_FIRESTORE_FIELD_PATHS) query.append("mask.fieldPaths", field);
        const url = `${firestoreOrigin}/v1/${docName}?${query}`;
        try {
          return decodeMaskedOwnerDocument(await streamRequest(url, 65_536), docName);
        } catch (error) {
          if ((error as Error).message === "capture_owner_source_unavailable") return null;
          throw error;
        }
      },
      readMetadata: metadata,
      async readPinned(name, generation, limit) {
        const first = await metadata(name, generation);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1_048_576)
          throw new Error("capture_owner_limit_invalid");
        const query = new URLSearchParams({ alt: "media", generation });
        const url = `${storageOrigin}/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?${query}`;
        const bytes = await streamRequest(url, limit);
        const second = await metadata(name, generation);
        if (!/^(0|[1-9][0-9]*)$/.test(String(first.size))
            || Number(first.size) !== bytes.length || !Number.isSafeInteger(Number(first.size)))
          throw new Error("capture_owner_pinned_size_invalid");
        for (const key of ["name", "generation", "size", "crc32c", "metageneration"]) {
          if (first[key] !== second[key]) throw new Error("capture_owner_pinned_metadata_changed");
        }
        return { metadata: first, bytes };
      },
    };
    const result = await action(deps);
    remaining();
    return result;
  } finally {
    clearTimeout(timer);
    options.disconnect?.off("close", disconnect);
    abort();
  }
}
