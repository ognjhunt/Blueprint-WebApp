/** Owner uploads on the existing capture bucket; parts never become source evidence. */
import {createHash} from "node:crypto";
import type {Bucket} from "@google-cloud/storage";
import {storageAdmin} from "../../client/src/lib/firebaseAdmin";
import {captureStorageBucketName} from "./siteCaptureBundleStorage";
import {composeParts, partPath, partsPrefix, savePart} from "./captureParts";
import type {CaptureDeletionReceipt, CaptureDownloadGrant, StoredCapturePart} from "./storage-provider";

export type FirebaseCaptureTarget = {
  ownerUid: string; sessionId: string; objectPath: string; contentType: string;
  sizeBytes: number; partSizeBytes: number; partCount: number;
};
export type FirebaseCapturePart = StoredCapturePart & {generation: string};
const segment = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g,
  value => `%${value.charCodeAt(0).toString(16).toUpperCase()}`);
export const firebaseCapturePrefix = (ownerUid: string, sessionId: string) =>
  `operations/capture-uploads/${segment(ownerUid)}/${segment(sessionId)}`;
const pendingPrefix = (target: FirebaseCaptureTarget) => `${firebaseCapturePrefix(target.ownerUid, target.sessionId)}/pending`;
function checkTarget(target: FirebaseCaptureTarget) {
  const prefix = firebaseCapturePrefix(target.ownerUid, target.sessionId);
  if (!target.ownerUid || !target.sessionId || !/^[A-Za-z0-9._-]+$/.test(target.sessionId)
    || !target.objectPath.startsWith(`${prefix}/${target.sessionId}.`)
    || target.objectPath.slice(prefix.length + 1).includes("/")
    || !Number.isSafeInteger(target.sizeBytes) || target.sizeBytes <= 0
    || !Number.isSafeInteger(target.partSizeBytes) || target.partSizeBytes <= 0
    || !Number.isSafeInteger(target.partCount) || target.partCount < 1
    || target.partCount !== Math.ceil(target.sizeBytes / target.partSizeBytes))
    throw Error("capture_firebase_binding_invalid");
}
function generation(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value))
    throw Error("capture_firebase_generation_missing");
  return value;
}

