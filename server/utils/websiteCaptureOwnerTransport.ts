/** One bounded deadline for the authenticated Firestore and GCS read path. */
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { OwnerObservationDeps } from "./websiteCaptureOwnerObservation";

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("capture_owner_deadline"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("capture_owner_deadline"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function boundedResponse(response: globalThis.Response, max: number): Promise<Buffer> {
  if (!response.ok || !response.body) throw new Error("capture_owner_source_unavailable");
  const announced = response.headers.get("content-length");
  if (announced && Number(announced) > max) throw new Error("capture_owner_source_oversize");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > max) throw new Error("capture_owner_source_oversize");
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks, length);
}

/** Uses Firebase Admin's configured credential; no separate key or bucket selector. */
export async function withWebsiteOwnerDeps<T>(
  remainingMs: number, action: (deps: OwnerObservationDeps) => Promise<T>,
): Promise<T> {
  if (!db || !Number.isInteger(remainingMs) || remainingMs < 1 || remainingMs > 10_000) {
    throw new Error("capture_owner_store_unavailable");
  }
  const store = db;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(remainingMs, 10_000));
  const signal = controller.signal;
  try {
    const credential = admin.app().options.credential;
    if (!credential) throw new Error("capture_owner_credential_unavailable");
    const access = await abortable(credential.getAccessToken(), signal);
    if (!access.access_token) throw new Error("capture_owner_credential_unavailable");
    const bucket = process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
    const endpoint = (name: string, generation: string | null, media: boolean) => {
      const base = media ? "https://storage.googleapis.com/download/storage/v1"
        : "https://storage.googleapis.com/storage/v1";
      const query = new URLSearchParams();
      if (generation) query.set("generation", generation);
      if (media) query.set("alt", "media");
      return `${base}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?${query}`;
    };
    const request = async (name: string, generation: string | null, media: boolean, max: number) => {
      if (signal.aborted) throw new Error("capture_owner_deadline");
      const response = await fetch(endpoint(name, generation, media), {
        headers: { Authorization: `Bearer ${access.access_token}` }, signal,
      });
      return boundedResponse(response, max);
    };
    const metadata = async (name: string, generation: string | null) => {
      const bytes = await request(name, generation, false, 65_536);
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("capture_owner_metadata_invalid");
      return value as Record<string, unknown>;
    };
    const deps: OwnerObservationDeps = {
      bucket, now: () => Math.floor(Date.now() / 1000),
      async readRequest(requestId) {
        const snapshot = await abortable(store.collection("inboundRequests").doc(requestId).get(), signal);
        if (!snapshot.exists) return null;
        const updateTime = snapshot.updateTime;
        if (!updateTime) throw new Error("capture_owner_timestamp_missing");
        return { data: snapshot.data() as Record<string, any>,
          updateTime: { seconds: updateTime.seconds, nanoseconds: updateTime.nanoseconds } };
      },
      readMetadata: metadata,
      async readPinned(name, generation, limit) {
        const first = await metadata(name, generation);
        const bytes = await request(name, generation, true, limit);
        const second = await metadata(name, generation);
        for (const key of ["name", "generation", "size", "crc32c", "metageneration"]) {
          if (first[key] !== second[key]) throw new Error("capture_owner_pinned_metadata_changed");
        }
        return { metadata: first, bytes };
      },
    };
    return await abortable(action(deps), signal);
  } finally { clearTimeout(timer); controller.abort(); }
}
