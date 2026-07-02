import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";
import type { UploadTaskSnapshot } from "firebase/storage";

import { auth, storage } from "@/lib/firebase";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

export type ClientStorageProvider = "firebase" | "backblaze";

export type AppStorageUploadResult = {
  provider: ClientStorageProvider;
  path: string;
  url: string;
};

type UploadSource = Blob | Uint8Array | ArrayBuffer;

export type AppStorageUploadInput = {
  path: string;
  data: UploadSource;
  fileName?: string;
  contentType?: string;
  onProgress?: (progress: number) => void;
};

export function getConfiguredClientStorageProvider(): ClientStorageProvider {
  const provider = String(import.meta.env.VITE_BLUEPRINT_STORAGE_PROVIDER || "firebase")
    .trim()
    .toLowerCase();
  return provider === "backblaze" || provider === "b2" || provider === "backblaze-b2"
    ? "backblaze"
    : "firebase";
}

function toBlob(data: UploadSource, contentType?: string) {
  if (data instanceof Blob) {
    return data;
  }
  return new Blob([data], { type: contentType || "application/octet-stream" });
}

async function uploadToFirebase(input: AppStorageUploadInput): Promise<AppStorageUploadResult> {
  const storageRef = ref(storage, input.path);
  if (input.onProgress) {
    const task = uploadBytesResumable(storageRef, input.data, {
      contentType: input.contentType,
    });
    await new Promise<UploadTaskSnapshot>((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          const total = snapshot.totalBytes || 1;
          input.onProgress?.(Math.round((snapshot.bytesTransferred / total) * 100));
        },
        reject,
        () => resolve(task.snapshot),
      );
    });
  } else {
    await uploadBytes(storageRef, input.data, {
      contentType: input.contentType,
    });
  }

  const url = await getDownloadURL(storageRef);
  return {
    provider: "firebase",
    path: input.path,
    url,
  };
}

async function uploadToBackblaze(input: AppStorageUploadInput): Promise<AppStorageUploadResult> {
  const fileName = input.fileName || input.path.split("/").pop() || "upload.bin";
  const body = new FormData();
  body.set("path", input.path);
  body.set("file", toBlob(input.data, input.contentType), fileName);
  input.onProgress?.(1);

  const response = await fetch("/api/storage/uploads", {
    method: "POST",
    credentials: "include",
    headers: await withFirebaseAuthHeaders(auth.currentUser, await withCsrfHeader()),
    body,
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    provider?: string;
    objectPath?: string;
    url?: string;
  };
  if (!payload.url || !payload.objectPath) {
    throw new Error("Storage upload response was missing url or objectPath.");
  }
  input.onProgress?.(100);

  return {
    provider: "backblaze",
    path: payload.objectPath,
    url: payload.url,
  };
}

export async function uploadAppStorageObject(
  input: AppStorageUploadInput,
): Promise<AppStorageUploadResult> {
  const provider = getConfiguredClientStorageProvider();
  return provider === "backblaze" ? uploadToBackblaze(input) : uploadToFirebase(input);
}
