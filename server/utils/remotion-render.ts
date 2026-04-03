import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import type { ProductReelInput } from "./creative-pipeline";

let bundlePromise: Promise<string> | null = null;

function productReelEntryPoint() {
  return fileURLToPath(new URL("../remotion/index.ts", import.meta.url));
}

async function bundledServeUrl() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: productReelEntryPoint(),
    });
  }

  return bundlePromise;
}

export async function renderProductReel(input: ProductReelInput) {
  if (!Array.isArray(input.storyboard) || input.storyboard.length === 0) {
    throw new Error("Remotion product reel requires a non-empty storyboard.");
  }

  if (!Array.isArray(input.images) || input.images.length === 0) {
    throw new Error("Remotion product reel requires at least one generated image.");
  }

  const inputProps = input as ProductReelInput & Record<string, unknown>;
  const serveUrl = await bundledServeUrl();
  const composition = await selectComposition({
    serveUrl,
    id: "BlueprintProductReel",
    inputProps,
  });

  const outputDirectory = await mkdtemp(join(tmpdir(), "blueprint-product-reel-"));
  const outputPath = join(outputDirectory, "product-reel.mp4");

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
  });

  let storageUri: string | null = null;
  if (storageAdmin && input.storageObjectPath?.trim()) {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
    const objectPath = input.storageObjectPath.trim().replace(/^\/+/, "");
    const buffer = await readFile(outputPath);
    await storageAdmin.bucket(bucketName).file(objectPath).save(buffer, {
      resumable: false,
      contentType: "video/mp4",
      metadata: {
        cacheControl: "public,max-age=31536000,immutable",
      },
    });
    storageUri = `gs://${bucketName}/${objectPath}`;
  }

  return {
    outputPath,
    storageUri,
    durationSeconds: composition.durationInFrames / composition.fps,
    frames: composition.durationInFrames,
  };
}
