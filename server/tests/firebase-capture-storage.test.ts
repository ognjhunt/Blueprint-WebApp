// @vitest-environment node
import {createHash} from "node:crypto";
import {Readable} from "node:stream";
import {CRC32C, type Bucket} from "@google-cloud/storage";
import {describe, expect, it, vi} from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({storageAdmin: null}));
import {firebaseCapturePrefix, firebaseCaptureStorageForBucket, type FirebaseCaptureTarget} from "../utils/firebaseCaptureStorage";

const sha1 = (bytes: Buffer) => createHash("sha1").update(bytes).digest("hex");
function memoryBucket() {
  let next = 7000;
  const objects = new Map<string, {bytes: Buffer; generation: string}>();
  const error = (code: number) => Object.assign(Error("storage status"), {code});
  const info = (name: string) => {
    const item = objects.get(name); if (!item) throw error(404);
    const crc = new CRC32C(); crc.update(item.bytes);
    return {name, size: String(item.bytes.length), generation: item.generation, crc32c: crc.toString()};
  };
  const write = (name: string, bytes: Buffer) => {
    objects.set(name, {bytes: Buffer.from(bytes), generation: String(++next)});
    return info(name);
  };
  const bucket = {
    file(name: string, options?: {generation: string}) {
      const get = () => {
        const item = objects.get(name);
        if (!item || (options?.generation && item.generation !== options.generation)) throw error(404);
        return item;
      };
      return {name, metadata: objects.has(name) ? info(name) : {},
        async getMetadata() {get(); return [info(name)];},
        async exists() {return [objects.has(name)];},
        async save(bytes: Buffer) {if (objects.has(name)) throw error(412); write(name, bytes);},
        async download() {return [Buffer.from(get().bytes)];},
        createReadStream() {return Readable.from([get().bytes]);},
        async delete(options?: {ignoreNotFound?: boolean}) {
          try {get(); objects.delete(name);} catch (e) {if (!options?.ignoreNotFound) throw e;}
        },
      };
    },
    async getFiles(options: {prefix: string}) {
      return [[...objects.keys()].filter(name => name.startsWith(options.prefix)).map(name => bucket.file(name))];
    },
    async combine(files: Array<{name: string; metadata: {generation: string}}>, destination: string, options: {ifGenerationMatch: number}) {
      expect(options.ifGenerationMatch).toBe(0);
      if (objects.has(destination)) throw error(412);
      const bytes = files.map(file => {
        const item = objects.get(file.name);
        if (!item || item.generation !== file.metadata.generation) throw error(404);
        return item.bytes;
      });
      const metadata = write(destination, Buffer.concat(bytes));
      return [bucket.file(destination), metadata];
    },
  };
  return {bucket: bucket as unknown as Bucket, objects, write};
}
function fixture() {
  const memory = memoryBucket();
  const target: FirebaseCaptureTarget = {ownerUid: "owner-1", sessionId: "capture-1",
    objectPath: `${firebaseCapturePrefix("owner-1", "capture-1")}/capture-1.mp4`, contentType: "video/mp4",
    sizeBytes: 4, partSizeBytes: 2, partCount: 2};
  return {...memory, target, storage: firebaseCaptureStorageForBucket(memory.bucket, "blueprint-8c1ca.appspot.com")};
}
async function parts(f: ReturnType<typeof fixture>) {
  return [await f.storage.savePart(f.target, 1, Buffer.from("ab"), sha1(Buffer.from("ab"))),
    await f.storage.savePart(f.target, 2, Buffer.from("cd"), sha1(Buffer.from("cd")))];
}

describe("owned Firebase capture byte custody", () => {
  it("composes exact ordered immutable parts and reconciles a lost completion without another object version", async () => {
    const f = fixture(), receipts = await parts(f);
    const first = await f.storage.finish(f.target, [...receipts].reverse());
    expect(f.objects.get(f.target.objectPath)?.bytes.toString()).toBe("abcd");
    const second = await f.storage.finish(f.target, receipts);
    expect(second.fileId).toBe(first.fileId);
    expect(second.storageUri).toBe(`gs://blueprint-8c1ca.appspot.com/${f.target.objectPath}`);
    const grant = await f.storage.downloadGrant(f.target, first.fileId);
    expect(grant).toMatchObject({provider: "firebase", generation: first.fileId, authorizationToken: ""});
    expect(grant.url.startsWith("gs://")).toBe(true);
    await f.storage.cleanupParts(f.target);
    expect([...f.objects.keys()]).toEqual([f.target.objectPath]);
  });
  it("reuses identical acknowledged parts and refuses changed bytes", async () => {
    const f = fixture(), first = await f.storage.savePart(f.target, 1, Buffer.from("ab"), sha1(Buffer.from("ab")));
    expect(await f.storage.savePart(f.target, 1, Buffer.from("ab"), sha1(Buffer.from("ab")))).toEqual(first);
    await expect(f.storage.savePart(f.target, 1, Buffer.from("xy"), sha1(Buffer.from("xy")))).rejects.toThrow("capture_part_conflict");
    expect([...f.objects.values()][0].bytes.toString()).toBe("ab");
  });
  it("refuses an unexpected same-size destination rather than adopting it after a create conflict", async () => {
    const f = fixture(), receipts = await parts(f);
    f.write(f.target.objectPath, Buffer.from("wxyz"));
    await expect(f.storage.finish(f.target, receipts)).rejects.toThrow("capture_firebase_composed_bytes_conflict");
    expect(f.objects.get(f.target.objectPath)?.bytes.toString()).toBe("wxyz");
  });
  it("rejects a changed source generation before composition", async () => {
    const f = fixture(), receipts = await parts(f), name = [...f.objects.keys()][0];
    f.write(name, Buffer.from("xy"));
    await expect(f.storage.finish(f.target, receipts)).rejects.toThrow("capture_firebase_part_changed");
    expect(f.objects.has(f.target.objectPath)).toBe(false);
  });
  it("rejects wrong byte digests, short parts and foreign owner paths before writes", async () => {
    const f = fixture();
    await expect(f.storage.savePart(f.target, 1, Buffer.from("ab"), "a".repeat(40))).rejects.toThrow("part_bytes_invalid");
    await expect(f.storage.savePart(f.target, 1, Buffer.from("a"), sha1(Buffer.from("a")))).rejects.toThrow("part_bytes_invalid");
    await expect(f.storage.savePart({...f.target, ownerUid: "other"}, 1, Buffer.from("ab"), sha1(Buffer.from("ab")))).rejects.toThrow("binding_invalid");
    expect(f.objects.size).toBe(0);
  });
  it("small geometry is create-only and a changed retry cannot replace its original bytes", async () => {
    const f = fixture(), original = Buffer.from("abcd"), first = await f.storage.uploadSmall(f.target, original);
    expect((await f.storage.uploadSmall(f.target, original)).fileId).toBe(first.fileId);
    await expect(f.storage.uploadSmall(f.target, Buffer.from("wxyz"))).rejects.toThrow("source_bytes_conflict");
    await f.storage.deleteFile(f.target, first.fileId);
    expect(f.objects.has(f.target.objectPath)).toBe(false);
    expect((await f.storage.deleteFile(f.target, first.fileId)).alreadyAbsent).toBe(true);
  });
});