export function firebaseCaptureStorageForBucket(bucket: Bucket, bucketName: string) {
  const identity = async (target: FirebaseCaptureTarget, expectedGeneration?: string) => {
    checkTarget(target);
    const [metadata] = await bucket.file(target.objectPath,
      expectedGeneration ? {generation: expectedGeneration} : undefined).getMetadata();
    const value = generation(metadata.generation);
    if (Number(metadata.size) !== target.sizeBytes || (expectedGeneration && value !== expectedGeneration))
      throw Error("capture_firebase_object_changed");
    return {provider: "firebase" as const, fileId: value, objectPath: target.objectPath,
      bucketName, storageUri: `gs://${bucketName}/${target.objectPath}`};
  };
  const listParts = async (target: FirebaseCaptureTarget, receipts: FirebaseCapturePart[]) => {
    checkTarget(target);
    const [files] = await bucket.getFiles({prefix: `${partsPrefix(pendingPrefix(target))}/part-`});
    const known = new Map(files.map(file => [file.name, file.metadata]));
    const seen = new Set<number>();
    for (const receipt of receipts) {
      const number = receipt.partNumber;
      const expected = number === target.partCount ? target.sizeBytes - (number - 1) * target.partSizeBytes : target.partSizeBytes;
      if (!Number.isInteger(number) || number < 1 || number > target.partCount || seen.has(number)
        || receipt.contentLength !== expected || !/^[a-f0-9]{40}$/.test(receipt.contentSha1))
        throw Error("capture_firebase_part_binding_invalid");
      seen.add(number);
      const metadata = known.get(partPath(pendingPrefix(target), number - 1));
      generation(receipt.generation);
      if (metadata?.generation !== receipt.generation || Number(metadata.size) !== expected)
        throw Error("capture_firebase_part_changed");
    }
    return [...receipts].sort((a, b) => a.partNumber - b.partNumber);
  };
  return {
    storageUri: (target: FirebaseCaptureTarget) => {checkTarget(target); return `gs://${bucketName}/${target.objectPath}`;},
    async savePart(target: FirebaseCaptureTarget, number: number, body: Buffer, sha1: string): Promise<FirebaseCapturePart> {
      checkTarget(target);
      const length = number === target.partCount ? target.sizeBytes - (number - 1) * target.partSizeBytes : target.partSizeBytes;
      if (!Number.isInteger(number) || number < 1 || number > target.partCount || body.length !== length
        || createHash("sha1").update(body).digest("hex") !== sha1)
        throw Error("capture_firebase_part_bytes_invalid");
      await savePart({bucket: bucket as never, rawPrefix: pendingPrefix(target), index: number - 1, body});
      const [metadata] = await bucket.file(partPath(pendingPrefix(target), number - 1)).getMetadata();
      return {partNumber: number, contentLength: body.length, contentSha1: sha1, generation: generation(metadata.generation)};
    },
    listParts,
    async finish(target: FirebaseCaptureTarget, receipts: FirebaseCapturePart[]) {
      const verified = await listParts(target, receipts);
      if (verified.length !== target.partCount) throw Error("capture_firebase_parts_incomplete");
      const versions = new Map(verified.map(row => [partPath(pendingPrefix(target), row.partNumber - 1), row.generation]));
      const hashFiles = async (files: ReturnType<Bucket["file"]>[]) => {
        const hash = createHash("sha256"); let bytes = 0;
        for (const file of files) for await (const block of file.createReadStream()) {
          bytes += block.length;
          if (bytes > target.sizeBytes) throw Error("capture_firebase_composed_size_invalid");
          hash.update(block);
        }
        return {sha256: hash.digest("hex"), bytes};
      };
      // Existing compose machinery, with immutable source generations and
      // create-only intermediates. A retry reads its identical protected output.
      const composedBucket = {
        file: bucket.file.bind(bucket), getFiles: bucket.getFiles.bind(bucket),
        async combine(names: string[], destination: string) {
          const sources = names.map(name => {
            const version = generation(versions.get(name));
            // The installed GCS SDK serializes source generations as numbers.
            if (BigInt(version) > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("capture_firebase_generation_not_exact");
            const file = bucket.file(name, {generation: version});
            file.metadata.generation = version;
            return file;
          });
          let result;
          try {result = await bucket.combine(sources, destination, {ifGenerationMatch: 0});}
          catch (error) {
            if (Number((error as {code?: unknown}).code) !== 412) throw error;
            const file = bucket.file(destination), [metadata] = await file.getMetadata();
            const expected = await hashFiles(sources);
            const actual = await hashFiles([bucket.file(destination, {generation: generation(metadata.generation)})]);
            if (expected.sha256 !== actual.sha256 || expected.bytes !== actual.bytes)
              throw Error("capture_firebase_composed_bytes_conflict");
            result = [file, metadata];
          }
          versions.set(destination, generation((result[1] as {generation?: unknown}).generation));
          return result;
        },
      };
      const result = await composeParts({bucket: composedBucket as never, rawPrefix: pendingPrefix(target),
        objectPath: target.objectPath, ifGenerationMatch: 0, expectedParts: target.partCount});
      if (!result.ok) throw Error("capture_firebase_parts_incomplete");
      return identity(target, result.video.generation);
    },
    async uploadSmall(target: FirebaseCaptureTarget, body: Buffer) {
      checkTarget(target);
      if (body.length !== target.sizeBytes) throw Error("capture_firebase_source_size_invalid");
      try {await bucket.file(target.objectPath).save(body, {contentType: target.contentType,
        resumable: false, preconditionOpts: {ifGenerationMatch: 0}});}
      catch (error) {
        if (Number((error as {code?: unknown}).code) !== 412) throw error;
        const stored = await identity(target);
        const [bytes] = await bucket.file(target.objectPath, {generation: stored.fileId}).download();
        if (!bytes.equals(body)) throw Error("capture_firebase_source_bytes_conflict");
      }
      return identity(target);
    },
    async downloadGrant(target: FirebaseCaptureTarget, version: string): Promise<CaptureDownloadGrant> {
      const stored = await identity(target, generation(version));
      return {provider: "firebase", url: stored.storageUri, authorizationToken: "", generation: stored.fileId,
        expiresAtIso: new Date(Date.now() + 15 * 60_000).toISOString()};
    },
    async cleanupParts(target: FirebaseCaptureTarget) {
      checkTarget(target);
      const prefix = `${partsPrefix(pendingPrefix(target))}/`;
      const [files] = await bucket.getFiles({prefix});
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        await bucket.file(file.name, {generation: generation(metadata.generation)}).delete({ignoreNotFound: true});
      }
      const [remaining] = await bucket.getFiles({prefix});
      if (remaining.length) throw Error("capture_firebase_parts_cleanup_pending");
    },
    async deleteFile(target: FirebaseCaptureTarget, version: string): Promise<CaptureDeletionReceipt> {
      checkTarget(target); generation(version);
      let absent = false;
      try {await bucket.file(target.objectPath, {generation: version}).delete();}
      catch (error) {if (Number((error as {code?: unknown}).code) !== 404) throw error; absent = true;}
      return {provider: "firebase", fileId: version, fileName: target.objectPath,
        deletedAtIso: new Date().toISOString(), alreadyAbsent: absent};
    },
  };
}
export function resolveFirebaseCaptureStorage() {
  return storageAdmin ? firebaseCaptureStorageForBucket(storageAdmin.bucket(captureStorageBucketName()), captureStorageBucketName()) : null;
}
